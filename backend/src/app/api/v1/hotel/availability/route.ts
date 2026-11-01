import { NextResponse } from "next/server";
import { getSessionContext, authErrorResponse } from "@/lib/api-helper";
import {
  getRoomAvailability,
  HotelError,
} from "@/lib/services/room-availability-service";

export async function GET(req: Request) {
  try {
    const session = await getSessionContext();
    if (!session) return authErrorResponse();

    const { searchParams } = new URL(req.url);
    const branchId = searchParams.get("branchId") || session.branchId;
    const roomTypeId = searchParams.get("roomTypeId") || undefined;

    const now = new Date();
    const defaultStart = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
    );
    const defaultEnd = new Date(defaultStart.getTime() + 7 * 24 * 60 * 60 * 1000);

    const startDateParam = searchParams.get("startDate");
    const endDateParam = searchParams.get("endDate");

    const startDate = startDateParam ? new Date(startDateParam) : defaultStart;
    const endDate = endDateParam ? new Date(endDateParam) : defaultEnd;

    const result = await getRoomAvailability({
      businessId: session.businessId,
      branchId,
      roomTypeId,
      startDate,
      endDate,
    });

    return NextResponse.json(result);
  } catch (error: any) {
    if (error instanceof HotelError || error?.name === "HotelError" || typeof error?.statusCode === "number") {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.statusCode || 400 }
      );
    }
    return NextResponse.json(
      { error: error.message || "Failed to fetch room availability" },
      { status: 500 }
    );
  }
}
