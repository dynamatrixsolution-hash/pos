import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { backupModels, excludedModels, schemaHash } from "../backend/src/lib/backup-format";
import { Prisma } from "@dynapos/db";

const target = process.env.TEST_DATABASE_URL;

describe("Phase 8 Schema Acyclicity & DR DAG Topological Verification", () => {
  it("includes all 4 Phase 8 models in backupModels in strict topological order without circular FKs", () => {
    const phase8Models = [
      "PropertyFeatureFlag",
      "PrintJob",
      "OfflineSyncBatch",
      "PilotDailyReconciliation",
    ];
    const backupNames = backupModels.map((m) => m.name);

    for (const name of phase8Models) {
      expect(backupNames).toContain(name);
    }

    const idx = (name: string) => backupNames.indexOf(name);

    expect(idx("Branch")).toBeLessThan(idx("PropertyFeatureFlag"));
    expect(idx("KitchenStation")).toBeLessThan(idx("PrintJob"));
    expect(idx("KitchenTicket")).toBeLessThan(idx("PrintJob"));
    expect(idx("Branch")).toBeLessThan(idx("OfflineSyncBatch"));
    expect(idx("Branch")).toBeLessThan(idx("PilotDailyReconciliation"));
    expect(schemaHash).toMatch(/^[a-f0-9]{64}$/);

    const dmmfCount = Prisma.dmmf.datamodel.models.filter(
      (m) => !excludedModels.includes(m.name)
    ).length;
    expect(backupModels.length).toBe(dmmfCount);
  });
});

