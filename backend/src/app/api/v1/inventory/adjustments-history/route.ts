import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionContext, authErrorResponse } from "@/lib/api-helper";

const OWNER_ROLES = ["SUPER_ADMIN", "OWNER"];

export async function GET(request: Request) {
  const context = await getSessionContext();
  if (!context) return authErrorResponse();

  const { searchParams } = new URL(request.url);
  const branchId = searchParams.get("branchId");
  const type = searchParams.get("type");
  const days = parseInt(searchParams.get("days") || "30");

  try {
    const isOwner = OWNER_ROLES.includes(context.role);
    const userBranchId = context.branchId;

    const branchWhere: any = { businessId: context.businessId, deletedAt: null };
    if (!isOwner && userBranchId) {
      branchWhere.id = userBranchId;
    }
    // Only owners can override branch filter via URL parameter
    if (branchId && isOwner) {
      branchWhere.id = branchId;
    }

    const branches = await db.branch.findMany({ where: branchWhere, select: { id: true } });
    const branchIds = branches.map((b) => b.id);

    // Get adjustment audit logs
    const adjustments = await db.auditLog.findMany({
      where: {
        businessId: context.businessId,
        module: "INVENTORY",
        createdAt: { gte: new Date(Date.now() - days * 24 * 60 * 60 * 1000) },
        details: { contains: "adjustment" },
      },
      include: {
        user: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    const records = adjustments.map((adj) => {
      const qtyMatch = adj.details?.match(/Qty adjusted: ([\d.]+)/);
      const typeMatch = adj.details?.match(/\(([A-Z_]+)\)/);
      const notesMatch = adj.details?.match(/Notes: (.+?)$/);

      return {
        id: adj.id,
        date: adj.createdAt,
        type: typeMatch ? typeMatch[1] : "UNKNOWN",
        quantity: qtyMatch ? parseFloat(qtyMatch[1]) : 0,
        notes: notesMatch ? notesMatch[1] : "No notes",
        user: adj.user?.name || "Unknown",
        details: adj.details || "",
      };
    });

    const filtered = type ? records.filter((r) => r.type === type) : records;

    return NextResponse.json({
      adjustments: filtered,
      summary: {
        totalAdjustments: filtered.length,
        byType: {
          STOCK_IN: filtered.filter((r) => r.type === "STOCK_IN").length,
          STOCK_OUT: filtered.filter((r) => r.type === "STOCK_OUT").length,
          DAMAGE: filtered.filter((r) => r.type === "DAMAGE").length,
          ADJUSTMENT: filtered.filter((r) => r.type === "ADJUSTMENT").length,
        },
      },
    });
  } catch (error: any) {
    console.error("GET adjustments history error:", error);
    return NextResponse.json({ error: "Failed to fetch adjustments history" }, { status: 500 });
  }
}
