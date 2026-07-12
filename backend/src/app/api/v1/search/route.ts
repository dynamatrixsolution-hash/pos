import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionContext, authErrorResponse } from "@/lib/api-helper";

export async function GET(request: Request) {
  const context = await getSessionContext();
  if (!context) return authErrorResponse();

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q") || "";

  if (!q.trim()) {
    return NextResponse.json({
      products: [],
      customers: [],
      suppliers: [],
    });
  }

  try {
    const [products, customers, suppliers] = await Promise.all([
      db.product.findMany({
        where: {
          businessId: context.businessId,
          deletedAt: null,
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { sku: { contains: q, mode: "insensitive" } },
            { barcode: { contains: q, mode: "insensitive" } },
          ],
        },
        take: 5,
        select: {
          id: true,
          name: true,
          sku: true,
          sellingPrice: true,
        },
      }),
      db.customer.findMany({
        where: {
          businessId: context.businessId,
          deletedAt: null,
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { phone: { contains: q, mode: "insensitive" } },
          ],
        },
        take: 5,
        select: {
          id: true,
          name: true,
          phone: true,
        },
      }),
      db.supplier.findMany({
        where: {
          businessId: context.businessId,
          deletedAt: null,
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { phone: { contains: q, mode: "insensitive" } },
          ],
        },
        take: 5,
        select: {
          id: true,
          name: true,
          phone: true,
        },
      }),
    ]);

    return NextResponse.json({
      products,
      customers,
      suppliers,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
