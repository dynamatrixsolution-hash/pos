import { NextResponse } from "next/server";
import { getSessionContext, authErrorResponse } from "@/lib/api-helper";
import { db } from "@/lib/db";
import {
  listPrintJobs,
  enqueueAndDispatchPrintJob,
  rehearseHardwareMatrix,
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

    const stationId = searchParams.get("stationId") || undefined;
    const status = searchParams.get("status") || undefined;

    const data = await listPrintJobs(db, {
      businessId: session.businessId,
      branchId,
      stationId,
      status,
    });

    return NextResponse.json({ data });
  } catch (error: any) {
    return handleRouteError(error, "Failed to list print jobs");
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

    if (body.action === "REHEARSE_MATRIX") {
      const result = await rehearseHardwareMatrix(db, {
        businessId: session.businessId,
        branchId,
        stationId: body.stationId,
        fallbackStationId: body.fallbackStationId,
        actorUserId: session.userId,
      });

      return NextResponse.json({ data: result }, { status: 201 });
    }

    const result = await enqueueAndDispatchPrintJob(db, {
      businessId: session.businessId,
      branchId,
      stationId: body.stationId,
      fallbackStationId: body.fallbackStationId,
      ticketId: body.ticketId,
      jobType: body.jobType || "RECEIPT_80MM",
      printerWidthMm: body.printerWidthMm,
      targetPrinterIp: body.targetPrinterIp,
      targetPrinterPort: body.targetPrinterPort,
      cashDrawerPulse: body.cashDrawerPulse,
      title: body.title,
      subtitle: body.subtitle,
      lines: body.lines,
      footer: body.footer,
      simulatePrimaryFailure: body.simulatePrimaryFailure,
      idempotencyKey: body.idempotencyKey,
      actorUserId: session.userId,
    });

    return NextResponse.json({ data: result }, { status: 201 });
  } catch (error: any) {
    return handleRouteError(error, "Failed to dispatch print job");
  }
}
