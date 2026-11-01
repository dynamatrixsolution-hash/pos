import { db } from "@/lib/db";
import { Prisma } from "@dynapos/db";
import { money, mulMoney } from "@/lib/services/decimal-math";
import { createAuditEvent } from "@/lib/audit-event";
import {
  HotelError,
  isExclusionViolation,
  parseDate,
  PrismaClientLike,
  withHotelTransaction,
} from "@/lib/services/room-availability-service";

export interface ReservationGuestInput {
  name: string;
  email?: string | null;
  phone?: string | null;
  idType?: string | null;
  idNumber?: string | null;
  isPrimary?: boolean;
}

export interface CreateReservationInput {
  businessId: string;
  branchId: string;
  guestName: string;
  guestEmail?: string | null;
  guestPhone?: string | null;
  roomTypeId: string;
  roomId?: string | null;
  checkInDate: Date | string;
  checkOutDate: Date | string;
  adults?: number;
  children?: number;
  ratePlan?: string;
  nightlyRate?: number | string | Prisma.Decimal;
  depositAmount?: number | string | Prisma.Decimal;
  specialRequests?: string | null;
  notes?: string | null;
  guests?: ReservationGuestInput[];
  actorId?: string;
}

export interface GetReservationsInput {
  businessId: string;
  branchId?: string | null;
  status?: string | null;
  roomId?: string | null;
  fromDate?: Date | string | null;
  toDate?: Date | string | null;
}

export interface UpdateReservationInput {
  businessId: string;
  id: string;
  guestName?: string;
  guestEmail?: string | null;
  guestPhone?: string | null;
  roomId?: string | null;
  checkInDate?: Date | string;
  checkOutDate?: Date | string;
  status?: string;
  specialRequests?: string | null;
  notes?: string | null;
  actorId?: string;
}

export interface CancelReservationInput {
  businessId: string;
  id: string;
  status?: "CANCELLED" | "NO_SHOW";
  reason?: string;
  actorId?: string;
}

function generateReservationNumber(now = new Date()): string {
  const datePart = now.toISOString().slice(0, 10).replace(/-/g, "");
  const timePart = now.toTimeString().slice(0, 8).replace(/:/g, "");
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `RES-${datePart}-${timePart}-${rand}`;
}

export function calculateNights(checkInDate: Date, checkOutDate: Date): number {
  return Math.max(1, Math.ceil((checkOutDate.getTime() - checkInDate.getTime()) / 86_400_000));
}

export async function createReservation(
  input: CreateReservationInput,
  prismaClient: PrismaClientLike = db
) {
  const guestName = input.guestName?.trim();
  if (!guestName) {
    throw new HotelError("Guest name is required", 400, "VALIDATION_ERROR");
  }

  const checkInDate = parseDate(input.checkInDate, "checkInDate");
  const checkOutDate = parseDate(input.checkOutDate, "checkOutDate");

  if (checkInDate.getTime() >= checkOutDate.getTime()) {
    throw new HotelError("checkInDate must be before checkOutDate", 400, "INVALID_DATE_RANGE");
  }

  try {
    return await withHotelTransaction(prismaClient, async (tx) => {
      const roomType = await tx.roomType.findFirst({
        where: { id: input.roomTypeId, businessId: input.businessId },
      });
      if (!roomType) {
        throw new HotelError("Room type not found", 404, "ROOM_TYPE_NOT_FOUND");
      }

      if (input.roomId) {
        const room = await tx.room.findFirst({
          where: { id: input.roomId, businessId: input.businessId, isActive: true },
        });
        if (!room) {
          throw new HotelError("Assigned room not found", 404, "ROOM_NOT_FOUND");
        }
        if (room.status === "OUT_OF_SERVICE") {
          throw new HotelError(
            "Assigned room is out of service",
            409,
            "ROOM_OUT_OF_SERVICE"
          );
        }
      }

      const nightlyRateDec =
        input.nightlyRate !== undefined ? money(input.nightlyRate) : money(roomType.baseRate);
      const nights = calculateNights(checkInDate, checkOutDate);
      const totalAmountDec = mulMoney(nightlyRateDec, nights);
      const depositAmountDec = money(input.depositAmount ?? 0);

      const reservation = await tx.reservation.create({
        data: {
          businessId: input.businessId,
          branchId: input.branchId,
          reservationNumber: generateReservationNumber(),
          guestName,
          guestEmail: input.guestEmail ?? null,
          guestPhone: input.guestPhone ?? null,
          roomTypeId: input.roomTypeId,
          roomId: input.roomId ?? null,
          checkInDate,
          checkOutDate,
          status: "CONFIRMED",
          adults: input.adults ?? 1,
          children: input.children ?? 0,
          ratePlan: input.ratePlan ?? "STANDARD",
          nightlyRate: nightlyRateDec,
          totalAmount: totalAmountDec,
          depositAmount: depositAmountDec,
          specialRequests: input.specialRequests ?? null,
          notes: input.notes ?? null,
          createdById: input.actorId ?? null,
        },
      });

      const guestPayloads: ReservationGuestInput[] =
        input.guests && input.guests.length > 0
          ? input.guests
          : [
              {
                name: guestName,
                email: input.guestEmail ?? null,
                phone: input.guestPhone ?? null,
                isPrimary: true,
              },
            ];

      for (let i = 0; i < guestPayloads.length; i++) {
        const g = guestPayloads[i];
        await tx.reservationGuest.create({
          data: {
            businessId: input.businessId,
            reservationId: reservation.id,
            name: g.name.trim(),
            email: g.email ?? null,
            phone: g.phone ?? null,
            idType: g.idType ?? null,
            idNumber: g.idNumber ?? null,
            isPrimary: g.isPrimary ?? i === 0,
          },
        });
      }

      if (input.roomId) {
        await tx.roomAllocation.create({
          data: {
            businessId: input.businessId,
            branchId: input.branchId,
            roomId: input.roomId,
            reservationId: reservation.id,
            startDate: checkInDate,
            endDate: checkOutDate,
            isBlocking: true,
            status: "CONFIRMED",
            notes: `Reservation ${reservation.reservationNumber}`,
          },
        });
      }

      const fullReservation = await tx.reservation.findUniqueOrThrow({
        where: { id: reservation.id },
        include: {
          roomType: true,
          room: true,
          guests: true,
          allocations: true,
        },
      });

      await createAuditEvent(
        {
          businessId: input.businessId,
          branchId: input.branchId,
          userId: input.actorId ?? null,
          action: "RESERVATION_CREATED",
          entity: "Reservation",
          entityId: reservation.id,
          newValue: fullReservation,
        },
        tx
      );

      return fullReservation;
    });
  } catch (err) {
    if (isExclusionViolation(err)) {
      throw new HotelError(
        "Room is already booked or blocked for the requested dates",
        409,
        "ROOM_DOUBLE_BOOKED"
      );
    }
    throw err;
  }
}

