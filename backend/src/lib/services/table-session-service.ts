import { db } from "@/lib/db";
import { Prisma, TableSession, RestaurantTable } from "@dynapos/db";
import { createAuditEvent } from "@/lib/audit-event";
import { serializable } from "@/lib/commerce-transaction";

export class TableSessionError extends Error {
  statusCode: number;
  constructor(message: string, statusCode = 400) {
    super(message);
    this.name = "TableSessionError";
    this.statusCode = statusCode;
  }
}

// -----------------------------------------------------------------------------
// DTO Interfaces
// -----------------------------------------------------------------------------

export interface OpenSessionInput {
  businessId: string;
  branchId: string;
  tableId: string;
  guestCount?: number;
  openedById?: string | null;
  serverStaffId?: string | null;
  notes?: string | null;
}

export interface CloseSessionInput {
  businessId: string;
  sessionId: string;
  closedById?: string | null;
  actorId?: string | null;
  notes?: string | null;
  force?: boolean;
  expectedVersion?: number;
}

export interface UpdateSessionInput {
  businessId: string;
  sessionId: string;
  guestCount?: number;
  notes?: string | null;
  expectedVersion?: number;
  actorId?: string | null;
}

export interface GetSessionsFilter {
  businessId: string;
  branchId?: string | null;
  floorId?: string | null;
  status?: string | null;
}

export interface MoveTableParams {
  businessId: string;
  sourceTableId?: string;
  targetTableId?: string;
  fromTableId?: string; // backwards compatibility alias
  toTableId?: string;   // backwards compatibility alias
  actorId?: string;
  reason?: string;
}

export interface MoveTableResult {
  session: TableSession;
  sourceTable: RestaurantTable;
  targetTable: RestaurantTable;
  ordersMovedCount: number;
}

export interface MergeTableParams {
  businessId: string;
  sourceTableIds?: string[];
  targetTableId?: string;
  sourceSessionId?: string; // backwards compatibility alias
  targetSessionId?: string; // backwards compatibility alias
  actorId?: string;
  reason?: string;
}

export interface MergedSessionSummary {
  sourceSessionId: string;
  sourceTableId: string;
  sourceTableNumber: string;
  guestCount: number;
  ordersTransferred: number;
}

export interface MergeTableResult {
  targetSession: TableSession;
  targetTable: RestaurantTable;
  mergedSessions: MergedSessionSummary[];
  totalTransferredOrders: number;
  totalGuests: number;
  sourceSession?: TableSession;
  sourceSessions?: TableSession[];
}

// -----------------------------------------------------------------------------
// Monotonic Session Number Generator
// -----------------------------------------------------------------------------

/**
 * Generates a concurrency-safe, monotonic session number per branch for today.
 * Format: SESS-YYYYMMDD-XXXX (e.g., SESS-20261101-0001)
 */
export async function generateMonotonicSessionNumber(
  tx: Prisma.TransactionClient,
  businessId: string,
  branchId: string,
  now: Date = new Date()
): Promise<string> {
  const dateStr = now.toISOString().slice(0, 10).replace(/-/g, "");
  const prefix = `SESS-${dateStr}-`;

  const lastSession = await tx.tableSession.findFirst({
    where: {
      businessId,
      branchId,
      sessionNumber: { startsWith: prefix },
    },
    orderBy: { sessionNumber: "desc" },
    select: { sessionNumber: true },
  });

  let nextSeq = 1;
  if (lastSession?.sessionNumber) {
    const parts = lastSession.sessionNumber.split("-");
    const lastNum = parseInt(parts[parts.length - 1], 10);
    if (!isNaN(lastNum)) {
      nextSeq = lastNum + 1;
    }
  }

  const paddedSeq = String(nextSeq).padStart(4, "0");
  return `${prefix}${paddedSeq}`;
}

// -----------------------------------------------------------------------------
// Core TableSession Operations
// -----------------------------------------------------------------------------

/**
 * Opens a new table session.
 * Enforces atomic CAS validation (table must be AVAILABLE), creates active session,
 * sets table status to OCCUPIED and currentSessionId to session.id.
 */
