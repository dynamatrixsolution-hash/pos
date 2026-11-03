import { NextResponse } from "next/server";
import { getSessionContext, authErrorResponse } from "@/lib/api-helper";
import {
  updateMenuSection,
  deleteMenuSection,
  MenuCatalogError,
} from "@/lib/services/menu-catalog-service";
import { z } from "zod";

const updateSectionSchema = z.object({
  name: z.string().trim().min(1).optional(),
  description: z.string().optional(),
  displayOrder: z.coerce.number().optional(),
  isActive: z.boolean().optional(),
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
    const parsed = updateSectionSchema.parse(body);

    const section = await updateMenuSection(session.businessId, id, parsed);
    return NextResponse.json({ success: true, section });
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
      { error: error.message || "Failed to update section" },
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
    await deleteMenuSection(session.businessId, id);
    return NextResponse.json({ success: true, message: "Section deleted successfully" });
  } catch (error: any) {
    if (error instanceof MenuCatalogError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    return NextResponse.json(
      { error: error.message || "Failed to delete section" },
      { status: 500 }
    );
  }
}

