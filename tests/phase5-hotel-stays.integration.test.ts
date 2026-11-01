import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";

const target = process.env.TEST_DATABASE_URL;

describe.skipIf(!target)("Phase 5: Hotel Inventory, Rooms, Concurrency & Guest Stays Integration", () => {
  let db: import("@dynapos/db").PrismaClient;
  const businessId = randomUUID();
  const branchId = randomUUID();
  const userId = randomUUID();

  let deluxeTypeId: string;
  let suiteTypeId: string;
  let room101Id: string;
  let room102Id: string;
  let room103Id: string;
  let room201Id: string;

  beforeAll(async () => {
    const { PrismaClient } = await import("@dynapos/db");
    db = new PrismaClient({ datasourceUrl: target, log: [] });
    await db.$connect();

    await db.business.create({
      data: {
        id: businessId,
        name: "RestroInn Grand Hotel Test",
        slug: `restro-hotel-${Date.now()}`,
        currency: "NPR",
        branches: {
          create: {
            id: branchId,
            name: "Main Hotel Tower",
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
        name: "Front Desk Manager",
        email: `frontdesk-${Date.now()}@restroinn.test`,
        passwordHash: "hashed",
        role: "MANAGER",
      },
    });
  });

  afterAll(async () => {
    if (db) {
      await db.business.deleteMany({ where: { id: businessId } });
      await db.$disconnect();
    }
  });

  it("1. creates RoomTypes and physical Rooms and computes Tape Chart & Availability matrix", async () => {
    const {
      createRoomType,
      createRoom,
      getRoomAvailability,
      getTapeChartMatrix,
    } = await import("../backend/src/lib/services/room-availability-service");

    const deluxe = await createRoomType(
      {
        businessId,
        branchId,
        name: "Deluxe King",
        code: "DLX-K",
        baseRate: 8500,
        maxOccupancy: 2,
        amenities: ["WIFI", "AC", "MINIBAR", "MOUNTAIN_VIEW"],
        actorId: userId,
      },
      db
    );
    deluxeTypeId = deluxe.id;

    const suite = await createRoomType(
      {
        businessId,
        branchId,
        name: "Executive Suite",
        code: "EXEC-S",
        baseRate: 15000,
        maxOccupancy: 4,
        amenities: ["WIFI", "AC", "MINIBAR", "BALCONY", "JACUZZI"],
        actorId: userId,
      },
      db
    );
    suiteTypeId = suite.id;

    const r101 = await createRoom(
      {
        businessId,
        branchId,
        roomTypeId: deluxeTypeId,
        roomNumber: "101",
        capacity: 2,
        status: "VACANT_CLEAN",
        actorId: userId,
      },
      db
    );
    room101Id = r101.id;

    const r102 = await createRoom(
      {
        businessId,
        branchId,
        roomTypeId: deluxeTypeId,
        roomNumber: "102",
        capacity: 2,
        status: "VACANT_CLEAN",
        actorId: userId,
      },
      db
    );
    room102Id = r102.id;

    const r103 = await createRoom(
      {
        businessId,
        branchId,
        roomTypeId: deluxeTypeId,
        roomNumber: "103",
        capacity: 2,
        status: "VACANT_CLEAN",
        actorId: userId,
      },
      db
    );
    room103Id = r103.id;

    const r201 = await createRoom(
      {
        businessId,
        branchId,
        roomTypeId: suiteTypeId,
        roomNumber: "201",
        capacity: 4,
        status: "VACANT_CLEAN",
        actorId: userId,
      },
      db
    );
    room201Id = r201.id;

    const avail = await getRoomAvailability(
      {
        businessId,
        branchId,
        startDate: new Date("2026-12-01T14:00:00Z"),
        endDate: new Date("2026-12-05T11:00:00Z"),
      },
      db
    );
    expect(avail.availableRooms.length).toBe(4);
    expect(avail.unavailableRooms.length).toBe(0);

    const tapeChart = await getTapeChartMatrix(
      {
        businessId,
        branchId,
        startDate: new Date("2026-12-01T00:00:00Z"),
        endDate: new Date("2026-12-08T00:00:00Z"),
      },
      db
    );
    expect(tapeChart.rooms.length).toBe(4);
    expect(tapeChart.stats.vacantClean).toBe(4);
  });

  it("2. enforces PostgreSQL GiST exclusion on 10 concurrent overlapping reservation requests (1 wins, 9 reject with 409 Conflict)", async () => {
    const { createReservation } = await import("../backend/src/lib/services/hotel-reservation-service");

    const checkInDate = new Date("2026-12-10T14:00:00Z");
    const checkOutDate = new Date("2026-12-15T11:00:00Z");

    const attempts = Array.from({ length: 10 }, (_, idx) =>
      createReservation(
        {
          businessId,
          branchId,
          guestName: `Concurrent Guest ${idx + 1}`,
          guestPhone: `980000000${idx}`,
          roomTypeId: deluxeTypeId,
          roomId: room101Id,
          checkInDate,
          checkOutDate,
          nightlyRate: 8500,
          actorId: userId,
        },
        db
      )
    );

    const settled = await Promise.allSettled(attempts);
    const fulfilled = settled.filter(r => r.status === "fulfilled");
    const rejected = settled.filter(r => r.status === "rejected") as PromiseRejectedResult[];

    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(9);

    for (const rej of rejected) {
      expect(rej.reason?.statusCode).toBe(409);
    }

    // Verify adjacent half-open interval [2026-12-15T11:00:00Z, 2026-12-18T11:00:00Z) succeeds without conflict
    const adjacentRes = await createReservation(
      {
        businessId,
        branchId,
        guestName: "Adjacent Departure-Arrival Guest",
        roomTypeId: deluxeTypeId,
        roomId: room101Id,
        checkInDate: new Date("2026-12-15T11:00:00Z"),
        checkOutDate: new Date("2026-12-18T11:00:00Z"),
        nightlyRate: 8500,
        actorId: userId,
      },
      db
    );
    expect(adjacentRes.status).toBe("CONFIRMED");
  });

  it("3. executes Guest Check-In, transitions Room to OCCUPIED_CLEAN, and transfers room atomically while preserving Stay identity", async () => {
    const { checkInGuest } = await import("../backend/src/lib/services/hotel-checkin-service");
    const { transferRoom } = await import("../backend/src/lib/services/hotel-room-transfer-service");

    const now = new Date();
    const expectedOut = new Date(now.getTime() + 3 * 86400000);

    const checkInResult = await checkInGuest(
      {
        businessId,
        branchId,
        roomId: room102Id,
        guestName: "Aarav Sharma",
        guestPhone: "9841234567",
        guestIdType: "PASSPORT",
        guestIdNumber: "NP-998877",
        checkInTime: now,
        expectedCheckOut: expectedOut,
        ratePerNight: 8500,
        paidAmount: 25500,
        actorId: userId,
      },
      db
    );

    expect(checkInResult.stay.status).toBe("ACTIVE");
    expect(checkInResult.room.status).toBe("OCCUPIED_CLEAN");
    expect(checkInResult.room.currentStayId).toBe(checkInResult.stay.id);

    const originalStayId = checkInResult.stay.id;
    const originalStayNumber = checkInResult.stay.stayNumber;

    // Transfer from Room 102 to Room 201 (Executive Suite)
    const transferResult = await transferRoom(
      {
        businessId,
        stayId: originalStayId,
        targetRoomId: room201Id,
        reason: "Complimentary upgrade to Executive Suite",
        actorId: userId,
      },
      db
    );

    // Stay identity preserved
    expect(transferResult.stay.id).toBe(originalStayId);
    expect(transferResult.stay.stayNumber).toBe(originalStayNumber);
    expect(transferResult.stay.roomId).toBe(room201Id);
    expect(transferResult.stay.guestName).toBe("Aarav Sharma");

    // Source room 102 released and marked VACANT_DIRTY with automatic DIRTY housekeeping task
    expect(transferResult.sourceRoom.status).toBe("VACANT_DIRTY");
    expect(transferResult.sourceRoom.currentStayId).toBeNull();
    expect(transferResult.housekeepingTask.roomId).toBe(room102Id);
    expect(transferResult.housekeepingTask.status).toBe("DIRTY");

    // Target room 201 occupied with currentStayId bound
    expect(transferResult.targetRoom.status).toBe("OCCUPIED_CLEAN");
    expect(transferResult.targetRoom.currentStayId).toBe(originalStayId);
  });

  it("4. completes Stay Check-Out, marks Room VACANT_DIRTY, spawns DIRTY HousekeepingTask, and cleans back to VACANT_CLEAN", async () => {
    const { checkOutStay } = await import("../backend/src/lib/services/hotel-checkout-service");
    const { updateHousekeepingTaskStatus } = await import("../backend/src/lib/services/hotel-housekeeping-service");

    const activeStay = await db.stay.findFirstOrThrow({
      where: { businessId, roomId: room201Id },
    });

    const outResult = await checkOutStay(
      {
        businessId,
        stayId: activeStay.id,
        notes: "Normal guest departure",
        actorId: userId,
      },
      db
    );

    expect(outResult.stay.status).toBe("COMPLETED");
    expect(outResult.stay.checkOutTime).toBeTruthy();
    expect(outResult.room.status).toBe("VACANT_DIRTY");
    expect(outResult.room.currentStayId).toBeNull();
    expect(outResult.housekeepingTask.status).toBe("DIRTY");
    expect(outResult.housekeepingTask.roomId).toBe(room201Id);

    // Advance housekeeping task to INSPECTED and verify room becomes VACANT_CLEAN
    const cleanResult = await updateHousekeepingTaskStatus(
      {
        businessId,
        taskId: outResult.housekeepingTask.id,
        status: "INSPECTED",
        notes: "Room cleaned and inspected",
        actorId: userId,
      },
      db
    );

    expect(cleanResult.task.status).toBe("INSPECTED");
    expect(cleanResult.room?.status).toBe("VACANT_CLEAN");
  });

  it("5. creates a MaintenanceTicket block that prevents overlapping reservations until resolved", async () => {
    const { createMaintenanceTicket, resolveMaintenanceTicket } = await import(
      "../backend/src/lib/services/hotel-housekeeping-service"
    );
    const { createReservation } = await import("../backend/src/lib/services/hotel-reservation-service");

    const mntStart = new Date("2026-12-20T08:00:00Z");
    const mntEnd = new Date("2026-12-23T18:00:00Z");

    const mnt = await createMaintenanceTicket(
      {
        businessId,
        branchId,
        roomId: room103Id,
        title: "HVAC Compressor Replacement",
        priority: "URGENT",
        startDate: mntStart,
        endDate: mntEnd,
        actorId: userId,
      },
      db
    );

    expect(mnt.ticket.status).toBe("OPEN");
    expect(mnt.room.status).toBe("MAINTENANCE");
    expect(mnt.allocation.isBlocking).toBe(true);

    // Attempt to book Room 103 during the maintenance window -> must fail with 409 Conflict
    await expect(
      createReservation(
        {
          businessId,
          branchId,
          guestName: "Blocked Guest",
          roomTypeId: deluxeTypeId,
          roomId: room103Id,
          checkInDate: new Date("2026-12-21T14:00:00Z"),
          checkOutDate: new Date("2026-12-22T11:00:00Z"),
          nightlyRate: 8500,
          actorId: userId,
        },
        db
      )
    ).rejects.toMatchObject({ statusCode: 409 });

    // Resolve maintenance ticket -> releases block so booking succeeds
    const resolved = await resolveMaintenanceTicket(
      {
        businessId,
        ticketId: mnt.ticket.id,
        status: "RESOLVED",
        resolutionNotes: "Replaced HVAC compressor and tested cooling",
        actorId: userId,
      },
      db
    );
    expect(resolved.ticket.status).toBe("RESOLVED");

    const postMntBooking = await createReservation(
      {
        businessId,
        branchId,
        guestName: "Post-Maintenance Guest",
        roomTypeId: deluxeTypeId,
        roomId: room103Id,
        checkInDate: new Date("2026-12-21T14:00:00Z"),
        checkOutDate: new Date("2026-12-22T11:00:00Z"),
        nightlyRate: 8500,
        actorId: userId,
      },
      db
    );
    expect(postMntBooking.status).toBe("CONFIRMED");
  });

  it("6. preserves original Stay and Allocation when extendStay conflicts with a future booking, and represents OCCUPIED_DIRTY independently from VACANT_DIRTY", async () => {
    const { checkInGuest, extendStay } = await import("../backend/src/lib/services/hotel-checkin-service");
    const { createReservation } = await import("../backend/src/lib/services/hotel-reservation-service");
    const { createHousekeepingTask, updateHousekeepingTaskStatus } = await import(
      "../backend/src/lib/services/hotel-housekeeping-service"
    );

    // Clean room 103 back to VACANT_CLEAN after maintenance resolution
    const mntTasks = await db.housekeepingTask.findMany({ where: { businessId, roomId: room103Id } });
    for (const t of mntTasks) {
      await updateHousekeepingTaskStatus({ businessId, taskId: t.id, status: "CLEAN", actorId: userId }, db);
    }

    const stayStart = new Date("2027-01-05T14:00:00Z");
    const stayOriginalEnd = new Date("2027-01-08T11:00:00Z");

    const checkedIn = await checkInGuest(
      {
        businessId,
        branchId,
        roomId: room103Id,
        guestName: "Extension Test Guest",
        checkInTime: stayStart,
        expectedCheckOut: stayOriginalEnd,
        ratePerNight: 8500,
        actorId: userId,
      },
      db
    );

    // Create a confirmed reservation right after [2027-01-08T14:00:00Z, 2027-01-12T11:00:00Z)
    await createReservation(
      {
        businessId,
        branchId,
        guestName: "Next Arriving Guest",
        roomTypeId: deluxeTypeId,
        roomId: room103Id,
        checkInDate: new Date("2027-01-08T14:00:00Z"),
        checkOutDate: new Date("2027-01-12T11:00:00Z"),
        nightlyRate: 8500,
        actorId: userId,
      },
      db
    );

    // Attempt to extend stay into 2027-01-10 -> must reject with 409 Conflict and preserve stayOriginalEnd
    await expect(
      extendStay(
        {
          businessId,
          stayId: checkedIn.stay.id,
          newExpectedCheckOut: new Date("2027-01-10T11:00:00Z"),
          actorId: userId,
        },
        db
      )
    ).rejects.toMatchObject({ statusCode: 409 });

    const preservedStay = await db.stay.findUniqueOrThrow({ where: { id: checkedIn.stay.id } });
    expect(preservedStay.expectedCheckOut.toISOString()).toBe(stayOriginalEnd.toISOString());

    // Verify OCCUPIED_DIRTY vs OCCUPIED_CLEAN while guest is still in-house
    const dailyTask = await createHousekeepingTask(
      {
        businessId,
        branchId,
        roomId: room103Id,
        stayId: checkedIn.stay.id,
        taskType: "DAILY_CLEANING",
        status: "DIRTY",
        actorId: userId,
      },
      db
    );
    const dirtyOccupied = await updateHousekeepingTaskStatus(
      { businessId, taskId: dailyTask.id, status: "DIRTY", actorId: userId },
      db
    );
    expect(dirtyOccupied.room?.status).toBe("OCCUPIED_DIRTY");
    expect(dirtyOccupied.room?.currentStayId).toBe(checkedIn.stay.id);

    const cleanOccupied = await updateHousekeepingTaskStatus(
      { businessId, taskId: dailyTask.id, status: "CLEAN", actorId: userId },
      db
    );
    expect(cleanOccupied.room?.status).toBe("OCCUPIED_CLEAN");
    expect(cleanOccupied.room?.currentStayId).toBe(checkedIn.stay.id);
  });
});

