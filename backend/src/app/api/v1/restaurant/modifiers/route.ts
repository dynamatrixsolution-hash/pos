import { NextResponse } from "next/server";
import { getSessionContext, authErrorResponse } from "@/lib/api-helper";
import {
  createModifierGroup,
  getModifierGroups,
  MenuCatalogError,
} from "@/lib/services/menu-catalog-service";
import { z } from "zod";

const createModifierOptionSchema = z.object({
  name: z.string().trim().min(1, "Option name is required"),
  priceDelta: z.union([z.number(), z.string()]).default(0),
  isAvailable: z.boolean().optional().default(true),
});

const createModifierGroupSchema = z.object({
  name: z.string().trim().min(1, "Modifier group name is required"),
  displayName: z.string().optional(),
  minSelections: z.coerce.number().int().min(0).default(0),
  maxSelections: z.coerce.number().int().min(1).default(1),
  options: z.array(createModifierOptionSchema).min(1, "At least one option is required"),
});

export async function GET(req: Request) {
  try {
    const session = await getSessionContext();
    if (!session) return authErrorResponse();

    const groups = await getModifierGroups(session.businessId);
    return NextResponse.json({ groups });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to fetch modifier groups" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const session = await getSessionContext();
    if (!session) return authErrorResponse();

    const body = await req.json();
    const parsed = createModifierGroupSchema.parse(body);

    const group = await createModifierGroup({
      businessId: session.businessId,
      name: parsed.name,
      displayName: parsed.displayName,
      minSelections: parsed.minSelections,
      maxSelections: parsed.maxSelections,
      options: parsed.options,
    });

    return NextResponse.json({ success: true, group }, { status: 201 });
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
      { error: error.message || "Failed to create modifier group" },
      { status: 500 }
    );
  }
}