export async function openTableSession(
  input: OpenSessionInput,
  externalTx?: Prisma.TransactionClient
) {
  const runner = async (tx: Prisma.TransactionClient) => {
    // 1. Fetch table and verify tenant and branch isolation
    const table = await tx.restaurantTable.findFirst({
      where: {
        id: input.tableId,
        businessId: input.businessId,
        branchId: input.branchId,
        isActive: true,
      },
    });

    if (!table) {
      throw new TableSessionError("Table not found or is inactive", 404);
    }

    if (table.status !== "AVAILABLE" || table.currentSessionId !== null) {
      throw new TableSessionError(
        `Table ${table.tableNumber} is already ${table.status}`,
        409
      );
    }

    // 2. Check no existing active session references this table
    const existingActiveSession = await tx.tableSession.findFirst({
      where: {
        businessId: input.businessId,
        tableId: input.tableId,
        status: { in: ["ACTIVE", "BILLED"] },
      },
    });

    if (existingActiveSession) {
      throw new TableSessionError(
        `Table already has an active session (${existingActiveSession.sessionNumber})`,
        409
      );
    }

    // 3. Generate monotonic session number
    const sessionNumber = await generateMonotonicSessionNumber(
      tx,
      input.businessId,
      input.branchId
    );

    const openedById = input.openedById || input.serverStaffId || null;

    // 4. Create active table session
    const session = await tx.tableSession.create({
      data: {
        businessId: input.businessId,
        branchId: input.branchId,
        tableId: input.tableId,
        sessionNumber,
        guestCount: input.guestCount && input.guestCount > 0 ? input.guestCount : 1,
        status: "ACTIVE",
        openedAt: new Date(),
        openedById,
        notes: input.notes || null,
        version: 1,
      },
    });

    // 5. Atomic CAS update on RestaurantTable
    const tableUpdate = await tx.restaurantTable.updateMany({
      where: {
        id: input.tableId,
        businessId: input.businessId,
        status: "AVAILABLE",
        currentSessionId: null,
      },
      data: {
        status: "OCCUPIED",
        currentSessionId: session.id,
      },
    });

    if (tableUpdate.count === 0) {
      throw new TableSessionError(
        `Table ${table.tableNumber} was occupied by a concurrent request. Please refresh.`,
        409
      );
    }

    const updatedTable = await tx.restaurantTable.findUniqueOrThrow({
      where: { id: input.tableId },
      include: { floor: { select: { id: true, name: true, displayOrder: true } } },
    });

    // 6. Audit event
    await createAuditEvent(
      {
        businessId: input.businessId,
        branchId: input.branchId,
        userId: openedById,
        action: "TABLE_SESSION_OPENED",
        entity: "TableSession",
        entityId: session.id,
        entityVersion: 1,
        newValue: {
          tableId: input.tableId,
          tableNumber: table.tableNumber,
          sessionNumber,
          guestCount: session.guestCount,
        },
      },
      tx
    );

    return { session, table: updatedTable };
  };

  if (externalTx) {
    return await runner(externalTx);
  }
  return await serializable(runner);
}

/**
 * Closes a table session and releases the table back to AVAILABLE.
 * Invariants: All orders must be settled (PAID/REFUNDED) or voided (CANCELLED/REJECTED),
 * and no items can be actively preparing in the kitchen, unless force: true.
 * Supports overloaded arguments:
 *   closeTableSession(input: CloseSessionInput, externalTx?: Prisma.TransactionClient)
 *   closeTableSession(tx: Prisma.TransactionClient, businessId: string, sessionId: string, actorId?: string)
 */
