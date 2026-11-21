import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionContext, authErrorResponse } from "@/lib/api-helper";

export async function GET() {
  const context = await getSessionContext();
  if (!context) return authErrorResponse();

  const { businessId, role: userRole, branchId: userBranchId } = context;
  const OWNER_ROLES = ["SUPER_ADMIN", "OWNER"];
  const isOwner = OWNER_ROLES.includes(userRole);

  try {
    const branchWhere: any = {
      businessId,
      deletedAt: null,
    };
    if (!isOwner && userBranchId) {
      branchWhere.id = userBranchId;
    }

    // 1. Parallelize independent layout context queries
    const [branches, dbNotifications, subscription, business, platform] = await Promise.all([
      db.branch.findMany({
        where: branchWhere,
        select: {
          id: true,
          name: true,
          isMain: true,
        },
        orderBy: { name: "asc" },
      }),
      db.notification.findMany({
        where: {
          businessId,
          isRead: false,
        },
        orderBy: { createdAt: "desc" },
        take: 5,
      }),
      db.subscription.findUnique({
        where: { businessId },
        select: {
          plan: true,
          endDate: true,
          status: true,
          packageType: true,
          enabledModules: true,
          billingCycle: true,
        },
      }),
      db.business.findUnique({
        where: { id: businessId },
        select: { settings: true },
      }),
      db.business.findUnique({
        where: { slug: "platform-admin" },
        select: { settings: true },
      }),
    ]);

    // Calculate active branch ID for low stock lookup
    const activeBranchId = userBranchId || branches.find((b) => b.isMain)?.id || branches[0]?.id || null;

    // 2. Retrieve bounded product projection for low-stock alerts
    const products = await db.product.findMany({
      where: {
        businessId,
        deletedAt: null,
      },
      select: {
        id: true,
        name: true,
        alertQuantity: true,
        unit: { select: { name: true } },
        productStocks: activeBranchId
          ? { where: { branchId: activeBranchId }, select: { quantity: true } }
          : { select: { quantity: true } },
      },
      take: 500,
    });

    const lowStockNotifications = products
      .map((prod) => {
        const currentStock = prod.productStocks.reduce((sum, s) => sum + s.quantity, 0);
        return {
          id: prod.id,
          name: prod.name,
          currentStock,
          alertQuantity: prod.alertQuantity,
          unit: prod.unit?.name || "Pcs",
        };
      })
      .filter((prod) => prod.currentStock <= prod.alertQuantity)
      .slice(0, 20)
      .map((alert) => ({
        id: `low-stock-${alert.id}`,
        title: "Low Stock Alert",
        message: `${alert.name} is down to ${alert.currentStock} ${alert.unit} (Min: ${alert.alertQuantity})`,
        type: "STOCK",
        isRead: false,
        createdAt: new Date(),
      }));

    const initialNotifications = [...lowStockNotifications, ...dbNotifications];

    const settings = (business?.settings as any) || {};
    const platformSettings = (platform?.settings as any) || {};
    const currentPlanName = subscription?.plan || "FREE_TRIAL";

    // Helper functions for features
    const normalizePlan = (name: string) => {
      const val = name.toLowerCase().replace(/[^a-z0-9]/g, "");
      if (val.includes("trial") || val.includes("free") || val === "basic" || val === "starter") return "starter";
      if (val.includes("pro") || val.includes("professional")) return "professional";
      if (val.includes("enterprise") || val.includes("scaling")) return "enterprise";
      if (val.includes("business")) return "business";
      return val;
    };

    const getDefaultFeatures = (planName: string) => {
      const p = normalizePlan(planName);
      if (p === "starter") {
        return {
          "POS Billing": true,
          "Products": true,
          "Customers": true,
          "Reports": true,
          "Full Reports": false,
          "Printing": false,
          "Inventory": true,
          "Purchases": true,
          "Suppliers": true,
          "Expenses": true,
          "Payments": true,
          "Multi Branch": false,
          "Warehouses": false,
          "Device Control": false,
          "Activity Logs": false,
          "Barcode": false,
          "Batch Tracking": false,
          "Expiry Tracking": false,
          "API Access": false,
          "Backup System": false,
        };
      }
      if (p === "professional") {
        return {
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
          "API Access": false,
          "Backup System": true,
        };
      }
      return {
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
    };

    const plans = platformSettings.plans || [];
    const matchingPlan = plans.find((p: any) => {
      const pId = normalizePlan(p.id || "");
      const pName = normalizePlan(p.name || "");
      const sPlan = normalizePlan(currentPlanName);
      return pId === sPlan || pName === sPlan;
    });

    const baseFeatures = (matchingPlan?.features && Object.keys(matchingPlan.features).length > 0)
      ? matchingPlan.features
      : getDefaultFeatures(currentPlanName);

    const customFeatures = settings.customFeatures || {};
    const mergedFeatures: Record<string, boolean> = {
      ...baseFeatures,
      ...customFeatures,
    };

    // Reflect Super Admin module entitlements immediately when configured (supports both key conventions)
    const enabledModules = Array.isArray(subscription?.enabledModules) ? subscription.enabledModules : [];
    if (enabledModules.length > 0) {
      const hasAny = (...keys: string[]) => keys.some((k) => enabledModules.includes(k));
      mergedFeatures["RESTAURANT_POS"] = hasAny("RESTAURANT_POS", "POS", "TABLES");
      mergedFeatures["KITCHEN_KDS"] = hasAny("KITCHEN_KDS", "KDS");
      mergedFeatures["HOTEL_ROOMS"] = hasAny("HOTEL_ROOMS", "ROOMS", "RESERVATIONS", "HOUSEKEEPING");
      mergedFeatures["HOTEL_FOLIOS"] = hasAny("HOTEL_FOLIOS", "FOLIOS", "ROOM_SERVICE");
      mergedFeatures["GUEST_QR_PORTAL"] = hasAny("GUEST_QR_PORTAL", "MENU", "TABLES");
      mergedFeatures["INVENTORY_RECIPES"] = hasAny("INVENTORY_RECIPES", "POS", "MENU");
      mergedFeatures["IRD_FISCAL_COMPLIANCE"] = hasAny("IRD_FISCAL_COMPLIANCE", "POS");
      mergedFeatures["__hasModuleEntitlements"] = true;
    }

    return NextResponse.json({
      branches,
      initialNotifications,
      subscription,
      features: mergedFeatures,
    });
  } catch (error: any) {
    console.error("GET layout context error:", error);
    return NextResponse.json({ error: "Failed to fetch layout context" }, { status: 500 });
  }
}
