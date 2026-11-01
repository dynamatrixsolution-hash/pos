import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";

const target = process.env.TEST_DATABASE_URL;

describe.skipIf(!target)("Phase 4: Kitchen Operations, Recipes & KDS Integration", () => {
  let db: import("@dynapos/db").PrismaClient;
  const businessId = randomUUID();
  const branchId = randomUUID();
  const userId = randomUUID();

  let hotStationId: string;
  let barStationId: string;
  let rawFlourProductId: string;
  let rawCheeseProductId: string;
  let pizzaMenuItemId: string;
  let cocktailMenuItemId: string;
  let roundId: string;

  beforeAll(async () => {
    const { PrismaClient } = await import("@dynapos/db");
    db = new PrismaClient({ datasourceUrl: target, log: [] });
    await db.$connect();

    // 1. Setup Business & Branch
    await db.business.create({
      data: {
        id: businessId,
        name: "Restro Chef Test Kitchen",
        slug: `restro-kitchen-${Date.now()}`,
        currency: "NPR",
        branches: {
          create: {
            id: branchId,
            name: "Kitchen Test Branch",
            address: "Pokhara",
          },
        },
      },
    });

    // 2. Setup Staff User
    await db.user.create({
      data: {
        id: userId,
        businessId,
        branchId,
        name: "Head Chef",
        email: `chef-${Date.now()}@restrotest.com`,
        passwordHash: "dummy_hash",
        role: "MANAGER",
      },
    });

    // 3. Setup Raw Inventory Products (Ingredients)
    const flour = await db.product.create({
      data: {
        businessId,
        name: "Organic Baker Flour",
        sku: `SKU-FLOUR-${Date.now()}`,
        costPrice: 80.00,
        sellingPrice: 120.00,
      },
    });
    const cheese = await db.product.create({
      data: {
        businessId,
        name: "Fresh Mozzarella",
        sku: `SKU-CHEESE-${Date.now()}`,
        costPrice: 600.00,
        sellingPrice: 850.00,
      },
    });
    rawFlourProductId = flour.id;
    rawCheeseProductId = cheese.id;

    // 4. Setup Floor, Table, Menu & MenuItems
    const floor = await db.floor.create({
      data: { businessId, branchId, name: "Dining Hall" },
    });
    const table = await db.restaurantTable.create({
      data: { businessId, branchId, floorId: floor.id, tableNumber: "K-01" },
    });
    const menu = await db.menu.create({
      data: { businessId, branchId, name: "Kitchen Menu" },
    });
    const section = await db.menuSection.create({
      data: { businessId, menuId: menu.id, name: "Artisan Pizza" },
    });

    const pizza = await db.menuItem.create({
      data: {
        businessId,
        sectionId: section.id,
        name: "Neapolitan Pizza",
        basePrice: 900.00,
      },
    });
    const cocktail = await db.menuItem.create({
      data: {
        businessId,
        sectionId: section.id,
        name: "Signature Mojito",
        basePrice: 350.00,
      },
    });
    pizzaMenuItemId = pizza.id;
    cocktailMenuItemId = cocktail.id;

    // 5. Setup Order & Round
    const order = await db.restaurantOrder.create({
      data: {
        businessId,
        branchId,
        tableId: table.id,
        orderNumber: `ORD-${Date.now()}`,
        subtotal: 1250.00,
        totalAmount: 1250.00,
      },
    });

    const round = await db.orderRound.create({
      data: {
        businessId,
        orderId: order.id,
        roundNumber: 1,
      },
    });
    roundId = round.id;

    // Line 1: Pizza with allergen note
    await db.orderLine.create({
      data: {
        businessId,
        orderId: order.id,
        roundId: round.id,
        menuItemId: pizzaMenuItemId,
        itemName: "Neapolitan Pizza",
        basePrice: 900.00,
        quantity: 2,
        appliedModifiers: [],
        unitPrice: 900.00,
        subtotal: 1800.00,
        total: 1800.00,
        notes: "Gluten free crust please, no nuts",
      },
    });

    // Line 2: Mojito
    await db.orderLine.create({
      data: {
        businessId,
        orderId: order.id,
        roundId: round.id,
        menuItemId: cocktailMenuItemId,
        itemName: "Signature Mojito",
        basePrice: 350.00,
        quantity: 1,
        appliedModifiers: [],
        unitPrice: 350.00,
        subtotal: 350.00,
        total: 350.00,
      },
    });
  });

  afterAll(async () => {
    if (db) {
      await db.business.deleteMany({ where: { id: businessId } });
      await db.$disconnect();
    }
  });

  it("configures kitchen stations and station routing rules", async () => {
    const {
      createKitchenStation,
      createStationRoute,
    } = await import("../backend/src/lib/services/kitchen-routing-service");

    const hotStation = await createKitchenStation({
      businessId,
      branchId,
      name: "Hot Grill & Pizza Oven",
      code: "HOT_OVEN",
      printerIp: "192.168.1.101",
    });
    const barStation = await createKitchenStation({
      businessId,
      branchId,
      name: "Main Cocktail Bar",
      code: "BAR",
      printerIp: "192.168.1.102",
    });

    hotStationId = hotStation.id;
    barStationId = barStation.id;

    expect(hotStation.code).toBe("HOT_OVEN");
    expect(barStation.code).toBe("BAR");

    // Route Pizza to Hot Oven
    await createStationRoute({
      businessId,
      stationId: hotStationId,
      menuItemId: pizzaMenuItemId,
    });

    // Route Mojito to Bar
    await createStationRoute({
      businessId,
      stationId: barStationId,
      menuItemId: cocktailMenuItemId,
    });
  });

  it("creates versioned Recipe Bill-of-Materials (BOM) with Decimal ingredient quantities", async () => {
    const { createRecipeVersion } = await import("../backend/src/lib/services/recipe-consumption-service");

    const recipe = await createRecipeVersion(
      {
        businessId,
        menuItemId: pizzaMenuItemId,
        yieldQuantity: 1,
        yieldUnit: "PIZZA",
        ingredients: [
          {
            productId: rawFlourProductId,
            quantity: 0.2500, // 250g flour per pizza
            unit: "kg",
            wastagePercent: 5.0, // 5% handling waste
          },
          {
            productId: rawCheeseProductId,
            quantity: 0.1500, // 150g cheese per pizza
            unit: "kg",
            wastagePercent: 0,
          },
        ],
      },
      db
    );

    expect(recipe).toBeDefined();
    expect(recipe?.versionNumber).toBe(1);
    expect(recipe?.ingredients).toHaveLength(2);
  });

  it("routes order round to multiple kitchen stations idempotently with dietary alerts", async () => {
    const { routeOrderRoundToStations } = await import("../backend/src/lib/services/kitchen-routing-service");

    const tickets = await routeOrderRoundToStations(
      {
        businessId,
        roundId,
        actorId: userId,
      },
      db
    );

    // Multi-station invariant: Pizza to Hot Oven, Mojito to Bar = 2 separate station tickets
    expect(tickets).toHaveLength(2);

    const ovenTicket = tickets.find((t: any) => t.stationId === hotStationId);
    const barTicket = tickets.find((t: any) => t.stationId === barStationId);

    expect(ovenTicket).toBeDefined();
    expect(barTicket).toBeDefined();

    // Check dietary alerts on Pizza
    const pizzaTicketLine = ovenTicket.lines[0];
    expect(pizzaTicketLine.itemName).toBe("Neapolitan Pizza");
    const alerts = pizzaTicketLine.dietaryAlerts as string[];
    expect(alerts).toContain("GLUTEN_FREE");
    expect(alerts).toContain("NO_NUTS");

    // Invariant: Exactly-once routing (re-routing must NOT duplicate tickets)
    const reRoutedTickets = await routeOrderRoundToStations(
      {
        businessId,
        roundId,
        actorId: userId,
      },
      db
    );
    expect(reRoutedTickets).toHaveLength(2);
    expect(reRoutedTickets[0].revisionNumber).toBe(2); // Revision incremented, zero duplicates
  });

  it("advances ticket status to READY and automatically deducts recipe ingredient stock", async () => {
    const { advanceTicketStatus } = await import("../backend/src/lib/services/kitchen-routing-service");

    const ovenTicket = await db.kitchenTicket.findFirstOrThrow({
      where: { businessId, stationId: hotStationId },
    });

    // 1. Advance to PREPARING
    await advanceTicketStatus(
      {
        businessId,
        ticketId: ovenTicket.id,
        newStatus: "PREPARING",
        actorId: userId,
      },
      db
    );

    // 2. Advance to READY (triggers ingredient deduction)
    await advanceTicketStatus(
      {
        businessId,
        ticketId: ovenTicket.id,
        newStatus: "READY",
        actorId: userId,
      },
      db
    );

    // Verify ConsumptionPostings were created
    const postings = await db.consumptionPosting.findMany({
      where: { businessId },
      include: { stockMovement: true },
    });

    expect(postings).toHaveLength(2);

    // 2 pizzas:
    // Flour: 2 * 0.25 * 1.05 = 0.525 kg deducted
    // Cheese: 2 * 0.15 = 0.300 kg deducted
    const flourPosting = postings.find((p) => p.productId === rawFlourProductId);
    const cheesePosting = postings.find((p) => p.productId === rawCheeseProductId);

    expect(Number(flourPosting?.quantity)).toBe(0.525);
    expect(Number(cheesePosting?.quantity)).toBe(0.3);

    // Verify negative stock movements recorded in authoritative ledger
    expect(Number(flourPosting?.stockMovement?.quantity)).toBe(-0.525);
    expect(Number(cheesePosting?.stockMovement?.quantity)).toBe(-0.3);
  });

  it("records kitchen waste when an item is cancelled after cooking commenced", async () => {
    const { advanceTicketLineStatus } = await import("../backend/src/lib/services/kitchen-routing-service");

    const barTicket = await db.kitchenTicket.findFirstOrThrow({
      where: { businessId, stationId: barStationId },
      include: { lines: true },
    });

    const mojitoLine = barTicket.lines[0];

    // Put into PREPARING first
    await advanceTicketLineStatus(
      {
        businessId,
        ticketLineId: mojitoLine.id,
        newStatus: "PREPARING",
      },
      db
    );

    // Cancel while in prep
    const cancelledLine = await advanceTicketLineStatus(
      {
        businessId,
        ticketLineId: mojitoLine.id,
        newStatus: "CANCELLED",
        wasteReason: "Customer changed mind after mint was crushed",
      },
      db
    );

    expect(cancelledLine.isWaste).toBe(true);
    expect(cancelledLine.wasteReason).toBe("Customer changed mind after mint was crushed");
  });
});
