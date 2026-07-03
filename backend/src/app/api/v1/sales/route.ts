import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionContext, authErrorResponse } from "@/lib/api-helper";
import { z } from "zod";

const saleItemSchema = z.object({
  productId: z.string().uuid(),
  batchNumber: z.string().optional().nullable(),
  quantity: z.number().positive(),
  price: z.number().nonnegative(),
  discount: z.number().nonnegative().default(0),
  tax: z.number().nonnegative().default(0),
});

const splitPaymentSchema = z.object({
  method: z.enum(["CASH", "CARD", "QR", "BANK_TRANSFER", "CREDIT"]),
  amount: z.number().positive(),
});

const saleCreateSchema = z.object({
  customerId: z.string().uuid().optional().nullable(),
  branchId: z.string().uuid(),
  items: z.array(saleItemSchema).min(1, "At least one item is required in the checkout cart"),
  subtotal: z.number().nonnegative(),
  discount: z.number().nonnegative().default(0), // overall invoice discount
  tax: z.number().nonnegative().default(0), // overall invoice tax
  total: z.number().nonnegative(),
  paidAmount: z.number().nonnegative().default(0),
  paymentMethod: z.enum(["CASH", "CARD", "QR", "BANK_TRANSFER", "CREDIT"]).default("CASH"),
  paymentStatus: z.enum(["PAID", "PARTIAL", "UNPAID"]).default("PAID"),
  status: z.enum(["COMPLETED", "DRAFT", "ON_HOLD"]).default("COMPLETED"),
  notes: z.string().optional().nullable(),
  splitPayments: z.array(splitPaymentSchema).optional(),
});

