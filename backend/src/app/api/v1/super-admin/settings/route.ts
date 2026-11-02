import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionContext, authErrorResponse, roleErrorResponse } from "@/lib/api-helper";
import { logPlatformAudit } from "@/lib/platform-audit";

// GET /api/v1/super-admin/settings
export async function GET() {
  const context = await getSessionContext();
  if (!context) return authErrorResponse();
  if (context.role !== "SUPER_ADMIN") return roleErrorResponse();

  try {
    const records = await db.platformSetting.findMany({
      orderBy: { key: "asc" },
    });

    const settingsMap: Record<string, any> = {};
    for (const r of records) {
      settingsMap[r.key] = r.value;
    }

    // Default fallbacks if keys not found
    const result = {
      GENERAL_CONFIG: settingsMap.GENERAL_CONFIG || {
        platformName: "RestroInn Platform",
        supportEmail: "support@restroinn.com",
        emergencyPhone: "+977-1-4400000",
        timeZone: "Asia/Kathmandu",
        taxSystem: "NEPAL_IRD_VAT",
        defaultCurrency: "NPR",
      },
      SUBSCRIPTION_DEFAULTS: settingsMap.SUBSCRIPTION_DEFAULTS || {
        trialDurationDays: 14,
        gracePeriodDays: 7,
        invoiceDueDays: 15,
        defaultCurrency: "NPR",
        autoReminderDaysBeforeDue: 3,
      },
      GATEWAY_SETTINGS: settingsMap.GATEWAY_SETTINGS || {
        smsProvider: "SPARROW_SMS",
        smsApiKey: "mock-sparrow-key-2026",
        smsSenderId: "RestroInn",
        emailProvider: "SMTP",
        emailSender: "noreply@restroinn.com",
        smtpHost: "smtp.mailgun.org",
        smtpPort: 587,
      },
      MAINTENANCE_MODE: settingsMap.MAINTENANCE_MODE || {
        enabled: false,
        message: "RestroInn is currently undergoing scheduled platform upgrades. We will be back online shortly.",
        allowedIps: ["127.0.0.1", "::1"],
      },
    };

    return NextResponse.json({ settings: result, rawRecords: records });
  } catch (error: any) {
    console.error("GET platform settings error:", error);
    return NextResponse.json({ error: error.message || "Failed to load platform settings" }, { status: 500 });
  }
}

// PUT /api/v1/super-admin/settings
export async function PUT(request: Request) {
  const context = await getSessionContext();
  if (!context) return authErrorResponse();
  if (context.role !== "SUPER_ADMIN") return roleErrorResponse();

  try {
    const body = await request.json();
    const { key, value, reason } = body;

    if (!key || !value) {
      return NextResponse.json({ error: "Setting key and value are required" }, { status: 400 });
    }
    if (!reason || reason.trim().length < 5) {
      return NextResponse.json({ error: "A valid administrative audit reason (min 5 characters) is required" }, { status: 400 });
    }

    const existing = await db.platformSetting.findUnique({
      where: { key },
    });

    const categoryMap: Record<string, string> = {
      MAINTENANCE_MODE: "MAINTENANCE",
      SUBSCRIPTION_DEFAULTS: "SUBSCRIPTION",
      GATEWAY_SETTINGS: "GATEWAYS",
      GENERAL_CONFIG: "GENERAL",
    };

    const updated = await db.platformSetting.upsert({
      where: { key },
      create: {
        key,
        category: categoryMap[key] || "GENERAL",
        value,
        updatedById: context.userId,
      },
      update: {
        value,
        updatedById: context.userId,
      },
    });

    await logPlatformAudit({
      actorId: context.userId,
      actorRole: context.role,
      action: `SETTING_UPDATED_${key}`,
      targetType: "SYSTEM",
      targetId: updated.id,
      reason: reason.trim(),
      beforeState: existing?.value || null,
      afterState: value,
    });

    return NextResponse.json({ success: true, setting: updated });
  } catch (error: any) {
    console.error("PUT platform settings error:", error);
    return NextResponse.json({ error: error.message || "Failed to save platform setting" }, { status: 500 });
  }
}
