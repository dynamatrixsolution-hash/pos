import { NextResponse } from "next/server";
import { getSessionContext, authErrorResponse } from "@/lib/api-helper";
import {
  getStaffMenuCatalog,
  createMenu,
  createMenuSection,
  createMenuItem,
  createModifierGroup,
  MenuCatalogError,
} from "@/lib/services/menu-catalog-service";
import { z } from "zod";

const createMenuSchema = z.object({
  name: z.string().min(1, "Menu name is required"),
  description: z.string().optional(),
  branchId: z.string().optional().nullable(),
  availableFrom: z.string().optional(),
  availableTo: z.string().optional(),
  displayOrder: z.coerce.number().default(0),
});

export async function GET(req: Request) {
  try {
    const session = await getSessionContext();
    if (!session) return authErrorResponse();

    const { searchParams } = new URL(req.url);
    const branchId = searchParams.get("branchId") || session.branchId;

    const catalog = await getStaffMenuCatalog(session.businessId, branchId);
    return NextResponse.json({ catalog });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to fetch menu catalog" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await getSessionContext();
    if (!session) return authErrorResponse();

    const body = await req.json();
    const parsed = createMenuSchema.parse(body);

    const menu = await createMenu({
      businessId: session.businessId,
      branchId: parsed.branchId || session.branchId,
      name: parsed.name,
      description: parsed.description,
      availableFrom: parsed.availableFrom,
      availableTo: parsed.availableTo,
      displayOrder: parsed.displayOrder,
    });

    return NextResponse.json({ menu }, { status: 201 });
  } catch (error: any) {
    if (error instanceof MenuCatalogError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message || "Validation failed" }, { status: 400 });
    }
    return NextResponse.json({ error: error.message || "Failed to create menu" }, { status: 500 });
  }
}

