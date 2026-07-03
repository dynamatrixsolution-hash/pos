import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionContext, authErrorResponse, roleErrorResponse } from "@/lib/api-helper";
import { z } from "zod";

const purchaseItemSchema = z.object({
  productId: z.string().uuid(),
  batchNumber: z.string().optional().nullable(),
  expiryDate: z.string().optional().nullable(), // ISO string date
  quantity: z.number().positive(),
  price: z.number().nonnegative(), // cost price of product for this purchase
});

const purchaseCreateSchema = z.object({
  supplierId: z.string().uuid(),
  branchId: z.string().uuid(),
  items: z.array(purchaseItemSchema).min(1, "At least one item is required in the purchase order"),
  subtotal: z.number().nonnegative(),
  discount: z.number().nonnegative().default(0),
  tax: z.number().nonnegative().default(0),
  total: z.number().nonnegative(),
  paidAmount: z.number().nonnegative().default(0),
  paymentMethod: z.enum(["CASH", "CARD", "QR", "BANK_TRANSFER", "CREDIT"]).default("CASH"),
  paymentStatus: z.enum(["PAID", "PARTIAL", "UNPAID"]).default("PAID"),
  notes: z.string().optional().nullable(),
});

export async function GET(request: Request) {
  const context = await getSessionContext();
  if (!context) return authErrorResponse();

  const { searchParams } = new URL(request.url);
  const supplierId = searchParams.get("supplierId");
  const branchId = searchParams.get("branchId") || context.branchId;
  const page = parseInt(searchParams.get("page") || "1", 10);
  const limit = parseInt(searchParams.get("limit") || "20", 10);
  const skip = (page - 1) * limit;

  try {
    const where: any = {
      businessId: context.businessId,
      deletedAt: null,
    };

    if (supplierId) where.supplierId = supplierId;
    if (branchId) where.branchId = branchId;

    const [purchases, totalCount] = await Promise.all([
      db.purchase.findMany({
        where,
        include: {
          supplier: true,
          user: { select: { name: true, email: true } },
          payments: true,
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      db.purchase.count({ where }),
    ]);

    return NextResponse.json({
      purchases,
      pagination: {
        totalItems: totalCount,
        totalPages: Math.ceil(totalCount / limit),
        currentPage: page,
        limit,
      },
    });
  } catch (error: any) {
    console.error("GET purchases error:", error);
    return NextResponse.json({ error: "Failed to fetch purchases" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const context = await getSessionContext();
  if (!context) return authErrorResponse();

  const headers = request.headers;
  const xForwardedFor = headers.get("x-forwarded-for");
  const ipAddress = xForwardedFor ? xForwardedFor.split(",")[0].trim() : (headers.get("x-real-ip") || "127.0.0.1");
  const deviceInfo = headers.get("user-agent") || "Unknown Device";

  // Block Cashiers from creating/modifying purchases
  if (context.role === "CASHIER") {
    return roleErrorResponse();
  }

  try {
    const body = await request.json();
    const result = purchaseCreateSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: "Validation failed", details: result.error.format() },
        { status: 400 }
      );
    }

    const payload = result.data;

    // Run the complete purchase intake pipeline inside a transaction
    const purchaseResult = await db.$transaction(async (tx) => {
      // 1. Fetch Business Settings to retrieve custom prefix
      const business = await tx.business.findUnique({
        where: { id: context.businessId },
        select: { settings: true },
      });
      const settings = (business?.settings as any) || {};
      const purchasePrefix = settings.purchasePrefix || "PO";

      // 2. Generate unique PO number
      const today = new Date();
      const year = today.getFullYear();
      const month = String(today.getMonth() + 1).padStart(2, "0");
      const day = String(today.getDate()).padStart(2, "0");
      const dateStr = `${year}${month}${day}`;

      const countToday = await tx.purchase.count({
        where: {
          businessId: context.businessId,
          createdAt: {
            gte: new Date(today.setHours(0, 0, 0, 0)),
            lte: new Date(today.setHours(23, 59, 59, 999)),
          },
        },
      });

      const purchaseNumber = `${purchasePrefix}-${dateStr}-${String(countToday + 1).padStart(4, "0")}`;

      // 3. Process stock additions
      const purchaseItemsData = [];

      for (const item of payload.items) {
        // Verify product
        const product = await tx.product.findFirst({
          where: { id: item.productId, businessId: context.businessId, deletedAt: null },
        });

        if (!product) {
          throw new Error(`Product not found: ${item.productId}`);
        }

        // Increment Branch-wise Stock levels
        const stock = await tx.productStock.findUnique({
          where: { productId_branchId: { productId: item.productId, branchId: payload.branchId } },
        });

        if (stock) {
          await tx.productStock.update({
            where: { id: stock.id },
            data: { quantity: stock.quantity + item.quantity },
          });
        } else {
          await tx.productStock.create({
            data: {
              productId: item.productId,
              branchId: payload.branchId,
              quantity: item.quantity,
            },
          });
        }

        // Handle batch creation and tracking
        if (product.batchTracking && item.batchNumber) {
          const parsedExpiry = item.expiryDate ? new Date(item.expiryDate) : null;

          const batch = await tx.batch.findFirst({
            where: {
              productId: item.productId,
              branchId: payload.branchId,
              batchNumber: item.batchNumber,
              deletedAt: null,
            },
          });

          if (batch) {
            // Add to batch quantity and update cost price
            await tx.batch.update({
              where: { id: batch.id },
              data: {
                quantity: batch.quantity + item.quantity,
                costPrice: item.price, // update to latest cost price
              },
            });
          } else {
            // Create a brand new batch record
            await tx.batch.create({
              data: {
                productId: item.productId,
                branchId: payload.branchId,
                batchNumber: item.batchNumber,
                quantity: item.quantity,
                costPrice: item.price,
                expiryDate: parsedExpiry,
              },
            });
          }
        }

        // Also update product's general costPrice to keep pricing accurate
        await tx.product.update({
          where: { id: product.id },
          data: { costPrice: item.price },
        });

        // Store item data
        purchaseItemsData.push({
          productId: item.productId,
          batchNumber: item.batchNumber,
          expiryDate: item.expiryDate ? new Date(item.expiryDate) : null,
          quantity: item.quantity,
          price: item.price,
          total: item.quantity * item.price,
        });
      }

      // 4. Create Purchase record
      const purchase = await tx.purchase.create({
        data: {
          businessId: context.businessId,
          branchId: payload.branchId,
          supplierId: payload.supplierId,
          userId: context.userId,
          purchaseNumber,
          status: "RECEIVED",
          subtotal: payload.subtotal,
          discount: payload.discount,
          tax: payload.tax,
          total: payload.total,
          paidAmount: payload.paidAmount,
          paymentStatus: payload.paymentStatus,
          notes: payload.notes,
          purchaseItems: {
            createMany: {
              data: purchaseItemsData,
            },
          },
        },
        include: {
          purchaseItems: true,
        },
      });

      // 5. Update Supplier balance and ledger if credit purchase
      const supplier = await tx.supplier.findFirst({
        where: { id: payload.supplierId, businessId: context.businessId },
      });

      if (!supplier) throw new Error("Supplier not found");

      const unpaidAmt = payload.total - payload.paidAmount;

      if (unpaidAmt > 0) {
        const newSupplierBalance = supplier.balance + unpaidAmt;

        // Update supplier balance
        await tx.supplier.update({
          where: { id: supplier.id },
          data: { balance: newSupplierBalance },
        });

        // Write supplier ledger entry
        await tx.supplierLedger.create({
          data: {
            supplierId: supplier.id,
            type: "PURCHASE",
            reference: purchaseNumber,
            debit: 0.0,
            credit: unpaidAmt, // Credit represents what we owe supplier
            balance: newSupplierBalance,
            description: `Purchase order inventory credit charge.`,
          },
        });
      }

      // 6. Create Payment record if cash paid
      if (payload.paidAmount > 0) {
        await tx.payment.create({
          data: {
            businessId: context.businessId,
            purchaseId: purchase.id,
            amount: payload.paidAmount,
            method: payload.paymentMethod,
            reference: `PO Pay against ${purchaseNumber}`,
          },
        });
      }

      // 7. Write Audit Log
      await tx.auditLog.create({
        data: {
          businessId: context.businessId,
          userId: context.userId,
          role: context.role,
          branchId: payload.branchId,
          warehouseId: payload.branchId,
          action: "CREATE",
          module: "PURCHASE",
          details: `Processed purchase invoice ${purchaseNumber}. Total: $${payload.total}, Paid: $${payload.paidAmount}`,
          newValue: JSON.parse(JSON.stringify(purchase)),
          ipAddress,
          deviceInfo,
        },
      });

      return purchase;
    }, { maxWait: 10000, timeout: 30000 });

    return NextResponse.json(purchaseResult, { status: 201 });
  } catch (error: any) {
    console.error("POST purchase error:", error.message);
    return NextResponse.json({ error: error.message || "Failed to process purchase" }, { status: 500 });
  }
}
