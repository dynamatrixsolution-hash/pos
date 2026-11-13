import { NextResponse } from "next/server";
import { getSessionContext, authErrorResponse } from "@/lib/api-helper";
import { db } from "@/lib/db";
import { Prisma } from "@dynapos/db";
import { createAuditEvent } from "@/lib/audit-event";
import { deductRecipeIngredientsForTicketLine } from "@/lib/services/recipe-consumption-service";
import { enqueueOutboxEvent } from "@/lib/services/outbox-service";
import { z } from "zod";

const splitPaymentAllocationSchema = z.object({
  method: z.enum([
    "CASH",
    "CARD",
    "FONE_PAY",
    "ESEWA",
    "KHALTI",
    "NEPAL_PAY",
    "CREDIT",
    "ROOM_CHARGE",
  ]),
  amount: z.coerce.number().positive(),
  cashTendered: z.coerce.number().min(0).optional().nullable(),
  changeReturned: z.coerce.number().min(0).optional().nullable(),
  reference: z.string().optional().nullable(),
});

const settleOrderSchema = z.object({
  customerId: z.string().nullable().optional(),
  registerId: z.string().optional().nullable(),
  shiftId: z.string().optional().nullable(),
  requireOpenShift: z.boolean().optional(),
  paymentMethod: z
    .enum([
      "CASH",
      "CARD",
      "FONE_PAY",
      "ESEWA",
      "KHALTI",
      "NEPAL_PAY",
      "CREDIT",
      "ROOM_CHARGE",
    ])
    .default("CASH"),
  splitPayments: z.array(splitPaymentAllocationSchema).optional(),
  cashTendered: z.coerce.number().min(0).optional().nullable(),
  changeReturned: z.coerce.number().min(0).optional().nullable(),
  subtotal: z.coerce.number().min(0).optional(),
  taxTotal: z.coerce.number().min(0).optional(),
  applyVat: z.boolean().optional().default(true),
  totalAmount: z.coerce.number().min(0).optional(),
  paidAmount: z.coerce.number().min(0).optional(),
  discountTotal: z.coerce.number().min(0).optional().default(0),
  deliveryFee: z.coerce.number().min(0).optional().default(0),
  packagingFee: z.coerce.number().min(0).optional().default(0),
  expressFee: z.coerce.number().min(0).optional().default(0),
  paymentReference: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  clearTable: z.boolean().default(true),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSessionContext();
    if (!session) return authErrorResponse();

    const { id: orderId } = await params;
    const body = await req.json().catch(() => ({}));
    const parsed = settleOrderSchema.parse(body);

    const order = await db.restaurantOrder.findFirst({
      where: { id: orderId, businessId: session.businessId },
      include: {
        table: true,
        tableSession: true,
        rounds: {
          include: {
            lines: {
              include: {
                menuItem: {
                  include: {
                    product: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    const result = await db.$transaction(async (tx) => {
      // Gather all active lines across this order (and any merged sibling orders in the same tableSession)
      const siblingOrders = order.tableSessionId
        ? await tx.restaurantOrder.findMany({
            where: {
              tableSessionId: order.tableSessionId,
              businessId: session.businessId,
              id: { not: order.id },
              settlementStatus: { not: "PAID" },
            },
            include: {
              rounds: {
                include: {
                  lines: {
                    include: {
                      menuItem: {
                        include: { product: true },
                      },
                    },
                  },
                },
              },
            },
          })
        : [];

      const allOrdersInSettlement = [order, ...siblingOrders];
      const activeLines = allOrdersInSettlement
        .flatMap((o) => o.rounds.flatMap((r) => r.lines))
        .filter(
          (l) =>
            l.fulfillmentStatus !== "CANCELLED" &&
            l.acceptanceStatus !== "REJECTED"
        );

      const computedLinesSubtotal = activeLines.reduce(
        (sum, l) => sum + Number(l.unitPrice || l.basePrice || 0) * l.quantity,
        0
      );

      const finalSubtotal =
        parsed.subtotal !== undefined && parsed.subtotal > 0
          ? parsed.subtotal
          : computedLinesSubtotal > 0
          ? computedLinesSubtotal
          : Number(order.subtotal || order.totalAmount || 0);

      const finalDiscount = Math.min(parsed.discountTotal || 0, finalSubtotal);
      const afterDiscount = Math.max(0, finalSubtotal - finalDiscount);
      const finalTax =
        parsed.taxTotal !== undefined
          ? parsed.taxTotal
          : parsed.applyVat
          ? Number((afterDiscount * 0.13).toFixed(2))
          : 0;
      const extraFees =
        (parsed.deliveryFee || 0) +
        (parsed.packagingFee || 0) +
        (parsed.expressFee || 0);

      const finalTotal =
        parsed.totalAmount !== undefined && parsed.totalAmount > 0
          ? Number(parsed.totalAmount.toFixed(2))
          : Number((afterDiscount + finalTax + extraFees).toFixed(2));

      const isCredit = parsed.paymentMethod === "CREDIT";
      const effectivePaidNum = isCredit
        ? 0
        : parsed.paidAmount !== undefined
        ? Math.min(finalTotal, parsed.paidAmount)
        : finalTotal;

      const paymentStatus =
        effectivePaidNum >= finalTotal
          ? "PAID"
          : effectivePaidNum > 0
          ? "PARTIAL"
          : "UNPAID";

      // 1. Settle RestaurantOrder
      const updatedOrder = await tx.restaurantOrder.update({
        where: { id: order.id },
        data: {
          settlementStatus: "PAID",
          subtotal: new Prisma.Decimal(finalSubtotal.toFixed(2)),
          discountTotal: new Prisma.Decimal(finalDiscount.toFixed(2)),
          taxTotal: new Prisma.Decimal(finalTax.toFixed(2)),
          totalAmount: new Prisma.Decimal(finalTotal.toFixed(2)),
          paidAmount: new Prisma.Decimal(effectivePaidNum.toFixed(2)),
          acceptanceStatus: "ACCEPTED",
          fulfillmentStatus:
            order.fulfillmentStatus === "CANCELLED" ? "CANCELLED" : "SERVED",
          version: { increment: 1 },
          notes: parsed.notes || order.notes,
        },
      });

      // 2. Mark all order lines as PAID & SERVED (unless voided/cancelled)
      await tx.orderLine.updateMany({
        where: {
          orderId: order.id,
          businessId: session.businessId,
          fulfillmentStatus: { not: "CANCELLED" },
        },
        data: {
          settlementStatus: "PAID",
          fulfillmentStatus: "SERVED",
          version: { increment: 1 },
        },
      });

      // 2a. If merged tables share this session, mark all sibling orders and lines as PAID too
      if (order.tableSessionId && siblingOrders.length > 0) {
        await tx.restaurantOrder.updateMany({
          where: {
            tableSessionId: order.tableSessionId,
            businessId: session.businessId,
            id: { not: order.id },
            settlementStatus: { not: "PAID" },
          },
          data: {
            settlementStatus: "PAID",
            acceptanceStatus: "ACCEPTED",
            fulfillmentStatus: "SERVED",
            version: { increment: 1 },
          },
        });

        await tx.orderLine.updateMany({
          where: {
            order: { tableSessionId: order.tableSessionId },
            businessId: session.businessId,
            fulfillmentStatus: { not: "CANCELLED" },
          },
          data: {
            settlementStatus: "PAID",
            fulfillmentStatus: "SERVED",
            version: { increment: 1 },
          },
        });
      }

      // 2b. Deduct recipe ingredients for any tickets/lines that haven't been deducted yet
      const orderTickets = await tx.kitchenTicket.findMany({
        where: {
          orderId: { in: allOrdersInSettlement.map((o) => o.id) },
          businessId: session.businessId,
        },
        include: { lines: true },
      });
      for (const t of orderTickets) {
        for (const l of t.lines) {
          if (l.status !== "CANCELLED") {
            try {
              await deductRecipeIngredientsForTicketLine(
                {
                  businessId: session.businessId,
                  branchId: order.branchId,
                  ticketLineId: l.id,
                  actorId: session.userId,
                },
                tx
              );
            } catch (deductErr) {
              console.warn("Settle deduction warning:", deductErr);
            }
          }
        }
      }
      // Also mark active kitchen tickets as SERVED on settlement if table is cleared
      if (parsed.clearTable && orderTickets.length > 0) {
        await tx.kitchenTicket.updateMany({
          where: {
            id: { in: orderTickets.map((t) => t.id) },
            status: { in: ["QUEUED", "PREPARING", "READY"] },
          },
          data: { status: "SERVED" },
        });
      }

      // =======================================================================
      // 2c. UNIFIED CORE POS PIPELINE: Record Sale, SaleItem, Payment, StockMovement & CustomerLedger
      // =======================================================================
      let createdSale = await tx.sale.findFirst({
        where: {
          businessId: session.businessId,
          OR: [
            { invoiceNumber: order.orderNumber },
            { notes: { contains: `[ORDER_ID:${order.id}]` } },
          ],
        },
      });

      let generatedInvoiceNumber = createdSale?.invoiceNumber || order.orderNumber;

      if (!createdSale && activeLines.length > 0) {
        const business = await tx.business.findUnique({
          where: { id: session.businessId },
          select: { settings: true },
        });
        const settings = (business?.settings as any) || {};
        const salesPrefix = settings.salesPrefix || settings.invoicePrefix || "INV";

        let activeFiscalYear = await tx.fiscalYear.findFirst({
          where: { businessId: session.businessId, isActive: true },
        });
        if (!activeFiscalYear) {
          activeFiscalYear = await tx.fiscalYear.findFirst({
            where: { businessId: session.businessId },
            orderBy: { createdAt: "desc" },
          });
          if (!activeFiscalYear) {
            const currentYear = new Date().getFullYear();
            activeFiscalYear = await tx.fiscalYear.create({
              data: {
                businessId: session.businessId,
                name: `${currentYear}/${(currentYear + 1).toString().slice(-2)}`,
                startDate: new Date(currentYear, 0, 1),
                endDate: new Date(currentYear, 11, 31, 23, 59, 59),
                isActive: true,
              },
            });
          }
        }

        const sequenceRecord = await tx.fiscalYearInvoiceSequence.upsert({
          where: {
            businessId_branchId_fiscalYearId: {
              businessId: session.businessId,
              branchId: order.branchId,
              fiscalYearId: activeFiscalYear.id,
            },
          },
          update: { nextValue: { increment: 1 } },
          create: {
            businessId: session.businessId,
            branchId: order.branchId,
            fiscalYearId: activeFiscalYear.id,
            nextValue: 2,
          },
        });
        const sequenceValue = sequenceRecord.nextValue - 1;
        const cleanFyName = activeFiscalYear.name.replace("/", "");
        generatedInvoiceNumber = `${salesPrefix}-${cleanFyName}-${String(sequenceValue).padStart(5, "0")}`;

        // Ensure default category & unit exist if we need to auto-link a MenuItem to a Product
        let fallbackCategoryId: string | null = null;
        let fallbackUnitId: string | null = null;

        const saleItemsData: Array<{
          productId: string;
          quantity: number;
          costPrice: Prisma.Decimal;
          price: Prisma.Decimal;
          discount: Prisma.Decimal;
          tax: Prisma.Decimal;
          total: Prisma.Decimal;
          isMenuDish?: boolean;
        }> = [];

        for (const line of activeLines) {
          let product = line.menuItem?.product || null;

          if (!product) {
            product = await tx.product.findFirst({
              where: {
                businessId: session.businessId,
                name: line.itemName,
                deletedAt: null,
              },
            });
          }

          if (!product) {
            if (!fallbackCategoryId) {
              const cat =
                (await tx.category.findFirst({
                  where: { businessId: session.businessId },
                })) ||
                (await tx.category.create({
                  data: {
                    businessId: session.businessId,
                    name: "Restaurant Menu",
                  },
                }));
              fallbackCategoryId = cat.id;
            }
            if (!fallbackUnitId) {
              const unit =
                (await tx.unit.findFirst({
                  where: { businessId: session.businessId },
                })) ||
                (await tx.unit.create({
                  data: {
                    businessId: session.businessId,
                    name: "Plate",
                  },
                }));
              fallbackUnitId = unit.id;
            }

            product = await tx.product.create({
              data: {
                businessId: session.businessId,
                name: line.itemName,
                sku: `MENU-${Date.now().toString().slice(-5)}-${Math.floor(Math.random() * 900 + 100)}`,
                categoryId: fallbackCategoryId,
                unitId: fallbackUnitId,
                costPrice: new Prisma.Decimal("0"),
                sellingPrice: line.unitPrice || line.basePrice,
                wholesalePrice: line.unitPrice || line.basePrice,
                alertQuantity: 5,
                isVatItem: true,
              },
            });

            if (line.menuItemId) {
              await tx.menuItem.update({
                where: { id: line.menuItemId },
                data: { productId: product.id },
              });
            }
          }

          const isMenuDish = Boolean(line.menuItemId);
          const unitPriceNum = Number(line.unitPrice || line.basePrice || 0);
          const lineTotalNum = unitPriceNum * line.quantity;
          const lineTaxNum = parsed.applyVat
            ? Number((lineTotalNum * 0.13).toFixed(2))
            : 0;

          saleItemsData.push({
            productId: product.id,
            quantity: line.quantity,
            // Menu dish COGS is tracked via Recipe ConsumptionPosting; only retail items use direct product costPrice
            costPrice: isMenuDish ? new Prisma.Decimal("0") : (product.costPrice || new Prisma.Decimal("0")),
            price: new Prisma.Decimal(unitPriceNum.toFixed(2)),
            discount: new Prisma.Decimal("0"),
            tax: new Prisma.Decimal(lineTaxNum.toFixed(2)),
            total: new Prisma.Decimal(lineTotalNum.toFixed(2)),
            isMenuDish,
          });

          // Only deduct direct product stock for non-dish retail/packaged items (menu dishes deduct raw recipe ingredients via BOM)
          if (!isMenuDish) {
            const existingStock = await tx.productStock.findUnique({
              where: {
                productId_branchId: {
                  productId: product.id,
                  branchId: order.branchId,
                },
              },
            });
            if (existingStock) {
              await tx.productStock.update({
                where: { id: existingStock.id },
                data: { quantity: { decrement: line.quantity } },
              });
            }
          }
        }

        // Resolve customer safely
        let resolvedCustomerId: string | null = null;
        if (parsed.customerId) {
          const cust = await tx.customer.findFirst({
            where: {
              id: parsed.customerId,
              businessId: session.businessId,
              deletedAt: null,
            },
          });
          if (cust) resolvedCustomerId = cust.id;
        }

        const isElectronicPayment = [
          "ESEWA",
          "KHALTI",
          "FONE_PAY",
          "NEPAL_PAY",
          "CARD",
        ].includes(parsed.paymentMethod);
        const vatRefundAmount =
          isElectronicPayment && finalTax > 0
            ? Number((finalTax * 0.1).toFixed(2))
            : 0;

        const originTag = order.table?.tableNumber
          ? `Table ${order.table.tableNumber}`
          : order.orderType;

        let activeShift = await tx.cashierShift.findFirst({
          where: {
            businessId: session.businessId,
            status: "OPEN",
            ...(parsed.shiftId
              ? { id: parsed.shiftId }
              : parsed.registerId
                ? { registerId: parsed.registerId }
                : {
                    cashierId: session.userId,
                    ...(order.branchId ? { branchId: order.branchId } : {}),
                  }),
          },
          select: { id: true, registerId: true },
        });

        if (!activeShift && !parsed.shiftId && !parsed.registerId && order.branchId) {
          activeShift = await tx.cashierShift.findFirst({
            where: {
              businessId: session.businessId,
              branchId: order.branchId,
              status: "OPEN",
            },
            select: { id: true, registerId: true },
          });
        }

        if (!activeShift) {
          const branchRegisterCount = await tx.cashRegister.count({
            where: {
              businessId: session.businessId,
              ...(order.branchId ? { branchId: order.branchId } : {}),
              deletedAt: null,
            },
          });
          if (parsed.requireOpenShift || parsed.registerId || parsed.shiftId || branchRegisterCount > 0) {
            const err: any = new Error(
              "No active cashier shift is open on this branch/register. Please open a shift before settling orders."
            );
            err.status = 409;
            throw err;
          }
        }

        if (activeShift) {
          await tx.restaurantOrder.update({
            where: { id: order.id },
            data: { shiftId: activeShift.id },
          });
        }

        createdSale = await tx.sale.create({
          data: {
            businessId: session.businessId,
            branchId: order.branchId,
            customerId: resolvedCustomerId,
            userId: session.userId,
            invoiceNumber: generatedInvoiceNumber,
            status: "COMPLETED",
            subtotal: new Prisma.Decimal(finalSubtotal.toFixed(2)),
            discount: new Prisma.Decimal(finalDiscount.toFixed(2)),
            tax: new Prisma.Decimal(finalTax.toFixed(2)),
            total: new Prisma.Decimal(finalTotal.toFixed(2)),
            paidAmount: new Prisma.Decimal(effectivePaidNum.toFixed(2)),
            paymentStatus,
            notes: `[ORDER_ID:${order.id}] [${originTag}] ${parsed.notes || order.notes || ""}`.trim(),
            fiscalYearId: activeFiscalYear.id,
            vatRefundAmount: new Prisma.Decimal(vatRefundAmount.toFixed(2)),
            shiftId: activeShift?.id || null,
            saleItems: {
              createMany: {
                data: saleItemsData.map(({ isMenuDish: _ignore, ...rest }) => rest),
              },
            },
          },
        });

        // Record direct StockMovement only for non-dish retail items (dish ingredients already log RECIPE_CONSUMPTION movements)
        for (const item of saleItemsData) {
          if (!item.isMenuDish) {
            await tx.stockMovement.create({
              data: {
                businessId: session.businessId,
                branchId: order.branchId,
                productId: item.productId,
                quantity: new Prisma.Decimal(-item.quantity),
                sourceType: "SALE",
                sourceId: createdSale.id,
                eventKey: `RESTAURANT_SALE:${createdSale.id}:${item.productId}:${Math.random().toString(36).slice(2, 7)}`,
                actorId: session.userId,
                notes: `Restaurant POS settlement ${generatedInvoiceNumber} (${originTag})`,
              },
            });
          }
        }

        // Update Customer Ledger if credit/partial
        if (resolvedCustomerId && finalTotal > effectivePaidNum) {
          const customer = await tx.customer.findUnique({
            where: { id: resolvedCustomerId },
          });
          if (customer) {
            const unpaidAmt = Number((finalTotal - effectivePaidNum).toFixed(2));
            const newBalance = Number(customer.balance) + unpaidAmt;
            await tx.customer.update({
              where: { id: customer.id },
              data: { balance: new Prisma.Decimal(newBalance.toFixed(2)) },
            });
            await tx.customerLedger.create({
              data: {
                customerId: customer.id,
                type: "SALE",
                reference: generatedInvoiceNumber,
                debit: new Prisma.Decimal(unpaidAmt.toFixed(2)),
                credit: new Prisma.Decimal("0"),
                balance: new Prisma.Decimal(newBalance.toFixed(2)),
                description: `Restaurant POS credit bill (${originTag})`,
              },
            });
          }
        }

        // Record Payment & PaymentAllocation (supporting splitPayments and ROOM_CHARGE as non-cash)
        const allocationsToProcess =
          parsed.splitPayments && parsed.splitPayments.length > 0
            ? parsed.splitPayments
            : effectivePaidNum > 0 && parsed.paymentMethod !== "CREDIT"
              ? [
                  {
                    method: parsed.paymentMethod,
                    amount: effectivePaidNum,
                    cashTendered: parsed.cashTendered ?? null,
                    changeReturned: parsed.changeReturned ?? null,
                    reference: parsed.paymentReference ?? null,
                  },
                ]
              : [];

        for (const alloc of allocationsToProcess) {
          if (alloc.method === "CREDIT") continue;
          const allocAmount = Number(alloc.amount.toFixed(2));
          if (allocAmount <= 0) continue;

          // Specification §2.3 & §3.1: ROOM_CHARGE is a non-cash method and MUST NEVER be mapped to CASH!
          const isCash = alloc.method === "CASH";
          const rawTendered = isCash ? (alloc.cashTendered ?? parsed.cashTendered ?? null) : null;
          const cashTenderedVal =
            isCash && rawTendered !== null && rawTendered >= allocAmount
              ? Number(rawTendered.toFixed(2))
              : isCash
                ? allocAmount
                : null;
          const changeReturnedVal =
            isCash && cashTenderedVal !== null
              ? Number(Math.max(0, cashTenderedVal - allocAmount).toFixed(2))
              : null;

          const createdPayment = await tx.payment.create({
            data: {
              businessId: session.businessId,
              branchId: order.branchId,
              userId: session.userId,
              customerId: resolvedCustomerId,
              saleId: createdSale.id,
              amount: new Prisma.Decimal(allocAmount.toFixed(2)),
              cashTendered: cashTenderedVal !== null ? new Prisma.Decimal(cashTenderedVal.toFixed(2)) : null,
              changeReturned: changeReturnedVal !== null ? new Prisma.Decimal(changeReturnedVal.toFixed(2)) : null,
              method: alloc.method,
              source: "STAFF_RECORDED",
              type: "RECEIVED",
              reference: alloc.reference || parsed.paymentReference || order.orderNumber,
              shiftId: activeShift?.id || null,
            },
          });

          if (activeShift) {
            if (isCash) {
              await tx.cashierShift.update({
                where: { id: activeShift.id },
                data: {
                  cashSales: { increment: allocAmount },
                  totalSales: { increment: allocAmount },
                  expectedCash: { increment: allocAmount },
                },
              });
            } else {
              await tx.cashierShift.update({
                where: { id: activeShift.id },
                data: {
                  nonCashSales: { increment: allocAmount },
                  totalSales: { increment: allocAmount },
                },
              });
            }

            await tx.shiftTransaction.create({
              data: {
                businessId: session.businessId,
                branchId: order.branchId,
                shiftId: activeShift.id,
                saleId: createdSale.id,
                paymentId: createdPayment.id,
                transactionType: "SALE",
                paymentMethod: alloc.method,
                amount: new Prisma.Decimal(allocAmount.toFixed(2)),
                cashTendered: cashTenderedVal !== null ? new Prisma.Decimal(cashTenderedVal.toFixed(2)) : null,
                changeReturned: changeReturnedVal !== null ? new Prisma.Decimal(changeReturnedVal.toFixed(2)) : null,
                cashEffect: new Prisma.Decimal(isCash ? allocAmount.toFixed(2) : "0.00"),
              },
            });
          }

          await tx.paymentAllocation.create({
            data: {
              businessId: session.businessId,
              paymentId: createdPayment.id,
              saleId: createdSale.id,
              amount: new Prisma.Decimal(allocAmount.toFixed(2)),
              allocatedById: session.userId,
            },
          });
        }

        const creditPortion = Number(Math.max(0, finalTotal - effectivePaidNum).toFixed(2));
        if (activeShift && creditPortion > 0) {
          await tx.cashierShift.update({
            where: { id: activeShift.id },
            data: {
              nonCashSales: { increment: creditPortion },
              totalSales: { increment: creditPortion },
            },
          });
          await tx.shiftTransaction.create({
            data: {
              businessId: session.businessId,
              branchId: order.branchId,
              shiftId: activeShift.id,
              saleId: createdSale.id,
              transactionType: "SALE",
              paymentMethod: "CREDIT",
              amount: new Prisma.Decimal(creditPortion.toFixed(2)),
              cashEffect: new Prisma.Decimal("0.00"),
            },
          });
        }

        await enqueueOutboxEvent(tx, {
          businessId: session.businessId,
          aggregateType: "Sale",
          aggregateId: createdSale.id,
          eventType: "SALE_CREATED",
          payload: {
            invoiceNumber: generatedInvoiceNumber,
            orderNumber: order.orderNumber,
            total: finalTotal.toString(),
            paidAmount: effectivePaidNum.toString(),
            itemsCount: saleItemsData.length,
          },
        });
      }

      // 3. If clearTable requested: close session & release table
      let tableUpdated = null;
      if (parsed.clearTable) {
        if (order.tableSessionId) {
          await tx.tableSession.update({
            where: { id: order.tableSessionId },
            data: {
              status: "COMPLETED",
              closedAt: new Date(),
              closedById: session.userId,
              version: { increment: 1 },
            },
          });

          await tx.guestAccessGrant.updateMany({
            where: {
              tableSessionId: order.tableSessionId,
              businessId: session.businessId,
            },
            data: {
              status: "REVOKED",
              revokedAt: new Date(),
              revokedReason: "SETTLED",
            },
          });

          await tx.guestSession.updateMany({
            where: {
              tableSessionId: order.tableSessionId,
              businessId: session.businessId,
            },
            data: { status: "REVOKED", revokedAt: new Date() },
          });
        }

        const tableIdToRelease = order.tableId || order.tableSession?.tableId;
        if (tableIdToRelease) {
          tableUpdated = await tx.restaurantTable.update({
            where: { id: tableIdToRelease },
            data: {
              status: "AVAILABLE",
              currentSessionId: null,
            },
          });
        }
      }

      // 4. Record Audit Event
      await createAuditEvent(
        {
          businessId: session.businessId,
          branchId: order.branchId,
          userId: session.userId,
          action: "RESTAURANT_ORDER_SETTLED",
          entity: "RestaurantOrder",
          entityId: order.id,
          newValue: {
            orderNumber: order.orderNumber,
            invoiceNumber: generatedInvoiceNumber,
            totalAmount: finalTotal.toString(),
            paidAmount: effectivePaidNum.toString(),
            paymentMethod: parsed.paymentMethod,
            paymentReference: parsed.paymentReference,
            tableCleared: parsed.clearTable,
            tableId: order.tableId,
          },
        },
        tx
      );

      return {
        order: updatedOrder,
        table: tableUpdated,
        sale: createdSale,
        invoiceNumber: generatedInvoiceNumber,
      };
    });

    return NextResponse.json({
      success: true,
      message: parsed.clearTable
        ? `Order #${order.orderNumber} settled (${result.invoiceNumber}) and table cleared.`
        : `Order #${order.orderNumber} settled (${result.invoiceNumber}).`,
      ...result,
    });
  } catch (error: any) {
    console.error("Order settlement error:", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0]?.message || "Validation failed" },
        { status: 400 }
      );
    }
    if (error?.status === 409) {
      return NextResponse.json(
        { error: error.message || "Shift conflict" },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { error: error.message || "Failed to settle order" },
      { status: 500 }
    );
  }
}
