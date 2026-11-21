import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionContext, authErrorResponse, roleErrorResponse, safeErrorMessage } from "@/lib/api-helper";
import { logPlatformAudit } from "@/lib/platform-audit";
import { DEFAULT_SUBSCRIPTION_PLANS } from "@/lib/subscription-plans";

export async function GET(request: Request) {
  const context = await getSessionContext();
  if (!context) return authErrorResponse();
  if (context.role !== "SUPER_ADMIN") return roleErrorResponse();

  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || "";
    const planFilter = searchParams.get("plan") || "ALL";
    const statusFilter = searchParams.get("status") || "ALL";
    const cycleFilter = searchParams.get("cycle") || "ALL";

    // 1. Fetch platform settings from PlatformSetting
    const configRecord = await db.platformSetting.findUnique({
      where: { key: "SUBSCRIPTION_CONFIG" },
    });
    const settings = (configRecord?.value as any) || {};

    // Default hospitality plan tiers matching Screenshot 2
    const defaultPlans = settings.plans || [
      {
        id: "Starter",
        name: "Starter",
        tier: "BASIC",
        subtitle: "For small cafes, cloud kitchens & bistros",
        priceMonthly: 700,
        priceAnnual: 7000,
        currency: "NPR",
        isPopular: false,
        limits: {
          tables: 15,
          staff: 5,
          branches: 1,
          rooms: 0,
        },
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
        limits: {
          tables: 40,
          staff: 15,
          branches: 2,
          rooms: 10,
        },
      },
      {
        id: "Professional",
        name: "Professional",
        tier: "PROFESSIONAL",
        subtitle: "For full-service dining, hotels & boutique resorts",
        priceMonthly: 2000,
        priceAnnual: 20000,
        currency: "NPR",
        isPopular: true,
        limits: {
          tables: 100,
          staff: 30,
          branches: 5,
          rooms: 50,
        },
      },
      {
        id: "Enterprise",
        name: "Enterprise",
        tier: "ENTERPRISE",
        subtitle: "For multi-property hotel chains & luxury resort networks",
        priceMonthly: 0,
        priceAnnual: 0,
        currency: "NPR",
        isCustomPrice: true,
        isPopular: false,
        limits: {
          tables: 999,
          staff: 999,
          branches: 99,
          rooms: 999,
        },
      },
    ];

    // Feature Matrix configuration matching Screenshot 2 for hospitality
    const defaultFeatureMatrix = settings.featureMatrix || [
      {
        category: "Core POS & Dining Operations",
        features: [
          { name: "Fast POS Billing & Table Orders", basic: true, standard: true, professional: true, enterprise: true },
          { name: "Split Billing & Partial Payments", basic: true, standard: true, professional: true, enterprise: true },
          { name: "Visual Floor Plan & Table Management", basic: true, standard: true, professional: true, enterprise: true },
          { name: "Recipe Management & Dish Modifiers", basic: false, standard: true, professional: true, enterprise: true },
        ],
      },
      {
        category: "Hotel & Stays Operations",
        features: [
          { name: "Room Reservation Tape Chart Grid", basic: false, standard: true, professional: true, enterprise: true },
          { name: "Guest Folios & Direct Invoicing", basic: false, standard: true, professional: true, enterprise: true },
          { name: "Housekeeping & Room Cleanliness Tracking", basic: false, standard: false, professional: true, enterprise: true },
          { name: "Guest QR Portal & Room Service Ordering", basic: false, standard: false, professional: true, enterprise: true },
        ],
      },
      {
        category: "Kitchen & Inventory Control",
        features: [
          { name: "Kitchen Display Stations (KDS) & Route Dispatch", basic: false, standard: true, professional: true, enterprise: true },
          { name: "Stock Batches & Expiry Date Alerts", basic: false, standard: false, professional: true, enterprise: true },
          { name: "Automatic Ingredient Deduction on Order", basic: false, standard: false, professional: true, enterprise: true },
          { name: "Purchase Orders & Supplier Invoicing", basic: false, standard: false, professional: true, enterprise: true },
        ],
      },
      {
        category: "Billing, Fiscal & Government Compliance",
        features: [
          { name: "Nepal IRD / CBMS Real-Time Sync", basic: true, standard: true, professional: true, enterprise: true },
          { name: "Multi-Currency & Exchange Rate Engine", basic: false, standard: true, professional: true, enterprise: true },
          { name: "Automated VAT (13%) & Service Charge (10%)", basic: true, standard: true, professional: true, enterprise: true },
        ],
      },
      {
        category: "Multi-Branch & Governance",
        features: [
          { name: "Multi-Branch Centralized Sync", basic: false, standard: false, professional: true, enterprise: true },
          { name: "Granular Role Permissions (RBAC)", basic: false, standard: true, professional: true, enterprise: true },
          { name: "Platform Audit Log & Security Events", basic: false, standard: false, professional: true, enterprise: true },
          { name: "Dedicated API & Custom Webhooks", basic: false, standard: false, professional: false, enterprise: true },
        ],
      },
    ];

    const globalSettings = settings.globalSettings || {
      defaultCurrency: "NPR",
      trialPeriodDays: 14,
      gracePeriodDays: 7,
      taxRate: 13,
      autoInvoice: true,
    };

    // 2. Fetch all real businesses with subscription, branches, users, and tables
    const businesses = await db.business.findMany({
      where: {
        slug: { not: "platform-admin" },
        deletedAt: null,
      },
      include: {
        subscription: true,
        branches: {
          select: { id: true, name: true, address: true },
        },
        users: {
          select: { id: true, role: true, isActive: true },
        },
        restaurantTables: {
          select: { id: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const now = new Date();
    const sevenDaysFromNow = new Date();
    sevenDaysFromNow.setDate(now.getDate() + 7);

    // Format subscriptions for the table
    const subscriptions = businesses.map((b) => {
      const sub = b.subscription;
      const planName = sub?.plan || "Professional";
      const billingCycle = sub?.billingCycle || "MONTHLY";
      
      // Determine plan object
      const matchedPlan = defaultPlans.find(
        (p: any) => p.name.toLowerCase() === planName.toLowerCase() || p.id.toLowerCase() === planName.toLowerCase()
      ) || defaultPlans[2];

      const amount = billingCycle === "ANNUAL" ? matchedPlan.priceAnnual : matchedPlan.priceMonthly;
      const endDate = sub?.endDate ? new Date(sub.endDate) : new Date(now.getTime() + 180 * 24 * 60 * 60 * 1000);
      
      const isExpired = endDate < now;
      const isExpiringSoon = !isExpired && endDate <= sevenDaysFromNow;
      
      let status = sub?.status || "ACTIVE";
      if (isExpired) status = "EXPIRED";
      else if (isExpiringSoon) status = "EXPIRING_SOON";

      const tablesUsed = b.restaurantTables?.length ?? 0;
      const tableLimit = matchedPlan.limits?.tables || 50;

      const staffUsed = b.users?.length ?? 0;
      const staffLimit = matchedPlan.limits?.staff || 15;

      const paymentStatus = isExpired ? "UNPAID" : "PAID";

      return {
        id: sub?.id || `sub_${b.id}`,
        businessId: b.id,
        businessName: b.name,
        businessSlug: b.slug,
        businessLocation: b.branches[0]?.address || b.address || "Nepal",
        plan: matchedPlan.name,
        billingCycle: billingCycle === "ANNUAL" ? "Annual" : "Monthly",
        tablesUsed,
        tableLimit,
        staffUsed,
        staffLimit,
        amount,
        nextRenewal: endDate.toISOString(),
        paymentStatus,
        status,
        createdAt: b.createdAt.toISOString(),
      };
    });

    // Filtering
    let filtered = subscriptions;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      filtered = filtered.filter(
        (s) =>
          s.businessName.toLowerCase().includes(q) ||
          s.businessLocation.toLowerCase().includes(q) ||
          s.plan.toLowerCase().includes(q)
      );
    }
    if (planFilter !== "ALL") {
      filtered = filtered.filter((s) => s.plan.toUpperCase() === planFilter.toUpperCase());
    }
    if (statusFilter !== "ALL") {
      filtered = filtered.filter((s) => s.status.toUpperCase() === statusFilter.toUpperCase());
    }
    if (cycleFilter !== "ALL") {
      filtered = filtered.filter((s) => s.billingCycle.toUpperCase() === cycleFilter.toUpperCase());
    }

    // 3. Compute KPI metrics
    const totalActive = subscriptions.filter((s) => s.status === "ACTIVE" || s.status === "EXPIRING_SOON").length;
    const expiring7Days = subscriptions.filter((s) => s.status === "EXPIRING_SOON").length;
    const mrr = subscriptions.reduce((sum, s) => {
      const monthlyVal = s.billingCycle === "Annual" ? s.amount / 12 : s.amount;
      return sum + (s.status !== "EXPIRED" && s.status !== "CANCELLED" ? monthlyVal : 0);
    }, 0);
    const overdueCount = subscriptions.filter((s) => s.paymentStatus === "UNPAID" || s.status === "EXPIRED").length;
    const renewalRate =
      subscriptions.length > 0 ? Math.round((totalActive / subscriptions.length) * 1000) / 10 : 0;

    // 4. Plan distribution for Donut Chart
    const planCounts: Record<string, number> = {
      Starter: 0,
      Standard: 0,
      Professional: 0,
      Enterprise: 0,
    };
    subscriptions.forEach((s) => {
      if (planCounts[s.plan] !== undefined) {
        planCounts[s.plan]++;
      } else {
        planCounts["Professional"]++;
      }
    });

    const totalSubs = subscriptions.length || 1;
    const planDistribution = [
      { name: "Starter", count: planCounts.Starter, percentage: Math.round((planCounts.Starter / totalSubs) * 100), color: "#3B82F6" },
      { name: "Standard", count: planCounts.Standard, percentage: Math.round((planCounts.Standard / totalSubs) * 100), color: "#10B981" },
      { name: "Professional", count: planCounts.Professional, percentage: Math.round((planCounts.Professional / totalSubs) * 100), color: "#6B2837" },
      { name: "Enterprise", count: planCounts.Enterprise, percentage: Math.round((planCounts.Enterprise / totalSubs) * 100), color: "#F59E0B" },
    ];

    // 5. Real recent billing activities from SubscriptionInvoice
    const recentInvoices = await db.subscriptionInvoice.findMany({
      orderBy: { createdAt: "desc" },
      take: 5,
      include: { business: { select: { name: true } } },
    });

    const recentActivity = recentInvoices.map((inv) => ({
      id: inv.id,
      type: inv.status === "PAID" ? "PAYMENT_RECEIVED" : "INVOICE_GENERATED",
      title:
        inv.status === "PAID"
          ? `Payment received from ${inv.business?.name || "Tenant"}`
          : `Invoice generated for ${inv.business?.name || "Tenant"}`,
      amount: Number(inv.amount || 0),
      currency: inv.currency || "NPR",
      date: (inv.paidAt || inv.createdAt).toISOString(),
      invoiceNumber: inv.invoiceNumber,
    }));

    // 6. Real monthly revenue trend (last 5 months from SubscriptionPayment)
    const fiveMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 4, 1);
    const recentPayments = await db.subscriptionPayment.findMany({
      where: { recordedAt: { gte: fiveMonthsAgo } },
      select: { amount: true, recordedAt: true },
    });

    const monthShort = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const revenueTrend = Array.from({ length: 5 }, (_, idx) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (4 - idx), 1);
      const y = d.getFullYear();
      const m = d.getMonth();
      const revenue = recentPayments
        .filter((p) => {
          const pd = new Date(p.recordedAt);
          return pd.getFullYear() === y && pd.getMonth() === m;
        })
        .reduce((acc, p) => acc + Number(p.amount || 0), 0);
      return { month: `${monthShort[m]} ${String(y).slice(-2)}`, revenue };
    });

    return NextResponse.json({
      subscriptions: filtered,
      kpis: {
        totalActive,
        expiring7Days,
        mrr,
        overdueCount,
        renewalRate,
      },
      plans: defaultPlans,
      featureMatrix: defaultFeatureMatrix,
      globalSettings,
      planDistribution,
      recentActivity,
      revenueTrend,
    });
  } catch (error: any) {
    console.error("GET subscriptions error:", error);
    return NextResponse.json({ error: "Failed to load subscriptions" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const context = await getSessionContext();
  if (!context) return authErrorResponse();
  if (context.role !== "SUPER_ADMIN") return roleErrorResponse();

  try {
    const body = await request.json();
    const { action, plan, plans, featureMatrix, globalSettings, businessId, billingCycle, durationMonths } = body;

    // 1. ADD / ASSIGN / RENEW SUBSCRIPTION FOR BUSINESS
    if (action === "RENEW_SUBSCRIPTION" || action === "ASSIGN_PLAN") {
      if (!businessId) {
        return NextResponse.json({ error: "Target business ID is required" }, { status: 400 });
      }

      const months = durationMonths || (billingCycle === "ANNUAL" ? 12 : 1);
      const newEndDate = new Date();
      newEndDate.setMonth(newEndDate.getMonth() + months);

      const sub = await db.subscription.upsert({
        where: { businessId },
        update: {
          plan: plan || "Professional",
          billingCycle: billingCycle || "MONTHLY",
          status: "ACTIVE",
          endDate: newEndDate,
        },
        create: {
          businessId,
          plan: plan || "Professional",
          billingCycle: billingCycle || "MONTHLY",
          status: "ACTIVE",
          startDate: new Date(),
          endDate: newEndDate,
        },
      });

      await logPlatformAudit({
        actorId: context.userId,
        actorRole: context.role,
        action: "RENEW_SUBSCRIPTION",
        targetType: "SUBSCRIPTION",
        targetId: sub.id,
        businessId,
        reason: `Assigned or renewed plan ${plan} for business ${businessId} until ${newEndDate.toDateString()}`,
        beforeState: null,
        afterState: sub,
      });

      return NextResponse.json({ message: "Subscription updated successfully", endDate: newEndDate.toISOString() });
    }

    // Load current config
    const currentRecord = await db.platformSetting.findUnique({
      where: { key: "SUBSCRIPTION_CONFIG" },
    });
    const currentSettings = (currentRecord?.value as any) || {};

    // 2. UPDATE PLANS CONFIGURATION
    if (action === "UPDATE_PLANS" || action === "CREATE_PLAN") {
      let updatedPlans = [...(currentSettings.plans || DEFAULT_SUBSCRIPTION_PLANS)];
      if (plan) {
        const index = updatedPlans.findIndex((p: any) => p.id === plan.id || p.name === plan.name);
        if (index >= 0) {
          updatedPlans[index] = { ...updatedPlans[index], ...plan };
        } else {
          updatedPlans.push({ ...plan, id: plan.name.toLowerCase().replace(/\s+/g, "-") });
        }
      } else if (plans) {
        updatedPlans = plans;
      }

      const newSettings = { ...currentSettings, plans: updatedPlans };
      await db.platformSetting.upsert({
        where: { key: "SUBSCRIPTION_CONFIG" },
        update: { value: newSettings },
        create: {
          key: "SUBSCRIPTION_CONFIG",
          value: newSettings,
          category: "SUBSCRIPTION",
          description: "Platform subscription plan configurations",
        },
      });

      await logPlatformAudit({
        actorId: context.userId,
        actorRole: context.role,
        action: "UPDATE_SUBSCRIPTION_PLANS",
        targetType: "SYSTEM",
        reason: "Updated subscription plan pricing or tiers",
        beforeState: currentSettings.plans,
        afterState: updatedPlans,
      });

      return NextResponse.json({ message: "Subscription plans saved successfully" });
    }

    // 3. UPDATE FEATURE MATRIX
    if (action === "UPDATE_FEATURE_MATRIX") {
      const newSettings = { ...currentSettings, featureMatrix: featureMatrix };
      await db.platformSetting.upsert({
        where: { key: "SUBSCRIPTION_CONFIG" },
        update: { value: newSettings },
        create: {
          key: "SUBSCRIPTION_CONFIG",
          value: newSettings,
          category: "SUBSCRIPTION",
          description: "Platform feature matrix by subscription tier",
        },
      });

      await logPlatformAudit({
        actorId: context.userId,
        actorRole: context.role,
        action: "UPDATE_FEATURE_MATRIX",
        targetType: "SYSTEM",
        reason: "Updated platform feature matrix by subscription tier",
        beforeState: currentSettings.featureMatrix,
        afterState: featureMatrix,
      });

      return NextResponse.json({ message: "Feature matrix saved successfully" });
    }

    // 4. UPDATE GLOBAL SETTINGS
    if (action === "UPDATE_GLOBAL_SETTINGS") {
      const newSettings = { ...currentSettings, globalSettings: globalSettings };
      await db.platformSetting.upsert({
        where: { key: "SUBSCRIPTION_CONFIG" },
        update: { value: newSettings },
        create: {
          key: "SUBSCRIPTION_CONFIG",
          value: newSettings,
          category: "SUBSCRIPTION",
          description: "Platform global subscription currency, trial, and grace period settings",
        },
      });

      await logPlatformAudit({
        actorId: context.userId,
        actorRole: context.role,
        action: "UPDATE_SUBSCRIPTION_GLOBAL_SETTINGS",
        targetType: "SYSTEM",
        reason: "Updated subscription global currency, trial, and grace period settings",
        beforeState: currentSettings.globalSettings,
        afterState: globalSettings,
      });

      return NextResponse.json({ message: "Global settings saved successfully" });
    }

    // Fallback: Legacy save
    const newSettings = {
      ...currentSettings,
      plans: body.plans || currentSettings.plans,
      features: body.features || currentSettings.features,
      limits: body.limits || currentSettings.limits,
      currencies: body.currencies || currentSettings.currencies,
    };

    await db.platformSetting.upsert({
      where: { key: "SUBSCRIPTION_CONFIG" },
      update: { value: newSettings },
      create: {
        key: "SUBSCRIPTION_CONFIG",
        value: newSettings,
        category: "SUBSCRIPTION",
        description: "Platform subscription settings",
      },
    });

    return NextResponse.json({ message: "Subscription configurations updated successfully" });

    return NextResponse.json({ message: "Subscription configurations updated successfully" });
  } catch (error: any) {
    console.error("POST subscriptions error:", error);
    return NextResponse.json({ error: safeErrorMessage(error, "Failed to save subscription configuration") }, { status: 500 });
  }
}