export async function closeTableSession(
  inputOrTx: CloseSessionInput | Prisma.TransactionClient,
  secondArg?: Prisma.TransactionClient | string,
  thirdArg?: string,
  fourthArg?: string
): Promise<TableSession & { table?: RestaurantTable }> {
  let input: CloseSessionInput;
  let externalTx: Prisma.TransactionClient | undefined;

  if (typeof secondArg === "string" && typeof thirdArg === "string") {
    // Signature: (tx, businessId, sessionId, actorId)
    externalTx = inputOrTx as Prisma.TransactionClient;
    input = {
      businessId: secondArg,
      sessionId: thirdArg,
      actorId: fourthArg || null,
      closedById: fourthArg || null,
    };
  } else {
    // Signature: (input, externalTx)
    input = inputOrTx as CloseSessionInput;
    externalTx = secondArg as Prisma.TransactionClient | undefined;
  }

  const runner = async (tx: Prisma.TransactionClient) => {
    const session = await tx.tableSession.findFirst({
      where: { id: input.sessionId, businessId: input.businessId },
      include: {
        table: true,
        restaurantOrders: {
          include: {
            orderLines: true,
          },
        },
      },
    });

    if (!session) {
      throw new TableSessionError("Session not found", 404);
    }

    if (
      session.status === "COMPLETED" ||
      session.status === "CLOSED" ||
      session.status === "CANCELLED" ||
      session.status === "MERGED"
    ) {
      throw new TableSessionError(
        `Session already closed with status: ${session.status}`,
        400
      );
    }

    if (
      input.expectedVersion !== undefined &&
      session.version !== input.expectedVersion
    ) {
      throw new TableSessionError(
        `Session version mismatch: current ${session.version}, expected ${input.expectedVersion}`,
        409
      );
    }

    // Invariant validations if not forced
    if (!input.force) {
      const orders = session.restaurantOrders || [];

      // 1. Settlement check
      const unsettledOrders = orders.filter((o: any) => {
        const isVoided =
          o.acceptanceStatus === "REJECTED" || o.fulfillmentStatus === "CANCELLED";
        if (isVoided) return false;
        const isSettled =
          o.settlementStatus === "PAID" || o.settlementStatus === "REFUNDED";
        return !isSettled;
      });

      if (unsettledOrders.length > 0) {
        throw new TableSessionError(
          `Cannot close session: ${unsettledOrders.length} order(s) remain unsettled (unpaid)`,
          400
        );
      }

      // 2. Kitchen preparation safety check
      const activeFoodLines = orders
        .flatMap((o: any) => o.orderLines || [])
        .filter(
          (l: any) =>
            l.acceptanceStatus === "ACCEPTED" &&
            (l.fulfillmentStatus === "QUEUED" || l.fulfillmentStatus === "PREPARING")
        );

      if (activeFoodLines.length > 0) {
        throw new TableSessionError(
          `Cannot close session: ${activeFoodLines.length} item(s) are still preparing in the kitchen`,
          400
        );
      }
    }

    const closedById = input.closedById || input.actorId || null;

    // 1. Atomically close session
    const closedSession = await tx.tableSession.update({
      where: { id: session.id },
      data: {
        status: "COMPLETED",
        closedAt: new Date(),
        closedById,
        version: { increment: 1 },
        notes: input.notes
          ? `${session.notes || ""}\n${input.notes}`.trim()
          : session.notes,
      },
    });

    // 2. Release table back to AVAILABLE
    const updatedTable = await tx.restaurantTable.update({
      where: { id: session.tableId },
      data: {
        status: "AVAILABLE",
        currentSessionId: null,
      },
    });

    // 2b. Atomically revoke all GuestAccessGrant and GuestSession tokens for this table session
    const revokedNow = new Date();
    await tx.guestAccessGrant.updateMany({
      where: {
        businessId: input.businessId,
        tableSessionId: session.id,
        status: "ACTIVE",
      },
      data: {
        status: "REVOKED",
        revokedAt: revokedNow,
        revokedReason: "TABLE_SESSION_CLOSED",
        revokedById: closedById,
      },
    });
    await tx.guestSession.updateMany({
      where: {
        businessId: input.businessId,
        tableSessionId: session.id,
        status: "ACTIVE",
      },
      data: {
        status: "REVOKED",
        revokedAt: revokedNow,
      },
    });

    // 3. Audit trail
    await createAuditEvent(
      {
        businessId: input.businessId,
        branchId: session.branchId,
        userId: closedById,
        action: "TABLE_SESSION_CLOSED",
        entity: "TableSession",
        entityId: session.id,
        entityVersion: closedSession.version,
        reason: input.notes || null,
        metadata: {
          sessionNumber: session.sessionNumber,
          tableId: session.tableId,
          tableNumber: session.table.tableNumber,
          ordersCount: (session.restaurantOrders || []).length,
          force: Boolean(input.force),
        },
      },
      tx
    );

    return Object.assign(closedSession, { table: updatedTable });
  };

  if (externalTx) {
    return await runner(externalTx);
  }
  return await serializable(runner);
}

/**
 * Moves an active table session from a source table to an available target table atomically.
 * Preserves all orders and order lines without duplication or loss.
 * Prevents deadlocks via deterministic lexicographical table locking.
 */
