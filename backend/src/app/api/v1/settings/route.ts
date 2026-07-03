import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionContext, authErrorResponse, roleErrorResponse } from "@/lib/api-helper";
import { z } from "zod";

const settingsSchema = z.object({
  name: z.string().min(2, "Business name must be at least 2 characters"),
  phone: z.string().optional().nullable(),
  email: z.string().email("Invalid email address").optional().nullable().or(z.literal("")),
  address: z.string().optional().nullable(),
  currency: z.string().min(1, "Currency is required"),
  taxName: z.string().min(1, "Tax name is required (e.g. VAT, GST)"),
  taxRate: z.number().min(0, "Tax rate cannot be negative").max(100, "Tax rate cannot exceed 100%"),
  
  // New configuration options
  businessType: z.string().optional().nullable(),
  ownerName: z.string().optional().nullable(),
  registrationNumber: z.string().optional().nullable(),
  website: z.string().optional().nullable(),
  invoiceLogo: z.string().optional().nullable(),
  receiptLogo: z.string().optional().nullable(),
  panNumber: z.string().optional().nullable(),
  vatNumber: z.string().optional().nullable(),
  taxRegDetails: z.string().optional().nullable(),
  taxStatus: z.string().optional().nullable(),
  currencySymbol: z.string().optional().nullable(),
  decimalPrecision: z.number().int().min(0).max(4).optional().default(2),
  fiscalYearStart: z.string().optional().nullable(),
  fiscalYearEnd: z.string().optional().nullable(),
  nepaliFiscalYear: z.boolean().optional().default(false),
  datePreference: z.string().optional().default("AD"),
  invoicePrefix: z.string().optional().nullable(),
  purchasePrefix: z.string().optional().nullable(),
  salesPrefix: z.string().optional().nullable(),
  returnPrefix: z.string().optional().nullable(),
  autoNumberGen: z.boolean().optional().default(true),
  enableVat: z.boolean().optional().default(true),
  vatPercentage: z.number().min(0).max(100).optional().default(13),
  pricingType: z.enum(["INCLUSIVE", "EXCLUSIVE"]).optional().default("EXCLUSIVE"),
  taxSlabs: z.array(z.number()).optional().default([]),
  defaultWalkIn: z.boolean().optional().default(true),
  defaultPaymentMethod: z.string().optional().default("CASH"),
  defaultCreditLimit: z.number().nonnegative().optional().default(0),
  defaultDiscount: z.number().nonnegative().optional().default(0),
  printerType: z.string().optional().default("THERMAL"),
  receiptWidth: z.string().optional().default("80mm"),
  autoPrint: z.boolean().optional().default(false),
  barcodeFormat: z.string().optional().default("CODE128"),
  barcodeLength: z.number().int().positive().optional().default(12),
  barcodePrefix: z.string().optional().nullable(),
  autoBarcodeGen: z.boolean().optional().default(true),
});

export async function GET() {
  const context = await getSessionContext();
  if (!context) return authErrorResponse();

  try {
    const business = await db.business.findUnique({
      where: { id: context.businessId },
      select: {
        id: true,
        name: true,
        slug: true,
        logo: true,
        phone: true,
        email: true,
        address: true,
        currency: true,
        taxConfig: true,
        settings: true,
      },
    });

    if (!business) {
      return NextResponse.json({ error: "Business profile not found" }, { status: 404 });
    }

    return NextResponse.json(business);
  } catch (error: any) {
    console.error("GET business settings error:", error);
    return NextResponse.json({ error: "Failed to fetch settings" }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  const context = await getSessionContext();
  if (!context) return authErrorResponse();

  const headers = request.headers;
  const xForwardedFor = headers.get("x-forwarded-for");
  const ipAddress = xForwardedFor ? xForwardedFor.split(",")[0].trim() : (headers.get("x-real-ip") || "127.0.0.1");
  const deviceInfo = headers.get("user-agent") || "Unknown Device";

  // Settings are typically restricted to Owner or Super Admin or Manager
  if (context.role !== "OWNER" && context.role !== "SUPER_ADMIN" && context.role !== "MANAGER") {
    return roleErrorResponse();
  }

  try {
    const body = await request.json();
    const result = settingsSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: "Validation failed", details: result.error.format() },
        { status: 400 }
      );
    }

    const { name, phone, email, address, currency, taxName, taxRate, ...metaSettings } = result.data;

    const updatedBusiness = await db.business.update({
      where: { id: context.businessId },
      data: {
        name,
        phone: phone || null,
        email: email || null,
        address: address || null,
        currency,
        taxConfig: { taxName, rate: taxRate },
        settings: metaSettings as any,
      },
    });

    // Write audit log
    await db.auditLog.create({
      data: {
        businessId: context.businessId,
        userId: context.userId,
        role: context.role,
        action: "UPDATE",
        module: "SETTINGS",
        details: `Updated store settings. Currency set to "${currency}", tax rule set to "${taxName} (${taxRate}%)".`,
        newValue: JSON.parse(JSON.stringify(updatedBusiness)),
        ipAddress,
        deviceInfo,
      },
    });

    return NextResponse.json(updatedBusiness);
  } catch (error: any) {
    console.error("PUT business settings error:", error);
    return NextResponse.json({ error: "Failed to update settings" }, { status: 500 });
  }
}
