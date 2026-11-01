import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { isolatedDatabaseUrl } from "../scripts/database-verification.mjs";

const target = process.env.TEST_DATABASE_URL;

describe.skipIf(!target)("Phase 3: Restaurant Staff MVP Integration & Invariants", () => {
  let db: import("@dynapos/db").PrismaClient;
  const businessId = randomUUID();
  const branchId = randomUUID();
  const userId = randomUUID();
  let floorId: string;
  let table1Id: string;
  let table2Id: string;
  let table3Id: string;
  let menuItem1Id: string;
  let menuItem2Id: string;

  beforeAll(async () => {
    const { PrismaClient } = await import("@dynapos/db");
    db = new PrismaClient({ datasourceUrl: target, log: [] });
    await db.$connect();

    // 1. Setup Business & Branch
    await db.business.create({
      data: {
        id: businessId,
        name: "Restro Test Fine Dining",
        slug: `restro-test-${Date.now()}`,
        currency: "NPR",
        branches: {
          create: {
            id: branchId,
            name: "Main Dining Hall",
            address: "Kathmandu",
          },
        },
      },
    });

    // 1.1 Setup User
    await db.user.create({
      data: {
        id: userId,
        businessId,
        branchId,
        name: "Test Captain",
        email: `captain-${Date.now()}@restrotest.com`,
        passwordHash: "hashed_dummy_password",
        role: "WAITER",
      },
    });

    // 2. Setup Floor
    const floor = await db.floor.create({
      data: {
        businessId,
        branchId,
        name: "Ground Floor",
        displayOrder: 1,
      },
    });
    floorId = floor.id;

    // 3. Setup Tables
    const t1 = await db.restaurantTable.create({
      data: {
        businessId,
        branchId,
        floorId,
        tableNumber: "T-01",
        capacity: 4,
        status: "AVAILABLE",
      },
    });
    const t2 = await db.restaurantTable.create({
      data: {
        businessId,
        branchId,
        floorId,
        tableNumber: "T-02",
        capacity: 4,
        status: "AVAILABLE",
      },
    });
    const t3 = await db.restaurantTable.create({
      data: {
        businessId,
        branchId,
        floorId,
        tableNumber: "T-03",
        capacity: 6,
        status: "AVAILABLE",
      },
    });
    table1Id = t1.id;
    table2Id = t2.id;
    table3Id = t3.id;

    // 4. Setup Menu, Sections, Items & Modifiers
    const menu = await db.menu.create({
      data: {
        businessId,
        branchId,
        name: "All-Day Dining Menu",
      },
    });
    const section = await db.menuSection.create({
      data: {
        businessId,
        menuId: menu.id,
        name: "Mains & Grills",
      },
    });

    const m1 = await db.menuItem.create({
      data: {
        businessId,
        sectionId: section.id,
        name: "Wood-Fired Pizza",
        basePrice: 850.00,
        taxRate: 13.00,
      },
    });
    const m2 = await db.menuItem.create({
      data: {
        businessId,
        sectionId: section.id,
        name: "Craft Lemonade",
        basePrice: 200.00,
        taxRate: 13.00,
      },
    });
    menuItem1Id = m1.id;
    menuItem2Id = m2.id;
  });

  afterAll(async () => {
    if (db) {
      await db.business.deleteMany({ where: { id: businessId } });
      await db.$disconnect();
    }
  });

  it("opens a table session and prevents concurrent double-opening", async () => {
    const { openTableSession } = await import("../backend/src/lib/services/table-session-service");

    const result = await openTableSession(
      {
        businessId,
        branchId,
        tableId: table1Id,
        guestCount: 2,
        openedById: userId,
      },
      db
    );

    expect(result.session.status).toBe("ACTIVE");
    expect(result.table.status).toBe("OCCUPIED");
    expect(result.table.currentSessionId).toBe(result.session.id);

    // Attempting to open again on Table 1 must fail
    await expect(
      openTableSession(
        {
          businessId,
          branchId,
          tableId: table1Id,
          guestCount: 3,
        },
        db
      )
    ).rejects.toThrow(/already OCCUPIED/i);
  });

  it("submits Round 1 order and snapshots immutable pricing & modifier deltas", async () => {
    const { createOrAppendOrder } = await import("../backend/src/lib/services/restaurant-order-service");

    const session = await db.tableSession.findFirstOrThrow({
      where: { businessId, tableId: table1Id, status: "ACTIVE" },
    });

    const result = await createOrAppendOrder(
      {
        businessId,
        branchId,
        tableSessionId: session.id,
        tableId: table1Id,
        items: [
          {
            menuItemId: menuItem1Id,
            itemName: "Wood-Fired Pizza",
            basePrice: 850.00,
            quantity: 2,
            appliedModifiers: [
              {
                modifierGroupId: "mg-cheese",
                groupName: "Extra Cheese",
                optionId: "opt-mozzarella",
                optionName: "Buffalo Mozzarella",
                priceDelta: 150.00,
              },
            ],
          },
        ],
        actorId: userId,
      },
      db
    );

    expect(result.round.roundNumber).toBe(1);
    expect(result.lines).toHaveLength(1);
    const line = result.lines[0];
    // unitPrice = 850 + 150 = 1000
    expect(Number(line.unitPrice)).toBe(1000.00);
    // subtotal = 1000 * 2 = 2000
    expect(Number(line.subtotal)).toBe(2000.00);
    // tax = 13% of 2000 = 260
    expect(Number(line.taxAmount)).toBe(260.00);
    // total = 2260
    expect(Number(line.total)).toBe(2260.00);
  });

  it("submits Round 2 preserving Round 1 items, statuses, and history", async () => {
    const { createOrAppendOrder } = await import("../backend/src/lib/services/restaurant-order-service");

    const session = await db.tableSession.findFirstOrThrow({
      where: { businessId, tableId: table1Id, status: "ACTIVE" },
    });

    const result = await createOrAppendOrder(
      {
        businessId,
        branchId,
        tableSessionId: session.id,
        tableId: table1Id,
        items: [
          {
            menuItemId: menuItem2Id,
            itemName: "Craft Lemonade",
            basePrice: 200.00,
            quantity: 2,
          },
        ],
        actorId: userId,
      },
      db
    );

    expect(result.round.roundNumber).toBe(2);

    // Verify order now has both rounds
    const fullOrder = await db.restaurantOrder.findFirstOrThrow({
      where: { id: result.order.id },
      include: { rounds: { orderBy: { roundNumber: "asc" }, include: { lines: true } } },
    });

    expect(fullOrder.rounds).toHaveLength(2);
    expect(fullOrder.rounds[0].roundNumber).toBe(1);
    expect(fullOrder.rounds[1].roundNumber).toBe(2);
    // Total should be Round 1 (2260) + Round 2 (200*2 = 400 + 13% (52) = 452) = 2712.00
    expect(Number(fullOrder.totalAmount)).toBe(2712.00);
  });

  it("enforces independent 3D status decoupling and mandatory rejection reason", async () => {
    const { updateLineStatus } = await import("../backend/src/lib/services/restaurant-order-service");

    const line = await db.orderLine.findFirstOrThrow({
      where: { businessId, itemName: "Craft Lemonade" },
    });

    // Rejection without reason must fail
    await expect(
      updateLineStatus(
        {
          businessId,
          lineId: line.id,
          acceptanceStatus: "REJECTED",
          rejectionReason: "",
        },
        db
      )
    ).rejects.toThrow(/mandatory rejection reason/i);

    // Fulfillment moves to PREPARING independently
    const updatedLine = await updateLineStatus(
      {
        businessId,
        lineId: line.id,
        fulfillmentStatus: "PREPARING",
      },
      db
    );
    expect(updatedLine.fulfillmentStatus).toBe("PREPARING");
    expect(updatedLine.settlementStatus).toBe("UNPAID");

    // Settling payment to PAID does NOT alter kitchen fulfillment
    const settledLine = await updateLineStatus(
      {
        businessId,
        lineId: line.id,
        settlementStatus: "PAID",
      },
      db
    );
    expect(settledLine.settlementStatus).toBe("PAID");
    expect(settledLine.fulfillmentStatus).toBe("PREPARING"); // INVARIANT: Food does NOT magically become SERVED
  });

  it("moves table session atomically and transfers orders without duplicates", async () => {
    const { moveTableSession } = await import("../backend/src/lib/services/table-session-service");

    const result = await moveTableSession(
      {
        businessId,
        fromTableId: table1Id,
        toTableId: table2Id,
        actorId: userId,
        reason: "Customer preferred window seat",
      },
      db
    );

    expect(result.sourceTable.status).toBe("AVAILABLE");
    expect(result.sourceTable.currentSessionId).toBeNull();
    expect(result.targetTable.status).toBe("OCCUPIED");
    expect(result.targetTable.currentSessionId).toBe(result.session.id);

    // Verify session tableId updated
    const session = await db.tableSession.findUniqueOrThrow({ where: { id: result.session.id } });
    expect(session.tableId).toBe(table2Id);

    // Verify orders transferred
    const orders = await db.restaurantOrder.findMany({ where: { tableSessionId: session.id } });
    for (const order of orders) {
      expect(order.tableId).toBe(table2Id);
    }
  });

  it("merges table sessions atomically and preserves order continuity", async () => {
    const { openTableSession, mergeTableSessions } = await import("../backend/src/lib/services/table-session-service");

    // Open session on Table 3
    const session3 = await openTableSession(
      {
        businessId,
        branchId,
        tableId: table3Id,
        guestCount: 3,
      },
      db
    );

    // Target session is the one currently on Table 2
    const targetSession = await db.tableSession.findFirstOrThrow({
      where: { businessId, tableId: table2Id, status: "ACTIVE" },
    });

    const mergeResult = await mergeTableSessions(
      {
        businessId,
        sourceSessionId: session3.session.id,
        targetSessionId: targetSession.id,
        actorId: userId,
        reason: "Parties decided to sit together",
      },
      db
    );

    expect(mergeResult.sourceSession.status).toBe("MERGED");
    expect(mergeResult.targetSession.guestCount).toBe(targetSession.guestCount + session3.session.guestCount);

    // Table 3 is freed
    const table3 = await db.restaurantTable.findUniqueOrThrow({ where: { id: table3Id } });
    expect(table3.status).toBe("AVAILABLE");
    expect(table3.currentSessionId).toBeNull();
  });

  it("enforces Optimistic Concurrency Control (OCC) rejection on stale write", async () => {
    const { updateLineStatus } = await import("../backend/src/lib/services/restaurant-order-service");

    const line = await db.orderLine.findFirstOrThrow({
      where: { businessId, itemName: "Wood-Fired Pizza" },
    });

    // Update with wrong expectedVersion must fail closed
    await expect(
      updateLineStatus(
        {
          businessId,
          lineId: line.id,
          fulfillmentStatus: "READY",
          expectedVersion: line.version + 999, // deliberate stale version
        },
        db
      )
    ).rejects.toThrow(/Optimistic lock failure/i);
  });

  it("enforces session closing invariant: unsettled orders prevent normal closure", async () => {
    const { closeTableSession } = await import("../backend/src/lib/services/table-session-service");

    const session = await db.tableSession.findFirstOrThrow({
      where: { businessId, tableId: table2Id, status: "ACTIVE" },
    });

    // Attempting normal close while orders are unpaid must fail
    await expect(
      closeTableSession(
        {
          businessId,
          sessionId: session.id,
          closedById: userId,
          force: false,
        },
        db
      )
    ).rejects.toThrow(/order\(s\) remain unsettled/i);

    // Force close succeeds
    const closed = await closeTableSession(
      {
        businessId,
        sessionId: session.id,
        closedById: userId,
        force: true,
        notes: "Manager override force close",
      },
      db
    );

    expect(closed.status).toBe("COMPLETED");

    // Table 2 is freed
    const table2 = await db.restaurantTable.findUniqueOrThrow({ where: { id: table2Id } });
    expect(table2.status).toBe("AVAILABLE");
    expect(table2.currentSessionId).toBeNull();
  });
});
