import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionContext, authErrorResponse, roleErrorResponse } from "@/lib/api-helper";
import { CbmsService } from "@/lib/cbms-service";
import { z } from "zod";

const correctItemSchema = z.object({
  productId: z.string().uuid(),
  batchNumber: z.string().optional().nullable(),
  quantity: z.number().positive(),
  price: z.number().nonnegative(),
  discount: z.number().nonnegative().default(0),
  tax: z.number().nonnegative().default(0),
});

const correctSchema = z.object({
  reason: z.string().min(5, "Correction reason must be at least 5 characters"),
  customerId: z.string().uuid().optional().nullable(),
  items: z.array(correctItemSchema).min(1, "At least one item is required in the checkout cart"),
  discount: z.number().nonnegative().default(0),
  paidAmount: z.number().nonnegative().default(0),
  paymentMethod: z.enum(["CASH", "CARD", "FONE_PAY", "ESEWA", "KHALTI", "NEPAL_PAY", "CREDIT"]).default("CASH"),
  paymentStatus: z.enum(["PAID", "PARTIAL", "UNPAID"]).default("PAID"),
  notes: z.string().optional().nullable(),
});

export async function POST(
  request: Request,
  props: { params: Promise<{ id: string }> }
) {
  const params = await props.params;
  const context = await getSessionContext();
  if (!context) return authErrorResponse();

  // Corrections are typically restricted to Owner or Manager
  if (context.role !== "OWNER" && context.role !== "SUPER_ADMIN" && context.role !== "MANAGER") {
    return roleErrorResponse();
  }

  const headers = request.headers;
  const xForwardedFor = headers.get("x-forwarded-for");
  const ipAddress = xForwardedFor ? xForwardedFor.split(",")[0].trim() : (headers.get("x-real-ip") || "127.0.0.1");
  const deviceInfo = headers.get("user-agent") || "Unknown Device";

  try {
    const body = await request.json();
    const result = correctSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json(
        { error: "Validation failed", details: result.error.format() },
        { status: 400 }
      );
    }

    const payload = result.data;
    const originalSaleId = params.id;

    const newSaleResult = await db.$transaction(async (tx) => {
      // 1. Fetch original sale to correct
      const originalSale = await tx.sale.findUnique({
        where: { id: originalSaleId },
        include: { saleItems: true },
      });

      if (!originalSale) throw new Error("Original invoice not found");
      if (originalSale.businessId !== context.businessId) throw new Error("Unauthorized tenant access");
      if (!originalSale.isActive) throw new Error("Original invoice is not active (cannot correct a cancelled or already corrected invoice)");

      // 2. Adjust Stock back (Revert deductions of the original sale)
      for (const item of originalSale.saleItems) {
        const stock = await tx.productStock.findUnique({
          where: { productId_branchId: { productId: item.productId, branchId: originalSale.branchId } },
        });
        if (stock) {
          await tx.productStock.update({
            where: { id: stock.id },
            data: { quantity: stock.quantity + item.quantity },
          });
        }

        if (item.batchNumber) {
          const batch = await tx.batch.findFirst({
            where: {
              productId: item.productId,
              branchId: originalSale.branchId,
              batchNumber: item.batchNumber,
              deletedAt: null,
            },
          });
          if (batch) {
            await tx.batch.update({
              where: { id: batch.id },
              data: { quantity: batch.quantity + item.quantity },
            });
          }
        }
      }

      // Revert original customer credit ledger dues
      if (originalSale.customerId) {
        const customer = await tx.customer.findFirst({
          where: { id: originalSale.customerId, businessId: context.businessId },
        });

        if (customer) {
          const unpaidAmt = originalSale.total - originalSale.paidAmount;
          if (unpaidAmt > 0) {
            const newCustomerBalance = Math.max(0, customer.balance - unpaidAmt);

            await tx.customer.update({
              where: { id: customer.id },
              data: { balance: newCustomerBalance },
            });

            await tx.customerLedger.create({
              data: {
                customerId: customer.id,
                type: "RETURN",
                reference: originalSale.invoiceNumber,
                debit: 0.0,
                credit: unpaidAmt,
                balance: newCustomerBalance,
                description: `Corrective Offset for Invoice #${originalSale.invoiceNumber}`,
              },
            });
          }
        }
      }

      // Mark original sale as cancelled/inactive due to correction
      await tx.sale.update({
        where: { id: originalSaleId },
        data: {
          isActive: false,
          cancellationReason: `CORRECTED: ${payload.reason}`,
          cancelledById: context.userId,
          cancelledAt: new Date(),
        },
      });

      // 3. Fetch active fiscal year and business settings for prefix & taxes
      const business = await tx.business.findUnique({
        where: { id: context.businessId },
        select: { settings: true },
      });
      const settings = (business?.settings as any) || {};
      const salesPrefix = settings.salesPrefix || settings.invoicePrefix || "INV";

      const activeFiscalYear = await tx.fiscalYear.findFirst({
        where: { businessId: context.businessId, isActive: true },
      });
      if (!activeFiscalYear) {
        throw new Error("IRD Compliance: No active fiscal year configured. Please configure a fiscal year in settings first.");
      }

      // 4. Concurrency-Safe Sequential Invoice Numbering
      let sequenceRecord;
      try {
        sequenceRecord = await tx.fiscalYearInvoiceSequence.update({
          where: {
            businessId_branchId_fiscalYearId: {
              businessId: context.businessId,
              branchId: originalSale.branchId,
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
              branchId: originalSale.branchId,
              fiscalYearId: activeFiscalYear.id,
            },
          },
          update: { nextValue: { increment: 1 } },
          create: {
            businessId: context.businessId,
            branchId: originalSale.branchId,
            fiscalYearId: activeFiscalYear.id,
            nextValue: 2,
          },
        });
      }
      const sequenceValue = sequenceRecord.nextValue - 1;
      const cleanFyName = activeFiscalYear.name.replace("/", "");
      const newInvoiceNumber = `${salesPrefix}-${cleanFyName}-${String(sequenceValue).padStart(6, "0")}`;

      // 5. Server-Side Calculations and Stock Deductions for the new sale
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
        if (!product) throw new Error(`Product not found: ${item.productId}`);

        const customer = payload.customerId ? await tx.customer.findFirst({ where: { id: payload.customerId } }) : null;
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

        // Deduct Branch-wise Stock levels
        const stock = await tx.productStock.findUnique({
          where: { productId_branchId: { productId: item.productId, branchId: originalSale.branchId } },
        });
        if (!stock || stock.quantity < item.quantity) {
          throw new Error(`Insufficient stock for product "${product.name}". Available: ${stock?.quantity || 0}, Requested: ${item.quantity}`);
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

        if (product.batchTracking && item.batchNumber) {
          const batch = await tx.batch.findFirst({
            where: {
              productId: item.productId,
              branchId: originalSale.branchId,
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

      // 10% VAT Refund for electronic payments
      let vatRefundAmount = 0;
      const isElectronicPayment = ["ESEWA", "KHALTI", "FONE_PAY", "NEPAL_PAY", "CARD"].includes(payload.paymentMethod);
      if (isElectronicPayment && finalVatAmount > 0) {
        vatRefundAmount = finalVatAmount * 0.10;
      }

      // Create new Sale record carrying corrected link reference
      const sale = await tx.sale.create({
        data: {
          businessId: context.businessId,
          branchId: originalSale.branchId,
          customerId: payload.customerId,
          userId: context.userId,
          invoiceNumber: newInvoiceNumber,
          status: "COMPLETED",
          subtotal: calculatedSubtotal,
          discount: lineDiscountsSum + payload.discount,
          tax: finalVatAmount,
          total: finalTotal,
          paidAmount: payload.paidAmount,
          paymentStatus: payload.paymentStatus,
          notes: payload.notes || `Corrected invoice referencing #${originalSale.invoiceNumber}`,
          fiscalYearId: activeFiscalYear.id,
          vatRefundAmount,
          correctedInvoiceId: originalSale.id, // Linking back
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

      // Adjust customer balance for the new sale
      if (payload.customerId) {
        const customer = await tx.customer.findFirst({
          where: { id: payload.customerId, businessId: context.businessId },
        });

        if (customer) {
          const unpaidAmt = finalTotal - payload.paidAmount;

          if (unpaidAmt > 0) {
            if (customer.balance + unpaidAmt > customer.creditLimit) {
              throw new Error(`Transaction violates customer credit limit. Limit: $${customer.creditLimit}, Current balance: $${customer.balance}, Added charge: $${unpaidAmt}`);
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
                reference: newInvoiceNumber,
                debit: unpaidAmt,
                credit: 0.0,
                balance: newCustomerBalance,
                description: `Sales billing invoice corrected adjustment. Status: ${payload.paymentStatus}`,
              },
            });
          }
        }
      }

      // Create Payment records
      if (payload.paidAmount > 0) {
        await tx.payment.create({
          data: {
            businessId: context.businessId,
            saleId: sale.id,
            amount: payload.paidAmount,
            method: payload.paymentMethod,
            reference: `POS Pay against corrected ${newInvoiceNumber}`,
          },
        });
      }

      // Write Audit Logs
      await tx.auditLog.create({
        data: {
          businessId: context.businessId,
          userId: context.userId,
          role: context.role,
          branchId: originalSale.branchId,
          action: "CORRECT_INVOICE",
          module: "SALE",
          details: `Corrected invoice ${originalSale.invoiceNumber}. Created new invoice ${newInvoiceNumber} carrying updated total Rs. ${finalTotal.toFixed(2)}. Reason: "${payload.reason}"`,
          oldValue: JSON.parse(JSON.stringify(originalSale)),
          newValue: JSON.parse(JSON.stringify(sale)),
          ipAddress,
          deviceInfo,
        },
      });

      return sale;
    }, { maxWait: 10000, timeout: 30000 });

    // Submit cancellation log and new invoice to CBMS
    CbmsService.submitCancellation(originalSaleId, `CORRECTED: ${payload.reason}`).catch((e) =>
      console.error("Async cancel CBMS failed:", e)
    );
    CbmsService.submitInvoice(newSaleResult.id).catch((e) =>
      console.error("Async new invoice CBMS failed:", e)
    );

    return NextResponse.json({
      message: "Invoice corrected successfully",
      originalInvoiceNumber: originalSaleId,
      newInvoiceNumber: newSaleResult.invoiceNumber,
      total: newSaleResult.total,
    });
  } catch (error: any) {
    console.error("POST correct error:", error.message || error);
    return NextResponse.json({ error: error.message || "Failed to process invoice correction" }, { status: 400 });
  }
}
