import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";

const target = process.env.TEST_DATABASE_URL;

describe.skipIf(!target)("Phase 6: Guest Folios, Charge-to-Room Bridge & Combined Settlement Integration", () => {
  let db: import("@dynapos/db").PrismaClient;
  const businessId = randomUUID();
  const branchId = randomUUID();
  const userId = randomUUID();

  let roomTypeId: string;
  let room302Id: string;
  let room303Id: string;
  let stayId: string;
  let secondStayId: string;
  let primaryFolioId: string;
  let companyFolioId: string;
  let restaurantOrderId: string;
  let diningFolioEntryId: string;
  let minibarEntryId: string;

  beforeAll(async () => {
    const { PrismaClient } = await import("@dynapos/db");
    db = new PrismaClient({ datasourceUrl: target, log: [] });
    await db.$connect();

    await db.business.create({
      data: {
        id: businessId,
        name: "RestroInn Grand Folio Resort",
        slug: `restro-folio-${Date.now()}`,
        currency: "NPR",
        branches: {
          create: {
            id: branchId,
            name: "Resort Main Wing",
            address: "Kathmandu",
          },
        },
      },
    });

    await db.user.create({
      data: {
        id: userId,
        businessId,
        branchId,
        name: "Folio Cashier",
        email: `folio-${Date.now()}@restroinn.test`,
        passwordHash: "hashed",
        role: "MANAGER",
      },
    });

    const { createRoomType, createRoom } = await import("../backend/src/lib/services/room-availability-service");
    const { checkInGuest } = await import("../backend/src/lib/services/hotel-checkin-service");

    const rt = await createRoomType(
      {
        businessId,
        branchId,
        name: "Premier Suite",
        code: "PRM-S",
        baseRate: 10000,
        maxOccupancy: 2,
        actorId: userId,
      },
      db
    );
    roomTypeId = rt.id;

    const r302 = await createRoom(
      {
        businessId,
        branchId,
        roomTypeId,
        roomNumber: "302",
        capacity: 2,
        status: "VACANT_CLEAN",
        actorId: userId,
      },
      db
    );
    room302Id = r302.id;

    const r303 = await createRoom(
      {
        businessId,
        branchId,
        roomTypeId,
        roomNumber: "303",
        capacity: 2,
        status: "VACANT_CLEAN",
        actorId: userId,
      },
      db
    );
    room303Id = r303.id;

    const now = new Date("2027-02-01T14:00:00Z");
    const out = new Date("2027-02-04T11:00:00Z");

    const checkIn1 = await checkInGuest(
      {
        businessId,
        branchId,
        roomId: room302Id,
        guestName: "Rohan Thapa",
        guestPhone: "9801122334",
        checkInTime: now,
        expectedCheckOut: out,
        ratePerNight: 10000,
        actorId: userId,
      },
      db
    );
    stayId = checkIn1.stay.id;

    const checkIn2 = await checkInGuest(
      {
        businessId,
        branchId,
        roomId: room303Id,
        guestName: "Sita Gurung",
        guestPhone: "9809988776",
        checkInTime: now,
        expectedCheckOut: out,
        ratePerNight: 10000,
        actorId: userId,
      },
      db
    );
    secondStayId = checkIn2.stay.id;
  });

  afterAll(async () => {
    if (db) {
      await db.business.deleteMany({ where: { id: businessId } });
      await db.$disconnect();
    }
  });

  it("1. ensures PRIMARY GuestFolio, posts Room-Night charge, rejects duplicate night posting (409), and runs Night Audit", async () => {
    const {
      ensureGuestFolio,
      postRoomNightCharge,
      runNightAuditForBranch,
    } = await import("../backend/src/lib/services/folio-service");

    const folio = await ensureGuestFolio(
      {
        businessId,
        branchId,
        stayId,
        windowName: "PRIMARY",
        actorId: userId,
      },
      db
    );
    primaryFolioId = folio.id;
    expect(folio.windowName).toBe("PRIMARY");
    expect(folio.status).toBe("OPEN");

    // Post Night 1 (2027-02-01) for Room 302 (Rs. 10,000)
    const night1 = await postRoomNightCharge(
      {
        businessId,
        branchId,
        stayId,
        folioId: primaryFolioId,
        chargeDate: "2027-02-01",
        baseRate: 10000,
        taxRatePercent: 0,
        actorId: userId,
      },
      db
    );
    expect(Number(night1.entry.totalAmount)).toBe(10000);
    expect(night1.entry.isRevenueRecognizedHere).toBe(true);
    expect(Number(night1.folio.balance)).toBe(10000);

    // Duplicate Night 1 posting for the same stay must reject with 409 Conflict
    await expect(
      postRoomNightCharge(
        {
          businessId,
          branchId,
          stayId,
          folioId: primaryFolioId,
          chargeDate: "2027-02-01",
          baseRate: 10000,
          actorId: userId,
        },
        db
      )
    ).rejects.toMatchObject({ statusCode: 409 });

    // Run automated Night Audit for 2027-02-02 across branch -> charges both active stays once
    const audit = await runNightAuditForBranch(
      {
        businessId,
        branchId,
        auditDate: "2027-02-02",
        taxRatePercent: 0,
        actorId: userId,
      },
      db
    );
    expect(audit.postedCharges.length).toBeGreaterThanOrEqual(2);

    const updatedFolio = await db.guestFolio.findUniqueOrThrow({ where: { id: primaryFolioId } });
    expect(Number(updatedFolio.chargesTotal)).toBe(20000);
    expect(Number(updatedFolio.balance)).toBe(20000);
  });

  it("2. executes Charge-to-Room bridge for RestaurantOrder with zero duplicate revenue and idempotent replay", async () => {
    const { createOrAppendOrder } = await import("../backend/src/lib/services/restaurant-order-service");
    const { postRestaurantOrderToFolio } = await import("../backend/src/lib/services/folio-service");

    // Create a restaurant order of Rs. 2,000 + 13% VAT (Rs. 260) = Rs. 2,260.00
    const orderRes = await createOrAppendOrder(
      {
        businessId,
        branchId,
        orderType: "DINE_IN",
        items: [
          {
            itemName: "Grilled Himalayan Trout Platter",
            basePrice: 1000,
            quantity: 2,
          },
        ],
        actorId: userId,
      },
      db
    );
    restaurantOrderId = orderRes.order.id;
    expect(Number(orderRes.order.totalAmount)).toBe(2000);

    // Post restaurant order to Room 302's folio
    const bridge1 = await postRestaurantOrderToFolio(
      {
        businessId,
        branchId,
        orderId: restaurantOrderId,
        stayId,
        folioId: primaryFolioId,
        actorId: userId,
      },
      db
    );
    diningFolioEntryId = bridge1.entry.id;

    expect(bridge1.idempotentReplay).toBe(false);
    expect(bridge1.entry.sourceType).toBe("RESTAURANT_ORDER");
    expect(bridge1.entry.postingKind).toBe("RECEIVABLE_TRANSFER");
    expect(bridge1.entry.category).toBe("DINING");
    expect(bridge1.entry.isRevenueRecognizedHere).toBe(false); // Crucial: food revenue stays in RestaurantOrder!
    expect(Number(bridge1.entry.totalAmount)).toBe(2000);
    expect(bridge1.order.settlementStatus).toBe("PAID");
    expect(Number(bridge1.folio.balance)).toBe(22000); // 20,000 room + 2,000 dining

    // Posting the exact same food order a second time to the same stay replays idempotently without double-charging
    const bridge2 = await postRestaurantOrderToFolio(
      {
        businessId,
        branchId,
        orderId: restaurantOrderId,
        stayId,
        folioId: primaryFolioId,
        actorId: userId,
      },
      db
    );
    expect(bridge2.idempotentReplay).toBe(true);
    expect(bridge2.entry.id).toBe(diningFolioEntryId);
    expect(Number(bridge2.folio.balance)).toBe(22000);

    // Attempting to post the same restaurant order to another stay (Room 303) rejects with 409 Conflict
    await expect(
      postRestaurantOrderToFolio(
        {
          businessId,
          branchId,
          orderId: restaurantOrderId,
          stayId: secondStayId,
          actorId: userId,
        },
        db
      )
    ).rejects.toMatchObject({ statusCode: 409 });
  });

  it("3. posts incidental charges, applies an offsetting credit adjustment on a dining entry, and transfers charges across split-folio windows", async () => {
    const {
      ensureGuestFolio,
      postManualFolioCharge,
      reverseOrAdjustFolioEntry,
      transferFolioEntryBetweenWindows,
    } = await import("../backend/src/lib/services/folio-service");

    // Post Rs. 500 Mini-bar charge
    const minibar = await postManualFolioCharge(
      {
        businessId,
        branchId,
        stayId,
        folioId: primaryFolioId,
        category: "MINIBAR",
        description: "Assorted nuts & sparkling water",
        amount: 500,
        taxAmount: 0,
        actorId: userId,
      },
      db
    );
    minibarEntryId = minibar.entry.id;
    expect(Number(minibar.folio.balance)).toBe(22500);

    // Apply Rs. 200 credit adjustment on the dining order entry
    const adj = await reverseOrAdjustFolioEntry(
      {
        businessId,
        branchId,
        folioEntryId: diningFolioEntryId,
        adjustmentAmount: 200,
        reason: "Complimentary dessert discount",
        actorId: userId,
      },
      db
    );
    expect(adj.creditEntry.direction).toBe("CREDIT");
    expect(adj.creditEntry.reversedEntryId).toBe(diningFolioEntryId);
    expect(adj.creditEntry.isRevenueRecognizedHere).toBe(false);
    expect(Number(adj.folio.creditsTotal)).toBe(200);
    expect(Number(adj.folio.balance)).toBe(22300); // 22,500 - 200

    // Create a COMPANY split-folio window and transfer the Mini-bar charge to it, then transfer back
    const companyFolio = await ensureGuestFolio(
      {
        businessId,
        branchId,
        stayId,
        windowName: "COMPANY",
        actorId: userId,
      },
      db
    );
    companyFolioId = companyFolio.id;

    const movedToCompany = await transferFolioEntryBetweenWindows(
      {
        businessId,
        entryId: minibarEntryId,
        targetFolioId: companyFolioId,
        actorId: userId,
      },
      db
    );
    expect(Number(movedToCompany.sourceFolio.balance)).toBe(21800);
    expect(Number(movedToCompany.targetFolio.balance)).toBe(500);

    // Move back to PRIMARY for unified checkout
    const movedBack = await transferFolioEntryBetweenWindows(
      {
        businessId,
        entryId: minibarEntryId,
        targetFolioId: primaryFolioId,
        actorId: userId,
      },
      db
    );
    expect(Number(movedBack.targetFolio.balance)).toBe(22300);
    expect(Number(movedBack.sourceFolio.balance)).toBe(0);
  });

  it("4. enforces SETTLING lock against concurrent charges and completes multi-tender split settlement with zero double-counted revenue", async () => {
    const {
      lockFolioForCheckout,
      postManualFolioCharge,
      settleGuestFolio,
      getFolioAccountingReconciliation,
    } = await import("../backend/src/lib/services/folio-service");

    // Lock primary folio for checkout
    const locked = await lockFolioForCheckout(
      {
        businessId,
        folioId: primaryFolioId,
        actorId: userId,
      },
      db
    );
    expect(locked.status).toBe("SETTLING");

    // Any late charge attempting to attach while SETTLING must reject with 409 Conflict
    await expect(
      postManualFolioCharge(
        {
          businessId,
          branchId,
          stayId,
          folioId: primaryFolioId,
          category: "LAUNDRY",
          description: "Late express pressing",
          amount: 400,
          actorId: userId,
        },
        db
      )
    ).rejects.toMatchObject({ statusCode: 409 });

    // Settle Rs. 22,300 across 3 tenders: Rs. 10,000 CARD + Rs. 7,300 QR + Rs. 5,000 CASH
    const settled = await settleGuestFolio(
      {
        businessId,
        branchId,
        folioId: primaryFolioId,
        tenders: [
          { paymentMethod: "CARD", amount: 10000, reference: "VISA-AUTH-9911" },
          { paymentMethod: "QR", amount: 7300, reference: "FONEPAY-8822" },
          { paymentMethod: "CASH", amount: 5000 },
        ],
        actorId: userId,
      },
      db
    );

    expect(settled.allocations).toHaveLength(3);
    expect(Number(settled.folio.paymentsTotal)).toBe(22300);
    expect(Number(settled.folio.balance)).toBe(0);
    expect(settled.folio.status).toBe("CLOSED");

    // Verify canonical accounting reconciliation
    const recon = await getFolioAccountingReconciliation({ businessId, stayId }, db);
    expect(Number(recon.roomRevenue)).toBe(20000);
    expect(Number(recon.diningReceivableTransferred)).toBe(2000);
    expect(Number(recon.incidentalRevenue)).toBe(500);
    expect(Number(recon.creditsAndAdjustments)).toBe(200);
    expect(Number(recon.totalFolioPayments)).toBe(22300);
    expect(Number(recon.outstandingBalance)).toBe(0);
    expect(recon.doubleCountedRevenue).toBe("0.00");
  });

  it("5. retains the same GuestFolio across room transfers, blocks checkout when folio has unresolved balance, and rejects charges to a closed stay", async () => {
    const {
      ensureGuestFolio,
      postManualFolioCharge,
      settleGuestFolio,
    } = await import("../backend/src/lib/services/folio-service");
    const { checkOutStay } = await import("../backend/src/lib/services/hotel-checkout-service");
    const { transferRoom } = await import("../backend/src/lib/services/hotel-room-transfer-service");

    // Check out Stay 1 (Room 302) now that its folio is settled -> frees Room 302 (marks VACANT_DIRTY)
    const out1 = await checkOutStay(
      {
        businessId,
        stayId,
        enforceSettlement: true,
        actorId: userId,
      },
      db
    );
    expect(out1.stay.status).toBe("COMPLETED");

    // Attempting to post a charge to the now-closed Stay 1 rejects with 409 Conflict
    await expect(
      postManualFolioCharge(
        {
          businessId,
          branchId,
          stayId,
          category: "SPA",
          description: "Post-checkout spa attempt",
          amount: 1500,
          actorId: userId,
        },
        db
      )
    ).rejects.toMatchObject({ statusCode: 409 });

    // On Stay 2 (Room 303), verify its folio has the Rs. 10,000 Night Audit charge from Test 1
    const stay2FolioBefore = await ensureGuestFolio(
      {
        businessId,
        branchId,
        stayId: secondStayId,
        windowName: "PRIMARY",
        actorId: userId,
      },
      db
    );
    expect(Number(stay2FolioBefore.balance)).toBe(10000);

    // Transfer Stay 2 from Room 303 to Room 302 -> retains the exact same folio identity and balance
    const transfer2 = await transferRoom(
      {
        businessId,
        stayId: secondStayId,
        targetRoomId: room302Id,
        reason: "Move to Room 302",
        actorId: userId,
      },
      db
    );
    expect(transfer2.stay.id).toBe(secondStayId);

    const stay2FolioAfter = await ensureGuestFolio(
      {
        businessId,
        branchId,
        stayId: secondStayId,
        windowName: "PRIMARY",
        actorId: userId,
      },
      db
    );
    expect(stay2FolioAfter.id).toBe(stay2FolioBefore.id);
    expect(stay2FolioAfter.folioNumber).toBe(stay2FolioBefore.folioNumber);
    expect(Number(stay2FolioAfter.balance)).toBe(10000);

    // Attempting to check out Stay 2 with enforceSettlement: true while Rs. 10,000 is unpaid must reject with 400
    await expect(
      checkOutStay(
        {
          businessId,
          stayId: secondStayId,
          enforceSettlement: true,
          actorId: userId,
        },
        db
      )
    ).rejects.toMatchObject({ statusCode: 400 });

    // Settle Stay 2's folio and check out cleanly
    await settleGuestFolio(
      {
        businessId,
        branchId,
        folioId: stay2FolioAfter.id,
        tenders: [{ paymentMethod: "CASH", amount: 10000 }],
        actorId: userId,
      },
      db
    );

    const out2 = await checkOutStay(
      {
        businessId,
        stayId: secondStayId,
        enforceSettlement: true,
        actorId: userId,
      },
      db
    );
    expect(out2.stay.status).toBe("COMPLETED");
  });
});

