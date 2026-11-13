import { NextResponse } from "next/server";
import { getSessionContext, authErrorResponse } from "@/lib/api-helper";
import { db } from "@/lib/db";
import { z } from "zod";

const updateRoleSchema = z.object({
  name: z.string().min(2).optional(),
  description: z.string().optional(),
  permissions: z.array(z.string()).optional(),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSessionContext();
    if (!session) return authErrorResponse();

    const OWNER_ROLES = ["SUPER_ADMIN", "OWNER"];
    if (!OWNER_ROLES.includes(session.role)) {
      return NextResponse.json({ error: "Only owners can update roles" }, { status: 403 });
    }

    const { id } = await params;
    if (id.startsWith("role-")) {
      return NextResponse.json({ error: "System roles cannot be modified" }, { status: 400 });
    }

    const body = await req.json();
    const parsed = updateRoleSchema.parse(body);

    const business = await db.business.findUnique({
      where: { id: session.businessId },
    });

    if (!business) return NextResponse.json({ error: "Business not found" }, { status: 404 });

    const settings = (business.settings as any) || {};
    const customRoles = Array.isArray(settings.customRoles) ? [...settings.customRoles] : [];

    const index = customRoles.findIndex((r: any) => r.id === id);
    if (index === -1) {
      return NextResponse.json({ error: "Role not found" }, { status: 404 });
    }

    const updatedRole = {
      ...customRoles[index],
      ...(parsed.name !== undefined && { name: parsed.name.trim().toUpperCase() }),
      ...(parsed.description !== undefined && { description: parsed.description }),
      ...(parsed.permissions !== undefined && { permissions: parsed.permissions }),
      updatedAt: new Date().toISOString(),
    };

    customRoles[index] = updatedRole;

    await db.business.update({
      where: { id: session.businessId },
      data: {
        settings: {
          ...settings,
          customRoles,
        },
      },
    });

    return NextResponse.json({ success: true, role: updatedRole });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message || "Validation failed" }, { status: 400 });
    }
    console.error("PATCH /roles/[id] error:", error);
    return NextResponse.json({ error: "Failed to update role" }, { status: 500 });
  }
}

export const PUT = PATCH;

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSessionContext();
    if (!session) return authErrorResponse();

    const OWNER_ROLES = ["SUPER_ADMIN", "OWNER"];
    if (!OWNER_ROLES.includes(session.role)) {
      return NextResponse.json({ error: "Only owners can delete roles" }, { status: 403 });
    }

    const { id } = await params;
    if (id.startsWith("role-")) {
      return NextResponse.json({ error: "System roles cannot be deleted" }, { status: 400 });
    }

    const business = await db.business.findUnique({
      where: { id: session.businessId },
    });

    if (!business) return NextResponse.json({ error: "Business not found" }, { status: 404 });

    const settings = (business.settings as any) || {};
    const customRoles = Array.isArray(settings.customRoles) ? [...settings.customRoles] : [];

    const targetRole = customRoles.find((r: any) => r.id === id);
    if (!targetRole) {
      return NextResponse.json({ error: "Role not found" }, { status: 404 });
    }

    // Check if any user in business currently has this role
    const assignedUsers = await db.user.count({
      where: {
        businessId: session.businessId,
        role: targetRole.name,
        deletedAt: null,
      },
    });

    if (assignedUsers > 0) {
      return NextResponse.json(
        { error: `Cannot delete role "${targetRole.name}" because it is currently assigned to ${assignedUsers} user(s).` },
        { status: 400 }
      );
    }

    const filteredRoles = customRoles.filter((r: any) => r.id !== id);

    await db.business.update({
      where: { id: session.businessId },
      data: {
        settings: {
          ...settings,
          customRoles: filteredRoles,
        },
      },
    });

    return NextResponse.json({ success: true, message: `Role "${targetRole.name}" deleted.` });
  } catch (error: any) {
    console.error("DELETE /roles/[id] error:", error);
    return NextResponse.json({ error: "Failed to delete role" }, { status: 500 });
  }
}

