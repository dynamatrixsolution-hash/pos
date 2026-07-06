import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionContext, authErrorResponse } from "@/lib/api-helper";
import bcrypt from "bcryptjs";
import { z } from "zod";

const updateUserSchema = z.object({
  name: z.string().min(2).optional(),
  email: z.string().email().optional(),
  role: z.enum(["SUPER_ADMIN", "OWNER", "MANAGER", "CASHIER", "ACCOUNTANT", "STOREKEEPER", "SALESPERSON", "DELIVERY"]).optional(),
  phone: z.string().optional().nullable(),
  password: z.string().min(6).optional(),
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

    const { name, email, role, phone, password, branchId, allowedDeviceId, deviceName } = result.data;

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

    // Check email uniqueness if email is being updated
    if (email && email !== existing.email) {
      const emailTaken = await db.user.findFirst({
        where: { email, deletedAt: null },
      });
      if (emailTaken) {
        return NextResponse.json({ error: "Email already in use" }, { status: 400 });
      }
    }

    const updateData: any = {};
    if (name !== undefined) updateData.name = name;
    if (email !== undefined) updateData.email = email;
    if (role !== undefined) updateData.role = role;
    if (phone !== undefined) updateData.phone = phone;
    if (branchId !== undefined) updateData.branchId = branchId;
    if (allowedDeviceId !== undefined) updateData.allowedDeviceId = allowedDeviceId;
    if (deviceName !== undefined) updateData.deviceName = deviceName;

    // Hash and update password if provided
    if (password) {
      const salt = await bcrypt.genSalt(10);
      updateData.passwordHash = await bcrypt.hash(password, salt);
    }

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

export async function DELETE(request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const context = await getSessionContext();
  if (!context) return authErrorResponse();

  const OWNER_ROLES = ["SUPER_ADMIN", "OWNER"];
  const isOwner = OWNER_ROLES.includes(context.role);

  if (!isOwner) {
    return NextResponse.json({ error: "Unauthorized. Only owners can delete users." }, { status: 403 });
  }

  try {
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

    if (existing.id === context.userId) {
      return NextResponse.json({ error: "Self-deletion is forbidden." }, { status: 400 });
    }

    const deletedUser = await db.user.update({
      where: { id: params.id },
      data: { deletedAt: new Date(), isActive: false },
    });

    await db.auditLog.create({
      data: {
        businessId: context.businessId,
        userId: context.userId,
        action: "DELETE",
        module: "USER",
        details: `Deleted user ${deletedUser.name} with email ${deletedUser.email}`,
      },
    });

    return NextResponse.json({ message: "User deleted successfully" });
  } catch (error: any) {
    console.error("DELETE user error:", error);
    return NextResponse.json({ error: "Failed to delete user" }, { status: 500 });
  }
}
