import { NextResponse } from "next/server";
import { getSessionContext, authErrorResponse } from "@/lib/api-helper";
import { db } from "@/lib/db";
import {
  listOfflineSyncBatches,
  syncOfflineDraftBatch,
} from "@/lib/services/pilot-rollout-service";
import { HotelError } from "@/lib/services/room-availability-service";

async function resolveBranchId(
  businessId: string,
  requestedBranchId?: string | null,
  sessionBranchId?: string | null
): Promise<string | null> {
  if (requestedBranchId) return requestedBranchId;
  if (sessionBranchId) return sessionBranchId;

  const firstBranch = await db.branch.findFirst({
    where: { businessId, isActive: true, deletedAt: null },
    select: { id: true },
  });
  return firstBranch?.id || null;
}

function handleRouteError(error: any, fallbackMessage: string) {
  if (
    error instanceof HotelError ||
    error?.name === "HotelError" ||
    error?.name === "PilotRolloutError" ||
    typeof error?.statusCode === "number"
  ) {
    return NextResponse.json(
      { error: error.message, code: error.code },
      { status: error.statusCode || 400 }
    );
  }
  return NextResponse.json(
    { error: error?.message || fallbackMessage },
    { status: 500 }
  );
}

export async function GET(req: Request) {
  try {
    const session = await getSessionContext();
    if (!session) return authErrorResponse();

    const { searchParams } = new URL(req.url);
    const branchId = await resolveBranchId(
      session.businessId,
      searchParams.get("branchId"),
      session.branchId
    );

    if (!branchId) {
      return NextResponse.json(
        { error: "Branch ID is required" },
        { status: 400 }
      );
    }

    const data = await listOfflineSyncBatches(db, {
      businessId: session.businessId,
      branchId,
    });

    return NextResponse.json({ data });
  } catch (error: any) {
    return handleRouteError(error, "Failed to list offline sync batches");
  }
}

export async function POST(req: Request) {
  try {
    const session = await getSessionContext();
    if (!session) return authErrorResponse();

    const { searchParams } = new URL(req.url);
    const body = await req.json().catch(() => ({}));

    const branchId = await resolveBranchId(
      session.businessId,
      body.branchId || searchParams.get("branchId"),
      session.branchId
    );

    if (!branchId) {
      return NextResponse.json(
        { error: "Branch ID is required" },
        { status: 400 }
      );
    }

    const result = await syncOfflineDraftBatch(db, {
      businessId: session.businessId,
      branchId,
      terminalId: body.terminalId || "TERM-POS-01",
      batchKey: body.batchKey,
      syncedById: session.userId,
      operations: body.operations || [],
    });

    return NextResponse.json({ data: result }, { status: 201 });
  } catch (error: any) {
    return handleRouteError(error, "Failed to sync offline draft batch");
  }
}
