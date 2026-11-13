import { NextResponse } from "next/server";
import { getSessionContext, authErrorResponse, roleErrorResponse } from "@/lib/api-helper";
import { db } from "@/lib/db";
import { logPlatformAudit } from "@/lib/platform-audit";
import { z } from "zod";

const toggleSchema = z.object({
  businessId: z.string().min(1, "Business ID is required"),
  moduleKey: z.string().min(1, "Module key is required"),
  enabled: z.boolean(),
  reason: z.string().optional(),
});

export async function POST(request: Request) {
  const context = await getSessionContext();
  if (!context) return authErrorResponse();
  if (context.role !== "SUPER_ADMIN") return roleErrorResponse();

  try {
    const body = await request.json();
    const parsed = toggleSchema.parse(body);

    const { businessId, moduleKey, enabled, reason } = parsed;
    const cleanKey = moduleKey.toUpperCase().trim();

    const sub = await db.subscription.findUnique({
      where: { businessId },
    });

    let currentModules: string[] = Array.isArray(sub?.enabledModules) ? [...sub.enabledModules] : [];

    if (enabled) {
      if (!currentModules.includes(cleanKey)) {
        currentModules.push(cleanKey);
      }
    } else {
      currentModules = currentModules.filter((m) => m !== cleanKey);
    }

    let updatedSub;
    if (sub) {
      updatedSub = await db.subscription.update({
        where: { businessId },
        data: { enabledModules: currentModules },
      });
    } else {
      const oneYearLater = new Date();
      oneYearLater.setFullYear(oneYearLater.getFullYear() + 1);
      updatedSub = await db.subscription.create({
        data: {
          businessId,
          plan: "STANDARD",
          status: "ACTIVE",
          startDate: new Date(),
          endDate: oneYearLater,
          enabledModules: currentModules,
        },
      });
    }

    await logPlatformAudit({
      actorId: context.userId,
      actorRole: context.role,
      action: enabled ? `MODULE_ENABLED_${cleanKey}` : `MODULE_DISABLED_${cleanKey}`,
      targetType: "SUBSCRIPTION",
      targetId: updatedSub.id,
      businessId,
      reason: reason || `Toggled module ${cleanKey} to ${enabled ? "enabled" : "disabled"}`,
      beforeState: { enabledModules: sub?.enabledModules || [] },
      afterState: { enabledModules: currentModules },
    });

    return NextResponse.json({
      success: true,
      enabledModules: currentModules,
      subscription: updatedSub,
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message || "Validation failed" }, { status: 400 });
    }
    console.error("POST /super-admin/modules/toggle error:", error);
    return NextResponse.json({ error: error.message || "Failed to toggle module" }, { status: 500 });
  }
}

