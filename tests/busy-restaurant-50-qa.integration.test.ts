import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";

const target = process.env.TEST_DATABASE_URL;

describe.skipIf(!target)("Busy Restaurant 50-Customer & Multi-Role Concurrency QA", () => {
  let db: import("@dynapos/db").PrismaClient;
  const businessId = randomUUID();
  const branchId = randomUUID();
  const ownerId = randomUUID();
  const waiterId = randomUUID();
  const cashierId = randomUUID();
  const kitchenId = randomUUID();

  let floorId = "";
  const tableIds: string[] = [];
  const menuItemIds: string[] = [];

  beforeAll(async () => {
    const { PrismaClient } = await import("@dynapos/db");
    db = new PrismaClient({ datasourceUrl: target, log: [] });
    await db.$connect();

    await db.business.create({
      data: {
        id: businessId,
        name: "Busy Restro 50-Guest QA",
        slug: `busy-restro-${Date.now()}`,
        currency: "NPR",
        branches: {
          create: {
            id: branchId,
            name: "Main Hall",
            address: "Kathmandu",
          },
        },
      },
    });

    await db.user.createMany({
      data: [
        {
          id: ownerId,
          businessId,
          branchId,
          name: "QA Owner",
          email: `owner-${Date.now()}@qa.test`,
          passwordHash: "hash",
          role: "OWNER",
        },
        {
          id: waiterId,
          businessId,
          branchId,
          name: "QA Waiter",
          email: `waiter-${Date.now()}@qa.test`,
          passwordHash: "hash",
          role: "WAITER",
        },
        {
          id: cashierId,
          businessId,
          branchId,
          name: "QA Cashier",
          email: `cashier-${Date.now()}@qa.test`,
          passwordHash: "hash",
          role: "CASHIER",
        },
        {
          id: kitchenId,
          businessId,
          branchId,
          name: "QA Chef",
          email: `chef-${Date.now()}@qa.test`,
          passwordHash: "hash",
          role: "KITCHEN",
        },
      ],
    });

    const floor = await db.floor.create({
      data: { businessId, branchId, name: "Grand Dining", displayOrder: 1 },
    });
    floorId = floor.id;

    // Create 15 tables (3-4 guests per table => ~50 concurrent customers)
    for (let i = 1; i <= 15; i++) {
      const table = await db.restaurantTable.create({
        data: {
          businessId,
          branchId,
          floorId,
          tableNumber: `T-${String(i).padStart(2, "0")}`,
          capacity: 4,
          status: "AVAILABLE",
        },
      });
      tableIds.push(table.id);
    }

    const menu = await db.menu.create({
      data: { businessId, branchId, name: "All Day Menu", isActive: true },
    });
    const section = await db.menuSection.create({
      data: { businessId, menuId: menu.id, name: "Mains", displayOrder: 1 },
    });

    const prices = [450, 850, 220, 650, 320];
    for (let i = 0; i < prices.length; i++) {
      const item = await db.menuItem.create({
        data: {
          businessId,
          sectionId: section.id,
          name: `Dish ${i + 1}`,
          basePrice: prices[i],
          taxRate: 13,
        },
      });
      menuItemIds.push(item.id);
    }
  });

  afterAll(async () => {
    if (db) {
      await db.business.deleteMany({ where: { id: businessId } });
      await db.$disconnect();
    }
  });

  it("seats 15 tables concurrently (~50 guests) without race conditions", async () => {
    const { openTableSession } = await import("../backend/src/lib/services/table-session-service");

    const sessions = await Promise.all(
      tableIds.map((tableId, idx) =>
        openTableSession(
          {
            businessId,
            branchId,
            tableId,
            guestCount: idx % 2 === 0 ? 4 : 3,
            openedById: waiterId,
          },
          db
        )
      )
    );

    expect(sessions).toHaveLength(15);
    expect(sessions.every((s) => s.session.status === "ACTIVE")).toBe(true);

    // Concurrent duplicate-open attempt on T-01 must fail cleanly
    await expect(
      openTableSession(
        { businessId, branchId, tableId: tableIds[0], guestCount: 2, openedById: waiterId },
        db
      )
    ).rejects.toThrow(/already OCCUPIED/i);
  });

  it("handles 50 concurrent customer/waiter orders across 15 tables accurately", async () => {
    const { createOrAppendOrder } = await import("../backend/src/lib/services/restaurant-order-service");

    const activeSessions = await db.tableSession.findMany({
      where: { businessId, status: "ACTIVE" },
      orderBy: { createdAt: "asc" },
    });
    expect(activeSessions).toHaveLength(15);

    // 50 concurrent order submissions distributed across the 15 active table sessions
    const tasks = Array.from({ length: 50 }, (_, idx) => {
      const sess = activeSessions[idx % activeSessions.length];
      const itemIdx = idx % menuItemIds.length;
      return db.$transaction((tx) =>
        createOrAppendOrder(
          {
            businessId,
            branchId,
            tableSessionId: sess.id,
            tableId: sess.tableId,
            items: [
              {
                menuItemId: menuItemIds[itemIdx],
                itemName: `Dish ${itemIdx + 1}`,
                basePrice: [450, 850, 220, 650, 320][itemIdx],
                quantity: 1,
              },
            ],
            actorId: idx % 3 === 0 ? cashierId : waiterId,
          },
          tx
        )
      );
    });

    const results = await Promise.all(tasks);
    expect(results).toHaveLength(50);

    // Verify all 50 items were recorded on the 15 orders with exact totals
    const orders = await db.restaurantOrder.findMany({
      where: { businessId },
      include: { orderLines: true },
    });
    expect(orders).toHaveLength(15);

    const totalItems = orders.reduce((acc, o) => acc + o.orderLines.length, 0);
    expect(totalItems).toBe(50);

    for (const order of orders) {
      const expectedSubtotal = order.orderLines.reduce((s, l) => s + Number(l.subtotal), 0);
      expect(Number(order.subtotal)).toBeCloseTo(expectedSubtotal, 2);
    }
  }, 30000);

  it("processes KDS updates and settles all 15 table orders concurrently", async () => {
    const { updateLineStatus } = await import("../backend/src/lib/services/restaurant-order-service");
    const { closeTableSession } = await import("../backend/src/lib/services/table-session-service");

    const orders = await db.restaurantOrder.findMany({
      where: { businessId, settlementStatus: { not: "PAID" } },
      select: { id: true, totalAmount: true, orderLines: { select: { id: true } } },
    });
    expect(orders).toHaveLength(15);

    // Kitchen marks all 50 lines PREPARING concurrently
    await Promise.all(
      orders.flatMap((o) =>
        o.orderLines.map((line) =>
          db.$transaction((tx) =>
            updateLineStatus(
              {
                businessId,
                orderId: o.id,
                lineId: line.id,
                fulfillmentStatus: "PREPARING",
                actorId: kitchenId,
              },
              tx
            )
          )
        )
      )
    );

    // Cashier settles all 15 orders concurrently
    await Promise.all(
      orders.map((o) =>
        db.$transaction(async (tx) => {
          await tx.orderLine.updateMany({
            where: { orderId: o.id, businessId },
            data: { settlementStatus: "PAID" },
          });
          await tx.restaurantOrder.update({
            where: { id: o.id },
            data: { settlementStatus: "PAID", paidAmount: o.totalAmount },
          });
        })
      )
    );

    const activeSessions = await db.tableSession.findMany({
      where: { businessId, status: "ACTIVE" },
      select: { id: true },
    });
    await Promise.all(
      activeSessions.map((s) =>
        db.$transaction((tx) =>
          closeTableSession(
            {
              businessId,
              branchId,
              sessionId: s.id,
              closedById: cashierId,
            },
            tx
          )
        )
      )
    );

    const remainingOpen = await db.tableSession.count({
      where: { businessId, status: "ACTIVE" },
    });
    expect(remainingOpen).toBe(0);
  }, 30000);
});
