import { NextResponse } from "next/server";
import { getSessionContext, authErrorResponse } from "@/lib/api-helper";
import {
  createTable,
  getTables,
  updateTablePositions,
  FloorTableError,
} from "@/lib/services/floor-table-service";
import { z } from "zod";

const createTableSchema = z.object({
  floorId: z.string().uuid("Invalid floor ID"),
  tableNumber: z.string().trim().min(1, "Table number is required").max(30),
  capacity: z.coerce.number().int().min(1).max(100).default(4),
  shape: z.enum(["RECTANGLE", "ROUND", "SQUARE"]).default("RECTANGLE"),
  posX: z.coerce.number().int().min(0).default(0),
  posY: z.coerce.number().int().min(0).default(0),
  width: z.coerce.number().int().min(1).default(1),
  height: z.coerce.number().int().min(1).default(1),
  status: z.enum(["AVAILABLE", "OCCUPIED", "RESERVED", "BILLED"]).default("AVAILABLE"),
  branchId: z.string().uuid().optional().nullable(),
  isActive: z.boolean().optional(),
});

const updatePositionsSchema = z.object({
  floorId: z.string().uuid("Invalid floor ID"),
  positions: z.array(
    z.object({
      tableId: z.string().uuid(),
      posX: z.coerce.number().int().min(0),
      posY: z.coerce.number().int().min(0),
      shape: z.enum(["RECTANGLE", "ROUND", "SQUARE"]).optional(),
      width: z.coerce.number().int().min(1).optional(),
      height: z.coerce.number().int().min(1).optional(),
    })
  ).min(1, "At least one position update is required"),
});

export async function GET(req: Request) {
  try {
    const session = await getSessionContext();
    if (!session) return authErrorResponse();

    const { searchParams } = new URL(req.url);
    const floorId = searchParams.get("floorId");
    const branchId = searchParams.get("branchId") || session.branchId;
    const status = searchParams.get("status");
    const includeFloor = searchParams.get("includeFloor") !== "false";
    const includeCurrentSession = searchParams.get("includeSession") === "true" || searchParams.get("includeCurrentSession") === "true";
    const isActiveParam = searchParams.get("isActive");
    const isActive = isActiveParam !== null ? isActiveParam === "true" : undefined;

    const tables = await getTables({
      businessId: session.businessId,
      branchId,
      floorId,
      status,
      isActive,
      includeFloor,
      includeCurrentSession,
    });

    return NextResponse.json({ tables });
  } catch (error: any) {
    if (error instanceof FloorTableError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    return NextResponse.json(
      { error: error.message || "Failed to fetch tables" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const session = await getSessionContext();
    if (!session) return authErrorResponse();

    const body = await req.json();
    const parsed = createTableSchema.parse(body);

    const table = await createTable({
      businessId: session.businessId,
      branchId: parsed.branchId || session.branchId,
      floorId: parsed.floorId,
      tableNumber: parsed.tableNumber,
      capacity: parsed.capacity,
      shape: parsed.shape,
      posX: parsed.posX,
      posY: parsed.posY,
      width: parsed.width,
      height: parsed.height,
      status: parsed.status,
      isActive: parsed.isActive,
    });

    return NextResponse.json({ table }, { status: 201 });
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
      { error: error.message || "Failed to create table" },
      { status: 500 }
    );
  }
}

export async function PATCH(req: Request) {
  try {
    const session = await getSessionContext();
    if (!session) return authErrorResponse();

    const body = await req.json();
    const parsed = updatePositionsSchema.parse(body);

    const updatedTables = await updateTablePositions({
      businessId: session.businessId,
      floorId: parsed.floorId,
      positions: parsed.positions,
    });

    return NextResponse.json({
      success: true,
      tables: updatedTables,
      updatedCount: updatedTables.length,
    });
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
      { error: error.message || "Failed to update table positions" },
      { status: 500 }
    );
  }
}