export async function GET(request: Request) {
  const context = await getSessionContext();
  if (!context) return authErrorResponse();

  const { searchParams } = new URL(request.url);
  const customerId = searchParams.get("customerId");
  const branchId = searchParams.get("branchId") || context.branchId;
  const status = searchParams.get("status");
  const paymentStatus = searchParams.get("paymentStatus");
  const page = parseInt(searchParams.get("page") || "1", 10);
  const limit = parseInt(searchParams.get("limit") || "20", 10);
  const skip = (page - 1) * limit;

  try {
    const where: any = {
      businessId: context.businessId,
      deletedAt: null,
    };

    if (customerId) where.customerId = customerId;
    if (branchId) where.branchId = branchId;
    if (status) where.status = status;
    if (paymentStatus) where.paymentStatus = paymentStatus;

    // Cashier role data isolation - view only assigned branch and cashier's own sales
    if (context.role === "CASHIER") {
      where.userId = context.userId;
      if (context.branchId) {
        where.branchId = context.branchId;
      }
    }

    const [sales, totalCount] = await Promise.all([
      db.sale.findMany({
        where,
        include: {
          customer: true,
          user: { select: { name: true, email: true } },
          payments: true,
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      db.sale.count({ where }),
    ]);

    return NextResponse.json({
      sales,
      pagination: {
        totalItems: totalCount,
        totalPages: Math.ceil(totalCount / limit),
        currentPage: page,
        limit,
      },
    });
  } catch (error: any) {
    console.error("GET sales error:", error);
    return NextResponse.json({ error: "Failed to fetch sales" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const context = await getSessionContext();
  if (!context) return authErrorResponse();

  const headers = request.headers;
  const xForwardedFor = headers.get("x-forwarded-for");
  const ipAddress = xForwardedFor ? xForwardedFor.split(",")[0].trim() : (headers.get("x-real-ip") || "127.0.0.1");
  const deviceInfo = headers.get("user-agent") || "Unknown Device";

  try {
    const body = await request.json();
    const result = saleCreateSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: "Validation failed", details: result.error.format() },
        { status: 400 }
      );
    }

    const payload = result.data;

    // Execute the complete sale pipeline in a single database transaction
    const saleResult = await db.$transaction(async (tx) => {
      // 1. Fetch Business Settings to retrieve custom prefix
      const business = await tx.business.findUnique({
        where: { id: context.businessId },
        select: { settings: true },
      });
      const settings = (business?.settings as any) || {};
      const salesPrefix = settings.salesPrefix || settings.invoicePrefix || "INV";

      // 2. Generate Unique Invoice Number
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, "0");
      const day = String(now.getDate()).padStart(2, "0");
      const dateStr = `${year}${month}${day}`;

      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
      const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

      const countToday = await tx.sale.count({
        where: {
          businessId: context.businessId,
          createdAt: {
            gte: startOfDay,
            lte: endOfDay,
          },
        },
      });

      let sequence = countToday + 1;
      let invoiceNumber = `${salesPrefix}-${dateStr}-${String(sequence).padStart(4, "0")}`;

      // Ensure zero invoice number collision
      let existingSale = await tx.sale.findUnique({ where: { invoiceNumber } });
      while (existingSale) {
        sequence++;
        invoiceNumber = `${salesPrefix}-${dateStr}-${String(sequence).padStart(4, "0")}`;
        existingSale = await tx.sale.findUnique({ where: { invoiceNumber } });
      }

      // 3. Process Stock Deductions & Alerts
      const saleItemsData = [];
      const lowStockAlerts = [];

      for (const item of payload.items) {
        // Fetch active product
        const product = await tx.product.findFirst({
          where: { id: item.productId, businessId: context.businessId, deletedAt: null },
        });

        if (!product) {
          throw new Error(`Product not found: ${item.productId}`);
        }

        // Deduct Branch-wise Stock levels
        const stock = await tx.productStock.findUnique({
          where: { productId_branchId: { productId: item.productId, branchId: payload.branchId } },
        });

        if (!stock || stock.quantity < item.quantity) {
          throw new Error(`Insufficient stock for product "${product.name}". Available: ${stock?.quantity || 0}, Requested: ${item.quantity}`);
        }

        const newStockQty = stock.quantity - item.quantity;
        await tx.productStock.update({
          where: { id: stock.id },
          data: { quantity: newStockQty },
        });

        // Trigger stock alert if under limit
        if (newStockQty <= product.alertQuantity) {
          lowStockAlerts.push({
            title: "Low Stock Alert",
            message: `Product "${product.name}" is low in stock (${newStockQty} ${product.unitId || "pcs"} remaining in active branch).`,
            type: "STOCK",
            businessId: context.businessId,
          });
        }

        // Handle batch tracking deductions if applicable
        if (product.batchTracking && item.batchNumber) {
          const batch = await tx.batch.findFirst({
            where: {
              productId: item.productId,
              branchId: payload.branchId,
              batchNumber: item.batchNumber,
              deletedAt: null,
            },
          });

          if (!batch || batch.quantity < item.quantity) {
            throw new Error(`Insufficient batch stock for product "${product.name}" in batch "${item.batchNumber}".`);
          }

          await tx.batch.update({
            where: { id: batch.id },
            data: { quantity: batch.quantity - item.quantity },
          });
        }

        // Prepare item details to write
        saleItemsData.push({
          productId: item.productId,
          batchNumber: item.batchNumber,
          quantity: item.quantity,
          costPrice: product.costPrice, // Store current cost price for profit margins
          price: item.price,
          discount: item.discount,
          tax: item.tax,
          total: item.quantity * item.price,
        });
      }

      // 4. Create Sale record
      const sale = await tx.sale.create({
        data: {
          businessId: context.businessId,
          branchId: payload.branchId,
          customerId: payload.customerId,
          userId: context.userId,
          invoiceNumber,
          status: payload.status,
          subtotal: payload.subtotal,
          discount: payload.discount,
          tax: payload.tax,
          total: payload.total,
          paidAmount: payload.paidAmount,
          paymentStatus: payload.paymentStatus,
          notes: payload.notes,
          saleItems: {
            createMany: {
              data: saleItemsData,
            },
          },
        },
        include: {
          saleItems: true,
        },
      });

      // 5. Create Ledger and Balance entries for Customers if transaction is credit
      if (payload.customerId) {
        const customer = await tx.customer.findFirst({
          where: { id: payload.customerId, businessId: context.businessId },
        });

        if (!customer) throw new Error("Customer not found");

        const unpaidAmt = payload.total - payload.paidAmount;

        if (unpaidAmt > 0) {
          // Verify credit limits
          if (customer.customerType === "WHOLESALE" && customer.balance + unpaidAmt > customer.creditLimit) {
            throw new Error(`Transaction violates customer credit limit. Limit: $${customer.creditLimit}, Current balance: $${customer.balance}, Added charge: $${unpaidAmt}`);
          }

          const newCustomerBalance = customer.balance + unpaidAmt;

          // Update customer balance
          await tx.customer.update({
            where: { id: customer.id },
            data: { balance: newCustomerBalance },
          });

          // Write ledger transaction
          await tx.customerLedger.create({
            data: {
              customerId: customer.id,
              type: "SALE",
              reference: invoiceNumber,
              debit: unpaidAmt,
              credit: 0.0,
              balance: newCustomerBalance,
              description: `Sales billing invoice credit charge. Status: ${payload.paymentStatus}`,
            },
          });
        }
      }

      // 6. Create Payment records (supporting split payments or single method payment)
      if (payload.splitPayments && payload.splitPayments.length > 0) {
        for (const splitPay of payload.splitPayments) {
          if (splitPay.amount > 0) {
            await tx.payment.create({
              data: {
                businessId: context.businessId,
                saleId: sale.id,
                amount: splitPay.amount,
                method: splitPay.method,
                reference: `POS Split Pay against ${invoiceNumber}`,
              },
            });
          }
        }
      } else if (payload.paidAmount > 0) {
        await tx.payment.create({
          data: {
            businessId: context.businessId,
            saleId: sale.id,
            amount: payload.paidAmount,
            method: payload.paymentMethod,
            reference: `POS Pay against ${invoiceNumber}`,
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
          module: "SALE",
          details: `Created invoice ${invoiceNumber}. Total: $${payload.total}, Paid: $${payload.paidAmount}`,
          newValue: JSON.parse(JSON.stringify(sale)),
          ipAddress,
          deviceInfo,
        },
      });

      // 8. Write Notifications
      if (lowStockAlerts.length > 0) {
        await tx.notification.createMany({
          data: lowStockAlerts,
        });
      }

      return sale;
    }, { maxWait: 10000, timeout: 30000 });

    return NextResponse.json(saleResult, { status: 201 });
  } catch (error: any) {
    console.error("POST sale error:", error.message || error);
    let errorMessage = error.message || "Failed to process sale";
    if (errorMessage.includes("Unique constraint failed") || errorMessage.includes("invoiceNumber")) {
      errorMessage = "Invoice number collision detected. Please try completing checkout again.";
    } else if (errorMessage.includes("PrismaClient") || errorMessage.includes("invocation")) {
      errorMessage = "Transaction processing error. Please verify order items and try again.";
    }
    return NextResponse.json({ error: errorMessage }, { status: 400 });
  }
}
