import { NextResponse } from "next/server";
import { getSessionContext, authErrorResponse } from "@/lib/api-helper";
import {
  createFloor,
  getFloors,
  FloorTableError,
} from "@/lib/services/floor-table-service";
import { z } from "zod";

const createFloorSchema = z.object({
  name: z.string().trim().min(1, "Floor name is required").max(100),
  branchId: z.string().uuid().optional().nullable(),
  displayOrder: z.coerce.number().int().default(0),
  metadata: z.record(z.string(), z.unknown()).optional().nullable(),
  isActive: z.boolean().optional(),
});

export async function GET(req: Request) {
  try {
    const session = await getSessionContext();
    if (!session) return authErrorResponse();

    const { searchParams } = new URL(req.url);
    const branchId = searchParams.get("branchId") || session.branchId;
    const includeTables = searchParams.get("includeTables") !== "false";
    const isActiveParam = searchParams.get("isActive");
    const isActive = isActiveParam !== null ? isActiveParam === "true" : undefined;

    const floors = await getFloors({
      businessId: session.businessId,
      branchId,
      isActive,
      includeTables,
    });

    return NextResponse.json({ floors });
  } catch (error: any) {
    if (error instanceof FloorTableError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    return NextResponse.json(
      { error: error.message || "Failed to fetch floors" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const session = await getSessionContext();
    if (!session) return authErrorResponse();

    const body = await req.json();
    const parsed = createFloorSchema.parse(body);

    const branchId = parsed.branchId || session.branchId;
    if (!branchId) {
      return NextResponse.json({ error: "Branch ID is required" }, { status: 400 });
    }

    const floor = await createFloor({
      businessId: session.businessId,
      branchId,
      name: parsed.name,
      displayOrder: parsed.displayOrder,
      metadata: parsed.metadata as any,
      isActive: parsed.isActive,
    });

    return NextResponse.json({ floor }, { status: 201 });
  } catch (error: any) {
    if (error instanceof FloorTableError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0]?.message || "Validation failed" },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: error.message || "Failed to create floor" },
      { status: 500 }
    );
  }
}
