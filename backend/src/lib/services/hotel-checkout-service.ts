import { db } from "@/lib/db";
import { Prisma } from "@dynapos/db";
import { addMoney, money, subMoney } from "@/lib/services/decimal-math";
import { createAuditEvent } from "@/lib/audit-event";
import {
  HotelError,
  PrismaClientLike,
  withHotelTransaction,
} from "@/lib/services/room-availability-service";
import { revokeGuestAccessForStay } from "@/lib/services/guest-portal-service";
import { recalculateFolioTotals } from "@/lib/services/folio-service";

export interface CheckOutStayInput {
  businessId: string;
  stayId: string;
  settleAmount?: number | string | Prisma.Decimal;
  enforceSettlement?: boolean;
  notes?: string | null;
  actorId?: string;
}

export async function checkOutStay(
  input: CheckOutStayInput,
  prismaClient: PrismaClientLike = db
) {
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
        "Stay is already checked out",
        400,
        "ALREADY_CHECKED_OUT"
      );
    }

    // Fetch all folios for this stay
    const folios = await tx.guestFolio.findMany({
      where: {
        businessId: input.businessId,
        stayId: stay.id,
      },
    });

    // Recalculate folio totals to ensure they are fresh before validation
    const refreshedFolios = [];
    for (const folio of folios) {
      if (folio.status !== "CLOSED") {
        const refreshed = await recalculateFolioTotals(
          tx,
          input.businessId,
          folio.id
        );
        refreshedFolios.push(refreshed);
      } else {
        refreshedFolios.push(folio);
      }
    }

    // If a settle amount is provided, apply it as payment allocations to open folios
    const settleAmountDec =
      input.settleAmount !== undefined ? money(input.settleAmount) : money(0);
    let remainingSettle = settleAmountDec;

    if (Number(remainingSettle) > 0) {
      // Sort folios with positive balance first so we pay them off
      const unpaidFolios = refreshedFolios
        .filter(
          (f) => f.status !== "CLOSED" && Number(f.balance) > 0
        )
        .sort((a, b) => Number(b.balance) - Number(a.balance));

      for (const folio of unpaidFolios) {
        if (Number(remainingSettle) <= 0) break;

        const folioBalance = money(folio.balance);
        // Pay up to the folio's remaining balance
        const payAmount =
          Number(remainingSettle) >= Number(folioBalance)
            ? folioBalance
            : remainingSettle;

        await tx.folioSettlementAllocation.create({
          data: {
            businessId: input.businessId,
            branchId: folio.branchId,
            folioId: folio.id,
            stayId: stay.id,
            paymentMethod: "CASH",
            amount: payAmount,
            status: "APPLIED",
            notes: "Final settlement at check-out",
            allocatedById: input.actorId ?? null,
          },
        });

        remainingSettle = subMoney(remainingSettle, payAmount);
      }

      // Recalculate folio totals again after applying settlements
      for (let i = 0; i < refreshedFolios.length; i++) {
        if (refreshedFolios[i].status !== "CLOSED") {
          refreshedFolios[i] = await recalculateFolioTotals(
            tx,
            input.businessId,
            refreshedFolios[i].id
          );
        }
      }
    }

    // Re-read stay after recalculateFolioTotals may have synced its totals
    const freshStay = await tx.stay.findFirst({
      where: { id: input.stayId, businessId: input.businessId },
    });
    const stayTotalAmount = freshStay
      ? freshStay.totalAmount
      : stay.totalAmount;
    const stayPaidAmount = freshStay ? freshStay.paidAmount : stay.paidAmount;

    const newPaidAmount =
      input.settleAmount !== undefined
        ? addMoney(stayPaidAmount, money(input.settleAmount))
        : stayPaidAmount;

    // Check if any folio still has a positive balance after settlements
    const hasUnpaidFolio = refreshedFolios.some(
      (f) => f.status !== "CLOSED" && Number(f.balance) > 0
    );

    if (
      input.enforceSettlement === true &&
      (hasUnpaidFolio || Number(newPaidAmount) < Number(stayTotalAmount))
    ) {
      throw new HotelError(
        "Cannot check out stay with unresolved folio balance",
        400,
        "UNRESOLVED_FOLIO_BALANCE"
      );
    }

    const now = new Date();

    // Close any OPEN or SETTLING GuestFolio that has zero (or negative) balance
    for (const folio of refreshedFolios) {
      if (
        (folio.status === "OPEN" || folio.status === "SETTLING") &&
        Number(folio.balance) <= 0
      ) {
        await tx.guestFolio.update({
          where: { id: folio.id },
          data: {
            status: "CLOSED",
            closedAt: now,
            lockedAt: null,
            version: { increment: 1 },
          },
        });
      }
    }

    const updatedStay = await tx.stay.update({
      where: { id: stay.id },
      data: {
        status: "COMPLETED",
        checkOutTime: now,
        checkedOutById: input.actorId ?? null,
        paidAmount: newPaidAmount,
        notes: input.notes
          ? stay.notes
            ? `${stay.notes} | Checkout: ${input.notes}`
            : input.notes
          : stay.notes,
        version: { increment: 1 },
      },
    });

    if (stay.reservationId) {
      await tx.reservation.update({
        where: { id: stay.reservationId },
        data: {
          status: "CHECKED_OUT",
          version: { increment: 1 },
        },
      });
    }

    // Release active RoomAllocation(s) for this stay
    const activeAllocs = stay.allocations.filter((a) => a.isBlocking);
    for (const alloc of activeAllocs) {
      await tx.roomAllocation.update({
        where: { id: alloc.id },
        data: {
          isBlocking: false,
          status: "COMPLETED",
          endDate: now.getTime() > alloc.startDate.getTime() ? now : alloc.endDate,
        },
      });
    }

    // Update Room to VACANT_DIRTY and clear currentStayId (never mark CLEAN on checkout!)
    const updatedRoom = await tx.room.update({
      where: { id: stay.roomId },
      data: {
        status: "VACANT_DIRTY",
        currentStayId: null,
      },
      include: { roomType: true, floor: true },
    });

    // Atomically revoke all GuestAccessGrant and GuestSession tokens for this stay
    await revokeGuestAccessForStay(
      {
        businessId: input.businessId,
        stayId: stay.id,
        reason: "STAY_CHECKED_OUT",
        actorId: input.actorId ?? null,
        now,
      },
      tx
    );

    // Automatically create a post-checkout HousekeepingTask
    const housekeepingTask = await tx.housekeepingTask.create({
      data: {
        businessId: input.businessId,
        branchId: stay.branchId,
        roomId: stay.roomId,
        stayId: stay.id,
        taskType: "CHECK_OUT_CLEANING",
        status: "DIRTY",
        priority: "HIGH",
        notes: input.notes ?? "Automatic post-checkout cleaning task",
      },
    });

    await createAuditEvent(
      {
        businessId: input.businessId,
        branchId: stay.branchId,
        userId: input.actorId ?? null,
        action: "STAY_CHECKED_OUT",
        entity: "Stay",
        entityId: updatedStay.id,
        entityVersion: updatedStay.version,
        oldValue: stay,
        newValue: {
          stay: updatedStay,
          roomStatus: updatedRoom.status,
          housekeepingTaskId: housekeepingTask.id,
        },
      },
      tx
    );

    return {
      stay: updatedStay,
      room: updatedRoom,
      housekeepingTask,
    };
  });
}
