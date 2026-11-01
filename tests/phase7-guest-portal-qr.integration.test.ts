import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { backupModels, excludedModels, schemaHash } from "../backend/src/lib/backup-format";
import { Prisma } from "@dynapos/db";

const target = process.env.TEST_DATABASE_URL;

describe("Phase 7 Schema Acyclicity & DR DAG Topological Verification", () => {
  it("includes all 4 Phase 7 models in backupModels in strict topological order", () => {
    const phase7Models = [
      "QrLocation",
      "GuestAccessGrant",
      "GuestSession",
      "ServiceRequest",
    ];
    const backupNames = backupModels.map((m) => m.name);

    for (const name of phase7Models) {
      expect(backupNames).toContain(name);
    }

    const idx = (name: string) => backupNames.indexOf(name);

    expect(idx("Room")).toBeLessThan(idx("QrLocation"));
    expect(idx("RestaurantTable")).toBeLessThan(idx("QrLocation"));
    expect(idx("QrLocation")).toBeLessThan(idx("GuestAccessGrant"));
    expect(idx("Stay")).toBeLessThan(idx("GuestAccessGrant"));
    expect(idx("TableSession")).toBeLessThan(idx("GuestAccessGrant"));
    expect(idx("GuestAccessGrant")).toBeLessThan(idx("GuestSession"));
    expect(idx("GuestSession")).toBeLessThan(idx("ServiceRequest"));
    expect(schemaHash).toMatch(/^[a-f0-9]{64}$/);

    const dmmfCount = Prisma.dmmf.datamodel.models.filter(
      (m) => !excludedModels.includes(m.name)
    ).length;
    expect(backupModels.length).toBe(dmmfCount);
  });
});

