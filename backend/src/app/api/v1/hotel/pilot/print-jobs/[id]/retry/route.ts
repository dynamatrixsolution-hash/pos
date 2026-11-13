import { NextResponse } from "next/server";
import { getSessionContext, authErrorResponse } from "@/lib/api-helper";
import { db } from "@/lib/db";
import { enqueueAndDispatchPrintJob } from "@/lib/services/pilot-rollout-service";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSessionContext();
    if (!session) return authErrorResponse();

    const { id } = await params;

    const existingJob = await db.printJob.findFirst({
      where: {
        id,
        businessId: session.businessId,
      },
    });

    if (!existingJob) {
      return NextResponse.json({ error: "Print job not found" }, { status: 404 });
    }

    const retriedJob = await enqueueAndDispatchPrintJob({
      businessId: session.businessId,
      branchId: existingJob.branchId,
      jobType: existingJob.jobType as any,
      targetPrinterIp: existingJob.targetPrinterIp || undefined,
      targetPrinterPort: existingJob.targetPrinterPort,
      stationId: existingJob.stationId || undefined,
      ticketId: existingJob.ticketId || undefined,
      printerWidthMm: existingJob.printerWidthMm,
      cashDrawerPulse: existingJob.cashDrawerPulse,
      actorUserId: session.userId,
    });

    return NextResponse.json({
      success: true,
      job: retriedJob,
      message: `Print job ${existingJob.jobNumber} re-dispatched.`,
    });
  } catch (error: any) {
    console.error("POST /hotel/pilot/print-jobs/[id]/retry error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to retry print job" },
      { status: 500 }
    );
  }
}
