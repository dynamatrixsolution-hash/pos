import { NextResponse } from "next/server";
import { getSessionContext, authErrorResponse } from "@/lib/api-helper";
import { runNightAuditForBranch } from "@/lib/services/folio-service";
import { HotelError } from "@/lib/services/room-availability-service";
import { z } from "zod";

const nightAuditSchema = z.object({
  auditDate: z.union([z.string(), z.date()]).optional(),
  taxRatePercent: z.union([z.number(), z.string()]).optional(),
  branchId: z.string().uuid().optional().nullable(),
});

export async function POST(req: Request) {
  try {
    const session = await getSessionContext();
    if (!session) return authErrorResponse();

    const body = await req.json().catch(() => ({}));
    const parsed = nightAuditSchema.parse(body);

    const branchId = parsed.branchId || session.branchId;
    if (!branchId) {
      return NextResponse.json(
        { error: "Branch ID is required" },
        { status: 400 }
      );
    }

    const result = await runNightAuditForBranch({
      businessId: session.businessId,
      branchId,
      auditDate: parsed.auditDate || new Date(),
      taxRatePercent: parsed.taxRatePercent,
      actorId: session.userId,
    });

    return NextResponse.json({
      auditDate: result.auditDate,
      processedCount: result.processedCount,
      postedCharges: result.postedCharges,
      skippedStays: result.skippedStays,
    });
  } catch (error: any) {
    if (
      error instanceof HotelError ||
      error?.name === "HotelError" ||
      typeof error?.statusCode === "number"
    ) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.statusCode || 400 }
      );
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0]?.message || "Validation failed" },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: error.message || "Failed to run night audit" },
      { status: 500 }
    );
  }
}
