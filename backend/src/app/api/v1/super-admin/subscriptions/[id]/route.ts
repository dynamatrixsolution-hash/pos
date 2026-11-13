import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionContext, authErrorResponse, roleErrorResponse } from "@/lib/api-helper";
import { logPlatformAudit } from "@/lib/platform-audit";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const context = await getSessionContext();
  if (!context) return authErrorResponse();
  if (context.role !== "SUPER_ADMIN") return roleErrorResponse();

  try {
    const { id } = await params;
    const subscription = await db.subscription.findFirst({
      where: {
        OR: [
          { id },
          { businessId: id },
        ],
      },
      include: {
        business: {
          select: {
            id: true,
            name: true,
            slug: true,
            email: true,
            phone: true,
          },
        },
      },
    });

    if (!subscription) {
      return NextResponse.json({ error: "Subscription not found" }, { status: 404 });
    }

    return NextResponse.json({ subscription });
  } catch (error: any) {
    console.error("GET /super-admin/subscriptions/[id] error:", error);
    return NextResponse.json({ error: "Failed to fetch subscription" }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const context = await getSessionContext();
  if (!context) return authErrorResponse();
  if (context.role !== "SUPER_ADMIN") return roleErrorResponse();

  try {
    const { id } = await params;
    const body = await request.json();

    const existing = await db.subscription.findFirst({
      where: {
        OR: [
          { id },
          { businessId: id },
        ],
      },
    });

    if (!existing) {
      return NextResponse.json({ error: "Subscription not found" }, { status: 404 });
    }

    const updated = await db.subscription.update({
      where: { id: existing.id },
      data: {
        ...(body.plan !== undefined && { plan: body.plan }),
        ...(body.status !== undefined && { status: body.status }),
        ...(body.billingCycle !== undefined && { billingCycle: body.billingCycle }),
        ...(body.endDate !== undefined && { endDate: new Date(body.endDate) }),
        ...(body.enabledModules !== undefined && { enabledModules: body.enabledModules }),
      },
    });

    await logPlatformAudit({
      actorId: context.userId,
      actorRole: context.role,
      action: "SUBSCRIPTION_UPDATED",
      targetType: "SUBSCRIPTION",
      targetId: existing.id,
      businessId: existing.businessId,
      reason: body.reason || `Updated subscription for business ${existing.businessId}`,
      beforeState: existing,
      afterState: updated,
    });

    return NextResponse.json({ success: true, subscription: updated });
  } catch (error: any) {
    console.error("PATCH /super-admin/subscriptions/[id] error:", error);
    return NextResponse.json({ error: "Failed to update subscription" }, { status: 500 });
  }
}

export const PUT = PATCH;

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const context = await getSessionContext();
  if (!context) return authErrorResponse();
  if (context.role !== "SUPER_ADMIN") return roleErrorResponse();

  try {
    const { id } = await params;

    const existing = await db.subscription.findFirst({
      where: {
        OR: [
          { id },
          { businessId: id },
        ],
      },
    });

    if (!existing) {
      return NextResponse.json({ error: "Subscription not found" }, { status: 404 });
    }

    const updated = await db.subscription.update({
      where: { id: existing.id },
      data: { status: "CANCELLED" },
    });

    await logPlatformAudit({
      actorId: context.userId,
      actorRole: context.role,
      action: "SUBSCRIPTION_CANCELLED",
      targetType: "SUBSCRIPTION",
      targetId: existing.id,
      businessId: existing.businessId,
      reason: "Super Admin cancelled subscription",
      beforeState: existing,
      afterState: updated,
    });

    return NextResponse.json({ success: true, message: "Subscription cancelled successfully" });
  } catch (error: any) {
    console.error("DELETE /super-admin/subscriptions/[id] error:", error);
    return NextResponse.json({ error: "Failed to cancel subscription" }, { status: 500 });
  }
}

