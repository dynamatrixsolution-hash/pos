import { db } from "@/lib/db";
import { Prisma } from "@dynapos/db";
import { addMoney, money, mulMoney } from "@/lib/services/decimal-math";
import { createAuditEvent } from "@/lib/audit-event";
import {
  HotelError,
  isExclusionViolation,
  parseDate,
  PrismaClientLike,
  withHotelTransaction,
} from "@/lib/services/room-availability-service";
import { calculateNights } from "@/lib/services/hotel-reservation-service";
import { extendGuestAccessForStay } from "@/lib/services/guest-portal-service";

export interface CheckInGuestInput {
  businessId: string;
  branchId: string;
  reservationId?: string | null;
  roomId: string;
  guestName?: string;
  guestEmail?: string | null;
  guestPhone?: string | null;
  guestIdType?: string | null;
  guestIdNumber?: string | null;
  checkInTime?: Date | string;
  expectedCheckOut?: Date | string;
  ratePerNight?: number | string | Prisma.Decimal;
  paidAmount?: number | string | Prisma.Decimal;
  notes?: string | null;
  actorId?: string;
}

export interface GetStaysInput {
  businessId: string;
  branchId?: string | null;
  status?: string | null;
  roomId?: string | null;
}

export interface ExtendStayInput {
  businessId: string;
  stayId: string;
  newExpectedCheckOut: Date | string;
  additionalPaidAmount?: number | string | Prisma.Decimal;
  notes?: string | null;
  actorId?: string;
}

function generateStayNumber(now = new Date()): string {
  const datePart = now.toISOString().slice(0, 10).replace(/-/g, "");
  const timePart = now.toTimeString().slice(0, 8).replace(/:/g, "");
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `STAY-${datePart}-${timePart}-${rand}`;
}

