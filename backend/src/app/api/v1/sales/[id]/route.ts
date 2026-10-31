import { checkBranch } from "@/lib/commerce-transaction";
import { CommerceError } from "@/lib/commerce-policy";
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
        ...(!["OWNER", "SUPER_ADMIN"].includes(context.role) ? { branchId: await checkBranch(context, context.branchId) } : {}),
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
    return NextResponse.json({ error: "Failed to retrieve sale" }, { status: error instanceof CommerceError ? error.status : 500 });
  }
}

export async function PUT(request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const context = await getSessionContext();
  if (!context) return authErrorResponse();

  try {

    const sale = await db.sale.findFirst({
      where: {
        id: params.id,
        businessId: context.businessId,
        ...(!["OWNER", "SUPER_ADMIN"].includes(context.role) ? { branchId: await checkBranch(context, context.branchId) } : {}),
        deletedAt: null,
      },
    });

    if (!sale) {
      return NextResponse.json({ error: "Sale not found" }, { status: 404 });
    }

    if (sale.status === "COMPLETED") {
      return NextResponse.json({ error: "IRD Compliance: Finalized sales invoices are immutable and cannot be updated." }, { status: 400 });
    }

    return NextResponse.json({ error: "Status and settlement transitions must use authorized checkout/payment commands" }, { status: 409 });
  } catch (error: any) {
    console.error("PUT sale error:", error);
    return NextResponse.json({ error: "Failed to update sale" }, { status: error instanceof CommerceError ? error.status : 500 });
  }
}

export async function DELETE(request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const context = await getSessionContext();
  if (!context) return authErrorResponse();

  try {
    const sale = await db.sale.findFirst({
      where: {
        id: params.id,
        businessId: context.businessId,
        ...(!["OWNER", "SUPER_ADMIN"].includes(context.role) ? { branchId: await checkBranch(context, context.branchId) } : {}),
        deletedAt: null,
      },
    });

    if (!sale) {
      return NextResponse.json({ error: "Sale not found" }, { status: 404 });
    }

    return NextResponse.json(
      { error: "IRD Compliance: Finalized sales invoices are immutable and cannot be physically deleted from the system." },
      { status: 400 }
    );
  } catch (error: any) {
    console.error("DELETE sale error:", error);
    return NextResponse.json({ error: "Failed to delete sale" }, { status: error instanceof CommerceError ? error.status : 500 });
  }
}

