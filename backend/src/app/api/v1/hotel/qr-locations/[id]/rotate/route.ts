import { NextResponse } from "next/server";
import { getSessionContext, authErrorResponse } from "@/lib/api-helper";
import { ensureQrLocation } from "@/lib/services/guest-portal-service";
import { HotelError } from "@/lib/services/room-availability-service";
import { db } from "@/lib/db";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSessionContext();
    if (!session) return authErrorResponse();

    const { id } = await params;

    const existing = await db.qrLocation.findFirst({
      where: {
        id,
        businessId: session.businessId,
      },
    });

    if (!existing) {
      return NextResponse.json({ error: "QR location not found" }, { status: 404 });
    }

    const rotated = await ensureQrLocation({
      businessId: session.businessId,
      branchId: existing.branchId,
      locationType: existing.locationType as any,
      roomId: existing.roomId,
      tableId: existing.tableId,
      label: existing.label,
      rotate: true,
    });

    return NextResponse.json({
      success: true,
      location: rotated,
      qrLocation: rotated,
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
    console.error("POST /hotel/qr-locations/[id]/rotate error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to rotate QR location" },
      { status: 500 }
    );
  }
}

