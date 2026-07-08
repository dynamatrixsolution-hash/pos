import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionContext, authErrorResponse } from "@/lib/api-helper";

export async function GET() {
  const context = await getSessionContext();
  if (!context) return authErrorResponse();

  try {
    const subscription = await db.subscription.findUnique({
      where: { businessId: context.businessId },
    });

    if (!subscription) {
      return NextResponse.json({ error: "No active subscription found" }, { status: 404 });
    }

    const branchCount = await db.branch.count({
      where: { businessId: context.businessId, deletedAt: null },
    });

    const userCount = await db.user.count({
      where: { businessId: context.businessId, deletedAt: null },
    });

    // Fetch plans from platform admin
    const platform = await db.business.findUnique({
      where: { slug: "platform-admin" },
      select: { settings: true },
    });

    const platformSettings = (platform?.settings as any) || {};
    const platformPlans = platformSettings.plans || [
      { id: "Starter", name: "Starter", price: 499, setupPrice: 4999, currency: "NPR", duration: "1 Month", desc: "Perfect for single-terminal independent shops" },
      { id: "Professional", name: "Professional", price: 999, setupPrice: 11999, currency: "NPR", duration: "1 Month", desc: "For growing local retail shops" },
      { id: "Enterprise", name: "Enterprise", price: 1499, setupPrice: 24999, currency: "NPR", duration: "1 Month", desc: "For multi-branch retail stores" },
    ];

    return NextResponse.json({
      subscription,
      metrics: {
        branchCount,
        userCount,
      },
      plans: platformPlans,
    });
  } catch (error: any) {
    console.error("GET subscription error:", error);
    return NextResponse.json({ error: "Failed to fetch subscription details" }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  const context = await getSessionContext();
  if (!context) return authErrorResponse();

  try {
    const { plan } = await request.json();
    if (!plan) {
      return NextResponse.json({ error: "Plan ID is required" }, { status: 400 });
    }

    // Load limits from platform configuration
    const platform = await db.business.findUnique({
      where: { slug: "platform-admin" },
      select: { settings: true },
    });

    const platformSettings = (platform?.settings as any) || {};
    const limits = platformSettings.limits || {};
    
    // Fetch limits for the selected plan or assign reasonable defaults
    const planLimits = limits[plan] || (plan.toUpperCase() === "STARTER" ? { users: 1, branches: 1 } : plan.toUpperCase() === "PROFESSIONAL" ? { users: 5, branches: 2 } : { users: 20, branches: 5 });

    // Update the tenant's subscription plan & bounds in database
    const subscription = await db.subscription.update({
      where: { businessId: context.businessId },
      data: {
        plan: plan.toUpperCase(),
        status: "ACTIVE",
        userLimit: planLimits.users || 1,
        branchLimit: planLimits.branches || 1,
      },
    });

    // Create an audit log record for the upgrade action
    await db.auditLog.create({
      data: {
        businessId: context.businessId,
        userId: context.userId,
        role: context.role,
        action: "PLAN_UPGRADE",
        module: "SUBSCRIPTION",
        details: `Upgraded subscription tier to ${plan.toUpperCase()}`,
      },
    });

    return NextResponse.json({ message: "Subscription upgraded successfully", subscription });
  } catch (error: any) {
    console.error("PUT subscription upgrade error:", error);
    return NextResponse.json({ error: "Failed to upgrade subscription plan" }, { status: 500 });
  }
}
