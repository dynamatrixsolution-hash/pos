import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionContext, authErrorResponse, roleErrorResponse } from "@/lib/api-helper";
import { logPlatformAudit } from "@/lib/platform-audit";
import { DEFAULT_SUBSCRIPTION_PLANS as DEFAULT_PLANS } from "@/lib/subscription-plans";

export async function GET(request: Request) {
  const context = await getSessionContext();
  if (!context) return authErrorResponse();
  if (context.role !== "SUPER_ADMIN") return roleErrorResponse();

  try {
    const configRecord = await db.platformSetting.findUnique({
      where: { key: "SUBSCRIPTION_CONFIG" },
    });
    const settings = (configRecord?.value as any) || {};
    const plans = settings.plans || DEFAULT_PLANS;

    return NextResponse.json({ plans });
  } catch (error: any) {
    console.error("GET /super-admin/subscriptions/plans error:", error);
    return NextResponse.json({ error: "Failed to load plans" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const context = await getSessionContext();
  if (!context) return authErrorResponse();
  if (context.role !== "SUPER_ADMIN") return roleErrorResponse();

  try {
    const body = await request.json();
    const configRecord = await db.platformSetting.findUnique({
      where: { key: "SUBSCRIPTION_CONFIG" },
    });
    const settings = (configRecord?.value as any) || {};
    const plans = [...(settings.plans || DEFAULT_PLANS)];

    const newPlan = {
      id: body.id || `plan_${Date.now()}`,
      name: body.name || "Custom Plan",
      tier: body.tier || "PRO",
      subtitle: body.subtitle || "",
      priceMonthly: Number(body.priceMonthly || 0),
      priceAnnual: Number(body.priceAnnual || 0),
      currency: body.currency || "NPR",
      isPopular: Boolean(body.isPopular),
      limits: body.limits || { tables: 50, staff: 20, branches: 2, rooms: 20 },
    };

    plans.push(newPlan);

    await db.platformSetting.upsert({
      where: { key: "SUBSCRIPTION_CONFIG" },
      update: { value: { ...settings, plans } },
      create: { key: "SUBSCRIPTION_CONFIG", value: { plans } },
    });

    await logPlatformAudit({
      actorId: context.userId,
      actorRole: context.role,
      action: "SUBSCRIPTION_PLAN_CREATED",
      targetType: "SYSTEM",
      targetId: newPlan.id,
      reason: `Created subscription plan ${newPlan.name}`,
      beforeState: null,
      afterState: newPlan,
    });

    return NextResponse.json({ success: true, plan: newPlan }, { status: 201 });
  } catch (error: any) {
    console.error("POST /super-admin/subscriptions/plans error:", error);
    return NextResponse.json({ error: "Failed to create subscription plan" }, { status: 500 });
  }
}

