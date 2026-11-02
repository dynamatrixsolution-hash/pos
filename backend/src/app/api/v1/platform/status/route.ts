import { NextResponse } from "next/server";
import { db } from "@/lib/db";

// GET /api/v1/platform/status - Public check for maintenance and system status
export async function GET() {
  try {
    const maintenance = await db.platformSetting.findUnique({
      where: { key: "MAINTENANCE_MODE" },
    });

    const maintenanceVal = (maintenance?.value as any) || { enabled: false, message: "" };

    return NextResponse.json({
      status: maintenanceVal.enabled ? "MAINTENANCE" : "OPERATIONAL",
      maintenanceMode: Boolean(maintenanceVal.enabled),
      message: maintenanceVal.message || "All platform services are operational.",
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    return NextResponse.json({
      status: "OPERATIONAL",
      maintenanceMode: false,
      message: "System operational",
      timestamp: new Date().toISOString(),
    });
  }
}

