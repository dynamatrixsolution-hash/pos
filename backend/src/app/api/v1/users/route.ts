import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  getSessionContext,
  authErrorResponse,
  roleErrorResponse,
  getBusinessLimits,
  getPaginationParams,
  paginationMeta,
  safeErrorMessage,
} from "@/lib/api-helper";
import { pepperPassword } from "@/lib/security";
import bcrypt from "bcryptjs";
import { z } from "zod";

const userSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(6),
  role: z.enum([
    "SUPER_ADMIN",
    "OWNER",
    "MANAGER",
    "FRONT_DESK",
    "CASHIER",
    "WAITER",
    "KITCHEN",
    "HOUSEKEEPING",
    "ACCOUNTANT",
    "STOREKEEPER",
    "SALESPERSON",
    "DELIVERY",
  ]),
  branchId: z.string().uuid().optional().nullable(),
  phone: z.string().optional().nullable(),
});

export async function GET(request: Request) {
  const context = await getSessionContext();
  if (!context) return authErrorResponse();

  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || "";
    const { page, limit, skip, take } = getPaginationParams(request, 50, 100);

    const where: any = {
      businessId: context.businessId,
      deletedAt: null,
    };

    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
      ];
    }

    const [total, users] = await Promise.all([
      db.user.count({ where }),
      db.user.findMany({
        where,
        skip,
        take,
        include: {
          branch: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: "desc" },
      }),
    ]);

    const safeUsers = users.map((u) => {
      const { passwordHash, ...rest } = u;
      return rest;
    });

    return NextResponse.json({
      users: safeUsers,
      meta: paginationMeta(total, page, limit),
    });
  } catch (error: any) {
    console.error("GET users error:", error);
    return NextResponse.json(
      { error: safeErrorMessage(error, "Failed to fetch users") },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const context = await getSessionContext();
  if (!context) return authErrorResponse();

  // Block Cashiers and staff from creating users
  if (!["OWNER", "SUPER_ADMIN", "MANAGER"].includes(context.role.toUpperCase())) {
    return roleErrorResponse();
  }

  try {
    const body = await request.json();
    const result = userSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: "Validation failed", details: result.error.format() },
        { status: 400 }
      );
    }

    const { name, email, password, role, branchId, phone } = result.data;

    // Check if email is already taken
    const existing = await db.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json({ error: "Email already in use" }, { status: 400 });
    }

    // Check user limit from subscription
    const limits = await getBusinessLimits(context.businessId);
    if (limits) {
      const activeUserCount = await db.user.count({
        where: { businessId: context.businessId, deletedAt: null },
      });
      if (activeUserCount >= limits.users) {
        return NextResponse.json(
          { error: `User limit reached. Your subscription allows a maximum of ${limits.users} users. Please upgrade your plan.` },
          { status: 400 }
        );
      }
    }

    const peppered = pepperPassword(password);
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(peppered, salt);

    const newUser = await db.user.create({
      data: {
        businessId: context.businessId,
        branchId,
        name,
        email,
        passwordHash,
        role,
        phone,
      },
    });

    await db.auditLog.create({
      data: {
        businessId: context.businessId,
        userId: context.userId,
        action: "CREATE",
        module: "USER",
        details: `Created new user ${name} with role ${role}`,
      },
    });

    const { passwordHash: _ph, ...safeUser } = newUser;

    return NextResponse.json({
      message: "User created successfully",
      user: safeUser,
    }, { status: 201 });
  } catch (error: any) {
    console.error("POST user error:", error);
    return NextResponse.json(
      { error: safeErrorMessage(error, "Failed to create user") },
      { status: 500 }
    );
  }
}
