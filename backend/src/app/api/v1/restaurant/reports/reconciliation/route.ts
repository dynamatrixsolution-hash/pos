import { NextResponse } from "next/server";
import { getSessionContext, authErrorResponse } from "@/lib/api-helper";
import { db } from "@/lib/db";
import { Prisma } from "@dynapos/db";
import { z } from "zod";

export async function GET(req: Request) {
  try {
    const session = await getSessionContext();
    if (!session) return authErrorResponse();

    const { searchParams } = new URL(req.url);
    const branchId = searchParams.get("branchId") || session.branchId;

    // 1. Fetch settled restaurant orders for revenue
    const orders = await db.restaurantOrder.findMany({
      where: {
        businessId: session.businessId,
        ...(branchId ? { branchId } : {}),
      },
      include: {
        rounds: {
          include: {
            lines: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const settledOrders = orders.filter((o) => o.settlementStatus === "PAID");
    const totalFoodSales = settledOrders.reduce(
      (acc, o) => acc + Number(o.totalAmount),
      0
    );

    // 2. Fetch Consumption Postings for raw ingredient COGS
    const consumptionPostings = await db.consumptionPosting.findMany({
      where: {
        businessId: session.businessId,
        ...(branchId ? { branchId } : {}),
      },
      include: {
        product: true,
        recipeVersion: {
          include: {
            menuItem: {
              include: { section: true },
            },
          },
        },
      },
      orderBy: { postedAt: "desc" },
    });

    let totalCogs = 0;
    const cogsByDish: Record<
      string,
      {
        name: string;
        category: string;
        quantityCooked: number;
        ingredientCost: number;
        salesRevenue: number;
        ingredientsUsed: { name: string; quantity: number; unit: string; cost: number }[];
      }
    > = {};

    for (const post of consumptionPostings) {
      const prodCost = Number(post.product.costPrice || 0);
      const postCost = Number(post.quantity) * prodCost;
      totalCogs += postCost;

      const dishName = post.recipeVersion?.menuItem?.name || "Kitchen Prep";
      const category = post.recipeVersion?.menuItem?.section?.name || "Kitchen";

      if (!cogsByDish[dishName]) {
        cogsByDish[dishName] = {
          name: dishName,
          category,
          quantityCooked: 0,
          ingredientCost: 0,
          salesRevenue: 0,
          ingredientsUsed: [],
        };
      }

      cogsByDish[dishName].ingredientCost += postCost;
      const existingIng = cogsByDish[dishName].ingredientsUsed.find(
        (i) => i.name === post.product.name
      );
      if (existingIng) {
        existingIng.quantity += Number(post.quantity);
        existingIng.cost += postCost;
      } else {
        cogsByDish[dishName].ingredientsUsed.push({
          name: post.product.name,
          quantity: Number(post.quantity),
          unit: post.unit,
          cost: postCost,
        });
      }
    }

    // Associate revenue with dishes from settled order lines
    for (const order of settledOrders) {
      for (const round of order.rounds) {
        for (const line of round.lines) {
          if (cogsByDish[line.itemName]) {
            cogsByDish[line.itemName].quantityCooked += line.quantity;
            cogsByDish[line.itemName].salesRevenue += Number(line.total);
          }
        }
      }
    }

    const cogsBreakdown = Object.values(cogsByDish).map((dish) => {
      const foodCostPct =
        dish.salesRevenue > 0
          ? (dish.ingredientCost / dish.salesRevenue) * 100
          : 0;
      const margin = dish.salesRevenue - dish.ingredientCost;
      return {
        ...dish,
        foodCostPercent: Number(foodCostPct.toFixed(1)),
        grossMargin: Number(margin.toFixed(2)),
      };
    });

    // 3. Accounts Payable (Who We Owe)
    const suppliers = await db.supplier.findMany({
      where: { businessId: session.businessId },
      include: {
        purchases: {
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
      orderBy: { balance: "desc" },
    });

    const totalAccountsPayable = suppliers.reduce(
      (acc, s) => acc + Math.max(0, Number(s.balance)),
      0
    );

    // 4. Supplier Purchases (Daily Procurement Ledger)
    const recentPurchases = await db.purchase.findMany({
      where: {
        businessId: session.businessId,
        ...(branchId ? { branchId } : {}),
      },
      include: {
        supplier: true,
        purchaseItems: {
          include: { product: true },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 20,
    });

    // 5. Accounts Receivable (Who Owes Us)
    // a) Pending Delivery Cash on Delivery (COD)
    const pendingDeliveryOrders = orders.filter(
      (o) => o.orderType === "DELIVERY" && o.settlementStatus !== "PAID"
    );

    const deliveryReceivables = pendingDeliveryOrders.map((o) => {
      // Parse customer/rider details from notes
      const notes = o.notes || "";
      const custMatch = notes.match(/Customer:\s*([^|]+)/i);
      const phoneMatch = notes.match(/Phone:\s*([^|]+)/i);
      const addrMatch = notes.match(/Address:\s*([^|]+)/i);
      const riderMatch = notes.match(/Rider:\s*([^|]+)/i);

      return {
        id: o.id,
        orderNumber: o.orderNumber,
        customerName: custMatch ? custMatch[1].trim() : "Delivery Customer",
        phone: phoneMatch ? phoneMatch[1].trim() : "N/A",
        address: addrMatch ? addrMatch[1].trim() : "N/A",
        riderName: riderMatch ? riderMatch[1].trim() : "Unassigned Rider",
        amount: Number(o.totalAmount),
        createdAt: o.createdAt,
        notes: o.notes,
      };
    });

    // b) Room Folios charged with restaurant orders
    const stays = await db.stay.findMany({
      where: {
        businessId: session.businessId,
        status: "ACTIVE",
      },
      include: {
        room: true,
        folios: {
          include: {
            entries: {
              where: {
                sourceType: "RESTAURANT_ORDER",
              },
            },
          },
        },
      },
    });

    const roomFolioReceivables: any[] = [];
    for (const stay of stays) {
      for (const folio of stay.folios) {
        if (folio.entries && folio.entries.length > 0) {
          const restaurantTotal = folio.entries.reduce(
            (acc: number, entry: any) => acc + Number(entry.totalAmount),
            0
          );
          roomFolioReceivables.push({
            id: folio.id,
            stayId: stay.id,
            roomNumber: stay.room?.roomNumber || "N/A",
            guestName: stay.guestName,
            stayNumber: stay.stayNumber,
            restaurantCharges: restaurantTotal,
            totalFolioBalance: Number(folio.balance || restaurantTotal),
            transactionsCount: folio.entries.length,
          });
        }
      }
    }

    const totalDeliveryReceivable = deliveryReceivables.reduce(
      (acc, d) => acc + d.amount,
      0
    );
    const totalRoomFolioReceivable = roomFolioReceivables.reduce(
      (acc, r) => acc + r.restaurantCharges,
      0
    );
    const totalAccountsReceivable =
      totalDeliveryReceivable + totalRoomFolioReceivable;

    // Financial KPI Summary
    const grossProfit = totalFoodSales - totalCogs;
    const grossMarginPercent =
      totalFoodSales > 0 ? (grossProfit / totalFoodSales) * 100 : 0;

    return NextResponse.json({
      summary: {
        totalFoodSales: Number(totalFoodSales.toFixed(2)),
        totalOrdersCount: settledOrders.length,
        totalCogs: Number(totalCogs.toFixed(2)),
        grossProfit: Number(grossProfit.toFixed(2)),
        grossMarginPercent: Number(grossMarginPercent.toFixed(1)),
        totalAccountsPayable: Number(totalAccountsPayable.toFixed(2)),
        totalAccountsReceivable: Number(totalAccountsReceivable.toFixed(2)),
        deliveryReceivable: Number(totalDeliveryReceivable.toFixed(2)),
        roomFolioReceivable: Number(totalRoomFolioReceivable.toFixed(2)),
      },
      suppliers: suppliers.map((s) => ({
        id: s.id,
        name: s.name,
        contactName: s.contactName,
        phone: s.phone,
        email: s.email,
        address: s.address,
        balance: Number(s.balance),
        lastPurchaseDate: s.purchases[0]?.createdAt || null,
      })),
      purchases: recentPurchases.map((p) => ({
        id: p.id,
        purchaseNumber: p.purchaseNumber,
        invoiceNumber: p.invoiceNumber,
        supplierName: p.supplier.name,
        supplierPhone: p.supplier.phone,
        total: Number(p.total),
        paidAmount: Number(p.paidAmount),
        dueAmount: Math.max(0, Number(p.total) - Number(p.paidAmount)),
        paymentStatus: p.paymentStatus,
        createdAt: p.createdAt,
        items: p.purchaseItems.map((pi) => ({
          productName: pi.product.name,
          quantity: pi.quantity,
          price: Number(pi.price),
          total: Number(pi.total || Number(pi.price) * pi.quantity),
        })),
      })),
      receivables: {
        deliveryCod: deliveryReceivables,
        roomFolios: roomFolioReceivables,
      },
      cogsBreakdown,
    });
  } catch (error: any) {
    console.error("Reconciliation report error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to generate reconciliation report" },
      { status: 500 }
    );
  }
}

const actionSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("PAY_SUPPLIER"),
    supplierId: z.string().uuid(),
    amount: z.number().positive(),
    paymentMethod: z.string().default("CASH"),
    reference: z.string().optional(),
    notes: z.string().optional(),
  }),
  z.object({
    action: z.literal("SETTLE_DELIVERY_COD"),
    orderId: z.string().uuid(),
    paidAmount: z.number().positive().optional(),
  }),
]);

export async function POST(req: Request) {
  try {
    const session = await getSessionContext();
    if (!session) return authErrorResponse();

    const body = await req.json();
    const parsed = actionSchema.parse(body);

    if (parsed.action === "PAY_SUPPLIER") {
      const supplier = await db.supplier.findFirst({
        where: { id: parsed.supplierId, businessId: session.businessId },
      });
      if (!supplier) {
        return NextResponse.json({ error: "Supplier not found" }, { status: 404 });
      }

      const payDec = new Prisma.Decimal(parsed.amount.toString());
      const newBalance = new Prisma.Decimal(supplier.balance.toString()).sub(payDec);

      await db.$transaction(async (tx) => {
        await tx.supplier.update({
          where: { id: supplier.id },
          data: { balance: newBalance },
        });

        await tx.supplierLedger.create({
          data: {
            supplierId: supplier.id,
            type: "PAYMENT",
            reference: parsed.reference || "VOUCHER-PAY",
            debit: payDec, // Decreases balance
            credit: new Prisma.Decimal(0),
            balance: newBalance,
            description: parsed.notes || `Supplier payment via ${parsed.paymentMethod}`,
          },
        });
      });

      return NextResponse.json({
        success: true,
        message: `Payment of NPR ${parsed.amount} recorded for ${supplier.name}. New balance: NPR ${newBalance.toString()}`,
      });
    }

    if (parsed.action === "SETTLE_DELIVERY_COD") {
      const order = await db.restaurantOrder.findFirst({
        where: { id: parsed.orderId, businessId: session.businessId },
      });
      if (!order) {
        return NextResponse.json({ error: "Order not found" }, { status: 404 });
      }

      const amountToPay = parsed.paidAmount
        ? new Prisma.Decimal(parsed.paidAmount.toString())
        : order.totalAmount;

      await db.restaurantOrder.update({
        where: { id: order.id },
        data: {
          settlementStatus: "PAID",
          fulfillmentStatus: "SERVED",
          paidAmount: amountToPay,
          notes: `${order.notes || ""}\n[COD REMITTED: Cash collected from delivery rider]`,
        },
      });

      return NextResponse.json({
        success: true,
        message: `Delivery Order #${order.orderNumber} COD remitted & marked PAID!`,
      });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0]?.message || "Validation failed" },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: error.message || "Failed to process reconciliation action" },
      { status: 500 }
    );
  }
}
