import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionContext, authErrorResponse, roleErrorResponse } from "@/lib/api-helper";

// We mock or retrieve platform-wide metadata settings stored in the platform-admin business
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

    // Baseline features if not configured in DB settings
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

    // Baseline limits if not configured in DB settings
    const defaultLimits = settings.limits || {
      Starter: { users: 1, branches: 1, products: 100, categories: 10, printing: false, dailyReportsOnly: true },
      Professional: { users: 5, branches: 2, products: 1000, categories: 999999, printing: true, dailyReportsOnly: false },
      Enterprise: { users: 20, branches: 5, products: 999999, categories: 999999, printing: true, dailyReportsOnly: false },
    };

    // Baseline plans if not configured in DB settings
    const defaultPlans = settings.plans || [
      { id: "Starter", name: "Starter", price: 499, setupPrice: 4999, currency: "NPR", duration: "1 Month", desc: "Perfect for single-terminal independent shops" },
      { id: "Professional", name: "Professional", price: 999, setupPrice: 11999, currency: "NPR", duration: "1 Month", desc: "For growing local retail shops" },
      { id: "Enterprise", name: "Enterprise", price: 1499, setupPrice: 24999, currency: "NPR", duration: "1 Month", desc: "For multi-branch retail stores" },
    ];

    // Baseline currencies
    const defaultCurrencies = settings.currencies || [
      { code: "NPR", name: "Nepalese Rupee", symbol: "Rs.", allowed: true },
      { code: "USD", name: "US Dollar", symbol: "$", allowed: true },
      { code: "INR", name: "Indian Rupee", symbol: "₹", allowed: true },
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
