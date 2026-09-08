import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionContext, authErrorResponse, getBusinessLimits } from "@/lib/api-helper";
import { z } from "zod";
import { CbmsService } from "@/lib/cbms-service";

const normalizePaymentMethod = (val: any) => {
  if (!val) return "CASH";
  const str = String(val).toUpperCase().replace(/\s+/g, "_").replace(/-/g, "_");
  if (str === "FONEPAY") return "FONE_PAY";
  if (str === "NEPALPAY") return "NEPAL_PAY";
  const validMethods = ["CASH", "CARD", "FONE_PAY", "ESEWA", "KHALTI", "NEPAL_PAY", "CREDIT"];
  return validMethods.includes(str) ? str : "CASH";
};

const saleItemSchema = z.object({
  productId: z.string().min(1, "Product ID is required"),
  batchNumber: z.string().optional().nullable(),
  quantity: z.preprocess((v) => Math.max(0.001, Number(v) || 1), z.number().positive()),
  price: z.preprocess((v) => Math.max(0, Number(v) || 0), z.number().nonnegative()),
  discount: z.preprocess((v) => Math.max(0, Number(v) || 0), z.number().nonnegative().default(0)),
  tax: z.preprocess((v) => Math.max(0, Number(v) || 0), z.number().nonnegative().default(0)),
});

const splitPaymentSchema = z.object({
  method: z.preprocess(normalizePaymentMethod, z.enum(["CASH", "CARD", "FONE_PAY", "ESEWA", "KHALTI", "NEPAL_PAY", "CREDIT"])),
  amount: z.preprocess((v) => Math.max(0, Number(v) || 0), z.number().positive()),
});

