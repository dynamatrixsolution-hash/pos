import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionContext, authErrorResponse } from "@/lib/api-helper";

const OWNER_ROLES = ["SUPER_ADMIN", "OWNER"];

export async function GET(request: Request) {
  const context = await getSessionContext();
  if (!context) return authErrorResponse();

  const { searchParams } = new URL(request.url);
  const branchId = searchParams.get("branchId");
  const search = searchParams.get("search") || "";
  const expiringSoon = searchParams.get("expiringSoon") === "true";

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

    // Get batches
    const batches = await db.batch.findMany({
      where: {
        branchId: { in: branchIds },
        deletedAt: null,
        ...(search && {
          OR: [
            { product: { name: { contains: search } } },
            { product: { sku: { contains: search } } },
            { batchNumber: { contains: search } },
          ],
        }),
      },
      include: {
        product: { select: { id: true, name: true, sku: true, batchTracking: true } },
        branch: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    const now = new Date();
    const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    let filtered = (batches as any[])
      .filter((b) => !b.product?.batchTracking || !search || b.product?.name.includes(search) || b.product?.sku?.includes(search) || b.batchNumber.includes(search))
      .map((b) => {
        const isExpired = b.expiryDate && b.expiryDate < now;
        const isExpiringSoon = b.expiryDate && b.expiryDate > now && b.expiryDate <= thirtyDaysFromNow;
        const daysToExpiry = b.expiryDate ? Math.ceil((b.expiryDate.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)) : null;

        return {
          id: b.id,
          productId: b.product?.id,
          productName: b.product?.name,
          sku: b.product?.sku || "N/A",
          batchNumber: b.batchNumber,
          branchName: b.branch?.name,
          quantity: b.quantity,
          costPrice: b.costPrice || 0,
          sellingPrice: b.sellingPrice || 0,
          totalValue: (b.quantity || 0) * (b.costPrice || 0),
          expiryDate: b.expiryDate,
          isExpired,
          isExpiringSoon,
          daysToExpiry,
          createdAt: b.createdAt,
        };
      });

    if (expiringSoon) {
      filtered = filtered.filter((b) => b.isExpired || b.isExpiringSoon);
    }

    return NextResponse.json({
      batches: filtered,
      summary: {
        totalBatches: filtered.length,
        expiredCount: filtered.filter((b) => b.isExpired).length,
        expiringSoonCount: filtered.filter((b) => b.isExpiringSoon).length,
        totalValue: filtered.reduce((sum, b) => sum + b.totalValue, 0),
      },
    });
  } catch (error: any) {
    console.error("GET batch stock error:", error);
    return NextResponse.json({ error: "Failed to fetch batch stock" }, { status: 500 });
  }
}
