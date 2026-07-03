import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionContext, authErrorResponse } from "@/lib/api-helper";

export async function GET(request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const context = await getSessionContext();
  if (!context) return authErrorResponse();

  try {
    const sale = await db.sale.findFirst({
      where: {
        id: params.id,
        businessId: context.businessId,
        deletedAt: null,
      },
      include: {
        customer: true,
        user: { select: { name: true, email: true } },
        saleItems: {
          include: {
            product: { select: { name: true, sku: true, unit: true } },
          },
        },
        payments: true,
        business: { select: { name: true, phone: true, address: true, logo: true, currency: true } },
      },
    });

    if (!sale) {
      return NextResponse.json({ error: "Sale not found" }, { status: 404 });
    }

    return NextResponse.json(sale);
  } catch (error: any) {
    console.error("GET sale error:", error);
    return NextResponse.json({ error: "Failed to retrieve sale" }, { status: 500 });
  }
}

export async function PUT(request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const context = await getSessionContext();
  if (!context) return authErrorResponse();

  try {
    const body = await request.json();
    const { status, paymentStatus } = body;

    const sale = await db.sale.findFirst({
      where: {
        id: params.id,
        businessId: context.businessId,
        deletedAt: null,
      },
    });

    if (!sale) {
      return NextResponse.json({ error: "Sale not found" }, { status: 404 });
    }

    const updatedSale = await db.sale.update({
      where: { id: params.id },
      data: {
        ...(status && { status }),
        ...(paymentStatus && { paymentStatus }),
      },
    });

    return NextResponse.json(updatedSale);
  } catch (error: any) {
    console.error("PUT sale error:", error);
    return NextResponse.json({ error: "Failed to update sale" }, { status: 500 });
  }
}