const saleCreateSchema = z.object({
  customerId: z.preprocess((val) => {
    if (!val || val === "" || val === "WALK_IN" || val === "walk_in" || val === "null" || val === "undefined") return null;
    return val;
  }, z.string().nullable().optional()),
  branchId: z.preprocess((val) => {
    if (!val || val === "" || val === "null" || val === "undefined") return undefined;
    return val;
  }, z.string().optional().nullable()),
  items: z.array(saleItemSchema).min(1, "At least one item is required in the checkout cart"),
  subtotal: z.preprocess((v) => Math.max(0, Number(v) || 0), z.number().nonnegative()),
  discount: z.preprocess((v) => Math.max(0, Number(v) || 0), z.number().nonnegative().default(0)),
  tax: z.preprocess((v) => Math.max(0, Number(v) || 0), z.number().nonnegative().default(0)),
  total: z.preprocess((v) => Math.max(0, Number(v) || 0), z.number().nonnegative()),
  paidAmount: z.preprocess((v) => Math.max(0, Number(v) || 0), z.number().nonnegative().default(0)),
  paymentMethod: z.preprocess(normalizePaymentMethod, z.enum(["CASH", "CARD", "FONE_PAY", "ESEWA", "KHALTI", "NEPAL_PAY", "CREDIT"])).default("CASH"),
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
          saleItems: {
            include: {
              product: true,
            },
          },
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
      console.error("Sale validation error details:", JSON.stringify(result.error.format()));
      const errorMsg = "Validation failed: " + result.error.issues.map((e: any) => `${e.path.join(".")}: ${e.message}`).join("; ");
      return NextResponse.json(
        { error: errorMsg, details: result.error.format() },
        { status: 400 }
      );
    }

    const payload = result.data;

    // Resolve active branch context safely
    let effectiveBranchId = payload.branchId || context.branchId;
    if (!effectiveBranchId) {
      let defaultBranch = await db.branch.findFirst({
        where: { businessId: context.businessId, deletedAt: null },
        orderBy: { createdAt: "asc" },
      });
      if (!defaultBranch) {
        defaultBranch = await db.branch.create({
          data: {
            businessId: context.businessId,
            name: "Main Branch",
            address: "Head Office",
            isMain: true,
          },
        });
      }
      effectiveBranchId = defaultBranch.id;
    }

    // Resolve customer safely
    let resolvedCustomerId: string | null = null;
    if (payload.customerId) {
      const cust = await db.customer.findFirst({
        where: { id: payload.customerId, businessId: context.businessId, deletedAt: null },
      });
      resolvedCustomerId = cust ? cust.id : null;
    }

    const hasCreditPayment = payload.paymentMethod === "CREDIT" || 
      (payload.splitPayments && payload.splitPayments.some(sp => sp.method === "CREDIT"));

    if (hasCreditPayment && !resolvedCustomerId) {
      return NextResponse.json(
        { error: "A registered customer must be selected to complete a credit transaction." },
        { status: 400 }
      );
    }

    // Check monthly transaction limit
    const limits = await getBusinessLimits(context.businessId);
    if (limits) {
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
      
      const monthlySalesCount = await db.sale.count({
        where: {
          businessId: context.businessId,
          createdAt: {
            gte: startOfMonth,
            lte: endOfMonth,
          },
        },
      });

      if (monthlySalesCount >= limits.transactions) {
        return NextResponse.json(
          { error: `Monthly transaction limit reached. Your subscription allows a maximum of ${limits.transactions} transactions per month. Please upgrade your plan.` },
          { status: 400 }
        );
      }
    }

    // Execute the complete sale pipeline in a single database transaction
    const saleResult = await db.$transaction(async (tx) => {
      // 1. Fetch Business Settings to retrieve custom prefix
      const business = await tx.business.findUnique({
        where: { id: context.businessId },
        select: { settings: true },
      });
      const settings = (business?.settings as any) || {};
      const salesPrefix = settings.salesPrefix || settings.invoicePrefix || "INV";

      // 2. Fetch Active Fiscal Year with automatic fallback/seeding
      let activeFiscalYear = await tx.fiscalYear.findFirst({
        where: { businessId: context.businessId, isActive: true },
      });
      if (!activeFiscalYear) {
        activeFiscalYear = await tx.fiscalYear.findFirst({
          where: { businessId: context.businessId },
          orderBy: { createdAt: "desc" },
        });
        if (activeFiscalYear) {
          await tx.fiscalYear.update({
            where: { id: activeFiscalYear.id },
            data: { isActive: true },
          });
        } else {
          const currentYear = new Date().getFullYear();
          activeFiscalYear = await tx.fiscalYear.create({
            data: {
              businessId: context.businessId,
              name: `${currentYear}/${(currentYear + 1).toString().slice(-2)}`,
              startDate: new Date(currentYear, 0, 1),
              endDate: new Date(currentYear, 11, 31, 23, 59, 59),
              isActive: true,
            },
          });
        }
      }

      // 3. Concurrency-Safe Sequential Invoice Numbering
      let sequenceRecord;
      try {
        sequenceRecord = await tx.fiscalYearInvoiceSequence.update({
          where: {
            businessId_branchId_fiscalYearId: {
              businessId: context.businessId,
              branchId: effectiveBranchId,
              fiscalYearId: activeFiscalYear.id,
            },
          },
          data: { nextValue: { increment: 1 } },
        });
      } catch (e) {
        sequenceRecord = await tx.fiscalYearInvoiceSequence.upsert({
          where: {
            businessId_branchId_fiscalYearId: {
              businessId: context.businessId,
              branchId: effectiveBranchId,
              fiscalYearId: activeFiscalYear.id,
            },
          },
          update: { nextValue: { increment: 1 } },
          create: {
            businessId: context.businessId,
            branchId: effectiveBranchId,
            fiscalYearId: activeFiscalYear.id,
            nextValue: 2,
          },
        });
      }
      const sequenceValue = sequenceRecord.nextValue - 1;
      const cleanFyName = activeFiscalYear.name.replace("/", "");
      const invoiceNumber = `${salesPrefix}-${cleanFyName}-${String(sequenceValue).padStart(6, "0")}`;

      // 4. Server-Side Calculations and Stock Deductions
      let calculatedSubtotal = 0;
      let lineDiscountsSum = 0;
      let taxableAmountSum = 0;
      const saleItemsData = [];
      const lowStockAlerts = [];

      const enableVat = settings.enableVat !== false;
      const defaultVatRate = settings.vatPercentage || 13.0;

      for (const item of payload.items) {
        const product = await tx.product.findFirst({
          where: { id: item.productId, businessId: context.businessId, deletedAt: null },
        });

        if (!product) {
          throw new Error(`Product not found: ${item.productId}`);
        }

        const customer = resolvedCustomerId ? await tx.customer.findFirst({ where: { id: resolvedCustomerId } }) : null;
        const isWholesale = customer?.customerType === "WHOLESALE";
        const basePrice = isWholesale ? product.wholesalePrice : product.sellingPrice;

        const itemQty = item.quantity;
        const itemPrice = basePrice;
        const itemLineDiscount = (item.discount || 0) * itemQty;

        calculatedSubtotal += itemPrice * itemQty;
        lineDiscountsSum += itemLineDiscount;

        const lineSubtotalAfterDiscount = (itemPrice * itemQty) - itemLineDiscount;
        if (product.isVatItem) {
          taxableAmountSum += lineSubtotalAfterDiscount;
        }

        // Deduct Branch-wise Stock levels with auto-initialization fallback
        let stock = await tx.productStock.findUnique({
          where: { productId_branchId: { productId: item.productId, branchId: effectiveBranchId } },
        });

        if (!stock) {
          stock = await tx.productStock.create({
            data: {
              productId: item.productId,
              branchId: effectiveBranchId,
              quantity: 0,
            },
          });
        }

        const allowNegativeStock = settings.allowNegativeStock !== false && settings.preventNegativeStock !== true;
        if (!allowNegativeStock && stock.quantity < item.quantity) {
          throw new Error(`Insufficient stock for product "${product.name}". Available: ${stock.quantity}, Requested: ${item.quantity}`);
        }

        const newStockQty = stock.quantity - item.quantity;
        await tx.productStock.update({
          where: { id: stock.id },
          data: { quantity: newStockQty },
        });

        if (newStockQty <= product.alertQuantity) {
          lowStockAlerts.push({
            title: "Low Stock Alert",
            message: `Product "${product.name}" is low in stock (${newStockQty} remaining in active branch).`,
            type: "STOCK",
            businessId: context.businessId,
          });
        }

        // Handle batch tracking
        if (product.batchTracking && item.batchNumber) {
          const batch = await tx.batch.findFirst({
            where: {
              productId: item.productId,
              branchId: effectiveBranchId,
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

        saleItemsData.push({
          productId: item.productId,
          batchNumber: item.batchNumber,
          quantity: item.quantity,
          costPrice: product.costPrice,
          price: itemPrice,
          discount: item.discount,
          tax: product.isVatItem && enableVat ? (lineSubtotalAfterDiscount * (defaultVatRate / 100)) : 0,
          total: lineSubtotalAfterDiscount,
        });
      }

      const finalTaxableAmount = Math.max(0, taxableAmountSum - payload.discount);
      const finalVatAmount = enableVat ? finalTaxableAmount * (defaultVatRate / 100) : 0;
      const finalTotal = (calculatedSubtotal - (lineDiscountsSum + payload.discount)) + finalVatAmount;

      // 10% VAT Refund for electronic payment modes
      let vatRefundAmount = 0;
      const isElectronicPayment = ["ESEWA", "KHALTI", "FONE_PAY", "NEPAL_PAY", "CARD"].includes(payload.paymentMethod);
      if (isElectronicPayment && finalVatAmount > 0) {
        vatRefundAmount = finalVatAmount * 0.10;
      }

      // 5. Create Sale record
      const sale = await tx.sale.create({
        data: {
          businessId: context.businessId,
          branchId: effectiveBranchId,
          customerId: resolvedCustomerId,
          userId: context.userId,
          invoiceNumber,
          status: payload.status,
          subtotal: calculatedSubtotal,
          discount: lineDiscountsSum + payload.discount,
          tax: finalVatAmount,
          total: finalTotal,
          paidAmount: payload.paidAmount,
          paymentStatus: payload.paymentStatus,
          notes: payload.notes,
          fiscalYearId: activeFiscalYear.id,
          vatRefundAmount,
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

      // 6. Create Ledger and Balance entries for Customers if transaction is credit
      if (resolvedCustomerId) {
        const customer = await tx.customer.findFirst({
          where: { id: resolvedCustomerId, businessId: context.businessId },
        });

        if (customer) {
          const unpaidAmt = finalTotal - payload.paidAmount;

          if (unpaidAmt > 0) {
            if (customer.balance + unpaidAmt > customer.creditLimit) {
              throw new Error(`Transaction violates customer credit limit. Limit: Rs. ${customer.creditLimit}, Current balance: Rs. ${customer.balance}, Added charge: Rs. ${unpaidAmt}`);
            }

            const newCustomerBalance = customer.balance + unpaidAmt;

            await tx.customer.update({
              where: { id: customer.id },
              data: { balance: newCustomerBalance },
            });

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
      }

      // 7. Create Payment records
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

      // 8. Write Audit Logs
      await tx.auditLog.create({
        data: {
          businessId: context.businessId,
          userId: context.userId,
          role: context.role,
          branchId: effectiveBranchId,
          warehouseId: effectiveBranchId,
          action: "CREATE",
          module: "SALE",
          details: `Created invoice ${invoiceNumber}. Total: Rs. ${finalTotal.toFixed(2)}, Paid: Rs. ${payload.paidAmount.toFixed(2)}`,
          newValue: JSON.parse(JSON.stringify(sale)),
          ipAddress,
          deviceInfo,
        },
      });

      if (finalVatAmount > 0) {
        await tx.auditLog.create({
          data: {
            businessId: context.businessId,
            userId: context.userId,
            role: context.role,
            branchId: effectiveBranchId,
            warehouseId: effectiveBranchId,
            action: "TAXATION",
            module: "SALE",
            details: `Nepal Compliance - VAT Invoice recorded: Invoice ${invoiceNumber}. Subtotal: Rs. ${calculatedSubtotal.toFixed(2)}, Discount: Rs. ${(lineDiscountsSum + payload.discount).toFixed(2)}, Taxable Value: Rs. ${finalTaxableAmount.toFixed(2)}, VAT (13%): Rs. ${finalVatAmount.toFixed(2)}, Total: Rs. ${finalTotal.toFixed(2)}`,
            newValue: {
              invoiceNumber,
              subtotal: calculatedSubtotal,
              discount: lineDiscountsSum + payload.discount,
              taxableAmount: finalTaxableAmount,
              tax: finalVatAmount,
              total: finalTotal
            },
            ipAddress,
            deviceInfo,
          },
        });
      }

      // 9. Write Notifications
      if (lowStockAlerts.length > 0) {
        await tx.notification.createMany({
          data: lowStockAlerts,
        });
      }

      return sale;
    }, { maxWait: 10000, timeout: 30000 });

    // 10. Fire and forget CBMS submission background job
    if (saleResult.status === "COMPLETED") {
      CbmsService.submitInvoice(saleResult.id).catch((e) => {
        console.error("Async CBMS submission failed:", e);
      });
    }

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
