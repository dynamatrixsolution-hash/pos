import { commerceTransaction, resolveBranch } from "@/lib/commerce-transaction";
import { CommerceError } from "@/lib/commerce-policy";
import { NextResponse } from "next/server";
import { getSessionContext, authErrorResponse, roleErrorResponse } from "@/lib/api-helper";
import { z } from "zod";

const noteItemSchema = z.object({
  productId: z.string().uuid(),
  quantity: z.number().positive(),
  price: z.number().nonnegative(),
});

const debitNoteCreateSchema = z.object({
  saleId: z.string().uuid(),
  reason: z.string().min(5, "Reason must be at least 5 characters"),
  items: z.array(noteItemSchema).min(1, "At least one item is required in the debit note"),
});

export async function POST(request: Request) {
  const context = await getSessionContext();
  if (!context) return authErrorResponse();

  if (context.role !== "OWNER" && context.role !== "SUPER_ADMIN" && context.role !== "MANAGER") {
    return roleErrorResponse();
  }

  const headers = request.headers;
  const xForwardedFor = headers.get("x-forwarded-for");
  const ipAddress = xForwardedFor ? xForwardedFor.split(",")[0].trim() : (headers.get("x-real-ip") || "127.0.0.1");
  const deviceInfo = headers.get("user-agent") || "Unknown Device";

  try {
    const body = await request.json();
    const result = debitNoteCreateSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: "Validation failed", details: result.error.format() },
        { status: 400 }
      );
    }

    const { saleId, reason, items } = result.data;

    const debitNoteResult = await commerceTransaction(request, context, "DEBIT_NOTE", body, async (tx) => {
      // 1. Fetch sale
      const sale = await tx.sale.findUnique({
        where: { id: saleId },
        include: { saleItems: true },
      });

      if (!sale) throw new Error("Sale invoice not found");
      if (sale.businessId !== context.businessId) throw new CommerceError("Unauthorized tenant access", 403);
      await resolveBranch(tx, context, sale.branchId);
      if (!sale.isActive) throw new CommerceError("Invoice is inactive");

      // 2. Generate unique Debit Note Number
      const count = await tx.debitNote.count({
        where: { businessId: context.businessId },
      });
      const noteNumber = `DN-${sale.invoiceNumber.split("-")[1] || "REF"}-${String(count + 1).padStart(5, "0")}`;

      // 3. Process items and calculate totals
      let subtotal = 0;
      let tax = 0;
      const debitNoteItemsData = [];

      const business = await tx.business.findUnique({
        where: { id: context.businessId },
        select: { settings: true },
      });
      const settings = (business?.settings as any) || {};
      const enableVat = settings.enableVat !== false;
      const defaultVatRate = settings.vatPercentage || 13.0;

      for (const item of items) {
        const product = await tx.product.findFirst({
          where: { id: item.productId, businessId: context.businessId, deletedAt: null },
        });
        if (!product) throw new Error("Product not found");

        const lineTotal = item.quantity * item.price;
        subtotal += lineTotal;

        const lineTax = product.isVatItem && enableVat ? lineTotal * (defaultVatRate / 100) : 0;
        tax += lineTax;

        debitNoteItemsData.push({
          productId: item.productId,
          quantity: item.quantity,
          price: item.price,
          total: lineTotal,
        });

        // Deduct branch stock levels (Since it is additional sales items)
        const stock = await tx.productStock.findUnique({
          where: { productId_branchId: { productId: item.productId, branchId: sale.branchId } },
        });
        if (!stock || stock.quantity < item.quantity) {
          throw new Error(`Insufficient stock for product "${product.name}". Available: ${stock?.quantity || 0}, Requested: ${item.quantity}`);
        }

        await tx.productStock.update({
          where: { id: stock.id },
          data: { quantity: stock.quantity - item.quantity },
        });
      }

      const total = subtotal + tax;

      // 4. Create Debit Note record
      const dn = await tx.debitNote.create({
        data: {
          businessId: context.businessId,
          branchId: sale.branchId,
          noteNumber,
          saleId: sale.id,
          reason,
          subtotal,
          discount: 0,
          tax,
          total,
          createdById: context.userId,
          items: {
            createMany: {
              data: debitNoteItemsData,
            },
          },
        },
      });

      // 5. Update Customer receivables balance (Debiting customer / increasing balance owed)
      if (sale.customerId) {
        const customer = await tx.customer.findFirst({
          where: { id: sale.customerId, businessId: context.businessId },
        });

        if (customer) {
          const newCustomerBalance = customer.balance + total;

          await tx.customer.update({
            where: { id: customer.id },
            data: { balance: newCustomerBalance },
          });

          await tx.customerLedger.create({
            data: {
              customerId: customer.id,
              type: "SALE",
              reference: noteNumber,
              debit: total,
              credit: 0.0,
              balance: newCustomerBalance,
              description: `Debit Note debit charge against invoice #${sale.invoiceNumber}. Reason: ${reason}`,
            },
          });
        }
      }

      // 6. Write Audit Log
      await tx.auditLog.create({
        data: {
          businessId: context.businessId,
          userId: context.userId,
          role: context.role,
          branchId: sale.branchId,
          action: "CREATE_DEBIT_NOTE",
          module: "SALE",
          details: `Created Debit Note ${noteNumber} referencing invoice ${sale.invoiceNumber}. Total debit: Rs. ${total.toFixed(2)}. Reason: ${reason}`,
          newValue: JSON.parse(JSON.stringify(dn)),
          ipAddress,
          deviceInfo,
        },
      });

      return dn;
    });

    return NextResponse.json(debitNoteResult, { status: 201 });
  } catch (error: any) {
    console.error("POST debit-note error:", error.message || error);
    return NextResponse.json({ error: error.message || "Failed to create Debit Note" }, { status: 400 });
  }
}
