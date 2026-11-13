import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionContext, authErrorResponse, roleErrorResponse } from "@/lib/api-helper";
import { z } from "zod";

const irdSettingsSchema = z.object({
  cbmsApiUrl: z.string().url().optional(),
  cbmsUsername: z.string().optional(),
  cbmsPassword: z.string().optional(),
  cbmsRealtime: z.boolean().optional(),
  panNumber: z.string().optional(),
  vatNumber: z.string().optional(),
  autoSync: z.boolean().optional(),
});

export async function GET() {
  const context = await getSessionContext();
  if (!context) return authErrorResponse();

  try {
    const business = await db.business.findUnique({
      where: { id: context.businessId },
      select: { settings: true },
    });

    const settings = (business?.settings as any) || {};

    return NextResponse.json({
      ird: {
        cbmsApiUrl: settings.cbmsApiUrl || "https://cbms.ird.gov.np/api/v1/invoice",
        cbmsUsername: settings.cbmsUsername || "",
        cbmsRealtime: settings.cbmsRealtime !== false,
        panNumber: settings.panNumber || "",
        vatNumber: settings.vatNumber || "",
        autoSync: settings.cbmsRealtime !== false,
        hasPasswordConfigured: Boolean(settings.cbmsPassword),
      },
    });
  } catch (error: any) {
    console.error("GET /settings/ird error:", error);
    return NextResponse.json({ error: "Failed to fetch IRD configuration" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const context = await getSessionContext();
  if (!context) return authErrorResponse();

  const OWNER_ROLES = ["SUPER_ADMIN", "OWNER"];
  if (!OWNER_ROLES.includes(context.role)) {
    return roleErrorResponse();
  }

  try {
    const body = await request.json();
    const parsed = irdSettingsSchema.parse(body);

    const business = await db.business.findUnique({
      where: { id: context.businessId },
    });

    if (!business) {
      return NextResponse.json({ error: "Business not found" }, { status: 404 });
    }

    const currentSettings = (business.settings as any) || {};

    const updatedSettings = {
      ...currentSettings,
      ...(parsed.cbmsApiUrl !== undefined && { cbmsApiUrl: parsed.cbmsApiUrl }),
      ...(parsed.cbmsUsername !== undefined && { cbmsUsername: parsed.cbmsUsername }),
      ...(parsed.cbmsPassword !== undefined && parsed.cbmsPassword && { cbmsPassword: parsed.cbmsPassword }),
      ...(parsed.cbmsRealtime !== undefined && { cbmsRealtime: parsed.cbmsRealtime }),
      ...(parsed.panNumber !== undefined && { panNumber: parsed.panNumber }),
      ...(parsed.vatNumber !== undefined && { vatNumber: parsed.vatNumber }),
    };

    await db.business.update({
      where: { id: context.businessId },
      data: {
        settings: updatedSettings,
      },
    });

    return NextResponse.json({
      success: true,
      message: "IRD configuration saved successfully",
      ird: {
        cbmsApiUrl: updatedSettings.cbmsApiUrl,
        cbmsUsername: updatedSettings.cbmsUsername,
        cbmsRealtime: updatedSettings.cbmsRealtime,
        panNumber: updatedSettings.panNumber,
        vatNumber: updatedSettings.vatNumber,
        hasPasswordConfigured: Boolean(updatedSettings.cbmsPassword),
      },
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message || "Validation failed" }, { status: 400 });
    }
    console.error("POST /settings/ird error:", error);
    return NextResponse.json({ error: "Failed to update IRD settings" }, { status: 500 });
  }
}