describe.skipIf(!target)(
  "Phase 7: Guest Self-Service Portal & Location QR System Integration",
  () => {
    let db: import("@dynapos/db").PrismaClient;
    const businessId = randomUUID();
    const branchId = randomUUID();
    const userId = randomUUID();

    let roomTypeId: string;
    let room104Id: string;
    let room105Id: string;
    let floorId: string;
    let tableT1Id: string;
    let menuItem1Id: string;
    let menuItem2Id: string;
    let modGroup1Id: string;
    let modOpt1Id: string;
    let kitchenStationId: string;

    let room104QrCode: string;
    let room105QrCode: string;
    let tableT1QrCode: string;

    let stay1Id: string;
    let stay1FolioId: string;
    let guest1SessionToken: string;

    beforeAll(async () => {
      const { PrismaClient } = await import("@dynapos/db");
      db = new PrismaClient({ datasourceUrl: target, log: [] });
      await db.$connect();

      await db.business.create({
        data: {
          id: businessId,
          name: "RestroInn Heritage Palace",
          slug: `restro-phase7-${Date.now()}`,
          currency: "NPR",
          settings: {
            currencySymbol: "Rs. ",
            googleReviewUrl: "https://g.page/r/restroinn-heritage/review",
          },
          branches: {
            create: {
              id: branchId,
              name: "Heritage Main Wing",
              address: "Durbar Marg, Kathmandu",
            },
          },
        },
      });

      await db.user.create({
        data: {
          id: userId,
          businessId,
          branchId,
          name: "Front Desk Supervisor",
          email: `phase7-${Date.now()}@restroinn.test`,
          passwordHash: "hashed",
          role: "MANAGER",
        },
      });

      const { createRoomType, createRoom } = await import(
        "../backend/src/lib/services/room-availability-service"
      );
      const { createFloor, createTable } = await import(
        "../backend/src/lib/services/floor-table-service"
      );
      const {
        createMenu,
        createMenuSection,
        createMenuItem,
        createModifierGroup,
      } = await import("../backend/src/lib/services/menu-catalog-service");
      const { createKitchenStation, createStationRoute } = await import(
        "../backend/src/lib/services/kitchen-routing-service"
      );

      const floor = await createFloor({
        businessId,
        branchId,
        name: "Courtyard Dining & Ground Wing",
        displayOrder: 1,
        actorId: userId,
      });
      floorId = floor.id;

      const table1 = await createTable({
        businessId,
        branchId,
        floorId,
        tableNumber: "T-01",
        capacity: 4,
        actorId: userId,
      });
      tableT1Id = table1.id;

      const rt = await createRoomType(
        {
          businessId,
          branchId,
          name: "Heritage Deluxe Room",
          code: "HDX",
          baseRate: 8500,
          maxOccupancy: 2,
          actorId: userId,
        },
        db
      );
      roomTypeId = rt.id;

      const r104 = await createRoom(
        {
          businessId,
          branchId,
          roomTypeId,
          floorId,
          roomNumber: "104",
          capacity: 2,
          status: "VACANT_CLEAN",
          actorId: userId,
        },
        db
      );
      room104Id = r104.id;

      const r105 = await createRoom(
        {
          businessId,
          branchId,
          roomTypeId,
          floorId,
          roomNumber: "105",
          capacity: 2,
          status: "VACANT_CLEAN",
          actorId: userId,
        },
        db
      );
      room105Id = r105.id;

      const menu = await createMenu({
        businessId,
        branchId,
        name: "All-Day Room & Courtyard Menu",
        description: "Freshly prepared Himalayan & Continental classics",
      });

      const section = await createMenuSection({
        businessId,
        menuId: menu.id,
        name: "Signature Mains",
        displayOrder: 1,
      });

      const modGroup = await createModifierGroup({
        businessId,
        name: "Spice Level",
        minSelections: 0,
        maxSelections: 1,
        options: [
          { name: "Mild", priceDelta: 0 },
          { name: "Extra Himalayan Timur (+Rs. 50)", priceDelta: 50 },
        ],
      });
      modGroup1Id = modGroup.id;
      const extraOption = modGroup.options.find((o: any) => Number(o.priceDelta) === 50)!;
      modOpt1Id = extraOption.id;

      const item1 = await createMenuItem({
        businessId,
        sectionId: section.id,
        name: "Thakali Mutton Thali",
        description: "Traditional Mustang buckwheat & black lentil thali",
        basePrice: 950,
        taxRate: 13,
        prepTimeMinutes: 20,
        modifierGroupIds: [modGroup1Id],
      });
      menuItem1Id = item1.id;

      const item2 = await createMenuItem({
        businessId,
        sectionId: section.id,
        name: "Artisan Masala Chai",
        description: "Ilam orthodox tea brewed with cardamom and ginger",
        basePrice: 250,
        taxRate: 13,
        prepTimeMinutes: 8,
      });
      menuItem2Id = item2.id;

      const station = await createKitchenStation({
        businessId,
        branchId,
        name: "Main Hot Kitchen",
        code: "HOT-KITCHEN",
      });
      kitchenStationId = station.id;

      await createStationRoute({
        businessId,
        stationId: kitchenStationId,
        menuItemId: menuItem1Id,
        priority: 10,
      });
      await createStationRoute({
        businessId,
        stationId: kitchenStationId,
        menuItemId: menuItem2Id,
        priority: 10,
      });
    });

    afterAll(async () => {
      if (db) {
        await db.business.deleteMany({ where: { id: businessId } });
        await db.$disconnect();
      }
    });

    it("1. Deploys permanent opaque physical QR codes for Room 104, Room 105, and Table T-01 without leaking stay secrets", async () => {
      const { ensureQrLocation, resolvePublicQrLocation } = await import(
        "../backend/src/lib/services/guest-portal-service"
      );

      const qrRoom104 = await ensureQrLocation(
        {
          businessId,
          branchId,
          locationType: "ROOM",
          roomId: room104Id,
          actorId: userId,
        },
        db
      );
      room104QrCode = qrRoom104.publicCode;

      const qrRoom105 = await ensureQrLocation(
        {
          businessId,
          branchId,
          locationType: "ROOM",
          roomId: room105Id,
          actorId: userId,
        },
        db
      );
      room105QrCode = qrRoom105.publicCode;

      const qrTableT1 = await ensureQrLocation(
        {
          businessId,
          branchId,
          locationType: "TABLE",
          tableId: tableT1Id,
          actorId: userId,
        },
        db
      );
      tableT1QrCode = qrTableT1.publicCode;

      // Public codes are opaque and contain no stay/room UUIDs
      expect(room104QrCode).toMatch(/^QRL-RM-[A-Z0-9]+$/);
      expect(tableT1QrCode).toMatch(/^QRL-TB-[A-Z0-9]+$/);
      expect(room104QrCode).not.toContain(room104Id);

      // Idempotent ensure without rotate returns the exact same permanent publicCode
      const qrRoom104Again = await ensureQrLocation(
        {
          businessId,
          branchId,
          locationType: "ROOM",
          roomId: room104Id,
          actorId: userId,
        },
        db
      );
      expect(qrRoom104Again.publicCode).toBe(room104QrCode);

      // Public resolution returns digital menu and property review URL, with zero occupant PII
      const publicResolved = await resolvePublicQrLocation(room104QrCode, db);
      expect(publicResolved.qrLocation.publicCode).toBe(room104QrCode);
      expect(publicResolved.qrLocation.locationType).toBe("ROOM");
      expect(publicResolved.qrLocation.requiresVerification).toBe(true);
      expect(publicResolved.qrLocation.business.googleReviewUrl).toBe(
        "https://g.page/r/restroinn-heritage/review"
      );
      expect(publicResolved.menus.length).toBeGreaterThanOrEqual(1);
      expect((publicResolved as any).stay).toBeUndefined();
      expect((publicResolved as any).folio).toBeUndefined();
    });

    it("2. Enforces guest verification on Room 104 QR, allows verified room ordering & folio review, and tracks live kitchen status", async () => {
      const { checkInGuest } = await import(
        "../backend/src/lib/services/hotel-checkin-service"
      );
      const { ensureGuestFolio, postRoomNightCharge, postRestaurantOrderToFolio } =
        await import("../backend/src/lib/services/folio-service");
      const {
        resolvePublicQrLocation,
        verifyAndCreateGuestSession,
        getGuestPortalFolioSummary,
        submitGuestOrder,
        getGuestOrdersAndTracking,
      } = await import("../backend/src/lib/services/guest-portal-service");
      const { updateLineStatus } = await import(
        "../backend/src/lib/services/restaurant-order-service"
      );
      const { routeOrderRoundToStations, advanceTicketStatus } = await import(
        "../backend/src/lib/services/kitchen-routing-service"
      );

      // Check in Occupant #1 (Aarav Sharma) into Room 104
      const checkIn1 = await checkInGuest(
        {
          businessId,
          branchId,
          roomId: room104Id,
          guestName: "Aarav Sharma",
          guestPhone: "9841223344",
          checkInTime: new Date("2027-03-01T14:00:00Z"),
          expectedCheckOut: new Date("2027-03-03T11:00:00Z"),
          ratePerNight: 8500,
          actorId: userId,
        },
        db
      );
      stay1Id = checkIn1.stay.id;

      const folio1 = await ensureGuestFolio(
        {
          businessId,
          branchId,
          stayId: stay1Id,
          windowName: "PRIMARY",
          actorId: userId,
        },
        db
      );
      stay1FolioId = folio1.id;

      await postRoomNightCharge(
        {
          businessId,
          branchId,
          stayId: stay1Id,
          folioId: stay1FolioId,
          chargeDate: "2027-03-01",
          baseRate: 8500,
          taxRatePercent: 13,
          actorId: userId,
        },
        db
      );

      // Unauthenticated scan of Room 104 QR still MUST NOT leak Aarav Sharma's name, phone, or folio balance!
      const rawScan = await resolvePublicQrLocation(room104QrCode, db);
      const rawScanJson = JSON.stringify(rawScan);
      expect(rawScanJson).not.toContain("Aarav");
      expect(rawScanJson).not.toContain("Sharma");
      expect(rawScanJson).not.toContain("9841223344");
      expect(rawScanJson).not.toContain("8500");

      // Wrong last name verification is rejected with 403
      await expect(
        verifyAndCreateGuestSession(
          {
            publicCode: room104QrCode,
            guestLastName: "WrongLastName",
          },
          db
        )
      ).rejects.toMatchObject({
        statusCode: 403,
        code: "GUEST_VERIFICATION_FAILED",
      });

      // Correct Guest Last Name + Phone Last 4 succeeds and issues ephemeral GuestSession
      const verified = await verifyAndCreateGuestSession(
        {
          publicCode: room104QrCode,
          guestLastName: "Sharma",
          guestPhoneLast4: "3344",
          deviceFingerprint: "iphone-safari-1",
        },
        db
      );
      expect(verified.sessionToken).toMatch(/^GSS-/);
      expect(verified.session.roomNumber).toBe("104");
      guest1SessionToken = verified.sessionToken;

      // Verified guest places an order with canonical server pricing (base 950 + mod 50 = 1000 + 13% tax = 1130)
      const orderRes = await submitGuestOrder(
        {
          sessionToken: guest1SessionToken,
          items: [
            {
              menuItemId: menuItem1Id,
              quantity: 1,
              selectedOptionIds: [modOpt1Id],
              notes: "Less oil please",
            },
          ],
          notes: "Room 104 dinner",
        },
        db
      );
      expect(orderRes.order.acceptanceStatus).toBe("PENDING");
      expect(Number(orderRes.order.totalAmount)).toBe(1130);

      // Live tracker initially shows ORDER_RECEIVED
      let tracking = await getGuestOrdersAndTracking(guest1SessionToken, db);
      expect(tracking.orders).toHaveLength(1);
      expect(tracking.orders[0].liveStage).toBe("ORDER_RECEIVED");

      // Staff accepts the order line & routes to kitchen -> tracker shows COOKING
      await updateLineStatus({
        businessId,
        lineId: orderRes.lines[0].id,
        acceptanceStatus: "ACCEPTED",
        fulfillmentStatus: "PREPARING",
        actorId: userId,
      });
      const routedTickets = await routeOrderRoundToStations({
        businessId,
        roundId: orderRes.round.id,
        actorId: userId,
      });
      expect(routedTickets.length).toBe(1);

      tracking = await getGuestOrdersAndTracking(guest1SessionToken, db);
      expect(tracking.orders[0].liveStage).toBe("COOKING");

      // Kitchen marks ticket READY -> tracker shows ON_ITS_WAY
      await advanceTicketStatus({
        businessId,
        ticketId: routedTickets[0].id,
        newStatus: "READY",
        actorId: userId,
      });
      tracking = await getGuestOrdersAndTracking(guest1SessionToken, db);
      expect(tracking.orders[0].liveStage).toBe("ON_ITS_WAY");

      // Charge order to Room 104 Folio and verify guest can view own bill
      await postRestaurantOrderToFolio(
        {
          businessId,
          branchId,
          orderId: orderRes.order.id,
          stayId: stay1Id,
          folioId: stay1FolioId,
          actorId: userId,
        },
        db
      );

      const folioView = await getGuestPortalFolioSummary(guest1SessionToken, db);
      expect(folioView.stayNumber).toBe(checkIn1.stay.stayNumber);
      expect(Number(folioView.totalBalance)).toBe(9605 + 1130);
      expect(folioView.folios[0].entries.length).toBe(2);
    });

    it("3. Preserves guest session across room transfer (104 -> 105) while detaching Room 104 QR from the stay", async () => {
      const { transferRoom } = await import(
        "../backend/src/lib/services/hotel-room-transfer-service"
      );
      const {
        getGuestPortalFolioSummary,
        verifyAndCreateGuestSession,
      } = await import("../backend/src/lib/services/guest-portal-service");

      await transferRoom(
        {
          businessId,
          stayId: stay1Id,
          targetRoomId: room105Id,
          reason: "AC upgrade to Room 105",
          actorId: userId,
        },
        db
      );

      // Aarav's existing session token seamlessly remains valid and now reflects Room 105
      const folioAfterTransfer = await getGuestPortalFolioSummary(
        guest1SessionToken,
        db
      );
      expect(folioAfterTransfer.roomNumber).toBe("105");
      expect(Number(folioAfterTransfer.totalBalance)).toBe(10735);

      // Meanwhile, scanning old Room 104 QR and trying to verify as "Sharma" fails because Room 104 is now vacant!
      await expect(
        verifyAndCreateGuestSession(
          {
            publicCode: room104QrCode,
            guestLastName: "Sharma",
          },
          db
        )
      ).rejects.toMatchObject({
        statusCode: 403,
        code: "NO_ACTIVE_STAY",
      });
    });

    it("4. EXIT CRITERION: Room QR privacy across occupant turnover (checkout atomically revokes prior guest tokens & hides all prior bills/orders)", async () => {
      const { settleGuestFolio } = await import(
        "../backend/src/lib/services/folio-service"
      );
      const { checkOutStay } = await import(
        "../backend/src/lib/services/hotel-checkout-service"
      );
      const { checkInGuest } = await import(
        "../backend/src/lib/services/hotel-checkin-service"
      );
      const { updateHousekeepingTaskStatus } = await import(
        "../backend/src/lib/services/hotel-housekeeping-service"
      );
      const {
        validateGuestSessionToken,
        getGuestPortalFolioSummary,
        getGuestOrdersAndTracking,
        createGuestServiceRequest,
        resolvePublicQrLocation,
        verifyAndCreateGuestSession,
      } = await import("../backend/src/lib/services/guest-portal-service");

      // Guest submits a CHECKOUT_REQUEST first -> verify it creates a FRONT_DESK ServiceRequest and does NOT silently check out the stay!
      const checkoutReq = await createGuestServiceRequest(
        {
          sessionToken: guest1SessionToken,
          requestType: "CHECKOUT_REQUEST",
          notes: "Ready with luggage at 11am",
        },
        db
      );
      expect(checkoutReq.serviceRequest.requestType).toBe("CHECKOUT_REQUEST");
      expect(checkoutReq.serviceRequest.category).toBe("FRONT_DESK");

      const stayStillActive = await db.stay.findUniqueOrThrow({
        where: { id: stay1Id },
      });
      expect(stayStillActive.status).not.toBe("COMPLETED");

      // Settle Folio & Front Desk checks out Occupant #1 (Aarav Sharma) from Room 105
      await settleGuestFolio(
        {
          businessId,
          branchId,
          folioId: stay1FolioId,
          tenders: [{ paymentMethod: "CARD", amount: 10735, reference: "POS-991" }],
          actorId: userId,
        },
        db
      );

      await checkOutStay(
        {
          businessId,
          stayId: stay1Id,
          enforceSettlement: true,
          actorId: userId,
        },
        db
      );

      // Immediately after checkout, Occupant #1's session token is 100% revoked!
      await expect(
        validateGuestSessionToken(guest1SessionToken, undefined, db)
      ).rejects.toMatchObject({
        statusCode: 401,
      });

      await expect(
        getGuestPortalFolioSummary(guest1SessionToken, db)
      ).rejects.toMatchObject({
        statusCode: 401,
      });

      await expect(
        getGuestOrdersAndTracking(guest1SessionToken, db)
      ).rejects.toMatchObject({
        statusCode: 401,
      });

      // Clean Room 105 and check in Occupant #2 (maya Gurung) into the SAME Room 105
      const hkTasks = await db.housekeepingTask.findMany({
        where: { businessId, roomId: room105Id, status: { not: "INSPECTED" } },
      });
      for (const task of hkTasks) {
        await updateHousekeepingTaskStatus(
          {
            businessId,
            taskId: task.id,
            status: "INSPECTED",
            actorId: userId,
          },
          db
        );
      }

      await checkInGuest(
        {
          businessId,
          branchId,
          roomId: room105Id,
          guestName: "Maya Gurung",
          guestPhone: "9807766554",
          checkInTime: new Date("2027-03-04T14:00:00Z"),
          expectedCheckOut: new Date("2027-03-06T11:00:00Z"),
          ratePerNight: 8500,
          actorId: userId,
        },
        db
      );

      // Occupant #2 scans the exact same physical QR code in Room 105
      const scanByNewOccupant = await resolvePublicQrLocation(room105QrCode, db);
      expect(JSON.stringify(scanByNewOccupant)).not.toContain("Aarav");
      expect(JSON.stringify(scanByNewOccupant)).not.toContain("Sharma");
      expect(JSON.stringify(scanByNewOccupant)).not.toContain("10735");

      // Trying to verify with previous occupant's name ("Sharma") on Room 105 QR is strictly rejected!
      await expect(
        verifyAndCreateGuestSession(
          {
            publicCode: room105QrCode,
            guestLastName: "Sharma",
          },
          db
        )
      ).rejects.toMatchObject({
        statusCode: 403,
        code: "GUEST_VERIFICATION_FAILED",
      });

      // Occupant #2 verifies with her own last name ("Gurung")
      const verified2 = await verifyAndCreateGuestSession(
        {
          publicCode: room105QrCode,
          guestLastName: "Gurung",
          guestPhoneLast4: "6554",
        },
        db
      );

      // Occupant #2 sees ONLY her own stay (0 balance, 0 prior orders, 0 prior folio entries)
      const folio2 = await getGuestPortalFolioSummary(verified2.sessionToken, db);
      expect(Number(folio2.totalBalance)).toBe(0);
      expect(folio2.folios.flatMap((f: any) => f.entries)).toHaveLength(0);
      expect(JSON.stringify(folio2)).not.toContain("Aarav");
      expect(JSON.stringify(folio2)).not.toContain("Thakali Mutton Thali");

      const orders2 = await getGuestOrdersAndTracking(verified2.sessionToken, db);
      expect(orders2.orders).toHaveLength(0);
    });

    it("5. EXIT CRITERION: Table QR draft order initiation, idempotent service requests, and 1-call-per-3-minutes waiter call rate limiting", async () => {
      const {
        verifyAndCreateGuestSession,
        submitGuestOrder,
        getGuestPortalFolioSummary,
        createGuestServiceRequest,
        getServiceRequestsForStaff,
        updateServiceRequestStatus,
      } = await import("../backend/src/lib/services/guest-portal-service");

      // Table T-01 guest scans Table QR and enrolls session
      const tableEnrollment = await verifyAndCreateGuestSession(
        {
          publicCode: tableT1QrCode,
        },
        db
      );
      expect(tableEnrollment.session.locationType).toBe("TABLE");
      const tableToken = tableEnrollment.sessionToken;

      // Table QR session CANNOT access hotel folios (scope forbidden)
      await expect(
        getGuestPortalFolioSummary(tableToken, db)
      ).rejects.toMatchObject({
        statusCode: 403,
        code: "GUEST_SCOPE_FORBIDDEN",
      });

      // Table QR initiates a draft order that requires cashier/waiter acceptance (acceptanceStatus === "PENDING", no kitchen tickets yet)
      const tableOrder = await submitGuestOrder(
        {
          sessionToken: tableToken,
          items: [{ menuItemId: menuItem2Id, quantity: 2 }],
          notes: "2 Masala Chais for Table T-01",
        },
        db
      );
      expect(tableOrder.order.acceptanceStatus).toBe("PENDING");
      const prematureTickets = await db.kitchenTicket.findMany({
        where: { businessId, orderId: tableOrder.order.id },
      });
      expect(prematureTickets).toHaveLength(0);

      // First Waiter Call at t0 succeeds (with idempotency key)
      const t0 = new Date();
      const call1 = await createGuestServiceRequest(
        {
          sessionToken: tableToken,
          requestType: "WAITER_CALL",
          notes: "Need extra napkins",
          idempotencyKey: "waiter-call-key-001",
          now: t0,
        },
        db
      );
      expect(call1.deduplicated).toBe(false);
      expect(call1.serviceRequest.status).toBe("OPEN");

      // Retrying with the SAME idempotency key deduplicates cleanly without throwing 429
      const call1Retry = await createGuestServiceRequest(
        {
          sessionToken: tableToken,
          requestType: "WAITER_CALL",
          notes: "Need extra napkins",
          idempotencyKey: "waiter-call-key-001",
          now: new Date(t0.getTime() + 5_000),
        },
        db
      );
      expect(call1Retry.deduplicated).toBe(true);
      expect(call1Retry.serviceRequest.id).toBe(call1.serviceRequest.id);

      // Spamming Waiter Call 30 seconds later (and 2 minutes later) on the same location is throttled with 429 RATE_LIMIT_EXCEEDED!
      await expect(
        createGuestServiceRequest(
          {
            sessionToken: tableToken,
            requestType: "WAITER_CALL",
            now: new Date(t0.getTime() + 30_000),
          },
          db
        )
      ).rejects.toMatchObject({
        statusCode: 429,
        code: "RATE_LIMIT_EXCEEDED",
      });

      await expect(
        createGuestServiceRequest(
          {
            sessionToken: tableToken,
            requestType: "WAITER_CALL",
            now: new Date(t0.getTime() + 179_000),
          },
          db
        )
      ).rejects.toMatchObject({
        statusCode: 429,
        code: "RATE_LIMIT_EXCEEDED",
      });

      // After 3 minutes + 1 second (181,000 ms), another Waiter Call is permitted!
      const call2 = await createGuestServiceRequest(
        {
          sessionToken: tableToken,
          requestType: "WAITER_CALL",
          notes: "Follow-up call after 3 minutes",
          now: new Date(t0.getTime() + 181_000),
        },
        db
      );
      expect(call2.deduplicated).toBe(false);
      expect(call2.serviceRequest.id).not.toBe(call1.serviceRequest.id);

      // Staff Service Request Queue lists the calls and transitions status OPEN -> ACKNOWLEDGED -> COMPLETED
      const staffQueue = await getServiceRequestsForStaff(
        { businessId, branchId, status: "OPEN" },
        db
      );
      expect(staffQueue.length).toBeGreaterThanOrEqual(2);

      const acked = await updateServiceRequestStatus(
        {
          businessId,
          requestId: call1.serviceRequest.id,
          status: "ACKNOWLEDGED",
          actorId: userId,
        },
        db
      );
      expect(acked.status).toBe("ACKNOWLEDGED");
      expect(acked.acknowledgedById).toBe(userId);

      const completed = await updateServiceRequestStatus(
        {
          businessId,
          requestId: call1.serviceRequest.id,
          status: "COMPLETED",
          resolutionNotes: "Delivered napkins to Table T-01",
          actorId: userId,
        },
        db
      );
      expect(completed.status).toBe("COMPLETED");
      expect(completed.resolvedById).toBe(userId);
    });
  }
);

