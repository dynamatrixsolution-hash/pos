import { NextResponse } from "next/server";
import { getSessionContext, authErrorResponse } from "@/lib/api-helper";
import {
  updateModifierGroup,
  deleteModifierGroup,
  MenuCatalogError,
} from "@/lib/services/menu-catalog-service";
import { z } from "zod";

const updateModifierOptionSchema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(1),
  priceDelta: z.union([z.number(), z.string()]).default(0),
  isAvailable: z.boolean().optional().default(true),
});

const updateModifierGroupSchema = z.object({
  name: z.string().trim().min(1).optional(),
  displayName: z.string().optional(),
  minSelections: z.coerce.number().int().min(0).optional(),
  maxSelections: z.coerce.number().int().min(1).optional(),
  options: z.array(updateModifierOptionSchema).optional(),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSessionContext();
    if (!session) return authErrorResponse();

    const { id } = await params;
    const body = await req.json();
    const parsed = updateModifierGroupSchema.parse(body);

    const group = await updateModifierGroup(session.businessId, id, parsed);
    return NextResponse.json({ success: true, group });
  } catch (error: any) {
    if (error instanceof MenuCatalogError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0]?.message || "Validation failed" },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: error.message || "Failed to update modifier group" },
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
    await deleteModifierGroup(session.businessId, id);
    return NextResponse.json({ success: true, message: "Modifier group deleted successfully" });
  } catch (error: any) {
    if (error instanceof MenuCatalogError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    return NextResponse.json(
      { error: error.message || "Failed to delete modifier group" },
      { status: 500 }
    );
  }
}

