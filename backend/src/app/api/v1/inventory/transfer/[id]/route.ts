import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionContext, authErrorResponse, roleErrorResponse } from "@/lib/api-helper";
import { logActivity } from "@/lib/activity-logger";

export async function PATCH(request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const context = await getSessionContext();
  if (!context) return authErrorResponse();

  const { id } = params;

  try {
    const { action, remarks } = await request.json(); // APPROVE, REJECT, DISPATCH, RECEIVE
    
    const transfer = await db.stockTransfer.findUnique({
      where: { id },
      include: { items: { include: { product: true } } },
    });

    if (!transfer || transfer.businessId !== context.businessId) {
      return NextResponse.json({ error: "Stock transfer not found" }, { status: 404 });
    }

    const currentStatus = transfer.status;
    let newStatus = currentStatus;

    if (action === "APPROVE") {
      if (currentStatus !== "PENDING") {
        return NextResponse.json({ error: "Can only approve pending transfers" }, { status: 400 });
      }
      if (!["OWNER", "MANAGER"].includes(context.role)) {
        return roleErrorResponse();
      }

      newStatus = "APPROVED";
      
      const updated = await db.$transaction(async (tx) => {
        // Deduct items from source branch stock and add to target branch stock
        for (const item of transfer.items) {
          const sourceStock = await tx.productStock.findUnique({
            where: { productId_branchId: { productId: item.productId, branchId: transfer.sourceBranchId } },
          });

          if (!sourceStock || sourceStock.quantity < item.quantity) {
            throw new Error(`Insufficient stock for product "${item.product.name}" at source branch. Available: ${sourceStock?.quantity || 0}, Transfer: ${item.quantity}`);
          }

          await tx.productStock.update({
            where: { id: sourceStock.id },
            data: { quantity: sourceStock.quantity - item.quantity },
          });

          const targetStock = await tx.productStock.findUnique({
            where: { productId_branchId: { productId: item.productId, branchId: transfer.targetBranchId } },
          });

          if (targetStock) {
            await tx.productStock.update({
              where: { id: targetStock.id },
              data: { quantity: targetStock.quantity + item.quantity },
            });
          } else {
            await tx.productStock.create({
              data: {
                productId: item.productId,
                branchId: transfer.targetBranchId,
                quantity: item.quantity,
              },
            });
          }

          // If the product is batch-tracked, we must also adjust batches in FIFO order
          if (item.product.batchTracking) {
            let remainingToTransfer = item.quantity;

            // Find all active batches at the source branch
            const sourceBatches = await tx.batch.findMany({
              where: {
                productId: item.productId,
                branchId: transfer.sourceBranchId,
                deletedAt: null,
                quantity: { gt: 0 },
              },
              orderBy: { expiryDate: "asc" },
            });

            for (const batch of sourceBatches) {
              if (remainingToTransfer <= 0) break;

              const deductQty = Math.min(batch.quantity, remainingToTransfer);
              remainingToTransfer -= deductQty;

              // Deduct from source batch
              await tx.batch.update({
                where: { id: batch.id },
                data: { quantity: batch.quantity - deductQty },
              });

              // Add/upsert to target branch batch
              const targetBatch = await tx.batch.findFirst({
                where: {
                  productId: item.productId,
                  branchId: transfer.targetBranchId,
                  batchNumber: batch.batchNumber,
                  deletedAt: null,
                },
              });

              if (targetBatch) {
                await tx.batch.update({
                  where: { id: targetBatch.id },
                  data: { quantity: targetBatch.quantity + deductQty },
                });
              } else {
                await tx.batch.create({
                  data: {
                    productId: item.productId,
                    branchId: transfer.targetBranchId,
                    batchNumber: batch.batchNumber,
                    quantity: deductQty,
                    costPrice: batch.costPrice,
                    sellingPrice: batch.sellingPrice,
                    expiryDate: batch.expiryDate,
                    manufacturingDate: batch.manufacturingDate,
                    rackNumber: batch.rackNumber,
                    supplierId: batch.supplierId,
                  },
                });
              }
            }
          }
        }

        return await tx.stockTransfer.update({
          where: { id },
          data: { status: newStatus, approvedById: context.userId, remarks },
        });
      });

      await logActivity({
        userId: context.userId,
        businessId: context.businessId,
        role: context.role,
        moduleName: "INVENTORY",
        actionType: "UPDATE",
        details: `Approved stock transfer request ID: ${id}. Items adjusted at source and target branches.`,
        oldValue: transfer,
        newValue: updated,
        request,
      });

      return NextResponse.json({ message: "Transfer approved successfully", transfer: updated });
    }

    if (action === "REJECT") {
      if (currentStatus !== "PENDING") {
        return NextResponse.json({ error: "Can only reject pending transfers" }, { status: 400 });
      }
      if (!["OWNER", "MANAGER"].includes(context.role)) {
        return roleErrorResponse();
      }

      newStatus = "REJECTED";
      const updated = await db.stockTransfer.update({
        where: { id },
        data: { status: newStatus, approvedById: context.userId, remarks },
      });

      await logActivity({
        userId: context.userId,
        businessId: context.businessId,
        role: context.role,
        moduleName: "INVENTORY",
        actionType: "UPDATE",
        details: `Rejected stock transfer request ID: ${id}`,
        oldValue: transfer,
        newValue: updated,
        request,
      });

      return NextResponse.json({ message: "Transfer rejected successfully", transfer: updated });
    }

    if (action === "DISPATCH") {
      if (currentStatus !== "APPROVED") {
        return NextResponse.json({ error: "Can only dispatch approved transfers" }, { status: 400 });
      }

      newStatus = "DISPATCHED";
      
      const updated = await db.stockTransfer.update({
        where: { id },
        data: { status: newStatus, remarks },
      });

      await logActivity({
        userId: context.userId,
        businessId: context.businessId,
        role: context.role,
        moduleName: "INVENTORY",
        actionType: "UPDATE",
        details: `Dispatched stock transfer ID: ${id}.`,
        oldValue: transfer,
        newValue: updated,
        request,
      });

      return NextResponse.json({ message: "Transfer dispatched successfully", transfer: updated });
    }

    if (action === "RECEIVE") {
      if (currentStatus !== "DISPATCHED") {
        return NextResponse.json({ error: "Can only receive dispatched transfers" }, { status: 400 });
      }

      newStatus = "RECEIVED";

      const updated = await db.stockTransfer.update({
        where: { id },
        data: { status: newStatus, receivedById: context.userId, remarks },
      });

      await logActivity({
        userId: context.userId,
        businessId: context.businessId,
        role: context.role,
        moduleName: "INVENTORY",
        actionType: "UPDATE",
        details: `Received stock transfer ID: ${id}.`,
        oldValue: transfer,
        newValue: updated,
        request,
      });

      return NextResponse.json({ message: "Transfer received successfully", transfer: updated });
    }

    return NextResponse.json({ error: "Invalid action type" }, { status: 400 });
  } catch (error: any) {
    console.error("PATCH transfer error:", error);
    return NextResponse.json({ error: error.message || "Failed to update stock transfer" }, { status: 500 });
  }
}
