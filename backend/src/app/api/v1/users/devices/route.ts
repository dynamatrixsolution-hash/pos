import { NextResponse } from "next/server";
import { getSessionContext, authErrorResponse } from "@/lib/api-helper";
import { db } from "@/lib/db";

export async function GET(req: Request) {
  try {
    const session = await getSessionContext();
    if (!session) return authErrorResponse();

    const OWNER_ROLES = ["SUPER_ADMIN", "OWNER", "MANAGER"];
    if (!OWNER_ROLES.includes(session.role)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const usersWithDevices = await db.user.findMany({
      where: {
        businessId: session.businessId,
        allowedDeviceId: { not: null },
        deletedAt: null,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        allowedDeviceId: true,
        deviceName: true,
        updatedAt: true,
      },
    });

    const devices = usersWithDevices.map((u) => ({
      id: u.allowedDeviceId || u.id,
      userId: u.id,
      deviceName: u.deviceName || "Registered POS Terminal",
      deviceType: "POS Terminal",
      lastActive: u.updatedAt.toISOString(),
      user: {
        name: u.name,
        email: u.email,
        role: u.role,
      },
    }));

    return NextResponse.json({ devices });
  } catch (error: any) {
    console.error("GET /users/devices error:", error);
    return NextResponse.json({ error: "Failed to fetch registered devices" }, { status: 500 });
  }
}

