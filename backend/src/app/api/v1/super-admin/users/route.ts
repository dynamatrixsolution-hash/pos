import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionContext, authErrorResponse, roleErrorResponse } from "@/lib/api-helper";

export async function GET(request: Request) {
  const context = await getSessionContext();
  if (!context) return authErrorResponse();
  if (context.role !== "SUPER_ADMIN") return roleErrorResponse();

  try {
    // 1. Fetch Business Owners
    const ownersList = await db.user.findMany({
      where: {
        role: "OWNER",
        business: { slug: { not: "platform-admin" } },
      },
      include: {
        business: {
          select: { name: true, slug: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const businessOwners = ownersList.map((o) => ({
      id: o.id,
      name: o.name,
      email: o.email,
      phone: o.phone || "N/A",
      businessName: o.business?.name || "Unknown Merchant",
      businessSlug: o.business?.slug || "",
      isActive: o.isActive,
      createdAt: o.createdAt.toISOString(),
    }));

    // 2. Fetch Active Users across the platform
    const usersList = await db.user.findMany({
      where: {
        business: { slug: { not: "platform-admin" } },
      },
      include: {
        business: {
          select: { name: true },
        },
        branch: {
          select: { name: true },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    const activeUsers = usersList.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      businessName: u.business?.name || "Unknown Merchant",
      branchName: u.branch?.name || "Main Branch",
      isActive: u.isActive,
      createdAt: u.createdAt.toISOString(),
    }));

    return NextResponse.json({
      businessOwners,
      activeUsers,
    });
  } catch (error: any) {
    console.error("GET super-admin users error:", error);
    return NextResponse.json({ error: "Failed to compile SaaS users list" }, { status: 500 });
  }
}
