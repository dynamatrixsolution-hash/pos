import { db } from "@/lib/db";
import { createAuditEvent } from "@/lib/audit-event";
import {
  HotelError,
  isExclusionViolation,
  PrismaClientLike,
  withHotelTransaction,
} from "@/lib/services/room-availability-service";
import { rebindGuestAccessOnRoomTransfer } from "@/lib/services/guest-portal-service";

export interface TransferRoomInput {
  businessId: string;
  stayId: string;
  targetRoomId: string;
  reason?: string | null;
  actorId?: string;
}

export async function transferRoom(
  input: TransferRoomInput,
  prismaClient: PrismaClientLike = db
) {
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
        throw new HotelError(
          "Cannot transfer a completed stay",
          400,
          "STAY_ALREADY_COMPLETED"
        );
      }

      const sourceRoomId = stay.roomId;
      if (input.targetRoomId === sourceRoomId) {
        throw new HotelError(
          "Target room must be different from current room",
          400,
          "SAME_ROOM_TRANSFER"
        );
      }

      const targetRoomCheck = await tx.room.findFirst({
        where: { id: input.targetRoomId, businessId: input.businessId, isActive: true },
      });
      if (!targetRoomCheck) {
        throw new HotelError("Target room not found", 404, "TARGET_ROOM_NOT_FOUND");
      }

      // Atomic Compare-And-Swap on targetRoom
      const cas = await tx.room.updateMany({
        where: {
          id: input.targetRoomId,
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
          "Target room is not vacant",
          409,
          "TARGET_ROOM_UNAVAILABLE"
        );
      }

      const now = new Date();

      // Release source room's active RoomAllocation(s)
      const activeSourceAllocs = stay.allocations.filter(
        (a) => a.isBlocking && a.roomId === sourceRoomId
      );
      for (const alloc of activeSourceAllocs) {
        await tx.roomAllocation.update({
          where: { id: alloc.id },
          data: {
            isBlocking: false,
            status: "COMPLETED",
            endDate: now.getTime() > alloc.startDate.getTime() ? now : alloc.endDate,
          },
        });
      }

      const allocStart =
        now.getTime() > stay.checkInTime.getTime() ? now : stay.checkInTime;
      const allocEnd =
        stay.expectedCheckOut.getTime() > allocStart.getTime()
          ? stay.expectedCheckOut
          : new Date(allocStart.getTime() + 3_600_000);

      // Create new RoomAllocation for targetRoomId
      const newAllocation = await tx.roomAllocation.create({
        data: {
          businessId: input.businessId,
          branchId: stay.branchId,
          roomId: input.targetRoomId,
          stayId: stay.id,
          reservationId: stay.reservationId,
          startDate: allocStart,
          endDate: allocEnd,
          isBlocking: true,
          status: "CHECKED_IN",
          notes: input.reason
            ? `Transferred from room ${sourceRoomId}: ${input.reason}`
            : `Transferred from room ${sourceRoomId}`,
        },
      });

      // Mark source room VACANT_DIRTY and clear currentStayId
      const sourceRoom = await tx.room.update({
        where: { id: sourceRoomId },
        data: {
          status: "VACANT_DIRTY",
          currentStayId: null,
        },
        include: { roomType: true, floor: true },
      });

      // Create HousekeepingTask for source room turnover
      const housekeepingTask = await tx.housekeepingTask.create({
        data: {
          businessId: input.businessId,
          branchId: stay.branchId,
          roomId: sourceRoomId,
          stayId: stay.id,
          taskType: "CHECK_OUT_CLEANING",
          status: "DIRTY",
          priority: "HIGH",
          notes: input.reason ? `Room transfer: ${input.reason}` : "Room transfer turnover",
        },
      });

      // Update Stay with new roomId while preserving stay.id, stayNumber, and guest identity
      const updatedStay = await tx.stay.update({
        where: { id: stay.id },
        data: {
          roomId: input.targetRoomId,
          status: "TRANSFERRED",
          notes: input.reason
            ? stay.notes
              ? `${stay.notes} | Transfer: ${input.reason}`
              : `Transfer: ${input.reason}`
            : stay.notes,
          version: { increment: 1 },
        },
        include: {
          room: { include: { roomType: true, floor: true } },
          allocations: true,
        },
      });

      if (stay.reservationId) {
        await tx.reservation.update({
          where: { id: stay.reservationId },
          data: {
            roomId: input.targetRoomId,
            version: { increment: 1 },
          },
        });
      }

      // Rebind any active GuestAccessGrant, GuestSession, and open ServiceRequests to target room
      await rebindGuestAccessOnRoomTransfer(
        {
          businessId: input.businessId,
          branchId: stay.branchId,
          stayId: stay.id,
          sourceRoomId,
          targetRoomId: input.targetRoomId,
          actorId: input.actorId ?? null,
        },
        tx
      );

      const targetRoom = await tx.room.findUniqueOrThrow({
        where: { id: input.targetRoomId },
        include: { roomType: true, floor: true },
      });

      await createAuditEvent(
        {
          businessId: input.businessId,
          branchId: stay.branchId,
          userId: input.actorId ?? null,
          action: "ROOM_TRANSFERRED",
          entity: "Stay",
          entityId: updatedStay.id,
          entityVersion: updatedStay.version,
          oldValue: { roomId: sourceRoomId, status: stay.status },
          newValue: {
            roomId: input.targetRoomId,
            status: updatedStay.status,
            housekeepingTaskId: housekeepingTask.id,
          },
          reason: input.reason ?? null,
        },
        tx
      );

      return {
        stay: updatedStay,
        sourceRoom,
        targetRoom,
        housekeepingTask,
        newAllocation,
      };
    });
  } catch (err) {
    if (isExclusionViolation(err)) {
      throw new HotelError(
        "Target room has an overlapping booking or block for the remaining stay window",
        409,
        "ROOM_DOUBLE_BOOKED"
      );
    }
    throw err;
  }
}
