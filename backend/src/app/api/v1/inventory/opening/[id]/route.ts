import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionContext, authErrorResponse, roleErrorResponse } from "@/lib/api-helper";
import { logActivity } from "@/lib/activity-logger";
import { approveOpeningStockTransaction } from "../route";

export async function PUT(request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const context = await getSessionContext();
  if (!context) return authErrorResponse();

  const { id } = params;

  try {
    const body = await request.json();
    const entry = await db.openingStock.findUnique({
      where: { id },
    });

    if (!entry || entry.businessId !== context.businessId) {
      return NextResponse.json({ error: "Opening stock entry not found" }, { status: 404 });
    }

    if (entry.approvalStatus !== "PENDING") {
      return NextResponse.json({ error: "Cannot edit an entry that has already been processed" }, { status: 400 });
    }

    const qty = body.quantity !== undefined ? body.quantity : entry.quantity;
    const rate = body.purchaseRate !== undefined ? body.purchaseRate : entry.purchaseRate;
    const totalValue = qty * rate;

    const updated = await db.openingStock.update({
      where: { id },
      data: {
        productId: body.productId,
        branchId: body.branchId,
        warehouseId: body.warehouseId || body.branchId,
        quantity: qty,
        unitType: body.unitType,
        purchaseRate: rate,
        sellingPrice: body.sellingPrice,
        mrp: body.mrp,
        totalValue,
        batchNumber: body.batchNumber,
        expiryDate: body.expiryDate ? new Date(body.expiryDate) : null,
        manufacturingDate: body.manufacturingDate ? new Date(body.manufacturingDate) : null,
        rackNumber: body.rackNumber,
        supplierId: body.supplierId,
        remarks: body.remarks,
      },
    });

    await logActivity({
      userId: context.userId,
      businessId: context.businessId,
      role: context.role,
      moduleName: "INVENTORY",
      actionType: "UPDATE",
      details: `Edited opening stock entry for ID: ${id}`,
      oldValue: entry,
      newValue: updated,
      request,
    });

    return NextResponse.json({ message: "Opening stock updated successfully", entry: updated });
  } catch (error: any) {
    console.error("PUT opening stock error:", error);
    return NextResponse.json({ error: error.message || "Failed to update opening stock" }, { status: 500 });
  }
}

export async function DELETE(request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const context = await getSessionContext();
  if (!context) return authErrorResponse();

  const { id } = params;

  try {
    const entry = await db.openingStock.findUnique({
      where: { id },
    });

    if (!entry || entry.businessId !== context.businessId) {
      return NextResponse.json({ error: "Opening stock entry not found" }, { status: 404 });
    }

    if (entry.approvalStatus !== "PENDING") {
      return NextResponse.json({ error: "Cannot delete an approved/rejected opening stock entry" }, { status: 400 });
    }

    await db.openingStock.delete({
      where: { id },
    });

    await logActivity({
      userId: context.userId,
      businessId: context.businessId,
      role: context.role,
      moduleName: "INVENTORY",
      actionType: "DELETE",
      details: `Deleted opening stock entry ID: ${id}`,
      oldValue: entry,
      request,
    });

    return NextResponse.json({ message: "Opening stock entry deleted successfully" });
  } catch (error: any) {
    console.error("DELETE opening stock error:", error);
    return NextResponse.json({ error: error.message || "Failed to delete opening stock" }, { status: 500 });
  }
}

export async function PATCH(request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const context = await getSessionContext();
  if (!context) return authErrorResponse();

  if (!["OWNER", "MANAGER"].includes(context.role)) {
    return roleErrorResponse();
  }

  const { id } = params;

  try {
    const { status } = await request.json();
    
    if (!["APPROVED", "REJECTED"].includes(status)) {
      return NextResponse.json({ error: "Invalid status. Choose APPROVED or REJECTED" }, { status: 400 });
    }

    const entry = await db.openingStock.findUnique({
      where: { id },
    });

    if (!entry || entry.businessId !== context.businessId) {
      return NextResponse.json({ error: "Opening stock entry not found" }, { status: 404 });
    }

    if (entry.approvalStatus !== "PENDING") {
      return NextResponse.json({ error: "This entry has already been processed" }, { status: 400 });
    }

    const updated = await db.openingStock.update({
      where: { id },
      data: {
        approvalStatus: status,
        approvedById: context.userId,
      },
    });

    if (status === "APPROVED") {
      await approveOpeningStockTransaction(id, context.businessId, context.userId);
    }

    await logActivity({
      userId: context.userId,
      businessId: context.businessId,
      role: context.role,
      moduleName: "INVENTORY",
      actionType: "UPDATE",
      details: `Set opening stock approval status to ${status} for entry ID: ${id}`,
      oldValue: entry,
      newValue: updated,
      request,
    });

    return NextResponse.json({ message: `Opening stock entry ${status.toLowerCase()} successfully`, entry: updated });
  } catch (error: any) {
    console.error("PATCH opening stock error:", error);
    return NextResponse.json({ error: error.message || "Failed to update status" }, { status: 500 });
  }
}
