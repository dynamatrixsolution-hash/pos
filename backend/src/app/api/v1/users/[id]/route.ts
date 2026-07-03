import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionContext, authErrorResponse } from "@/lib/api-helper";
import { z } from "zod";

const updateUserSchema = z.object({
  branchId: z.string().uuid().optional().nullable(),
  allowedDeviceId: z.string().optional().nullable(),
  deviceName: z.string().optional().nullable(),
});

export async function PUT(request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const context = await getSessionContext();
  if (!context) return authErrorResponse();

  try {
    const OWNER_ROLES = ["SUPER_ADMIN", "OWNER"];
    const isOwner = OWNER_ROLES.includes(context.role);

    if (!isOwner) {
      return NextResponse.json({ error: "Unauthorized. Only owners can edit users." }, { status: 403 });
    }

    const body = await request.json();
    const result = updateUserSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: "Validation failed", details: result.error.format() },
        { status: 400 }
      );
    }

    const { branchId, allowedDeviceId, deviceName } = result.data;

    // Verify user belongs to business
    const existing = await db.user.findFirst({
      where: {
        id: params.id,
        businessId: context.businessId,
        deletedAt: null,
      },
    });

    if (!existing) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const updateData: any = {};
    if (branchId !== undefined) updateData.branchId = branchId;
    if (allowedDeviceId !== undefined) updateData.allowedDeviceId = allowedDeviceId;
    if (deviceName !== undefined) updateData.deviceName = deviceName;

    // Update user
    const updatedUser = await db.user.update({
      where: { id: params.id },
      data: updateData,
    });

    let auditDetails = `Updated properties for user ${updatedUser.name}.`;
    if (branchId !== undefined) {
      auditDetails = `Updated branch access for user ${updatedUser.name} to ${branchId || "All Branches"}.`;
    }
    if (allowedDeviceId === null) {
      auditDetails = `Released authorized POS device lock for user ${updatedUser.name}.`;
    }

    // Write audit log
    await db.auditLog.create({
      data: {
        businessId: context.businessId,
        userId: context.userId,
        action: "UPDATE",
        module: "USER",
        details: auditDetails,
      },
    });

    const { passwordHash: _ph, ...safeUser } = updatedUser;

    return NextResponse.json(safeUser);
  } catch (error: any) {
    console.error("PUT user error:", error);
    return NextResponse.json({ error: "Failed to update user" }, { status: 500 });
  }
}
