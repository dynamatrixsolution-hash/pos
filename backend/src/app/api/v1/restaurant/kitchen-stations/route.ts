import { NextResponse } from "next/server";
import { getSessionContext, authErrorResponse } from "@/lib/api-helper";
import {
  createKitchenStation,
  getKitchenStations,
  KitchenRoutingError,
} from "@/lib/services/kitchen-routing-service";
import { z } from "zod";

const createStationSchema = z.object({
  name: z.string().min(1, "Station name is required"),
  code: z.string().min(1, "Station code is required"),
  branchId: z.string().optional().nullable(),
  printerIp: z.string().optional().nullable(),
  printerPort: z.coerce.number().default(9100),
  displayOrder: z.coerce.number().default(0),
});

export async function GET(req: Request) {
  try {
    const session = await getSessionContext();
    if (!session) return authErrorResponse();

    const { searchParams } = new URL(req.url);
    const branchId = searchParams.get("branchId") || session.branchId;
    if (!branchId) return NextResponse.json({ error: "Branch ID required" }, { status: 400 });

    const stations = await getKitchenStations(session.businessId, branchId);
    return NextResponse.json({ stations });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to fetch stations" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await getSessionContext();
    if (!session) return authErrorResponse();

    const body = await req.json();
    const parsed = createStationSchema.parse(body);

    const branchId = parsed.branchId || session.branchId;
    if (!branchId) return NextResponse.json({ error: "Branch ID required" }, { status: 400 });

    const station = await createKitchenStation({
      businessId: session.businessId,
      branchId,
      name: parsed.name,
      code: parsed.code,
      printerIp: parsed.printerIp || undefined,
      printerPort: parsed.printerPort,
      displayOrder: parsed.displayOrder,
    });

    return NextResponse.json({ station }, { status: 201 });
  } catch (error: any) {
    if (error instanceof KitchenRoutingError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message || "Validation failed" }, { status: 400 });
    }
    return NextResponse.json({ error: error.message || "Failed to create station" }, { status: 500 });
  }
}

