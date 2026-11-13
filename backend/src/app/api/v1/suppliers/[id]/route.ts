import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionContext, authErrorResponse, roleErrorResponse } from "@/lib/api-helper";
import { z } from "zod";
import { logActivity } from "@/lib/activity-logger";

const updateSupplierSchema = z.object({
  name: z.string().min(2, "Supplier name must be at least 2 characters").optional(),
  contactName: z.string().optional().nullable(),
  email: z.string().email("Invalid email").optional().nullable().or(z.literal("")),
  phone: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  isImported: z.boolean().optional(),
  notes: z.string().optional().nullable(),
});

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const context = await getSessionContext();
  if (!context) return authErrorResponse();

  const { id } = await params;

  try {
    const supplier = await db.supplier.findFirst({
      where: {
        id,
        businessId: context.businessId,
        deletedAt: null,
      },
      include: {
        purchases: {
          take: 5,
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            invoiceNumber: true,
            total: true,
            paymentStatus: true,
            createdAt: true,
          },
        },
      },
    });

    if (!supplier) {
      return NextResponse.json({ error: "Supplier not found" }, { status: 404 });
    }

    return NextResponse.json({
      supplier: {
        ...supplier,
        balance: Number(supplier.balance || 0),
      },
    });
  } catch (error: any) {
    console.error("GET supplier [id] error:", error);
    return NextResponse.json({ error: "Failed to fetch supplier" }, { status: 500 });
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  return handleUpdate(request, params);
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  return handleUpdate(request, params);
}

async function handleUpdate(
  request: Request,
  paramsPromise: Promise<{ id: string }>
) {
  const context = await getSessionContext();
  if (!context) return authErrorResponse();

  if (context.role === "CASHIER") {
    return roleErrorResponse();
  }

  const { id } = await paramsPromise;

  try {
    const existing = await db.supplier.findFirst({
      where: {
        id,
        businessId: context.businessId,
        deletedAt: null,
      },
    });

    if (!existing) {
      return NextResponse.json({ error: "Supplier not found" }, { status: 404 });
    }

    const body = await request.json();
    const result = updateSupplierSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: "Validation failed", details: result.error.format() },
        { status: 400 }
      );
    }

    const data = result.data;

    const updated = await db.supplier.update({
      where: { id },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.contactName !== undefined && { contactName: data.contactName || null }),
        ...(data.email !== undefined && { email: data.email || null }),
        ...(data.phone !== undefined && { phone: data.phone || null }),
        ...(data.address !== undefined && { address: data.address || null }),
        ...(data.isImported !== undefined && { isImported: data.isImported }),
        ...(data.notes !== undefined && { notes: data.notes || null }),
      },
    });

    await logActivity({
      userId: context.userId,
      businessId: context.businessId,
      role: context.role,
      moduleName: "SUPPLIER",
      actionType: "UPDATE",
      details: `Updated supplier "${updated.name}"`,
      oldValue: existing,
      newValue: updated,
      request,
    });

    return NextResponse.json({
      supplier: {
        ...updated,
        balance: Number(updated.balance || 0),
      },
    });
  } catch (error: any) {
    console.error("UPDATE supplier [id] error:", error);
    return NextResponse.json({ error: "Failed to update supplier" }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const context = await getSessionContext();
  if (!context) return authErrorResponse();

  if (context.role === "CASHIER") {
    return roleErrorResponse();
  }

  const { id } = await params;

  try {
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

    const balance = Number(supplier.balance || 0);
    if (balance !== 0) {
      return NextResponse.json(
        {
          error: `Cannot delete supplier with an outstanding payable balance of ${balance.toFixed(2)}`,
        },
        { status: 400 }
      );
    }

    // Soft delete to protect purchase invoice references
    await db.supplier.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    await logActivity({
      userId: context.userId,
      businessId: context.businessId,
      role: context.role,
      moduleName: "SUPPLIER",
      actionType: "DELETE",
      details: `Deleted supplier "${supplier.name}"`,
      oldValue: supplier,
      request,
    });

    return NextResponse.json({ success: true, message: "Supplier deleted successfully" });
  } catch (error: any) {
    console.error("DELETE supplier [id] error:", error);
    return NextResponse.json({ error: "Failed to delete supplier" }, { status: 500 });
  }
}
