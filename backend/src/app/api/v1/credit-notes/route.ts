import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionContext, authErrorResponse, roleErrorResponse } from "@/lib/api-helper";
import { CbmsService } from "@/lib/cbms-service";
import { z } from "zod";

const noteItemSchema = z.object({
  productId: z.string().uuid(),
  quantity: z.number().positive(),
  price: z.number().nonnegative(),
});

const creditNoteCreateSchema = z.object({
  saleId: z.string().uuid(),
  reason: z.string().min(5, "Reason must be at least 5 characters"),
  items: z.array(noteItemSchema).min(1, "At least one item is required in the credit note"),
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
    const result = creditNoteCreateSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: "Validation failed", details: result.error.format() },
        { status: 400 }
      );
    }

    const { saleId, reason, items } = result.data;

    const creditNoteResult = await db.$transaction(async (tx) => {
      // 1. Fetch sale
      const sale = await tx.sale.findUnique({
        where: { id: saleId },
        include: { saleItems: true },
      });

      if (!sale) throw new Error("Sale invoice not found");
      if (sale.businessId !== context.businessId) throw new Error("Unauthorized tenant access");

      // 2. Generate unique Credit Note Number
      const count = await tx.creditNote.count({
        where: { businessId: context.businessId },
      });
      const noteNumber = `CN-${sale.invoiceNumber.split("-")[1] || "REF"}-${String(count + 1).padStart(5, "0")}`;

      // 3. Process items and calculate totals on the server
      let subtotal = 0;
      let tax = 0;
      const creditNoteItemsData = [];

      const business = await tx.business.findUnique({
        where: { id: context.businessId },
        select: { settings: true },
      });
      const settings = (business?.settings as any) || {};
      const enableVat = settings.enableVat !== false;
      const defaultVatRate = settings.vatPercentage || 13.0;

      for (const item of items) {
        // Verify item was in the original sale
        const originalItem = sale.saleItems.find((si) => si.productId === item.productId);
        if (!originalItem) {
          throw new Error(`Product ${item.productId} was not part of the original sale.`);
        }
        if (item.quantity > originalItem.quantity) {
          throw new Error(`Credit quantity exceeds original sold quantity for product ${item.productId}.`);
        }

        const product = await tx.product.findFirst({
          where: { id: item.productId, businessId: context.businessId, deletedAt: null },
        });
        if (!product) throw new Error("Product not found");

        const lineTotal = item.quantity * item.price;
        subtotal += lineTotal;

        const lineTax = product.isVatItem && enableVat ? lineTotal * (defaultVatRate / 100) : 0;
        tax += lineTax;

        creditNoteItemsData.push({
          productId: item.productId,
          quantity: item.quantity,
          price: item.price,
          total: lineTotal,
        });

        // Add returned stock back to branch inventory
        const stock = await tx.productStock.findUnique({
          where: { productId_branchId: { productId: item.productId, branchId: sale.branchId } },
        });
        if (stock) {
          await tx.productStock.update({
            where: { id: stock.id },
            data: { quantity: stock.quantity + item.quantity },
          });
        }
      }

      const total = subtotal + tax;

      // 4. Create Credit Note record
      const cn = await tx.creditNote.create({
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
              data: creditNoteItemsData,
            },
          },
        },
      });

      // 5. Update Customer Ledger and Balance (Crediting customer / reducing receivables)
      if (sale.customerId) {
        const customer = await tx.customer.findFirst({
          where: { id: sale.customerId, businessId: context.businessId },
        });

        if (customer) {
          const newCustomerBalance = Math.max(0, customer.balance - total);

          await tx.customer.update({
            where: { id: customer.id },
            data: { balance: newCustomerBalance },
          });

          await tx.customerLedger.create({
            data: {
              customerId: customer.id,
              type: "RETURN",
              reference: noteNumber,
              debit: 0.0,
              credit: total,
              balance: newCustomerBalance,
              description: `Credit Note credit adjustment against invoice #${sale.invoiceNumber}. Reason: ${reason}`,
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
          action: "CREATE_CREDIT_NOTE",
          module: "SALE",
          details: `Created Credit Note ${noteNumber} referencing invoice ${sale.invoiceNumber}. Total refund: Rs. ${total.toFixed(2)}. Reason: ${reason}`,
          newValue: JSON.parse(JSON.stringify(cn)),
          ipAddress,
          deviceInfo,
        },
      });

      return cn;
    }, { maxWait: 10000, timeout: 30000 });

    // 7. Fire off async CBMS submission
    CbmsService.submitCreditNote(creditNoteResult.id).catch((e) => {
      console.error("Async Credit Note submit failed:", e);
    });

    return NextResponse.json(creditNoteResult, { status: 201 });
  } catch (error: any) {
    console.error("POST credit-note error:", error.message || error);
    return NextResponse.json({ error: error.message || "Failed to create Credit Note" }, { status: 400 });
  }
}
