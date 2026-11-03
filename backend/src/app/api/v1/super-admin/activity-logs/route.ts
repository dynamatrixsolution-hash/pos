import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionContext, authErrorResponse, roleErrorResponse } from "@/lib/api-helper";

export async function GET(request: Request) {
  const context = await getSessionContext();
  if (!context) return authErrorResponse();
  if (context.role !== "SUPER_ADMIN") return roleErrorResponse();

  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get("action");
    const businessId = searchParams.get("businessId");

    const where: any = {};
    if (action && action !== "ALL") where.action = action;
    if (businessId && businessId !== "ALL") where.businessId = businessId;

    const logs = await db.platformAuditLog.findMany({
      where,
      include: {
        actor: {
          select: { id: true, name: true, email: true, role: true },
        },
        business: {
          select: { id: true, name: true, slug: true },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    });

    const formattedLogs = logs.map((log) => ({
      id: log.id,
      action: log.action,
      targetType: log.targetType,
      targetId: log.targetId,
      reason: log.reason,
      beforeState: log.beforeState,
      afterState: log.afterState,
      createdAt: log.createdAt.toISOString(),
      user: log.actor?.email || "system",
      userName: log.actor?.name || "System",
      role: log.actorRole,
      businessName: log.business?.name || "Platform Global",
      businessId: log.businessId,
      ipAddress: log.ipAddress || "127.0.0.1",
    }));

    return NextResponse.json({ logs: formattedLogs });
  } catch (error: any) {
    console.error("GET platform activity logs error:", error);
    return NextResponse.json({ error: "Failed to fetch platform activity logs" }, { status: 500 });
  }
}
