import { NextResponse } from "next/server";
import { getSessionContext, authErrorResponse } from "@/lib/api-helper";
import { db } from "@/lib/db";

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSessionContext();
    if (!session) return authErrorResponse();

    const OWNER_ROLES = ["SUPER_ADMIN", "OWNER"];
    if (!OWNER_ROLES.includes(session.role)) {
      return NextResponse.json({ error: "Only owners can revoke device locks" }, { status: 403 });
    }

    const { id } = await params;

    // Find user matching id as userId or allowedDeviceId
    const user = await db.user.findFirst({
      where: {
        businessId: session.businessId,
        OR: [
          { id },
          { allowedDeviceId: id },
        ],
      },
    });

    if (!user) {
      return NextResponse.json({ error: "Device or user not found" }, { status: 404 });
    }

    await db.user.update({
      where: { id: user.id },
      data: {
        allowedDeviceId: null,
        deviceName: null,
      },
    });

    await db.auditLog.create({
      data: {
        businessId: session.businessId,
        userId: session.userId,
        action: "UPDATE",
        module: "USER",
        details: `Revoked registered device authorization for user ${user.name} (${user.email}).`,
      },
    });

    return NextResponse.json({ success: true, message: "Device lock revoked successfully" });
  } catch (error: any) {
    console.error("DELETE /users/devices/[id] error:", error);
    return NextResponse.json({ error: "Failed to revoke device" }, { status: 500 });
  }
}

