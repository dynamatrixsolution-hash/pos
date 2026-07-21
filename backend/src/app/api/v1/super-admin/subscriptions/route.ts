import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionContext, authErrorResponse, roleErrorResponse } from "@/lib/api-helper";

export async function GET(request: Request) {
  const context = await getSessionContext();
  if (!context) return authErrorResponse();
  if (context.role !== "SUPER_ADMIN") return roleErrorResponse();

  try {
    const platform = await db.business.findUnique({
      where: { slug: "platform-admin" },
      select: { settings: true },
    });

    const settings = (platform?.settings as any) || {};

    const defaultFeatures = settings.features || {
      "POS Billing": true,
      "Products": true,
      "Inventory": true,
      "Purchases": true,
      "Customers": true,
      "Suppliers": true,
      "Reports": true,
      "Full Reports": true,
      "Printing": true,
      "Expenses": true,
      "Payments": true,
      "Multi Branch": true,
      "Warehouses": true,
      "Device Control": true,
      "Activity Logs": true,
      "Barcode": true,
      "Batch Tracking": true,
      "Expiry Tracking": true,
      "API Access": true,
      "Backup System": true,
    };

    const defaultLimits = settings.limits || {
      Starter: { users: 1, branches: 1, products: 100, categories: 10, printing: false, dailyReportsOnly: true },
      Professional: { users: 5, branches: 2, products: 1000, categories: 0, printing: true, dailyReportsOnly: false },
      Enterprise: { users: 10, branches: 5, products: 0, categories: 0, printing: true, dailyReportsOnly: false },
    };

    const defaultPlans = settings.plans || [
      {
        id: "Starter",
        name: "Starter Plan",
        price: 499,
        setupPrice: 4999,
        currency: "NPR",
        duration: "1 Month",
        desc: "Up to 100 products, 1 branch, 1 user, Max 10 categories, Daily reports only, No printing",
      },
      {
        id: "Professional",
        name: "Professional Plan",
        price: 999,
        setupPrice: 11999,
        currency: "NPR",
        duration: "1 Month",
        desc: "Up to 1,000 products, 2 branches, 5 users (1 owner, 4 staff), Receipt printing, Full reports, Unlimited categories",
      },
      {
        id: "Enterprise",
        name: "Enterprise Plan",
        price: 1499,
        setupPrice: 24999,
        currency: "NPR",
        duration: "1 Month",
        desc: "Unlimited products, 5 branches, 10 users (1 owner, 9 staff), Receipt printing, Full reports, Unlimited categories",
      },
    ];

    const defaultCurrencies = settings.currencies || [
      { code: "NPR", name: "Nepalese Rupee", symbol: "Rs.", allowed: true },
      { code: "INR", name: "Indian Rupee", symbol: "₹", allowed: true },
      { code: "USD", name: "US Dollar", symbol: "$", allowed: true },
      { code: "AUD", name: "Australian Dollar", symbol: "A$", allowed: false },
      { code: "GBP", name: "British Pound", symbol: "£", allowed: false },
      { code: "EUR", name: "Euro", symbol: "€", allowed: false },
    ];

    return NextResponse.json({
      plans: defaultPlans,
      features: defaultFeatures,
      limits: defaultLimits,
      currencies: defaultCurrencies,
    });
  } catch (error: any) {
    console.error("GET subscriptions config error:", error);
    return NextResponse.json({ error: "Failed to load subscription configuration" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const context = await getSessionContext();
  if (!context) return authErrorResponse();
  if (context.role !== "SUPER_ADMIN") return roleErrorResponse();

  try {
    const body = await request.json();
    const { plans, features, limits, currencies } = body;

    const platform = await db.business.findUnique({
      where: { slug: "platform-admin" },
    });

    if (!platform) {
      return NextResponse.json({ error: "Platform configuration record not found" }, { status: 404 });
    }

    const currentSettings = (platform.settings as any) || {};
    const newSettings = {
      ...currentSettings,
      plans: plans || currentSettings.plans,
      features: features || currentSettings.features,
      limits: limits || currentSettings.limits,
      currencies: currencies || currentSettings.currencies,
    };

    await db.business.update({
      where: { id: platform.id },
      data: { settings: newSettings },
    });

    await db.auditLog.create({
      data: {
        businessId: context.businessId,
        userId: context.userId,
        role: context.role,
        action: "UPDATE_SUBSCRIPTION_CONFIG",
        module: "SUPER_ADMIN",
        details: "Updated platform plan profiles, feature toggles, limits, or allowed currencies",
      },
    });

    return NextResponse.json({ message: "Subscription configurations updated successfully" });
  } catch (error: any) {
    console.error("POST subscriptions config error:", error);
    return NextResponse.json({ error: "Failed to save subscription configuration" }, { status: 500 });
  }
}
