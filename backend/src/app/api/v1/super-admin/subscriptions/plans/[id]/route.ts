import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionContext, authErrorResponse, roleErrorResponse } from "@/lib/api-helper";
import { logPlatformAudit } from "@/lib/platform-audit";
import { DEFAULT_SUBSCRIPTION_PLANS } from "@/lib/subscription-plans";

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

    const configRecord = await db.platformSetting.findUnique({
      where: { key: "SUBSCRIPTION_CONFIG" },
    });
    const settings = (configRecord?.value as any) || {};
    const plans = [...(settings.plans || DEFAULT_SUBSCRIPTION_PLANS)];

    const index = plans.findIndex((p: any) => p.id === id || p.name === id);
    if (index === -1) {
      return NextResponse.json({ error: "Plan not found" }, { status: 404 });
    }

    const beforePlan = { ...plans[index] };
    const updatedPlan = {
      ...beforePlan,
      ...body,
      id: beforePlan.id, // preserve id
    };

    plans[index] = updatedPlan;

    await db.platformSetting.upsert({
      where: { key: "SUBSCRIPTION_CONFIG" },
      update: { value: { ...settings, plans } },
      create: { key: "SUBSCRIPTION_CONFIG", value: { plans } },
    });

    await logPlatformAudit({
      actorId: context.userId,
      actorRole: context.role,
      action: "SUBSCRIPTION_PLAN_UPDATED",
      targetType: "SYSTEM",
      targetId: id,
      reason: `Updated subscription plan ${updatedPlan.name}`,
      beforeState: beforePlan,
      afterState: updatedPlan,
    });

    return NextResponse.json({ success: true, plan: updatedPlan });
  } catch (error: any) {
    console.error("PATCH /super-admin/subscriptions/plans/[id] error:", error);
    return NextResponse.json({ error: "Failed to update subscription plan" }, { status: 500 });
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
    const configRecord = await db.platformSetting.findUnique({
      where: { key: "SUBSCRIPTION_CONFIG" },
    });
    const settings = (configRecord?.value as any) || {};
    const plans = [...(settings.plans || DEFAULT_SUBSCRIPTION_PLANS)];

    const filtered = plans.filter((p: any) => p.id !== id && p.name !== id);

    await db.platformSetting.upsert({
      where: { key: "SUBSCRIPTION_CONFIG" },
      update: { value: { ...settings, plans: filtered } },
      create: { key: "SUBSCRIPTION_CONFIG", value: { plans: filtered } },
    });

    return NextResponse.json({ success: true, message: `Plan ${id} deleted` });
  } catch (error: any) {
    console.error("DELETE /super-admin/subscriptions/plans/[id] error:", error);
    return NextResponse.json({ error: "Failed to delete subscription plan" }, { status: 500 });
  }
}

