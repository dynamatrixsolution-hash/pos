import { NextResponse } from "next/server";
import { getSessionContext, authErrorResponse } from "@/lib/api-helper";
import { db } from "@/lib/db";
import {
  getPropertyFeatureFlags,
  updatePropertyFeatureFlags,
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

    const flags = await getPropertyFeatureFlags(db, {
      businessId: session.businessId,
      branchId,
    });

    return NextResponse.json({ data: flags });
  } catch (error: any) {
    return handleRouteError(error, "Failed to fetch property feature flags");
  }
}

export async function PUT(req: Request) {
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

    const updated = await updatePropertyFeatureFlags(db, {
      hotelEnabled: body.hotelEnabled,
      restaurantEnabled: body.restaurantEnabled,
      kdsEnabled: body.kdsEnabled,
      guestQrEnabled: body.guestQrEnabled,
      folioBridgeEnabled: body.folioBridgeEnabled,
      offlineDraftSyncEnabled: body.offlineDraftSyncEnabled,
      printerFailoverEnabled: body.printerFailoverEnabled,
      pilotMode: body.pilotMode,
      metadata: body.metadata,
      businessId: session.businessId,
      branchId,
      updatedById: session.userId,
    });

    return NextResponse.json({ data: updated });
  } catch (error: any) {
    return handleRouteError(error, "Failed to update property feature flags");
  }
}