export async function getReservations(
  input: GetReservationsInput,
  prismaClient: PrismaClientLike = db
) {
  const fromDate = input.fromDate ? parseDate(input.fromDate, "fromDate") : undefined;
  const toDate = input.toDate ? parseDate(input.toDate, "toDate") : undefined;

  return await prismaClient.reservation.findMany({
    where: {
      businessId: input.businessId,
      ...(input.branchId ? { branchId: input.branchId } : {}),
      ...(input.status ? { status: input.status } : {}),
      ...(input.roomId ? { roomId: input.roomId } : {}),
      ...(fromDate ? { checkOutDate: { gt: fromDate } } : {}),
      ...(toDate ? { checkInDate: { lt: toDate } } : {}),
    },
    include: {
      roomType: true,
      room: true,
      guests: true,
      allocations: {
        where: { isBlocking: true },
      },
      stays: true,
    },
    orderBy: [{ checkInDate: "asc" }, { createdAt: "desc" }],
  });
}

export async function getReservationById(
  businessId: string,
  id: string,
  prismaClient: PrismaClientLike = db
) {
  const reservation = await prismaClient.reservation.findFirst({
    where: { id, businessId },
    include: {
      roomType: true,
      room: true,
      guests: true,
      allocations: true,
      stays: true,
    },
  });
  if (!reservation) {
    throw new HotelError("Reservation not found", 404, "RESERVATION_NOT_FOUND");
  }
  return reservation;
}

