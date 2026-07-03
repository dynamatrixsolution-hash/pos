import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionContext, authErrorResponse } from "@/lib/api-helper";
import { logActivity } from "@/lib/activity-logger";
import { z } from "zod";

const transferItemSchema = z.object({
  productId: z.string().uuid(),
  quantity: z.number().positive("Quantity must be positive"),
});

const transferCreateSchema = z.object({
  sourceBranchId: z.string().uuid(),
  targetBranchId: z.string().uuid(),
  items: z.array(transferItemSchema).min(1, "At least one item is required for transfer"),
  notes: z.string().optional().nullable(),
});

export async function GET(request: Request) {
  const context = await getSessionContext();
  if (!context) return authErrorResponse();

  try {
    const isOwner = ["SUPER_ADMIN", "OWNER"].includes(context.role);
    const userBranchId = context.branchId;

    const where: any = {
      businessId: context.businessId,
    };

    // Branch isolation for non-owners
    if (!isOwner && userBranchId) {
      where.OR = [
        { sourceBranchId: userBranchId },
        { targetBranchId: userBranchId },
      ];
    }

    const transfers = await db.stockTransfer.findMany({
      where,
      include: {
        sourceBranch: { select: { name: true } },
        targetBranch: { select: { name: true } },
        requestedBy: { select: { name: true, email: true } },
        approvedBy: { select: { name: true, email: true } },
        receivedBy: { select: { name: true, email: true } },
        items: {
          include: {
            product: { select: { name: true, sku: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(transfers);
  } catch (error: any) {
    console.error("GET transfers error:", error);
    return NextResponse.json({ error: "Failed to fetch transfers" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const context = await getSessionContext();
  if (!context) return authErrorResponse();

  try {
    const body = await request.json();
    const result = transferCreateSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: "Validation failed", details: result.error.format() },
        { status: 400 }
      );
    }

    const { sourceBranchId, targetBranchId, items, notes } = result.data;

    if (sourceBranchId === targetBranchId) {
      return NextResponse.json(
        { error: "Source and target branch cannot be the same" },
        { status: 400 }
      );
    }

    // Verify source and target branches exist and belong to business
    const [sourceBranch, targetBranch] = await Promise.all([
      db.branch.findFirst({ where: { id: sourceBranchId, businessId: context.businessId, deletedAt: null } }),
      db.branch.findFirst({ where: { id: targetBranchId, businessId: context.businessId, deletedAt: null } }),
    ]);

    if (!sourceBranch || !targetBranch) {
      return NextResponse.json({ error: "Source or target branch not found" }, { status: 404 });
    }

    // Create stock transfer record in PENDING state
    const transfer = await db.$transaction(async (tx) => {
      const newTransfer = await tx.stockTransfer.create({
        data: {
          businessId: context.businessId,
          sourceBranchId,
          targetBranchId,
          status: "PENDING",
          notes,
          requestedById: context.userId,
        },
      });

      const transferItemsData = items.map((item) => ({
        transferId: newTransfer.id,
        productId: item.productId,
        quantity: item.quantity,
      }));

      await tx.stockTransferItem.createMany({
        data: transferItemsData,
      });

      return newTransfer;
    });

    await logActivity({
      userId: context.userId,
      businessId: context.businessId,
      role: context.role,
      moduleName: "INVENTORY",
      actionType: "CREATE",
      details: `Requested stock transfer of ${items.length} items from ${sourceBranch.name} to ${targetBranch.name}. Status: PENDING`,
      newValue: transfer,
      request,
    });

    return NextResponse.json({
      message: "Stock transfer request created successfully",
      transfer,
    }, { status: 201 });
  } catch (error: any) {
    console.error("POST stock transfer error:", error.message);
    return NextResponse.json({ error: error.message || "Failed to transfer stock" }, { status: 500 });
  }
}
