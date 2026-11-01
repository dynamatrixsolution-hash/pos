import { NextResponse } from "next/server";
import { getSessionContext, authErrorResponse } from "@/lib/api-helper";
import {
  getFloorById,
  updateFloor,
  deleteFloor,
  FloorTableError,
} from "@/lib/services/floor-table-service";
import { z } from "zod";

const updateFloorSchema = z.object({
  name: z.string().trim().min(1, "Floor name cannot be empty").max(100).optional(),
  displayOrder: z.coerce.number().int().optional(),
  isActive: z.boolean().optional(),
  metadata: z.record(z.string(), z.unknown()).optional().nullable(),
});

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSessionContext();
    if (!session) return authErrorResponse();

    const { id } = await params;
    const { searchParams } = new URL(req.url);
    const includeTables = searchParams.get("includeTables") !== "false";

    const floor = await getFloorById(session.businessId, id, { includeTables });
    return NextResponse.json({ floor });
  } catch (error: any) {
    if (error instanceof FloorTableError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    return NextResponse.json(
      { error: error.message || "Failed to fetch floor" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSessionContext();
    if (!session) return authErrorResponse();

    const { id } = await params;
    const body = await req.json();
    const parsed = updateFloorSchema.parse(body);

    const floor = await updateFloor({
      businessId: session.businessId,
      floorId: id,
      name: parsed.name,
      displayOrder: parsed.displayOrder,
      isActive: parsed.isActive,
      metadata: parsed.metadata as any,
    });

    return NextResponse.json({ floor });
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
      { error: error.message || "Failed to update floor" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSessionContext();
    if (!session) return authErrorResponse();

    const { id } = await params;
    const result = await deleteFloor(session.businessId, id);

    return NextResponse.json({
      message: result.deleted
        ? "Floor successfully deleted"
        : "Floor has historical tables and was deactivated",
      ...result,
    });
  } catch (error: any) {
    if (error instanceof FloorTableError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    return NextResponse.json(
      { error: error.message || "Failed to delete floor" },
      { status: 500 }
    );
  }
}
