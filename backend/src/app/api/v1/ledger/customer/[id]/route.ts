import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionContext, authErrorResponse } from "@/lib/api-helper";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const context = await getSessionContext();
  if (!context) return authErrorResponse();

  const { id } = await params;

  try {
    // Verify customer belongs to this business
    const customer = await db.customer.findFirst({
      where: {
        id,
        businessId: context.businessId,
        deletedAt: null,
      },
    });

    if (!customer) {
      return NextResponse.json({ error: "Customer not found" }, { status: 404 });
    }

    const ledgerEntries = await db.customerLedger.findMany({
      where: {
        customerId: id,
      },
      orderBy: {
        createdAt: "asc",
      },
    });

    return NextResponse.json({
      customer: {
        id: customer.id,
        name: customer.name,
        email: customer.email,
        phone: customer.phone,
        customerType: customer.customerType,
        creditLimit: customer.creditLimit,
        balance: customer.balance,
      },
      ledger: ledgerEntries,
    });
  } catch (error: any) {
    console.error("GET customer ledger error:", error);
    return NextResponse.json({ error: "Failed to fetch ledger statement" }, { status: 500 });
  }
}