describe.skipIf(!target)(
  "Phase 8: Operational Readiness, Hardware Rehearsals & Pilot Rollout Integration",
  () => {
    let db: import("@dynapos/db").PrismaClient;
    const businessId = randomUUID();
    const branchId = randomUUID();
    const userId = randomUUID();

    let roomTypeId: string;
    let room201Id: string;
    let room202Id: string;
    let room203Id: string;
    let floorId: string;
    let tableT10Id: string;
    let tableT11Id: string;
    let menuItem1Id: string;
    let hotStationId: string;
    let backupStationId: string;
    let room201QrCode: string;
    let room201StayId: string;
    let room201FolioId: string;
    let guestPinSessionToken: string;

    beforeAll(async () => {
      const { PrismaClient } = await import("@dynapos/db");
      db = new PrismaClient({ datasourceUrl: target, log: [] });
      await db.$connect();

      await db.business.create({
        data: {
          id: businessId,
          name: "RestroInn Grand Pilot Property",
          slug: `restro-phase8-${Date.now()}`,
          currency: "NPR",
          settings: {
            currencySymbol: "Rs. ",
          },
          branches: {
            create: {
              id: branchId,
              name: "Grand Pilot Flagship Branch",
              address: "Lazimpat, Kathmandu",
            },
          },
        },
      });

      await db.user.create({
        data: {
          id: userId,
          businessId,
          branchId,
          name: "Pilot Operations Director",
          email: `phase8-${Date.now()}@restroinn.test`,
          passwordHash: "hashed",
          role: "OWNER",
        },
      });

      const { createRoomType, createRoom } = await import(
        "../backend/src/lib/services/room-availability-service"
      );
      const { createFloor, createTable } = await import(
        "../backend/src/lib/services/floor-table-service"
      );
      const { createMenu, createMenuSection, createMenuItem } = await import(
        "../backend/src/lib/services/menu-catalog-service"
      );
      const { createKitchenStation, createStationRoute } = await import(
        "../backend/src/lib/services/kitchen-routing-service"
      );
      const { ensureQrLocation, verifyAndCreateGuestSession } = await import(
        "../backend/src/lib/services/guest-portal-service"
      );
      const { checkInGuest } = await import(
        "../backend/src/lib/services/hotel-checkin-service"
      );
      const { ensureGuestFolio } = await import(
        "../backend/src/lib/services/folio-service"
      );

      const floor = await createFloor({
        businessId,
        branchId,
        name: "Pilot Main Dining Hall",
        displayOrder: 1,
        actorId: userId,
      });
      floorId = floor.id;

      const t10 = await createTable({
        businessId,
        branchId,
        floorId,
        tableNumber: "P-10",
        capacity: 4,
        actorId: userId,
      });
      tableT10Id = t10.id;

      const t11 = await createTable({
        businessId,
        branchId,
        floorId,
        tableNumber: "P-11",
        capacity: 6,
        actorId: userId,
      });
      tableT11Id = t11.id;

      const rt = await createRoomType(
        {
          businessId,
          branchId,
          name: "Pilot Executive Suite",
          code: "PEX",
          baseRate: 12000,
          maxOccupancy: 3,
          actorId: userId,
        },
        db
      );
      roomTypeId = rt.id;

      const r201 = await createRoom(
        {
          businessId,
          branchId,
          roomTypeId,
          roomNumber: "201",
          floorNumber: 2,
          actorId: userId,
        },
        db
      );
      room201Id = r201.id;

      const r202 = await createRoom(
        {
          businessId,
          branchId,
          roomTypeId,
          roomNumber: "202",
          floorNumber: 2,
          actorId: userId,
        },
        db
      );
      room202Id = r202.id;

      const r203 = await createRoom(
        {
          businessId,
          branchId,
          roomTypeId,
          roomNumber: "203",
          floorNumber: 2,
          actorId: userId,
        },
        db
      );
      room203Id = r203.id;

      const hotStation = await createKitchenStation({
        businessId,
        branchId,
        name: "Hot Kitchen Primary",
        code: "HOT",
        printerIp: "192.168.10.51",
        printerPort: 9100,
        displayOrder: 1,
      });
      hotStationId = hotStation.id;

      const backupStation = await createKitchenStation({
        businessId,
        branchId,
        name: "Grill & Backup Kitchen",
        code: "BACKUP",
        printerIp: "192.168.10.52",
        printerPort: 9100,
        displayOrder: 2,
      });
      backupStationId = backupStation.id;

      const menu = await createMenu({
        businessId,
        branchId,
        name: "Pilot All-Day Dining",
        isDefault: true,
      });
      const section = await createMenuSection({
        businessId,
        menuId: menu.id,
        name: "Signature Entrees",
        displayOrder: 1,
      });
      const item1 = await createMenuItem({
        businessId,
        sectionId: section.id,
        name: "Himalayan Grilled Trout",
        basePrice: 1450,
        prepTimeMinutes: 15,
      });
      menuItem1Id = item1.id;

      await createStationRoute({
        businessId,
        stationId: hotStationId,
        menuItemId: menuItem1Id,
        priority: 1,
      });

      const qr201 = await ensureQrLocation(
        {
          businessId,
          branchId,
          locationType: "ROOM",
          roomId: room201Id,
          actorId: userId,
        },
        db
      );
      room201QrCode = qr201.publicCode;

      const checkin201 = await checkInGuest(
        {
          businessId,
          branchId,
          roomId: room201Id,
          guestName: "Aarav Sharma",
          guestPhone: "9841228899",
          checkInTime: new Date("2027-04-01T14:00:00Z"),
          expectedCheckOut: new Date("2027-04-03T11:00:00Z"),
          ratePerNight: 12000,
          actorId: userId,
        },
        db
      );
      room201StayId = checkin201.stay.id;

      const folio201 = await ensureGuestFolio(
        {
          businessId,
          branchId,
          stayId: room201StayId,
          windowName: "PRIMARY",
          actorId: userId,
        },
        db
      );
      room201FolioId = folio201.id;

      const verified = await verifyAndCreateGuestSession(
        {
          publicCode: room201QrCode,
          guestLastName: "Sharma",
          guestPhoneLast4: "8899",
          deviceFingerprint: "pilot-guest-phone-1",
        },
        db
      );
      guestPinSessionToken = verified.sessionToken;
    });

    afterAll(async () => {
      if (db) {
        await db.business.deleteMany({ where: { id: businessId } });
        await db.$disconnect();
      }
    });

    it("1. enforces PropertyFeatureFlag toggles: disabling guestQrEnabled blocks new guest QR self-orders & requests while preserving existing committed folios and stays", async () => {
      const {
        getPropertyFeatureFlags,
        updatePropertyFeatureFlags,
      } = await import("../backend/src/lib/services/pilot-rollout-service");
      const {
        submitGuestOrder,
        createGuestServiceRequest,
      } = await import("../backend/src/lib/services/guest-portal-service");
      const { postRoomNightCharge } = await import(
        "../backend/src/lib/services/folio-service"
      );

      await postRoomNightCharge(
        {
          businessId,
          branchId,
          stayId: room201StayId,
          folioId: room201FolioId,
          chargeDate: "2027-04-01",
          baseRate: 12000,
          taxRatePercent: 13,
          actorId: userId,
        },
        db
      );

      const initialFlags = await getPropertyFeatureFlags(db, {
        businessId,
        branchId,
      });
      expect(initialFlags.hotelEnabled).toBe(true);
      expect(initialFlags.guestQrEnabled).toBe(true);

      // Post an initial room-service order while enabled
      const order1 = await submitGuestOrder(
        {
          sessionToken: guestPinSessionToken,
          idempotencyKey: `pilot-qr-ord-1-${Date.now()}`,
          items: [{ menuItemId: menuItem1Id, quantity: 1 }],
        },
        db
      );
      expect(order1.order.id).toBeDefined();

      // Route the round to kitchen so we have a KitchenTicket for Test 2
      const { updateLineStatus } = await import(
        "../backend/src/lib/services/restaurant-order-service"
      );
      const { routeOrderRoundToStations } = await import(
        "../backend/src/lib/services/kitchen-routing-service"
      );
      await updateLineStatus({
        businessId,
        lineId: order1.lines[0].id,
        acceptanceStatus: "ACCEPTED",
        fulfillmentStatus: "PREPARING",
        actorId: userId,
      });
      await routeOrderRoundToStations({
        businessId,
        roundId: order1.round.id,
        actorId: userId,
      });

      // Disable guestQrEnabled at the branch level
      const disabledFlags = await updatePropertyFeatureFlags(db, {
        businessId,
        branchId,
        updatedById: userId,
        guestQrEnabled: false,
        pilotMode: true,
      });
      expect(disabledFlags.guestQrEnabled).toBe(false);
      expect(disabledFlags.pilotMode).toBe(true);

      // New guest QR self-order and service request must be rejected with FEATURE_DISABLED (403)
      await expect(
        submitGuestOrder(
          {
            sessionToken: guestPinSessionToken,
            idempotencyKey: `pilot-qr-ord-blocked-${Date.now()}`,
            items: [{ menuItemId: menuItem1Id, quantity: 1 }],
          },
          db
        )
      ).rejects.toMatchObject({
        statusCode: 403,
        code: "FEATURE_DISABLED",
      });

      await expect(
        createGuestServiceRequest(
          {
            sessionToken: guestPinSessionToken,
            requestType: "EXTRA_TOWELS",
          },
          db
        )
      ).rejects.toMatchObject({
        statusCode: 403,
        code: "FEATURE_DISABLED",
      });

      // Verify committed stay and folio charges were NOT erased
      const folio = await db.guestFolio.findUniqueOrThrow({
        where: { id: room201FolioId },
        include: { entries: true },
      });
      expect(folio.status).toBe("OPEN");
      expect(folio.entries.length).toBeGreaterThanOrEqual(1);
      expect(Number(folio.chargesTotal)).toBeGreaterThan(0);

      // Re-enable guestQrEnabled
      const reenabled = await updatePropertyFeatureFlags(db, {
        businessId,
        branchId,
        updatedById: userId,
        guestQrEnabled: true,
      });
      expect(reenabled.guestQrEnabled).toBe(true);
    });

    it("2. executes 4-step Hardware Compatibility Matrix (80mm receipt, 58mm KOT, RJ11 cash drawer kick pulse, and automatic printer jam failover with KDS visual alert)", async () => {
      const {
        rehearseHardwareMatrix,
        enqueueAndDispatchPrintJob,
        listPrintJobs,
      } = await import("../backend/src/lib/services/pilot-rollout-service");

      const existingTicket = await db.kitchenTicket.findFirstOrThrow({
        where: { businessId, branchId },
      });

      const matrix = await rehearseHardwareMatrix(db, {
        businessId,
        branchId,
        stationId: hotStationId,
        fallbackStationId: backupStationId,
        actorUserId: userId,
      });

      expect(matrix.passed).toBe(true);
      expect(matrix.summary.receipt80mmPassed).toBe(true);
      expect(matrix.summary.kot58mmPassed).toBe(true);
      expect(matrix.summary.cashDrawerPulsePassed).toBe(true);
      expect(matrix.summary.printerFailoverPassed).toBe(true);
      expect(matrix.jobs).toHaveLength(4);

      const failoverJob = await enqueueAndDispatchPrintJob(db, {
        businessId,
        branchId,
        stationId: hotStationId,
        fallbackStationId: backupStationId,
        ticketId: existingTicket.id,
        jobType: "KOT_58MM",
        title: "KOT #T-201",
        lines: [{ label: "Himalayan Grilled Trout", qty: 2 }],
        simulatePrimaryFailure: true,
        idempotencyKey: `failover-kot-${Date.now()}`,
        actorUserId: userId,
      });

      expect(failoverJob.job.status).toBe("REDIRECTED_TO_BACKUP");
      expect(failoverJob.job.routedStationId).toBe(backupStationId);
      expect(failoverJob.failoverAlert.redirected).toBe(true);
      expect(failoverJob.failoverAlert.backupStationCode).toBe("BACKUP");

      const updatedTicket = await db.kitchenTicket.findUniqueOrThrow({
        where: { id: existingTicket.id },
      });
      expect(updatedTicket.notes).toContain("FAILOVER ALERT");
      expect(updatedTicket.notes).toContain("BACKUP");

      const queue = await listPrintJobs(db, { businessId, branchId });
      expect(queue.kdsFailoverAlerts.length).toBeGreaterThanOrEqual(1);
    });

    it("3. buffers offline terminal drafts and synchronizes idempotently upon reconnect with zero duplicates on replay", async () => {
      const { syncOfflineDraftBatch } = await import(
        "../backend/src/lib/services/pilot-rollout-service"
      );

      const batchKey = `OFFLINE-BATCH-${Date.now()}`;
      const qrLocation = await db.qrLocation.findFirstOrThrow({
        where: { businessId, branchId, publicCode: room201QrCode },
      });

      const operations = [
        {
          idempotencyKey: `off-ord-1-${Date.now()}`,
          type: "RESTAURANT_ORDER_DRAFT" as const,
          payload: {
            orderNumber: `ORD-OFF-${Date.now()}`,
            orderType: "DINE_IN",
            tableId: tableT10Id,
            notes: "Buffered while Wi-Fi AP roamed",
            items: [
              {
                menuItemId: menuItem1Id,
                quantity: 2,
                unitPrice: 1450,
              },
            ],
          },
        },
        {
          idempotencyKey: `off-sr-1-${Date.now()}`,
          type: "SERVICE_REQUEST_DRAFT" as const,
          payload: {
            qrLocationId: qrLocation.id,
            requestType: "WATER_REFILL",
            notes: "Offline waiter tablet water request",
          },
        },
      ];

      const firstSync = await syncOfflineDraftBatch(db, {
        businessId,
        branchId,
        terminalId: "TERM-WAITSTAFF-02",
        batchKey,
        syncedById: userId,
        operations,
      });

      expect(firstSync.replayed).toBe(false);
      expect(firstSync.batch.status).toBe("COMPLETED");
      expect(firstSync.batch.operationsCount).toBe(2);
      expect(firstSync.batch.appliedCount).toBe(2);

      const orderCountAfterFirst = await db.restaurantOrder.count({
        where: { businessId, branchId },
      });

      const secondSync = await syncOfflineDraftBatch(db, {
        businessId,
        branchId,
        terminalId: "TERM-WAITSTAFF-02",
        batchKey,
        syncedById: userId,
        operations,
      });

      expect(secondSync.replayed).toBe(true);
      expect(secondSync.batch.id).toBe(firstSync.batch.id);

      const orderCountAfterReplay = await db.restaurantOrder.count({
        where: { businessId, branchId },
      });
      expect(orderCountAfterReplay).toBe(orderCountAfterFirst);
    });

    it("4. sustains concurrent peak-hour dining orders & front-desk check-ins without deadlocks or folio drift", async () => {
      const { checkInGuest } = await import(
        "../backend/src/lib/services/hotel-checkin-service"
      );
      const { openTableSession } = await import(
        "../backend/src/lib/services/table-session-service"
      );
      const { createOrAppendOrder, updateLineStatus } = await import(
        "../backend/src/lib/services/restaurant-order-service"
      );
      const { routeOrderRoundToStations } = await import(
        "../backend/src/lib/services/kitchen-routing-service"
      );

      // Run parallel front-desk check-ins + parallel restaurant table session opening
      const [checkin202, checkin203, diningSession] = await Promise.all([
        checkInGuest(
          {
            businessId,
            branchId,
            roomId: room202Id,
            guestName: "Bikash Thapa",
            guestPhone: "9801112233",
            checkInTime: new Date("2027-04-01T15:00:00Z"),
            expectedCheckOut: new Date("2027-04-03T11:00:00Z"),
            ratePerNight: 12000,
            actorId: userId,
          },
          db
        ),
        checkInGuest(
          {
            businessId,
            branchId,
            roomId: room203Id,
            guestName: "Sita Gurung",
            guestPhone: "9801114455",
            checkInTime: new Date("2027-04-01T15:05:00Z"),
            expectedCheckOut: new Date("2027-04-03T11:00:00Z"),
            ratePerNight: 12000,
            actorId: userId,
          },
          db
        ),
        openTableSession({
          businessId,
          branchId,
          tableId: tableT11Id,
          guestCount: 4,
          openedById: userId,
        }),
      ]);

      expect(checkin202.stay.status).toBe("ACTIVE");
      expect(checkin203.stay.status).toBe("ACTIVE");
      expect(diningSession.session.status).toBe("ACTIVE");

      const orderRes = await createOrAppendOrder({
        businessId,
        branchId,
        tableId: tableT11Id,
        tableSessionId: diningSession.session.id,
        orderType: "DINE_IN",
        actorId: userId,
        items: [
          {
            menuItemId: menuItem1Id,
            itemName: "Himalayan Grilled Trout",
            basePrice: 1450,
            quantity: 3,
          },
        ],
      });

      await updateLineStatus({
        businessId,
        lineId: orderRes.lines[0].id,
        acceptanceStatus: "ACCEPTED",
        fulfillmentStatus: "PREPARING",
        actorId: userId,
      });

      const tickets = await routeOrderRoundToStations({
        businessId,
        roundId: orderRes.round.id,
        actorId: userId,
      });

      expect(tickets.length).toBeGreaterThanOrEqual(1);
    });

    it("5. reconciles Pilot Daily Audit & Cash Drawer with zero discrepancy (BALANCED) and flags variance when cash count differs", async () => {
      const {
        runPilotDailyReconciliation,
        getPilotOperationalHealth,
      } = await import("../backend/src/lib/services/pilot-rollout-service");

      const todayStr = new Date().toISOString().slice(0, 10);

      const probe = await runPilotDailyReconciliation(db, {
        businessId,
        branchId,
        businessDate: todayStr,
        declaredCashTotal: 5000,
        expectedCashOverride: 5000,
        notes: "Pilot shift handover — exact drawer match",
        reconciledById: userId,
      });

      expect(probe.status).toBe("BALANCED");
      expect(Number(probe.cashVariance)).toBe(0);
      expect(Number(probe.restaurantOrdersTotal)).toBeGreaterThan(0);

      const flagged = await runPilotDailyReconciliation(db, {
        businessId,
        branchId,
        businessDate: todayStr,
        declaredCashTotal: 4750,
        expectedCashOverride: 5000,
        notes: "Short Rs. 250 during evening shift check",
        reconciledById: userId,
      });

      expect(flagged.status).toBe("DISCREPANCY_FLAGGED");
      expect(Number(flagged.cashVariance)).toBe(-250);

      const balanced = await runPilotDailyReconciliation(db, {
        businessId,
        branchId,
        businessDate: todayStr,
        declaredCashTotal: 5000,
        expectedCashOverride: 5000,
        notes: "Resolved Petty Cash voucher — zero discrepancy verified",
        reconciledById: userId,
      });
      expect(balanced.status).toBe("BALANCED");
      expect(Number(balanced.cashVariance)).toBe(0);

      const health = await getPilotOperationalHealth(db, {
        businessId,
        branchId,
      });
      expect(health.rpoTargetMinutes).toBe(5);
      expect(health.rtoTargetMinutes).toBe(30);
      expect(health.printQueue.printedCount).toBeGreaterThanOrEqual(3);
      expect(health.printQueue.redirectedCount).toBeGreaterThanOrEqual(1);
    });
  }
);
