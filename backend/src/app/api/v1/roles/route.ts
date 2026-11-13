import { NextResponse } from "next/server";
import { getSessionContext, authErrorResponse } from "@/lib/api-helper";
import { db } from "@/lib/db";
import { z } from "zod";

const SYSTEM_ROLES = [
  {
    id: "role-owner",
    name: "OWNER",
    description: "Full administrative access to business operations, financials, users, and store configuration.",
    permissions: ["*"],
    isSystem: true,
  },
  {
    id: "role-manager",
    name: "MANAGER",
    description: "Store operations, staff oversight, price checks, inventory adjustments, and reports.",
    permissions: [
      "sales:read", "sales:create", "sales:cancel",
      "purchases:read", "purchases:create",
      "inventory:read", "inventory:adjust",
      "restaurant:all", "hotel:all",
      "reports:read", "customers:all", "suppliers:all"
    ],
    isSystem: true,
  },
  {
    id: "role-cashier",
    name: "CASHIER",
    description: "Front-desk POS point of sale, order creation, receipt printing, and payment collection.",
    permissions: [
      "pos:access", "sales:create", "sales:read",
      "customers:read", "customers:create",
      "restaurant:orders", "payments:create"
    ],
    isSystem: true,
  },
  {
    id: "role-accountant",
    name: "ACCOUNTANT",
    description: "Financial books, double-entry ledger, daybook, tax/VAT reports, and expense vouchers.",
    permissions: [
      "reports:read", "ledger:read", "expenses:all",
      "income:all", "compliance:read", "sales:read", "purchases:read"
    ],
    isSystem: true,
  },
  {
    id: "role-storekeeper",
    name: "STOREKEEPER",
    description: "Warehouse stock management, stock transfers, batch tracking, and opening inventory.",
    permissions: [
      "inventory:read", "inventory:adjust", "inventory:transfer",
      "purchases:read", "products:read"
    ],
    isSystem: true,
  },
  {
    id: "role-salesperson",
    name: "SALESPERSON",
    description: "Direct customer interaction, sales quote generation, and product catalog browsing.",
    permissions: [
      "pos:access", "products:read", "customers:all", "sales:create"
    ],
    isSystem: true,
  },
  {
    id: "role-delivery",
    name: "DELIVERY",
    description: "Dispatch tracking, customer delivery fulfillment, and order status updates.",
    permissions: [
      "delivery:read", "delivery:update", "restaurant:orders:read"
    ],
    isSystem: true,
  },
];

const roleSchema = z.object({
  name: z.string().min(2, "Role name must be at least 2 characters"),
  description: z.string().optional(),
  permissions: z.array(z.string()).default([]),
});

export async function GET(req: Request) {
  try {
    const session = await getSessionContext();
    if (!session) return authErrorResponse();

    const business = await db.business.findUnique({
      where: { id: session.businessId },
      select: { settings: true },
    });

    const settings = (business?.settings as any) || {};
    const customRoles = Array.isArray(settings.customRoles) ? settings.customRoles : [];

    const allRoles = [...SYSTEM_ROLES, ...customRoles];

    return NextResponse.json({
      roles: allRoles,
    });
  } catch (error: any) {
    console.error("GET /roles error:", error);
    return NextResponse.json({ error: "Failed to fetch roles" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await getSessionContext();
    if (!session) return authErrorResponse();

    const OWNER_ROLES = ["SUPER_ADMIN", "OWNER"];
    if (!OWNER_ROLES.includes(session.role)) {
      return NextResponse.json({ error: "Only owners can create custom roles" }, { status: 403 });
    }

    const body = await req.json();
    const parsed = roleSchema.parse(body);

    const business = await db.business.findUnique({
      where: { id: session.businessId },
    });

    if (!business) return NextResponse.json({ error: "Business not found" }, { status: 404 });

    const settings = (business.settings as any) || {};
    const customRoles = Array.isArray(settings.customRoles) ? [...settings.customRoles] : [];

    const normalizedName = parsed.name.trim().toUpperCase();
    if (
      SYSTEM_ROLES.some((r) => r.name === normalizedName) ||
      customRoles.some((r: any) => r.name === normalizedName)
    ) {
      return NextResponse.json({ error: "A role with this name already exists" }, { status: 400 });
    }

    const newRole = {
      id: `custom-role-${Date.now()}`,
      name: normalizedName,
      description: parsed.description || "",
      permissions: parsed.permissions,
      isSystem: false,
      createdAt: new Date().toISOString(),
    };

    customRoles.push(newRole);

    await db.business.update({
      where: { id: session.businessId },
      data: {
        settings: {
          ...settings,
          customRoles,
        },
      },
    });

    return NextResponse.json({ success: true, role: newRole }, { status: 201 });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message || "Validation failed" }, { status: 400 });
    }
    console.error("POST /roles error:", error);
    return NextResponse.json({ error: "Failed to create role" }, { status: 500 });
  }
}

