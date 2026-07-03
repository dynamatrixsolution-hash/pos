import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionContext, authErrorResponse } from "@/lib/api-helper";
import { z } from "zod";

const unitSchema = z.object({
  name: z.string().min(1, "Name is required"),
});

export async function GET() {
  const context = await getSessionContext();
  if (!context) return authErrorResponse();

  try {
    const units = await db.unit.findMany({
      where: {
        businessId: context.businessId,
        deletedAt: null,
      },
      orderBy: { name: "asc" },
    });

    return NextResponse.json(units);
  } catch (error: any) {
    console.error("GET units error:", error);
    return NextResponse.json({ error: "Failed to fetch units" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const context = await getSessionContext();
  if (!context) return authErrorResponse();

  try {
    const body = await request.json();
    const result = unitSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: "Validation failed", details: result.error.format() },
        { status: 400 }
      );
    }

    const unit = await db.unit.create({
      data: {
        name: result.data.name,
        businessId: context.businessId,
      },
    });

    return NextResponse.json(unit, { status: 201 });
  } catch (error: any) {
    console.error("POST unit error:", error);
    return NextResponse.json({ error: "Failed to create unit" }, { status: 500 });
  }
}