export async function moveTableSession(
  params: MoveTableParams,
  externalTx?: Prisma.TransactionClient
): Promise<MoveTableResult> {
  const runner = async (tx: Prisma.TransactionClient): Promise<MoveTableResult> => {
    const { businessId, actorId, reason } = params;
    const sourceTableId = params.sourceTableId || params.fromTableId;
    const targetTableId = params.targetTableId || params.toTableId;

    if (!sourceTableId || !targetTableId) {
      throw new TableSessionError("Source and target table IDs are required", 400);
    }

    if (sourceTableId === targetTableId) {
      throw new TableSessionError("Source and target tables cannot be identical", 400);
    }

    // 1. Deterministic lock acquisition order to prevent deadlocks
    const [firstId, secondId] = [sourceTableId, targetTableId].sort();

    const firstTable = await tx.restaurantTable.findFirst({
      where: { id: firstId, businessId, isActive: true },
    });
    const secondTable = await tx.restaurantTable.findFirst({
      where: { id: secondId, businessId, isActive: true },
    });

    const sourceTable = firstId === sourceTableId ? firstTable : secondTable;
    const targetTable = firstId === targetTableId ? firstTable : secondTable;

    if (!sourceTable) {
      throw new TableSessionError("Source table not found or inactive", 404);
    }
    if (!targetTable) {
      throw new TableSessionError("Target table not found or inactive", 404);
    }
    if (sourceTable.branchId !== targetTable.branchId) {
      throw new TableSessionError("Cannot move table session across different branches", 400);
    }

    // 2. Validate table occupancy states
    if (sourceTable.status !== "OCCUPIED" && sourceTable.status !== "BILLED") {
      throw new TableSessionError(
        `Source table ${sourceTable.tableNumber} is not occupied (status: ${sourceTable.status})`,
        400
      );
    }
    if (!sourceTable.currentSessionId) {
      throw new TableSessionError(
        `Source table ${sourceTable.tableNumber} has no active session linked`,
        400
      );
    }

    if (targetTable.status !== "AVAILABLE" || targetTable.currentSessionId !== null) {
      throw new TableSessionError(
        `Target table ${targetTable.tableNumber} is not available (status: ${targetTable.status})`,
        409
      );
    }

    // 3. Retrieve and lock active session
    const session = await tx.tableSession.findFirst({
      where: {
        id: sourceTable.currentSessionId,
        businessId,
        branchId: sourceTable.branchId,
        status: { in: ["ACTIVE", "BILLED"] },
      },
    });

    if (!session) {
      throw new TableSessionError("Active table session not found for source table", 404);
    }

    // 4. Update TableSession table pointer and bump OCC version
    const updatedSession = await tx.tableSession.update({
      where: { id: session.id },
      data: {
        tableId: targetTable.id,
        version: { increment: 1 },
      },
    });

    // 5. Update cached tableId on all active RestaurantOrders linked to this session
    const orderUpdateResult = await tx.restaurantOrder.updateMany({
      where: {
        tableSessionId: session.id,
        businessId,
      },
      data: {
        tableId: targetTable.id,
      },
    });

    // 6. Release source table
    const updatedSourceTable = await tx.restaurantTable.update({
      where: { id: sourceTable.id },
      data: {
        status: "AVAILABLE",
        currentSessionId: null,
      },
    });

    // 7. Occupy target table
    const updatedTargetTable = await tx.restaurantTable.update({
      where: { id: targetTable.id },
      data: {
        status: sourceTable.status,
        currentSessionId: session.id,
      },
    });

    // 8. Immutable audit event
    await createAuditEvent(
      {
        businessId,
        branchId: sourceTable.branchId,
        userId: actorId || null,
        action: "TABLE_SESSION_MOVED",
        entity: "TableSession",
        entityId: session.id,
        entityVersion: updatedSession.version,
        reason: reason || "Staff table move request",
        oldValue: {
          tableId: sourceTable.id,
          tableNumber: sourceTable.tableNumber,
          status: sourceTable.status,
        },
        newValue: {
          tableId: targetTable.id,
          tableNumber: targetTable.tableNumber,
          status: updatedTargetTable.status,
        },
        metadata: {
          sourceTableId: sourceTable.id,
          targetTableId: targetTable.id,
          ordersMoved: orderUpdateResult.count,
        },
      },
      tx
    );

    return {
      session: updatedSession,
      sourceTable: updatedSourceTable,
      targetTable: updatedTargetTable,
      ordersMovedCount: orderUpdateResult.count,
    };
  };

  if (externalTx) {
    return await runner(externalTx);
  }
  return await serializable(runner);
}

