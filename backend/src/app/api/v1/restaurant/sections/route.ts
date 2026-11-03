import { NextResponse } from "next/server";
import { getSessionContext, authErrorResponse } from "@/lib/api-helper";
import {
  createMenuSection,
  MenuCatalogError,
} from "@/lib/services/menu-catalog-service";
import { db } from "@/lib/db";
import { z } from "zod";

const createSectionSchema = z.object({
  menuId: z.string().optional(),
  name: z.string().trim().min(1, "Section name is required"),
  description: z.string().optional(),
  displayOrder: z.coerce.number().default(0),
});

export async function GET(req: Request) {
  try {
    const session = await getSessionContext();
    if (!session) return authErrorResponse();

    const sections = await db.menuSection.findMany({
      where: { businessId: session.businessId, isActive: true },
      include: {
        menu: { select: { id: true, name: true } },
        items: {
          select: { id: true, name: true, basePrice: true, isAvailable: true },
        },
      },
      orderBy: { displayOrder: "asc" },
    });

    return NextResponse.json({ sections });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to fetch sections" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const session = await getSessionContext();
    if (!session) return authErrorResponse();

    const body = await req.json();
    const parsed = createSectionSchema.parse(body);

    // If menuId not provided, default to first active menu or create one
    let menuId = parsed.menuId;
    if (!menuId) {
      let defaultMenu = await db.menu.findFirst({
        where: { businessId: session.businessId, isActive: true },
        orderBy: { createdAt: "asc" },
      });
      if (!defaultMenu) {
        defaultMenu = await db.menu.create({
          data: {
            businessId: session.businessId,
            name: "Main Restaurant Menu",
            displayOrder: 0,
          },
        });
      }
      menuId = defaultMenu.id;
    }

    const section = await createMenuSection({
      businessId: session.businessId,
      menuId,
      name: parsed.name,
      description: parsed.description,
      displayOrder: parsed.displayOrder,
    });

    return NextResponse.json({ section }, { status: 201 });
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
      { error: error.message || "Failed to create menu section" },
      { status: 500 }
    );
  }
}

