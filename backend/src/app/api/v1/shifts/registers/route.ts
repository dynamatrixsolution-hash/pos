import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionContext, authErrorResponse, safeErrorMessage } from "@/lib/api-helper";
import { isManagerOrOwnerRole } from "@/lib/shift-service";
import { z } from "zod";

const createRegisterSchema = z.object({
  name: z.string().min(2, "Register name is required"),
  code: z.string().min(1, "Register code is required").optional().nullable(),
  branchId: z.string().optional().nullable(),
  branch_id: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  isActive: z.boolean().optional(),
  status: z.enum(["ACTIVE", "INACTIVE", "OPEN", "CLOSED"]).optional(),
  assignedUserIds: z.array(z.string()).optional(),
  assigned_users: z.array(z.string()).optional(),
});

export async function GET(request: Request) {
  const context = await getSessionContext();
  if (!context) return authErrorResponse();

  try {
    const { searchParams } = new URL(request.url);
    const branchId = searchParams.get("branchId") || searchParams.get("branch_id") || context.branchId;
    const includeInactive = searchParams.get("includeInactive") !== "false";

    const where: any = {
      businessId: context.businessId,
      deletedAt: null,
    };

    if (branchId) {
      where.branchId = branchId;
    }

    if (!includeInactive) {
      where.isActive = true;
    }

    let registers = await db.cashRegister.findMany({
      where,
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
          select: {
            id: true,
            shiftNumber: true,
            startTime: true,
            openingBalance: true,
            cashSales: true,
            cashRefunds: true,
            cashIn: true,
            cashOut: true,
            expectedCash: true,
            cashier: { select: { id: true, name: true, email: true, role: true } },
          },
        },
        _count: {
          select: { shifts: true },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    // Auto-seed a default "Main Cash Register" if none exist yet for the branch
    if (registers.length === 0 && (branchId || context.branchId)) {
      const targetBranchId = (branchId || context.branchId)!;
      const existingCode = await db.cashRegister.findFirst({
        where: { branchId: targetBranchId, code: "REG-01" },
      });
      const defaultCode = existingCode ? `REG-${Date.now().toString().slice(-4)}` : "REG-01";
      const defaultRegister = await db.cashRegister.create({
        data: {
          businessId: context.businessId,
          branchId: targetBranchId,
          name: "Main Counter",
          code: defaultCode,
          description: "Primary checkout counter",
          status: "CLOSED",
          isActive: true,
          createdById: context.userId,
        },
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
            select: {
              id: true,
              shiftNumber: true,
              startTime: true,
              openingBalance: true,
              cashSales: true,
              cashRefunds: true,
              cashIn: true,
              cashOut: true,
              expectedCash: true,
              cashier: { select: { id: true, name: true, email: true, role: true } },
            },
          },
          _count: {
            select: { shifts: true },
          },
        },
      });
      registers = [defaultRegister];
    }

    const formatted = registers.map((reg) => {
      const activeShift = reg.shifts[0] || null;
      return {
        ...reg,
        activeShift,
        hasTransactionHistory: (reg._count?.shifts ?? 0) > 0,
      };
    });

    return NextResponse.json({ registers: formatted });
  } catch (error: any) {
    console.error("GET registers error:", error);
    return NextResponse.json(
      { error: safeErrorMessage(error, "Failed to fetch cash registers") },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const context = await getSessionContext();
  if (!context) return authErrorResponse();

  if (!isManagerOrOwnerRole(context.role)) {
    return NextResponse.json(
      { error: "Forbidden: Only managers or business owners can create cash registers." },
      { status: 403 }
    );
  }

  try {
    const body = await request.json();
    const parsed = createRegisterSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.format() },
        { status: 400 }
      );
    }

    const {
      name,
      code,
      branchId,
      branch_id,
      description,
      notes,
      isActive,
      status,
      assignedUserIds,
      assigned_users,
    } = parsed.data;

    const resolvedBranchId = branchId || branch_id || context.branchId;

    if (!resolvedBranchId) {
      return NextResponse.json(
        { error: "Branch ID is required to create a register." },
        { status: 400 }
      );
    }

    // Generate or normalize branch-unique register code
    let normalizedCode = (code || "").trim().toUpperCase();
    if (!normalizedCode) {
      const count = await db.cashRegister.count({
        where: { branchId: resolvedBranchId },
      });
      normalizedCode = `REG-${String(count + 1).padStart(2, "0")}`;
    }

    // Check duplicate code within the same branch (Specification §2.1: Register codes must be unique within a branch)
    const existingCode = await db.cashRegister.findFirst({
      where: {
        branchId: resolvedBranchId,
        code: { equals: normalizedCode, mode: "insensitive" },
      },
    });

    if (existingCode) {
      return NextResponse.json(
        { error: `Register code "${normalizedCode}" already exists in this branch.` },
        { status: 409 }
      );
    }

    // Check duplicate name in same branch
    const existingName = await db.cashRegister.findFirst({
      where: {
        businessId: context.businessId,
        branchId: resolvedBranchId,
        name: { equals: name.trim(), mode: "insensitive" },
        deletedAt: null,
      },
    });

    if (existingName) {
      return NextResponse.json(
        { error: `A register named "${name}" already exists in this branch.` },
        { status: 409 }
      );
    }

    const resolvedIsActive =
      isActive !== undefined
        ? isActive
        : status === "INACTIVE"
          ? false
          : true;

    const userIdsToAssign = assignedUserIds || assigned_users || [];

    const register = await db.$transaction(async (tx) => {
      const created = await tx.cashRegister.create({
        data: {
          businessId: context.businessId,
          branchId: resolvedBranchId,
          name: name.trim(),
          code: normalizedCode,
          description: description || notes || null,
          notes: notes || description || null,
          status: "CLOSED",
          isActive: resolvedIsActive,
          createdById: context.userId,
        },
      });

      if (userIdsToAssign.length > 0) {
        for (const uid of userIdsToAssign) {
          await tx.registerUserAssignment.create({
            data: {
              businessId: context.businessId,
              branchId: resolvedBranchId,
              registerId: created.id,
              userId: uid,
            },
          });
        }
      }

      return tx.cashRegister.findUnique({
        where: { id: created.id },
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

    return NextResponse.json(
      { message: "Cash register created successfully.", register },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("POST create register error:", error);
    return NextResponse.json(
      { error: safeErrorMessage(error, "Failed to create cash register") },
      { status: 500 }
    );
  }
}
