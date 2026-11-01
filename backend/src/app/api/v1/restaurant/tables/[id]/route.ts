import { NextResponse } from "next/server";
import { getSessionContext, authErrorResponse } from "@/lib/api-helper";
import {
  getTableById,
  updateTable,
  deleteTable,
  FloorTableError,
} from "@/lib/services/floor-table-service";
import { z } from "zod";

const updateTableSchema = z.object({
  tableNumber: z.string().trim().min(1).max(30).optional(),
  capacity: z.coerce.number().int().min(1).max(100).optional(),
  shape: z.enum(["RECTANGLE", "ROUND", "SQUARE"]).optional(),
  posX: z.coerce.number().int().min(0).optional(),
  posY: z.coerce.number().int().min(0).optional(),
  width: z.coerce.number().int().min(1).optional(),
  height: z.coerce.number().int().min(1).optional(),
  floorId: z.string().uuid().optional(),
  status: z.enum(["AVAILABLE", "OCCUPIED", "RESERVED", "BILLED"]).optional(),
  isActive: z.boolean().optional(),
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
    const includeSession = searchParams.get("includeSession") === "true";

    const table = await getTableById(session.businessId, id, { includeSession });
    return NextResponse.json({ table });
  } catch (error: any) {
    if (error instanceof FloorTableError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    return NextResponse.json(
      { error: error.message || "Failed to fetch table" },
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
    const parsed = updateTableSchema.parse(body);

    const table = await updateTable({
      businessId: session.businessId,
      tableId: id,
      ...parsed,
    });

    return NextResponse.json({ table });
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
      { error: error.message || "Failed to update table" },
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
    const result = await deleteTable(session.businessId, id);

    return NextResponse.json({
      message: result.deleted
        ? "Table successfully deleted"
        : "Table has historical orders/sessions and was deactivated",
      ...result,
    });
  } catch (error: any) {
    if (error instanceof FloorTableError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    return NextResponse.json(
      { error: error.message || "Failed to delete table" },
      { status: 500 }
    );
  }
}