export async function checkInGuest(
  input: CheckInGuestInput,
  prismaClient: PrismaClientLike = db
) {
  try {
    return await withHotelTransaction(prismaClient, async (tx) => {
      let reservation:
        | (Prisma.ReservationGetPayload<{
            include: { guests: true; allocations: true };
          }>)
        | null = null;

      if (input.reservationId) {
        reservation = await tx.reservation.findFirst({
          where: { id: input.reservationId, businessId: input.businessId },
          include: { guests: true, allocations: true },
        });
        if (!reservation) {
          throw new HotelError("Reservation not found", 404, "RESERVATION_NOT_FOUND");
        }
        if (reservation.status !== "CONFIRMED") {
          throw new HotelError(
            `Reservation cannot be checked in from status ${reservation.status}`,
            409,
            "INVALID_RESERVATION_STATE"
          );
        }
      }

      const targetRoom = await tx.room.findFirst({
        where: { id: input.roomId, businessId: input.businessId, isActive: true },
        include: { roomType: true },
      });
      if (!targetRoom) {
        throw new HotelError("Room not found", 404, "ROOM_NOT_FOUND");
      }

      if (targetRoom.status === "MAINTENANCE" || targetRoom.status === "OUT_OF_SERVICE") {
        throw new HotelError(
          "Room is under maintenance or out of service",
          409,
          "ROOM_UNAVAILABLE"
        );
      }

      const primaryGuest = reservation?.guests?.find((g) => g.isPrimary) ?? reservation?.guests?.[0];
      const guestName = (
        input.guestName ??
        reservation?.guestName ??
        primaryGuest?.name ??
        ""
      ).trim();

      if (!guestName) {
        throw new HotelError("Guest name is required for check-in", 400, "VALIDATION_ERROR");
      }

      const checkInTime = input.checkInTime
        ? parseDate(input.checkInTime, "checkInTime")
        : reservation
          ? new Date(reservation.checkInDate.getTime())
          : new Date();

      const expectedCheckOut = input.expectedCheckOut
        ? parseDate(input.expectedCheckOut, "expectedCheckOut")
        : reservation
          ? new Date(reservation.checkOutDate.getTime())
          : new Date(checkInTime.getTime() + 86_400_000);

      if (checkInTime.getTime() >= expectedCheckOut.getTime()) {
        throw new HotelError(
          "checkInTime must be before expectedCheckOut",
          400,
          "INVALID_DATE_RANGE"
        );
      }

      const ratePerNightDec =
        input.ratePerNight !== undefined
          ? money(input.ratePerNight)
          : reservation
            ? money(reservation.nightlyRate)
            : money(targetRoom.roomType.baseRate);

      const nights = calculateNights(checkInTime, expectedCheckOut);
      const totalAmountDec = mulMoney(ratePerNightDec, nights);
      const paidAmountDec =
        input.paidAmount !== undefined
          ? money(input.paidAmount)
          : reservation
            ? money(reservation.depositAmount)
            : money(0);

      const stay = await tx.stay.create({
        data: {
          businessId: input.businessId,
          branchId: input.branchId,
          stayNumber: generateStayNumber(),
          reservationId: reservation?.id ?? null,
          roomId: input.roomId,
          guestName,
          guestEmail: input.guestEmail ?? reservation?.guestEmail ?? primaryGuest?.email ?? null,
          guestPhone: input.guestPhone ?? reservation?.guestPhone ?? primaryGuest?.phone ?? null,
          guestIdType: input.guestIdType ?? primaryGuest?.idType ?? null,
          guestIdNumber: input.guestIdNumber ?? primaryGuest?.idNumber ?? null,
          checkInTime,
          expectedCheckOut,
          status: "ACTIVE",
          ratePerNight: ratePerNightDec,
          totalAmount: totalAmountDec,
          paidAmount: paidAmountDec,
          checkedInById: input.actorId ?? null,
          notes: input.notes ?? reservation?.notes ?? null,
        },
      });

      // Atomic Compare-And-Swap on Room
      const cas = await tx.room.updateMany({
        where: {
          id: input.roomId,
          businessId: input.businessId,
          status: { in: ["VACANT_CLEAN", "VACANT_DIRTY"] },
          currentStayId: null,
        },
        data: {
          status: "OCCUPIED_CLEAN",
          currentStayId: stay.id,
        },
      });

      if (cas.count === 0) {
        throw new HotelError(
          "Room is already occupied or unavailable for check-in",
          409,
          "ROOM_ALREADY_OCCUPIED"
        );
      }

      // Manage RoomAllocation
      const existingSameRoomAlloc = reservation?.allocations?.find(
        (a) => a.isBlocking && a.roomId === input.roomId
      );

      let allocation;
      if (existingSameRoomAlloc) {
        allocation = await tx.roomAllocation.update({
          where: { id: existingSameRoomAlloc.id },
          data: {
            stayId: stay.id,
            status: "CHECKED_IN",
            startDate: checkInTime,
            endDate: expectedCheckOut,
            isBlocking: true,
          },
        });
      } else {
        if (reservation) {
          await tx.roomAllocation.updateMany({
            where: {
              businessId: input.businessId,
              reservationId: reservation.id,
              isBlocking: true,
            },
            data: {
              isBlocking: false,
              status: "CANCELLED",
            },
          });
        }

        allocation = await tx.roomAllocation.create({
          data: {
            businessId: input.businessId,
            branchId: input.branchId,
            roomId: input.roomId,
            stayId: stay.id,
            reservationId: reservation?.id ?? null,
            startDate: checkInTime,
            endDate: expectedCheckOut,
            isBlocking: true,
            status: "CHECKED_IN",
            notes: `Stay ${stay.stayNumber}`,
          },
        });
      }

      if (reservation) {
        await tx.reservation.update({
          where: { id: reservation.id },
          data: {
            status: "CHECKED_IN",
            roomId: input.roomId,
            version: { increment: 1 },
          },
        });
      }

      const updatedRoom = await tx.room.findUniqueOrThrow({
        where: { id: input.roomId },
        include: { roomType: true, floor: true },
      });

      await createAuditEvent(
        {
          businessId: input.businessId,
          branchId: input.branchId,
          userId: input.actorId ?? null,
          action: "GUEST_CHECKED_IN",
          entity: "Stay",
          entityId: stay.id,
          newValue: { stay, roomId: updatedRoom.id, allocationId: allocation.id },
        },
        tx
      );

      return {
        stay,
        room: updatedRoom,
        allocation,
      };
    });
  } catch (err) {
    if (isExclusionViolation(err)) {
      throw new HotelError(
        "Room has an overlapping booking or block for this stay window",
        409,
        "ROOM_DOUBLE_BOOKED"
      );
    }
    const code = (err as { code?: string })?.code;
    if (code === "P2034") {
      throw new HotelError(
        "Concurrent check-in conflict on room",
        409,
        "CONCURRENT_CHECKIN_CONFLICT"
      );
    }
    throw err;
  }
}

