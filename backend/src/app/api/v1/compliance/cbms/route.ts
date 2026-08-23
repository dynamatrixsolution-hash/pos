import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionContext, authErrorResponse, roleErrorResponse } from "@/lib/api-helper";
import { CbmsService } from "@/lib/cbms-service";
import { z } from "zod";

const retrySchema = z.object({
  queueId: z.string().uuid("Invalid Queue ID"),
});

export async function GET() {
  const context = await getSessionContext();
  if (!context) return authErrorResponse();

  try {
    const queue = db.cbmsSyncQueue;

    // Get aggregated metrics
    const [total, synced, pending, failed, retrying, lastSuccess, lastFailed] = await Promise.all([
      queue.count({ where: { businessId: context.businessId } }),
      queue.count({ where: { businessId: context.businessId, syncStatus: "SYNCED" } }),
      queue.count({ where: { businessId: context.businessId, syncStatus: "PENDING" } }),
      queue.count({ where: { businessId: context.businessId, syncStatus: "FAILED" } }),
      queue.count({ where: { businessId: context.businessId, syncStatus: "RETRYING" } }),
      queue.findFirst({
        where: { businessId: context.businessId, syncStatus: "SYNCED" },
        orderBy: { lastAttempt: "desc" },
        select: { lastAttempt: true },
      }),
      queue.findFirst({
        where: { businessId: context.businessId, syncStatus: "FAILED" },
        orderBy: { lastAttempt: "desc" },
        select: { lastAttempt: true, errorMessage: true },
      }),
    ]);

    return NextResponse.json({
      metrics: {
        total,
        synced,
        pending,
        failed,
        retrying,
        lastSuccessfulSync: lastSuccess?.lastAttempt || null,
        lastFailedSync: lastFailed?.lastAttempt || null,
        lastFailureError: lastFailed?.errorMessage || null,
      },
    });
  } catch (error: any) {
    console.error("GET CBMS metrics error:", error);
    return NextResponse.json({ error: "Failed to compile CBMS metrics" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const context = await getSessionContext();
  if (!context) return authErrorResponse();

  if (context.role !== "OWNER" && context.role !== "SUPER_ADMIN" && context.role !== "MANAGER") {
    return roleErrorResponse();
  }

  try {
    const body = await request.json();
    const result = retrySchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json(
        { error: "Validation failed", details: result.error.format() },
        { status: 400 }
      );
    }

    const { queueId } = result.data;

    // Verify queue item belongs to this business
    const queueItem = await db.cbmsSyncQueue.findFirst({
      where: { id: queueId, businessId: context.businessId },
    });

    if (!queueItem) {
      return NextResponse.json({ error: "Queue record not found" }, { status: 404 });
    }

    const syncSuccess = await CbmsService.manuallyRetryQueueItem(queueId);

    // Write audit log
    const headers = request.headers;
    const xForwardedFor = headers.get("x-forwarded-for");
    const ipAddress = xForwardedFor ? xForwardedFor.split(",")[0].trim() : (headers.get("x-real-ip") || "127.0.0.1");
    const deviceInfo = headers.get("user-agent") || "Unknown Device";

    await db.auditLog.create({
      data: {
        businessId: context.businessId,
        userId: context.userId,
        role: context.role,
        action: "CBMS_SYNC",
        module: "COMPLIANCE",
        details: `Triggered manual CBMS retry on queue item #${queueId}. Status: ${syncSuccess ? "SYNCED" : "FAILED"}.`,
        newValue: { queueId, syncSuccess },
        ipAddress,
        deviceInfo,
      },
    });

    if (syncSuccess) {
      return NextResponse.json({ message: "Queue item synced successfully" });
    } else {
      return NextResponse.json({ error: "Sync attempt failed. Please check error logs." }, { status: 400 });
    }
  } catch (error: any) {
    console.error("POST CBMS retry error:", error);
    return NextResponse.json({ error: "Failed to process manual sync request" }, { status: 500 });
  }
}
