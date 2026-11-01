import { NextResponse } from "next/server";
import { getSessionContext, authErrorResponse } from "@/lib/api-helper";
import { db } from "@/lib/db";
import {
  ensureQrLocation,
  getQrLocations,
} from "@/lib/services/guest-portal-service";
import { HotelError } from "@/lib/services/room-availability-service";
import { z } from "zod";

const ensureQrLocationSchema = z.object({
  branchId: z.string().optional().nullable(),
  locationType: z.enum(["ROOM", "TABLE"]),
  roomId: z.string().optional().nullable(),
  tableId: z.string().optional().nullable(),
  label: z.string().optional(),
  rotate: z.boolean().optional(),
  metadata: z.record(z.string(), z.any()).optional().nullable(),
});

export async function GET(req: Request) {
  try {
    const session = await getSessionContext();
    if (!session) return authErrorResponse();

    const { searchParams } = new URL(req.url);
    const branchId = searchParams.get("branchId") || session.branchId;
    const locationType = searchParams.get("locationType");
    const isActiveParam = searchParams.get("isActive");
    const isActive =
      isActiveParam !== null ? isActiveParam === "true" : undefined;

    const qrLocations = await getQrLocations({
      businessId: session.businessId,
      branchId,
      locationType,
      isActive,
    });

    return NextResponse.json({ qrLocations });
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
    return NextResponse.json(
      { error: error.message || "Failed to fetch QR locations" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const session = await getSessionContext();
    if (!session) return authErrorResponse();

    const body = await req.json();
    const parsed = ensureQrLocationSchema.parse(body);

    let branchId = parsed.branchId || session.branchId;
    if (!branchId) {
      const firstBranch = await db.branch.findFirst({
        where: { businessId: session.businessId, isActive: true, deletedAt: null },
        select: { id: true },
      });
      branchId = firstBranch?.id || null;
    }

    if (!branchId) {
      return NextResponse.json(
        { error: "Branch ID is required" },
        { status: 400 }
      );
    }

    const result = await ensureQrLocation({
      businessId: session.businessId,
      branchId,
      locationType: parsed.locationType,
      roomId: parsed.roomId,
      tableId: parsed.tableId,
      label: parsed.label,
      rotate: parsed.rotate,
      metadata: parsed.metadata,
      actorId: session.userId,
    });

    return NextResponse.json({ qrLocation: result }, { status: 201 });
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
      { error: error.message || "Failed to ensure QR location" },
      { status: 500 }
    );
  }
}