/**
 * Merges one or more source table sessions into a target table session atomically.
 * Supports both multi-source table merging and backwards-compatible session merging.
 * Re-parents all orders from source sessions to the target session and updates tableId cache.
 * Source sessions transition to MERGED status and source tables return to AVAILABLE.
 */
export async function mergeTableSessions(
  params: MergeTableParams,
  externalTx?: Prisma.TransactionClient
): Promise<MergeTableResult> {
  const runner = async (tx: Prisma.TransactionClient): Promise<MergeTableResult> => {
    const { businessId, actorId, reason } = params;

    let sourceTableIds = params.sourceTableIds;
    let targetTableId = params.targetTableId;

    // Handle backwards compatibility where session IDs were passed
    if (params.sourceSessionId && params.targetSessionId) {
      const [srcSess, tgtSess] = await Promise.all([
        tx.tableSession.findFirst({
          where: { id: params.sourceSessionId, businessId },
        }),
        tx.tableSession.findFirst({
          where: { id: params.targetSessionId, businessId },
        }),
      ]);
      if (!srcSess || !tgtSess) {
        throw new TableSessionError("One or both table sessions not found", 404);
      }
      sourceTableIds = [srcSess.tableId];
      targetTableId = tgtSess.tableId;
    }

    if (!sourceTableIds || sourceTableIds.length === 0) {
      throw new TableSessionError("At least one source table ID must be provided", 400);
    }
    if (!targetTableId) {
      throw new TableSessionError("Target table ID is required", 400);
    }

    const uniqueSourceIds = Array.from(new Set(sourceTableIds));
    if (uniqueSourceIds.includes(targetTableId)) {
      throw new TableSessionError("Target table cannot be included among source tables", 400);
    }

    // 1. Deterministic lock ordering across all participating tables
    const allTableIds = Array.from(new Set([...uniqueSourceIds, targetTableId])).sort();

    const tables = await tx.restaurantTable.findMany({
      where: { id: { in: allTableIds }, businessId, isActive: true },
    });

    if (tables.length !== allTableIds.length) {
      throw new TableSessionError("One or more tables could not be found or are inactive", 404);
    }

    const targetTable = tables.find((t) => t.id === targetTableId)!;
    const sourceTables = uniqueSourceIds.map((id) => tables.find((t) => t.id === id)!);

    // Uniform branch verification
    for (const st of sourceTables) {
      if (st.branchId !== targetTable.branchId) {
        throw new TableSessionError("All tables in a merge must belong to the same branch", 400);
      }
    }

    // 2. Validate target table & session
    if (!targetTable.currentSessionId) {
      throw new TableSessionError(
        `Target table ${targetTable.tableNumber} does not have an active session`,
        400
      );
    }

    const targetSession = await tx.tableSession.findFirst({
      where: {
        id: targetTable.currentSessionId,
        businessId,
        branchId: targetTable.branchId,
        status: { in: ["ACTIVE", "BILLED"] },
      },
    });

    if (!targetSession) {
      throw new TableSessionError("Active session not found for target table", 404);
    }

    // 3. Validate each source table & session
    const sourceSessions: TableSession[] = [];
    for (const srcTable of sourceTables) {
      if (!srcTable.currentSessionId) {
        throw new TableSessionError(
          `Source table ${srcTable.tableNumber} has no active session to merge`,
          400
        );
      }

      const srcSession = await tx.tableSession.findFirst({
        where: {
          id: srcTable.currentSessionId,
          businessId,
          branchId: srcTable.branchId,
          status: { in: ["ACTIVE", "BILLED"] },
        },
      });

      if (!srcSession) {
        throw new TableSessionError(
          `Active session not found for source table ${srcTable.tableNumber}`,
          404
        );
      }

      sourceSessions.push(srcSession);
    }

    let totalTransferredOrders = 0;
    let additionalGuests = 0;
    const mergedSessionSummaries: MergedSessionSummary[] = [];
    const updatedSourceSessions: TableSession[] = [];

    // 4. Process each source session atomically
    for (let i = 0; i < sourceTables.length; i++) {
      const srcTable = sourceTables[i];
      const srcSession = sourceSessions[i];

      // a. Re-parent all orders from source session to target session & table
      const orderUpdate = await tx.restaurantOrder.updateMany({
        where: {
          tableSessionId: srcSession.id,
          businessId,
        },
        data: {
          tableSessionId: targetSession.id,
          tableId: targetTable.id,
        },
      });

      totalTransferredOrders += orderUpdate.count;
      additionalGuests += srcSession.guestCount;

      // b. Mark source session as MERGED with provenance recorded in notes
      const mergeNote = `[MERGED_INTO:${targetSession.id}] Merged into Table ${targetTable.tableNumber} (Session ${targetSession.sessionNumber})`;
      const updatedNotes = srcSession.notes
        ? `${srcSession.notes}\n${mergeNote}`
        : mergeNote;

      const updatedSrc = await tx.tableSession.update({
        where: { id: srcSession.id },
        data: {
          status: "MERGED",
          closedAt: new Date(),
          closedById: actorId || null,
          notes: updatedNotes,
          version: { increment: 1 },
        },
      });
      updatedSourceSessions.push(updatedSrc);

      // c. Release source table
      await tx.restaurantTable.update({
        where: { id: srcTable.id },
        data: {
          status: "AVAILABLE",
          currentSessionId: null,
        },
      });

      // d. Rebind active GuestAccessGrant, GuestSession, and open ServiceRequests from source session to target session
      await tx.guestAccessGrant.updateMany({
        where: {
          businessId,
          tableSessionId: srcSession.id,
          status: "ACTIVE",
        },
        data: {
          tableSessionId: targetSession.id,
        },
      });
      await tx.guestSession.updateMany({
        where: {
          businessId,
          tableSessionId: srcSession.id,
          status: "ACTIVE",
        },
        data: {
          tableSessionId: targetSession.id,
        },
      });
      await tx.serviceRequest.updateMany({
        where: {
          businessId,
          tableSessionId: srcSession.id,
          status: { in: ["OPEN", "ACKNOWLEDGED", "IN_PROGRESS"] },
        },
        data: {
          tableSessionId: targetSession.id,
          tableId: targetTable.id,
        },
      });

      mergedSessionSummaries.push({
        sourceSessionId: srcSession.id,
        sourceTableId: srcTable.id,
        sourceTableNumber: srcTable.tableNumber,
        guestCount: srcSession.guestCount,
        ordersTransferred: orderUpdate.count,
      });
    }

    // 5. Update target session with combined guest count and merge note
    const sourceTableNumbers = sourceTables.map((t) => t.tableNumber).join(", ");
    const targetMergeNote = `Merged with Table(s) ${sourceTableNumbers}`;
    const updatedTargetNotes = targetSession.notes
      ? `${targetSession.notes} | ${targetMergeNote}`
      : targetMergeNote;

    const updatedTargetSession = await tx.tableSession.update({
      where: { id: targetSession.id },
      data: {
        guestCount: targetSession.guestCount + additionalGuests,
        notes: updatedTargetNotes,
        version: { increment: 1 },
      },
    });

    // 6. Record immutable AuditEvent
    await createAuditEvent(
      {
        businessId,
        branchId: targetTable.branchId,
        userId: actorId || null,
        action: "TABLES_MERGED",
        entity: "TableSession",
        entityId: targetSession.id,
        entityVersion: updatedTargetSession.version,
        oldValue: {
          targetGuestCount: targetSession.guestCount,
          targetTableNumber: targetTable.tableNumber,
        },
        newValue: {
          targetGuestCount: updatedTargetSession.guestCount,
          targetTableNumber: targetTable.tableNumber,
          mergedSessionsCount: sourceSessions.length,
          totalTransferredOrders,
        },
        metadata: {
          targetTableId: targetTable.id,
          targetSessionId: targetSession.id,
          sourceTableIds: uniqueSourceIds,
          sourceSessionIds: sourceSessions.map((s) => s.id),
          mergedSessions: mergedSessionSummaries,
        },
        reason: reason || "Staff table merge request",
      },
      tx
    );

    return {
      targetSession: updatedTargetSession,
      targetTable,
      mergedSessions: mergedSessionSummaries,
      totalTransferredOrders,
      totalGuests: updatedTargetSession.guestCount,
      sourceSession: updatedSourceSessions[0],
      sourceSessions: updatedSourceSessions,
    };
  };

  if (externalTx) {
    return await runner(externalTx);
  }
  return await serializable(runner);
}

