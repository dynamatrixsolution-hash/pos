import { NextResponse } from "next/server";
import { getSessionContext, authErrorResponse, safeErrorMessage } from "@/lib/api-helper";
import { getStaffMenuCatalog } from "@/lib/services/menu-catalog-service";
import { db } from "@/lib/db";

export async function GET(req: Request) {
  try {
    const session = await getSessionContext();
    if (!session) return authErrorResponse();

    const { searchParams } = new URL(req.url);
    const branchId = searchParams.get("branchId") || session.branchId;

    const [catalog, categories, subcategories] = await Promise.all([
      getStaffMenuCatalog(session.businessId, branchId),
      db.category.findMany({
        where: { businessId: session.businessId, deletedAt: null },
        orderBy: { name: "asc" },
      }),
      db.subcategory.findMany({
        where: { businessId: session.businessId, deletedAt: null },
        orderBy: { name: "asc" },
      }),
    ]);

    return NextResponse.json({
      catalog,
      categories,
      subcategories,
    });
  } catch (error: any) {
    console.error("GET /restaurant/menu/catalog error:", error);
    return NextResponse.json(
      { error: safeErrorMessage(error, "Failed to fetch menu catalog") },
      { status: 500 }
    );
  }
}

