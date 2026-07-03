import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionContext, authErrorResponse, roleErrorResponse } from "@/lib/api-helper";

export async function GET() {
  const context = await getSessionContext();
  if (!context) return authErrorResponse();

  if (context.role !== "OWNER" && context.role !== "SUPER_ADMIN" && context.role !== "MANAGER") {
    return roleErrorResponse();
  }

  try {
    const logs = await db.auditLog.findMany({
      where: {
        businessId: context.businessId,
      },
      include: {
        user: {
          select: {
            name: true,
            email: true,
            role: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 100, // retrieve latest 100 logs
    });

    return NextResponse.json(logs);
  } catch (error: any) {
    console.error("GET audit logs error:", error);
    return NextResponse.json({ error: "Failed to fetch activity logs" }, { status: 500 });
  }
}
