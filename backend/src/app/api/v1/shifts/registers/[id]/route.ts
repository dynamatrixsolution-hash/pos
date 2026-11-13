import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionContext, authErrorResponse, safeErrorMessage } from "@/lib/api-helper";
import { isManagerOrOwnerRole } from "@/lib/shift-service";
import { z } from "zod";

const updateRegisterSchema = z.object({
  name: z.string().min(2).optional(),
  code: z.string().min(1).optional(),
  description: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  isActive: z.boolean().optional(),
  status: z.enum(["ACTIVE", "INACTIVE", "OPEN", "CLOSED"]).optional(),
  assignedUserIds: z.array(z.string()).optional(),
  assigned_users: z.array(z.string()).optional(),
});

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const context = await getSessionContext();
  if (!context) return authErrorResponse();

  const { id } = await params;

  try {
    const register = await db.cashRegister.findFirst({
      where: { id, businessId: context.businessId, deletedAt: null },
      include: {
        branch: { select: { id: true, name: true } },
        assignedUsers: {
          include: {
            user: { select: { id: true, name: true, email: true, role: true } },
          },
        },
        shifts: {
          where: { status: "OPEN" },
          take: 1,
          include: {
            cashier: { select: { id: true, name: true, email: true, role: true } },
          },
        },
        _count: {
          select: { shifts: true },
        },
      },
    });

    if (!register) {
      return NextResponse.json({ error: "Register not found" }, { status: 404 });
    }

    const activeShift = register.shifts[0] || null;

    return NextResponse.json({
      register: {
        ...register,
        activeShift,
        hasTransactionHistory: (register._count?.shifts ?? 0) > 0,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: safeErrorMessage(error, "Failed to fetch register details") },
      { status: 500 }
    );
  }
}

async function handleUpdateRegister(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const context = await getSessionContext();
  if (!context) return authErrorResponse();

  if (!isManagerOrOwnerRole(context.role)) {
    return NextResponse.json(
      { error: "Forbidden: Only managers or business owners can update cash registers." },
      { status: 403 }
    );
  }

  const { id } = await params;

  try {
    const body = await request.json();
    const parsed = updateRegisterSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.format() },
        { status: 400 }
      );
    }

    const register = await db.cashRegister.findFirst({
      where: { id, businessId: context.businessId, deletedAt: null },
    });

    if (!register) {
      return NextResponse.json({ error: "Register not found" }, { status: 404 });
    }

    const {
      name,
      code,
      description,
      notes,
      isActive,
      status,
      assignedUserIds,
      assigned_users,
    } = parsed.data;

    const resolvedIsActive =
      isActive !== undefined
        ? isActive
        : status === "INACTIVE"
          ? false
          : status === "ACTIVE"
            ? true
            : undefined;

    if (resolvedIsActive === false && register.status === "OPEN") {
      return NextResponse.json(
        { error: "Cannot deactivate a register while an active shift is open on it." },
        { status: 409 }
      );
    }

    if (code && code.trim().toUpperCase() !== register.code.toUpperCase()) {
      const duplicateCode = await db.cashRegister.findFirst({
        where: {
          branchId: register.branchId,
          code: { equals: code.trim().toUpperCase(), mode: "insensitive" },
          id: { not: register.id },
        },
      });
      if (duplicateCode) {
        return NextResponse.json(
          { error: `Register code "${code.trim().toUpperCase()}" already exists in this branch.` },
          { status: 409 }
        );
      }
    }

    const userIdsToAssign = assignedUserIds ?? assigned_users;

    const updated = await db.$transaction(async (tx) => {
      const reg = await tx.cashRegister.update({
        where: { id: register.id },
        data: {
          ...(name !== undefined ? { name: name.trim() } : {}),
          ...(code !== undefined ? { code: code.trim().toUpperCase() } : {}),
          ...(description !== undefined ? { description } : {}),
          ...(notes !== undefined ? { notes } : {}),
          ...(resolvedIsActive !== undefined ? { isActive: resolvedIsActive } : {}),
        },
      });

      if (userIdsToAssign !== undefined) {
        await tx.registerUserAssignment.deleteMany({
          where: { registerId: register.id },
        });
        for (const uid of userIdsToAssign) {
          await tx.registerUserAssignment.create({
            data: {
              businessId: context.businessId,
              branchId: register.branchId,
              registerId: register.id,
              userId: uid,
            },
          });
        }
      }

      return tx.cashRegister.findUnique({
        where: { id: reg.id },
        include: {
          branch: { select: { id: true, name: true } },
          assignedUsers: {
            include: {
              user: { select: { id: true, name: true, email: true, role: true } },
            },
          },
        },
      });
    });

    return NextResponse.json({
      message: "Register updated successfully",
      register: updated,
    });
  } catch (error: any) {
    console.error("Update register error:", error);
    return NextResponse.json(
      { error: safeErrorMessage(error, "Failed to update register") },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  return handleUpdateRegister(request, ctx);
}

export async function PUT(
  request: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  return handleUpdateRegister(request, ctx);
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const context = await getSessionContext();
  if (!context) return authErrorResponse();

  if (!isManagerOrOwnerRole(context.role)) {
    return NextResponse.json(
      { error: "Forbidden: Only managers or business owners can delete cash registers." },
      { status: 403 }
    );
  }

  const { id } = await params;

  try {
    const register = await db.cashRegister.findFirst({
      where: { id, businessId: context.businessId, deletedAt: null },
      include: {
        _count: {
          select: { shifts: true },
        },
      },
    });

    if (!register) {
      return NextResponse.json({ error: "Register not found" }, { status: 404 });
    }

    if (register.status === "OPEN" || register.currentShiftId) {
      return NextResponse.json(
        { error: "Cannot delete register while an active shift is open on it. Please close the shift first." },
        { status: 409 }
      );
    }

    // Specification §2.1: A register cannot be deleted if it has transaction history.
    if ((register._count?.shifts ?? 0) > 0) {
      return NextResponse.json(
        {
          error:
            "Cannot delete a register that has shift or transaction history. Please deactivate the register instead.",
        },
        { status: 409 }
      );
    }

    await db.cashRegister.delete({
      where: { id: register.id },
    });

    return NextResponse.json({ message: "Register deleted successfully." });
  } catch (error: any) {
    console.error("DELETE register error:", error);
    return NextResponse.json(
      { error: safeErrorMessage(error, "Failed to delete register") },
      { status: 500 }
    );
  }
}
