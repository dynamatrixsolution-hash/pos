import { NextResponse } from "next/server";
import { resolvePublicQrLocation } from "@/lib/services/guest-portal-service";
import { HotelError } from "@/lib/services/room-availability-service";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ publicCode: string }> }
) {
  try {
    const { publicCode } = await params;
    const result = await resolvePublicQrLocation(publicCode);
    return NextResponse.json(result);
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
      { error: error.message || "Failed to resolve QR location" },
      { status: 500 }
    );
  }
}