export async function updateReservation(
  input: UpdateReservationInput,
  prismaClient: PrismaClientLike = db
) {
  try {
    return await withHotelTransaction(prismaClient, async (tx) => {
      const existing = await tx.reservation.findFirst({
        where: { id: input.id, businessId: input.businessId },
        include: { allocations: true },
      });
      if (!existing) {
        throw new HotelError("Reservation not found", 404, "RESERVATION_NOT_FOUND");
      }

      const nextCheckIn = input.checkInDate
        ? parseDate(input.checkInDate, "checkInDate")
        : existing.checkInDate;
      const nextCheckOut = input.checkOutDate
        ? parseDate(input.checkOutDate, "checkOutDate")
        : existing.checkOutDate;

      if (nextCheckIn.getTime() >= nextCheckOut.getTime()) {
        throw new HotelError("checkInDate must be before checkOutDate", 400, "INVALID_DATE_RANGE");
      }

      const nextRoomId = input.roomId !== undefined ? input.roomId : existing.roomId;
      const nights = calculateNights(nextCheckIn, nextCheckOut);
      const nextTotalAmount = mulMoney(existing.nightlyRate, nights);

      // Update RoomAllocation if dates or roomId changed and reservation is still CONFIRMED
      if (existing.status === "CONFIRMED") {
        const activeAllocations = existing.allocations.filter((a) => a.isBlocking);
        if (nextRoomId) {
          const room = await tx.room.findFirst({
            where: { id: nextRoomId, businessId: input.businessId, isActive: true },
          });
          if (!room) {
            throw new HotelError("Assigned room not found", 404, "ROOM_NOT_FOUND");
          }
          if (room.status === "OUT_OF_SERVICE") {
            throw new HotelError(
              "Assigned room is out of service",
              409,
              "ROOM_OUT_OF_SERVICE"
            );
          }

          if (activeAllocations.length === 1 && activeAllocations[0].roomId === nextRoomId) {
            await tx.roomAllocation.update({
              where: { id: activeAllocations[0].id },
              data: {
                startDate: nextCheckIn,
                endDate: nextCheckOut,
              },
            });
          } else {
            if (activeAllocations.length > 0) {
              await tx.roomAllocation.updateMany({
                where: {
                  businessId: input.businessId,
                  reservationId: existing.id,
                  isBlocking: true,
                },
                data: {
                  isBlocking: false,
                  status: "CANCELLED",
                },
              });
            }
            await tx.roomAllocation.create({
              data: {
                businessId: input.businessId,
                branchId: existing.branchId,
                roomId: nextRoomId,
                reservationId: existing.id,
                startDate: nextCheckIn,
                endDate: nextCheckOut,
                isBlocking: true,
                status: "CONFIRMED",
                notes: `Reservation ${existing.reservationNumber}`,
              },
            });
          }
        } else if (input.roomId === null && activeAllocations.length > 0) {
          await tx.roomAllocation.updateMany({
            where: {
              businessId: input.businessId,
              reservationId: existing.id,
              isBlocking: true,
            },
            data: {
              isBlocking: false,
              status: "CANCELLED",
            },
          });
        }
      }

      const updated = await tx.reservation.update({
        where: { id: existing.id },
        data: {
          ...(input.guestName !== undefined ? { guestName: input.guestName.trim() } : {}),
          ...(input.guestEmail !== undefined ? { guestEmail: input.guestEmail } : {}),
          ...(input.guestPhone !== undefined ? { guestPhone: input.guestPhone } : {}),
          ...(input.roomId !== undefined ? { roomId: input.roomId } : {}),
          checkInDate: nextCheckIn,
          checkOutDate: nextCheckOut,
          totalAmount: nextTotalAmount,
          ...(input.status !== undefined ? { status: input.status } : {}),
          ...(input.specialRequests !== undefined
            ? { specialRequests: input.specialRequests }
            : {}),
          ...(input.notes !== undefined ? { notes: input.notes } : {}),
          version: { increment: 1 },
        },
        include: {
          roomType: true,
          room: true,
          guests: true,
          allocations: true,
        },
      });

      await createAuditEvent(
        {
          businessId: input.businessId,
          branchId: existing.branchId,
          userId: input.actorId ?? null,
          action: "RESERVATION_UPDATED",
          entity: "Reservation",
          entityId: updated.id,
          entityVersion: updated.version,
          oldValue: existing,
          newValue: updated,
        },
        tx
      );

      return updated;
    });
  } catch (err) {
    if (isExclusionViolation(err)) {
      throw new HotelError(
        "Room is already booked or blocked for the requested dates",
        409,
        "ROOM_DOUBLE_BOOKED"
      );
    }
    throw err;
  }
}

export async function cancelReservation(
  input: CancelReservationInput,
  prismaClient: PrismaClientLike = db
) {
  return await withHotelTransaction(prismaClient, async (tx) => {
    const existing = await tx.reservation.findFirst({
      where: { id: input.id, businessId: input.businessId },
    });
    if (!existing) {
      throw new HotelError("Reservation not found", 404, "RESERVATION_NOT_FOUND");
    }

    if (existing.status === "CHECKED_IN" || existing.status === "CHECKED_OUT") {
      throw new HotelError(
        `Cannot cancel reservation in ${existing.status} state`,
        409,
        "INVALID_RESERVATION_STATE"
      );
    }

    const targetStatus = input.status ?? "CANCELLED";

    // Release all blocking RoomAllocations for this reservation
    await tx.roomAllocation.updateMany({
      where: {
        businessId: input.businessId,
        reservationId: existing.id,
        isBlocking: true,
      },
      data: {
        isBlocking: false,
        status: "CANCELLED",
      },
    });

    const updated = await tx.reservation.update({
      where: { id: existing.id },
      data: {
        status: targetStatus,
        notes: input.reason
          ? existing.notes
            ? `${existing.notes} | Cancel reason: ${input.reason}`
            : `Cancel reason: ${input.reason}`
          : existing.notes,
        version: { increment: 1 },
      },
      include: {
        roomType: true,
        room: true,
        guests: true,
        allocations: true,
      },
    });

    await createAuditEvent(
      {
        businessId: input.businessId,
        branchId: existing.branchId,
        userId: input.actorId ?? null,
        action: targetStatus === "NO_SHOW" ? "RESERVATION_NO_SHOW" : "RESERVATION_CANCELLED",
        entity: "Reservation",
        entityId: updated.id,
        entityVersion: updated.version,
        oldValue: existing,
        newValue: updated,
        reason: input.reason ?? null,
      },
      tx
    );

    return updated;
  });
}
