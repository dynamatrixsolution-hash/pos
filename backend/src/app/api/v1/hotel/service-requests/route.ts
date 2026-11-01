import { NextResponse } from "next/server";
import { getSessionContext, authErrorResponse } from "@/lib/api-helper";
import { getServiceRequestsForStaff } from "@/lib/services/guest-portal-service";
import { HotelError } from "@/lib/services/room-availability-service";

export async function GET(req: Request) {
  try {
    const session = await getSessionContext();
    if (!session) return authErrorResponse();

    const { searchParams } = new URL(req.url);
    const branchId = searchParams.get("branchId") || session.branchId;
    const status = searchParams.get("status");
    const category = searchParams.get("category");
    const locationType = searchParams.get("locationType");

    const serviceRequests = await getServiceRequestsForStaff({
      businessId: session.businessId,
      branchId,
      status,
      category,
      locationType,
    });

    return NextResponse.json({ serviceRequests });
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
      { error: error.message || "Failed to fetch service requests" },
      { status: 500 }
    );
  }
}
