import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function POST(request: Request) {
  try {
    const { email, deviceId, deviceName } = await request.json();

    if (!email || !deviceId) {
      return NextResponse.json({ error: "Missing parameters" }, { status: 400 });
    }

    const user = await db.user.findFirst({
      where: {
        email: email.toLowerCase().trim(),
        deletedAt: null,
      },
    });

    if (!user) {
      // Return success if user does not exist to prevent account enumeration
      return NextResponse.json({ success: true });
    }

    // If no device is currently registered, bind this device on first login
    if (!user.allowedDeviceId) {
      await db.user.update({
        where: { id: user.id },
        data: {
          allowedDeviceId: deviceId,
          deviceName: deviceName || "Unknown Device",
        },
      });

      return NextResponse.json({ success: true });
    }

    // Verify if the device matches
    if (user.allowedDeviceId === deviceId) {
      return NextResponse.json({ success: true });
    }

    // OWNER and SUPER_ADMIN users should bypass device-locking block and auto-update their binding
    // to prevent administrative lockouts (e.g. from switching HTTP/HTTPS protocols, clearing storage, etc.)
    if (user.role === "OWNER" || user.role === "SUPER_ADMIN") {
      await db.user.update({
        where: { id: user.id },
        data: {
          allowedDeviceId: deviceId,
          deviceName: deviceName || "Unknown Device",
        },
      });
      return NextResponse.json({ success: true });
    }

    // Mismatch - return device locked error message
    return NextResponse.json({
      success: false,
      error: "DEVICE_LOCKED",
      message: "Unauthorized device. This account is locked to a different terminal/device. Please contact your system administrator.",
    });
  } catch (error: any) {
    console.error("Device check error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
