import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionContext, authErrorResponse, roleErrorResponse } from "@/lib/api-helper";
import { z } from "zod";
import { logActivity } from "@/lib/activity-logger";

const updateCustomerSchema = z.object({
  name: z.string().min(2, "Customer name must be at least 2 characters").optional(),
  email: z.string().email("Invalid email").optional().nullable().or(z.literal("")),
  phone: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  customerType: z.enum(["RETAIL", "WHOLESALE"]).optional(),
  creditLimit: z.number().nonnegative().optional(),
  branchId: z.string().optional().nullable(),
});

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const context = await getSessionContext();
  if (!context) return authErrorResponse();

  const { id } = await params;

  try {
    const customer = await db.customer.findFirst({
      where: {
        id,
        businessId: context.businessId,
        deletedAt: null,
      },
      include: {
        sales: {
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

    if (!customer) {
      return NextResponse.json({ error: "Customer not found" }, { status: 404 });
    }

    return NextResponse.json({
      customer: {
        ...customer,
        balance: Number(customer.balance || 0),
        creditLimit: Number(customer.creditLimit || 0),
      },
    });
  } catch (error: any) {
    console.error("GET customer [id] error:", error);
    return NextResponse.json({ error: "Failed to fetch customer" }, { status: 500 });
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

  const { id } = await paramsPromise;

  try {
    const existing = await db.customer.findFirst({
      where: {
        id,
        businessId: context.businessId,
        deletedAt: null,
      },
    });

    if (!existing) {
      return NextResponse.json({ error: "Customer not found" }, { status: 404 });
    }

    const body = await request.json();
    const result = updateCustomerSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: "Validation failed", details: result.error.format() },
        { status: 400 }
      );
    }

    const data = result.data;

    if (data.phone && data.phone.trim() && data.phone.trim() !== existing.phone) {
      const duplicate = await db.customer.findFirst({
        where: {
          phone: data.phone.trim(),
          businessId: context.businessId,
          deletedAt: null,
          id: { not: id },
        },
      });

      if (duplicate) {
        return NextResponse.json(
          { error: "Another customer with this phone number already exists" },
          { status: 400 }
        );
      }
    }

    const updated = await db.customer.update({
      where: { id },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.email !== undefined && { email: data.email || null }),
        ...(data.phone !== undefined && { phone: data.phone || null }),
        ...(data.address !== undefined && { address: data.address || null }),
        ...(data.customerType !== undefined && { customerType: data.customerType }),
        ...(data.creditLimit !== undefined && { creditLimit: data.creditLimit }),
        ...(data.branchId !== undefined && { branchId: data.branchId || null }),
      },
    });

    await logActivity({
      userId: context.userId,
      businessId: context.businessId,
      role: context.role,
      moduleName: "CUSTOMER",
      actionType: "UPDATE",
      details: `Updated customer "${updated.name}"`,
      oldValue: existing,
      newValue: updated,
      request,
    });

    return NextResponse.json({
      customer: {
        ...updated,
        balance: Number(updated.balance || 0),
        creditLimit: Number(updated.creditLimit || 0),
      },
    });
  } catch (error: any) {
    console.error("UPDATE customer [id] error:", error);
    return NextResponse.json({ error: "Failed to update customer" }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const context = await getSessionContext();
  if (!context) return authErrorResponse();

  // Cashiers should not delete customers
  if (context.role === "CASHIER") {
    return roleErrorResponse();
  }

  const { id } = await params;

  try {
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

    const balance = Number(customer.balance || 0);
    if (balance !== 0) {
      return NextResponse.json(
        {
          error: `Cannot delete customer with an outstanding balance of ${balance.toFixed(2)}`,
        },
        { status: 400 }
      );
    }

    // Soft delete to protect financial invoice references
    await db.customer.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    await logActivity({
      userId: context.userId,
      businessId: context.businessId,
      role: context.role,
      moduleName: "CUSTOMER",
      actionType: "DELETE",
      details: `Deleted customer "${customer.name}"`,
      oldValue: customer,
      request,
    });

    return NextResponse.json({ success: true, message: "Customer deleted successfully" });
  } catch (error: any) {
    console.error("DELETE customer [id] error:", error);
    return NextResponse.json({ error: "Failed to delete customer" }, { status: 500 });
  }
}
