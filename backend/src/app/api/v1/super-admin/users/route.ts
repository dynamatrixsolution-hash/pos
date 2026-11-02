import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionContext, authErrorResponse, roleErrorResponse } from "@/lib/api-helper";
import bcrypt from "bcryptjs";
import { z } from "zod";

const userActionSchema = z.object({
  action: z.enum(["TOGGLE_STATUS", "RESET_PASSWORD", "GENERATE_LOGIN"]),
  userId: z.string().optional(),
  businessId: z.string().optional(),
  name: z.string().optional(),
  email: z.string().email().optional(),
  role: z.string().optional(),
  password: z.string().optional(),
});

export async function GET(request: Request) {
  const context = await getSessionContext();
  if (!context) return authErrorResponse();
  if (context.role !== "SUPER_ADMIN") return roleErrorResponse();

  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || "";
    const roleFilter = searchParams.get("role") || "ALL";
    const businessFilter = searchParams.get("businessId") || "ALL";
    const statusFilter = searchParams.get("status") || "ALL";

    // 1. Fetch businesses for dropdown filter
    const businesses = await db.business.findMany({
      where: { slug: { not: "platform-admin" }, deletedAt: null },
      select: { id: true, name: true, slug: true },
      orderBy: { name: "asc" },
    });

    // 2. Build where filter
    const where: any = {
      business: { slug: { not: "platform-admin" } },
      deletedAt: null,
    };

    if (roleFilter !== "ALL") {
      where.role = roleFilter;
    }

    if (businessFilter !== "ALL") {
      where.businessId = businessFilter;
    }

    if (statusFilter === "ACTIVE") {
      where.isActive = true;
    } else if (statusFilter === "SUSPENDED" || statusFilter === "DISABLED") {
      where.isActive = false;
    }

    if (search.trim()) {
      const q = search.trim();
      where.OR = [
        { name: { contains: q, mode: "insensitive" } },
        { email: { contains: q, mode: "insensitive" } },
        { phone: { contains: q, mode: "insensitive" } },
        { business: { name: { contains: q, mode: "insensitive" } } },
      ];
    }

    // 3. Fetch users
    const usersList = await db.user.findMany({
      where,
      include: {
        business: {
          select: { id: true, name: true, slug: true },
        },
        branch: {
          select: { id: true, name: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    // 4. Calculate platform counts
    const [totalUsers, activeUsers, ownersCount, suspendedCount] = await Promise.all([
      db.user.count({
        where: { business: { slug: { not: "platform-admin" } }, deletedAt: null },
      }),
      db.user.count({
        where: { business: { slug: { not: "platform-admin" } }, deletedAt: null, isActive: true },
      }),
      db.user.count({
        where: { business: { slug: { not: "platform-admin" } }, deletedAt: null, role: "OWNER" },
      }),
      db.user.count({
        where: { business: { slug: { not: "platform-admin" } }, deletedAt: null, isActive: false },
      }),
    ]);

    const formattedUsers = usersList.map((u) => {
      // Derive username handle from email or name
      const username = u.email.split("@")[0].toLowerCase().replace(/[^a-z0-9]/g, "");
      return {
        id: u.id,
        name: u.name,
        username: `@${username}`,
        email: u.email,
        phone: u.phone || "—",
        role: u.role,
        businessId: u.businessId,
        businessName: u.business?.name || "Unassigned",
        businessSlug: u.business?.slug || "",
        branchName: u.branch?.name || "Main",
        isActive: u.isActive,
        createdAt: u.createdAt.toISOString(),
        lastActive: u.updatedAt ? u.updatedAt.toISOString() : null,
      };
    });

    return NextResponse.json({
      users: formattedUsers,
      businesses,
      counts: {
        total: totalUsers,
        active: activeUsers,
        pendingInvites: 0,
        businessOwners: ownersCount,
        institutionAdmins: ownersCount,
        suspended: suspendedCount,
      },
    });
  } catch (error: any) {
    console.error("GET super-admin users error:", error);
    return NextResponse.json({ error: "Failed to compile SaaS users list" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const context = await getSessionContext();
  if (!context) return authErrorResponse();
  if (context.role !== "SUPER_ADMIN") return roleErrorResponse();

  try {
    const body = await request.json();
    const result = userActionSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: "Validation failed", details: result.error.format() },
        { status: 400 }
      );
    }

    const { action, userId, businessId, name, email, role, password } = result.data;

    // 1. Toggle user active / disabled status
    if (action === "TOGGLE_STATUS") {
      if (!userId) return NextResponse.json({ error: "userId required" }, { status: 400 });

      const target = await db.user.findUnique({ where: { id: userId } });
      if (!target) return NextResponse.json({ error: "User not found" }, { status: 404 });

      const updated = await db.user.update({
        where: { id: userId },
        data: { isActive: !target.isActive },
      });

      await db.platformAuditLog.create({
        data: {
          actorId: context.userId,
          actorRole: "SUPER_ADMIN",
          action: updated.isActive ? "USER_ACTIVATED" : "USER_SUSPENDED",
          targetType: "USER",
          targetId: target.id,
          businessId: target.businessId,
          reason: `Super Admin toggled account status to ${updated.isActive ? "ACTIVE" : "SUSPENDED"}`,
        },
      });

      return NextResponse.json({
        success: true,
        message: `Account for ${target.name} is now ${updated.isActive ? "Active" : "Disabled"}.`,
        isActive: updated.isActive,
      });
    }

    // 2. Reset password
    if (action === "RESET_PASSWORD") {
      if (!userId) return NextResponse.json({ error: "userId required" }, { status: 400 });
      const tempPass = password || `Pass_${Math.random().toString(36).slice(-8)}!`;
      const hashed = await bcrypt.hash(tempPass, 10);

      const updated = await db.user.update({
        where: { id: userId },
        data: { passwordHash: hashed },
      });

      await db.platformAuditLog.create({
        data: {
          actorId: context.userId,
          actorRole: "SUPER_ADMIN",
          action: "PASSWORD_RESET_SENT",
          targetType: "USER",
          targetId: updated.id,
          businessId: updated.businessId,
          reason: `Super Admin manually reset credentials for ${updated.email}`,
        },
      });

      return NextResponse.json({
        success: true,
        message: `Password reset successfully.`,
        tempPassword: tempPass,
      });
    }

    // 3. Generate new login for a business
    if (action === "GENERATE_LOGIN") {
      if (!businessId || !name || !email) {
        return NextResponse.json({ error: "businessId, name, and email are required" }, { status: 400 });
      }

      const existing = await db.user.findUnique({ where: { email: email.toLowerCase() } });
      if (existing) {
        return NextResponse.json({ error: "A user with this email already exists" }, { status: 400 });
      }

      const tempPass = password || `Owner_${Math.random().toString(36).slice(-8)}!`;
      const hashed = await bcrypt.hash(tempPass, 10);

      const newUser = await db.user.create({
        data: {
          businessId,
          name: name.trim(),
          email: email.toLowerCase().trim(),
          role: role || "OWNER",
          passwordHash: hashed,
          isActive: true,
        },
      });

      await db.platformAuditLog.create({
        data: {
          actorId: context.userId,
          actorRole: "SUPER_ADMIN",
          action: "ADMIN_LOGIN_GENERATED",
          targetType: "USER",
          targetId: newUser.id,
          businessId,
          reason: `Generated direct login credentials for ${newUser.name} (${newUser.email})`,
        },
      });

      return NextResponse.json({
        success: true,
        message: `Admin login generated successfully.`,
        user: { id: newUser.id, name: newUser.name, email: newUser.email },
        tempPassword: tempPass,
      });
    }

    return NextResponse.json({ error: "Unsupported action" }, { status: 400 });
  } catch (error: any) {
    console.error("POST super-admin users error:", error);
    return NextResponse.json({ error: "Failed to process user action" }, { status: 500 });
  }
}