// -----------------------------------------------------------------------------
// Auxiliary Session Service Methods
// -----------------------------------------------------------------------------

/**
 * Retrieves a table session by ID with table, openedBy, closedBy, and orders.
 */
export async function getTableSessionById(
  businessId: string,
  sessionId: string,
  externalTx?: Prisma.TransactionClient
) {
  const client = externalTx || db;

  const session = await client.tableSession.findFirst({
    where: { id: sessionId, businessId },
    include: {
      table: {
        include: { floor: { select: { id: true, name: true, displayOrder: true } } },
      },
      openedBy: { select: { id: true, name: true, email: true } },
      closedBy: { select: { id: true, name: true, email: true } },
      restaurantOrders: {
        include: {
          rounds: {
            orderBy: { roundNumber: "asc" },
            include: { lines: true },
          },
          orderLines: { orderBy: { createdAt: "asc" } },
        },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!session) {
    throw new TableSessionError("Session not found", 404);
  }

  return session;
}

/**
 * Lists table sessions matching filter.
 */
export async function getActiveTableSessions(
  filter: GetSessionsFilter,
  externalTx?: Prisma.TransactionClient
) {
  const client = externalTx || db;

  const statusFilter =
    filter.status === "all"
      ? {}
      : filter.status
      ? { status: filter.status }
      : { status: { in: ["ACTIVE", "BILLED"] } };

  return await client.tableSession.findMany({
    where: {
      businessId: filter.businessId,
      ...(filter.branchId ? { branchId: filter.branchId } : {}),
      ...(filter.floorId ? { table: { floorId: filter.floorId } } : {}),
      ...statusFilter,
    },
    include: {
      table: {
        select: {
          id: true,
          tableNumber: true,
          capacity: true,
          status: true,
          floorId: true,
          floor: { select: { id: true, name: true } },
        },
      },
      openedBy: { select: { id: true, name: true } },
      _count: { select: { restaurantOrders: true } },
    },
    orderBy: { openedAt: "desc" },
  });
}

/**
 * Updates an active table session (guestCount, notes) with OCC version protection.
 */
export async function updateTableSession(
  input: UpdateSessionInput,
  externalTx?: Prisma.TransactionClient
) {
  const runner = async (tx: Prisma.TransactionClient) => {
    const session = await tx.tableSession.findFirst({
      where: { id: input.sessionId, businessId: input.businessId },
    });

    if (!session) {
      throw new TableSessionError("Session not found", 404);
    }

    if (session.status !== "ACTIVE" && session.status !== "BILLED") {
      throw new TableSessionError(
        `Cannot update session with status ${session.status}`,
        400
      );
    }

    if (
      input.expectedVersion !== undefined &&
      session.version !== input.expectedVersion
    ) {
      throw new TableSessionError(
        `Session version mismatch: current ${session.version}, expected ${input.expectedVersion}`,
        409
      );
    }

    const updateData: Prisma.TableSessionUpdateInput = {
      version: { increment: 1 },
    };

    if (input.guestCount !== undefined) {
      if (input.guestCount < 1) {
        throw new TableSessionError("Guest count must be at least 1", 400);
      }
      updateData.guestCount = input.guestCount;
    }

    if (input.notes !== undefined) {
      updateData.notes = input.notes;
    }

    const updated = await tx.tableSession.update({
      where: { id: session.id },
      data: updateData,
    });

    await createAuditEvent(
      {
        businessId: input.businessId,
        branchId: session.branchId,
        userId: input.actorId || null,
        action: "TABLE_SESSION_UPDATED",
        entity: "TableSession",
        entityId: session.id,
        entityVersion: updated.version,
        oldValue: { guestCount: session.guestCount, notes: session.notes },
        newValue: { guestCount: updated.guestCount, notes: updated.notes },
      },
      tx
    );

    return updated;
  };

  if (externalTx) {
    return await runner(externalTx);
  }
  return await serializable(runner);
}
