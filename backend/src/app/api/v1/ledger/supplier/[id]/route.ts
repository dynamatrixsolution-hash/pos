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
    // Verify supplier belongs to business
    const supplier = await db.supplier.findFirst({
      where: {
        id,
        businessId: context.businessId,
        deletedAt: null,
      },
    });

    if (!supplier) {
      return NextResponse.json({ error: "Supplier not found" }, { status: 404 });
    }

    const ledgerEntries = await db.supplierLedger.findMany({
      where: {
        supplierId: id,
      },
      orderBy: {
        createdAt: "asc",
      },
    });

    return NextResponse.json({
      supplier: {
        id: supplier.id,
        name: supplier.name,
        contactName: supplier.contactName,
        email: supplier.email,
        phone: supplier.phone,
        balance: supplier.balance,
      },
      ledger: ledgerEntries,
    });
  } catch (error: any) {
    console.error("GET supplier ledger error:", error);
    return NextResponse.json({ error: "Failed to fetch supplier ledger statement" }, { status: 500 });
  }
}
