import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionContext, authErrorResponse } from "@/lib/api-helper";
import { z } from "zod";

const updateBranchSchema = z.object({
  name: z.string().min(2, "Branch name must be at least 2 characters").optional(),
  phone: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  isActive: z.boolean().optional(),
});

export async function PUT(request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const context = await getSessionContext();
  if (!context) return authErrorResponse();

  try {
    const OWNER_ROLES = ["SUPER_ADMIN", "OWNER"];
    const isOwner = OWNER_ROLES.includes(context.role);

    if (!isOwner) {
      return NextResponse.json({ error: "Unauthorized. Only owners can edit branches." }, { status: 403 });
    }

    const body = await request.json();
    const result = updateBranchSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: "Validation failed", details: result.error.format() },
        { status: 400 }
      );
    }

    const existing = await db.branch.findFirst({
      where: {
        id: params.id,
        businessId: context.businessId,
        deletedAt: null,
      },
    });

    if (!existing) {
      return NextResponse.json({ error: "Branch not found" }, { status: 404 });
    }

    // Safety checks for active context or main branch status
    const { name, phone, address, isActive } = result.data;

    if (isActive === false) {
      if (existing.isMain) {
        return NextResponse.json({ error: "Cannot disable the main/headquarters branch." }, { status: 400 });
      }
      if (params.id === context.branchId) {
        return NextResponse.json({ error: "Cannot disable the branch you are currently operating in." }, { status: 400 });
      }
    }

    const updated = await db.branch.update({
      where: { id: params.id },
      data: {
        ...(name !== undefined && { name }),
        ...(phone !== undefined && { phone }),
        ...(address !== undefined && { address }),
        ...(isActive !== undefined && { isActive }),
      },
    });

    // Write audit log
    await db.auditLog.create({
      data: {
        businessId: context.businessId,
        userId: context.userId,
        action: "UPDATE",
        module: "BRANCH",
        details: `Updated branch "${updated.name}" details. Status: ${updated.isActive ? "Active" : "Disabled"}.`,
      },
    });

    return NextResponse.json(updated);
  } catch (error: any) {
    console.error("PUT branch error:", error);
    return NextResponse.json({ error: "Failed to update branch" }, { status: 500 });
  }
}

export async function DELETE(request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const context = await getSessionContext();
  if (!context) return authErrorResponse();

  try {
    const OWNER_ROLES = ["SUPER_ADMIN", "OWNER"];
    const isOwner = OWNER_ROLES.includes(context.role);

    if (!isOwner) {
      return NextResponse.json({ error: "Unauthorized. Only owners can delete branches." }, { status: 403 });
    }

    const existing = await db.branch.findFirst({
      where: {
        id: params.id,
        businessId: context.businessId,
        deletedAt: null,
      },
    });

    if (!existing) {
      return NextResponse.json({ error: "Branch not found" }, { status: 404 });
    }

    if (existing.isMain) {
      return NextResponse.json({ error: "Cannot delete the main/headquarters branch." }, { status: 400 });
    }

    if (params.id === context.branchId) {
      return NextResponse.json({ error: "Cannot delete the branch you are currently operating in." }, { status: 400 });
    }

    // Soft delete by setting deletedAt
    await db.branch.update({
      where: { id: params.id },
      data: { deletedAt: new Date() },
    });

    // Write audit log
    await db.auditLog.create({
      data: {
        businessId: context.businessId,
        userId: context.userId,
        action: "DELETE",
        module: "BRANCH",
        details: `Soft-deleted branch "${existing.name}".`,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("DELETE branch error:", error);
    return NextResponse.json({ error: "Failed to delete branch" }, { status: 500 });
  }
}
