import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { authErrorResponse, getBusinessLimits, getSessionContext } from "@/lib/api-helper";

// POST /api/v1/auth/device-check — Authenticated terminal/device binding verification
export async function POST(request: Request) {
  const context = await getSessionContext();
  if (!context) return authErrorResponse();

  try {
    const body = await request.json().catch(() => ({}));
    const deviceId = typeof body?.deviceId === "string" ? body.deviceId.trim() : "";
    const deviceName = typeof body?.deviceName === "string" ? body.deviceName.trim().slice(0, 120) : "";

    if (!deviceId || deviceId.length < 4 || deviceId.length > 160) {
      return NextResponse.json({ error: "Valid deviceId is required" }, { status: 400 });
    }

    const user = await db.user.findFirst({
      where: {
        id: context.userId,
        deletedAt: null,
      },
      select: {
        id: true,
        role: true,
        businessId: true,
        allowedDeviceId: true,
      },
    });

    if (!user) {
      return authErrorResponse();
    }

    // OWNER and SUPER_ADMIN roam across devices without lockout
    if (user.role === "OWNER" || user.role === "SUPER_ADMIN") {
      if (user.allowedDeviceId !== deviceId) {
        await db.user.update({
          where: { id: user.id },
          data: {
            allowedDeviceId: deviceId,
            deviceName: deviceName || "Admin Workstation",
          },
        });
      }
      return NextResponse.json({ success: true });
    }

    // Bind unbound staff user on first authenticated login if within plan device limits
    if (!user.allowedDeviceId) {
      const limits = await getBusinessLimits(user.businessId);
      if (limits) {
        const staffWithDevices = await db.user.findMany({
          where: {
            businessId: user.businessId,
            allowedDeviceId: { not: null },
            deletedAt: null,
            role: { notIn: ["OWNER", "SUPER_ADMIN"] },
          },
          select: { allowedDeviceId: true },
        });

        const distinctDevices = new Set(
          staffWithDevices.map((s) => s.allowedDeviceId).filter(Boolean)
        );
        const allowedDevicesCount = Math.max(Number(limits.devices) || 1, Number(limits.users) || 1);

        if (!distinctDevices.has(deviceId) && distinctDevices.size >= allowedDevicesCount) {
          return NextResponse.json({
            success: false,
            error: "DEVICE_LIMIT_REACHED",
            message: `Terminal device registration limit reached for your business (max ${allowedDevicesCount} devices). Please upgrade your subscription or contact support.`,
          });
        }
      }

      await db.user.update({
        where: { id: user.id },
        data: {
          allowedDeviceId: deviceId,
          deviceName: deviceName || "POS Terminal",
        },
      });
      return NextResponse.json({ success: true });
    }

    if (user.allowedDeviceId === deviceId) {
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({
      success: false,
      error: "DEVICE_LOCKED",
      message: "Unauthorized device. This account is locked to a different terminal. Please contact your administrator.",
    });
  } catch (error) {
    console.error("Device check error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
