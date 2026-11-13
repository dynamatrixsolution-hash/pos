import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionContext, authErrorResponse, roleErrorResponse } from "@/lib/api-helper";
import { logPlatformAudit } from "@/lib/platform-audit";

const DEFAULT_PLANS = [
  {
    id: "Starter",
    name: "Starter",
    tier: "BASIC",
    subtitle: "For small cafes, cloud kitchens & bistros",
    priceMonthly: 700,
    priceAnnual: 7000,
    currency: "NPR",
    isPopular: false,
    limits: { tables: 15, staff: 5, branches: 1, rooms: 0 },
  },
  {
    id: "Standard",
    name: "Standard",
    tier: "STANDARD",
    subtitle: "For growing dine-in restaurants & bars",
    priceMonthly: 1200,
    priceAnnual: 12000,
    currency: "NPR",
    isPopular: false,
    limits: { tables: 40, staff: 15, branches: 2, rooms: 10 },
  },
  {
    id: "Professional",
    name: "Professional",
    tier: "PRO",
    subtitle: "For high-volume multi-floor restaurants & boutique hotels",
    priceMonthly: 2000,
    priceAnnual: 20000,
    currency: "NPR",
    isPopular: true,
    limits: { tables: 100, staff: 50, branches: 5, rooms: 40 },
  },
  {
    id: "Enterprise",
    name: "Enterprise",
    tier: "ENTERPRISE",
    subtitle: "For resort chains, franchises & large hospitality groups",
    priceMonthly: 5000,
    priceAnnual: 50000,
    currency: "NPR",
    isPopular: false,
    limits: { tables: 999, staff: 999, branches: 20, rooms: 500 },
  },
];

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

