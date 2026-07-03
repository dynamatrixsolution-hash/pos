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
      select: { settings: true, name: true, phone: true, email: true, address: true },
    });

    const settings = (platform?.settings as any) || {};

    const smtp = settings.smtp || {
      host: "smtp.mailgun.org",
      port: 587,
      user: "postmaster@dynaone.io",
      password: "••••••••••••••••",
      encryption: "TLS",
    };

    const backups = settings.backups || {
      enabled: true,
      frequency: "DAILY",
      retentionDays: 30,
      destination: "AWS_S3_SECURE",
    };

    const general = {
      name: platform?.name || "DynaOne SaaS Platform",
      phone: platform?.phone || "+1-800-555-0100",
      email: platform?.email || "admin@dynapos.com",
      address: platform?.address || "DynaPOS Headquarters",
      taxName: "VAT",
      defaultRate: 10,
    };

    return NextResponse.json({ smtp, backups, general });
  } catch (error: any) {
    console.error("GET platform settings error:", error);
    return NextResponse.json({ error: "Failed to compile platform settings" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const context = await getSessionContext();
  if (!context) return authErrorResponse();
  if (context.role !== "SUPER_ADMIN") return roleErrorResponse();

  try {
    const body = await request.json();
    const { smtp, backups, general } = body;

    const platform = await db.business.findUnique({
      where: { slug: "platform-admin" },
    });

    if (!platform) {
      return NextResponse.json({ error: "Platform administration details not found" }, { status: 404 });
    }

    const currentSettings = (platform.settings as any) || {};
    const newSettings = {
      ...currentSettings,
      smtp: smtp || currentSettings.smtp,
      backups: backups || currentSettings.backups,
    };

    await db.business.update({
      where: { id: platform.id },
      data: {
        name: general?.name || platform.name,
        phone: general?.phone || platform.phone,
        email: general?.email || platform.email,
        address: general?.address || platform.address,
        settings: newSettings,
      },
    });

    await db.auditLog.create({
      data: {
        businessId: context.businessId,
        userId: context.userId,
        role: context.role,
        action: "UPDATE_PLATFORM_SETTINGS",
        module: "SUPER_ADMIN",
        details: "Updated platform settings, SMTP configuration, or automated database backup schedules",
      },
    });

    return NextResponse.json({ message: "Platform configurations updated successfully" });
  } catch (error: any) {
    console.error("POST platform settings error:", error);
    return NextResponse.json({ error: "Failed to update platform configurations" }, { status: 500 });
  }
}