export async function getStays(
  input: GetStaysInput,
  prismaClient: PrismaClientLike = db
) {
  return await prismaClient.stay.findMany({
    where: {
      businessId: input.businessId,
      ...(input.branchId ? { branchId: input.branchId } : {}),
      ...(input.status ? { status: input.status } : {}),
      ...(input.roomId ? { roomId: input.roomId } : {}),
    },
    include: {
      room: {
        include: { roomType: true, floor: true },
      },
      reservation: {
        include: { guests: true },
      },
      allocations: true,
      housekeepingTasks: true,
    },
    orderBy: [{ checkInTime: "desc" }],
  });
}

export async function extendStay(
  input: ExtendStayInput,
  prismaClient: PrismaClientLike = db
) {
  const newExpectedCheckOut = parseDate(input.newExpectedCheckOut, "newExpectedCheckOut");

  try {
    return await withHotelTransaction(prismaClient, async (tx) => {
      const stay = await tx.stay.findFirst({
        where: { id: input.stayId, businessId: input.businessId },
        include: { allocations: true },
      });
      if (!stay) {
        throw new HotelError("Stay not found", 404, "STAY_NOT_FOUND");
      }
      if (stay.status === "COMPLETED") {
        throw new HotelError("Cannot extend a completed stay", 400, "STAY_COMPLETED");
      }

      if (newExpectedCheckOut.getTime() <= stay.expectedCheckOut.getTime()) {
        throw new HotelError(
          "newExpectedCheckOut must be after current expectedCheckOut",
          400,
          "INVALID_EXTENSION_DATE"
        );
      }

      const activeAllocation = stay.allocations.find(
        (a) => a.isBlocking && a.roomId === stay.roomId
      );

      let updatedAllocation = null;
      if (activeAllocation) {
        updatedAllocation = await tx.roomAllocation.update({
          where: { id: activeAllocation.id },
          data: {
            endDate: newExpectedCheckOut,
          },
        });
      } else {
        updatedAllocation = await tx.roomAllocation.create({
          data: {
            businessId: stay.businessId,
            branchId: stay.branchId,
            roomId: stay.roomId,
            stayId: stay.id,
            reservationId: stay.reservationId,
            startDate: stay.checkInTime,
            endDate: newExpectedCheckOut,
            isBlocking: true,
            status: "CHECKED_IN",
          },
        });
      }

      const totalNights = calculateNights(stay.checkInTime, newExpectedCheckOut);
      const recalculatedTotal = mulMoney(stay.ratePerNight, totalNights);
      const nextPaidAmount =
        input.additionalPaidAmount !== undefined
          ? addMoney(stay.paidAmount, money(input.additionalPaidAmount))
          : stay.paidAmount;

      const updatedStay = await tx.stay.update({
        where: { id: stay.id },
        data: {
          expectedCheckOut: newExpectedCheckOut,
          totalAmount: recalculatedTotal,
          paidAmount: nextPaidAmount,
          status: "EXTENDED",
          notes: input.notes ?? stay.notes,
          version: { increment: 1 },
        },
        include: {
          room: { include: { roomType: true, floor: true } },
          allocations: true,
        },
      });

      await extendGuestAccessForStay(
        {
          businessId: input.businessId,
          stayId: stay.id,
          newExpectedCheckOut,
        },
        tx
      );

      await createAuditEvent(
        {
          businessId: input.businessId,
          branchId: stay.branchId,
          userId: input.actorId ?? null,
          action: "STAY_EXTENDED",
          entity: "Stay",
          entityId: updatedStay.id,
          entityVersion: updatedStay.version,
          oldValue: stay,
          newValue: updatedStay,
        },
        tx
      );

      return {
        stay: updatedStay,
        allocation: updatedAllocation,
      };
    });
  } catch (err) {
    if (isExclusionViolation(err)) {
      throw new HotelError(
        "Room is already booked or blocked for the extended dates",
        409,
        "ROOM_DOUBLE_BOOKED"
      );
    }
    throw err;
  }
}
