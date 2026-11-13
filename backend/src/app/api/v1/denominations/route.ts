import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionContext, authErrorResponse, safeErrorMessage } from "@/lib/api-helper";
import { ensureBusinessDenominations, isOwnerOrAdminRole } from "@/lib/shift-service";
import { z } from "zod";

const createDenominationSchema = z.object({
  currency: z.string().min(1).optional(),
  currencyCode: z.string().min(1).optional(),
  currency_code: z.string().min(1).optional(),
  value: z.number().positive("Denomination value must be positive"),
  type: z.enum(["NOTE", "COIN"]).default("NOTE"),
  displayOrder: z.number().int().optional(),
  display_order: z.number().int().optional(),
  isActive: z.boolean().optional(),
  is_active: z.boolean().optional(),
});

export async function GET(request: Request) {
  const context = await getSessionContext();
  if (!context) return authErrorResponse();

  try {
    const { searchParams } = new URL(request.url);
    const activeOnly = searchParams.get("activeOnly") !== "false";

    await ensureBusinessDenominations(context.businessId);

    const denominations = await db.denomination.findMany({
      where: {
        businessId: context.businessId,
        ...(activeOnly ? { isActive: true } : {}),
      },
      orderBy: [{ displayOrder: "asc" }, { value: "desc" }],
    });

    return NextResponse.json({
      denominations: denominations.map((d) => ({
        ...d,
        value: Number(d.value),
        label: `${d.currencyCode} ${Number(d.value).toLocaleString()}`,
      })),
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: safeErrorMessage(error, "Failed to fetch denominations") },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const context = await getSessionContext();
  if (!context) return authErrorResponse();

  if (!isOwnerOrAdminRole(context.role)) {
    return NextResponse.json(
      { error: "Forbidden: Only business owners or admins can configure denominations." },
      { status: 403 }
    );
  }

  try {
    const body = await request.json();
    const parsed = createDenominationSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.format() },
        { status: 400 }
      );
    }

    const {
      currency,
      currencyCode,
      currency_code,
      value,
      type,
      displayOrder,
      display_order,
      isActive,
      is_active,
    } = parsed.data;
    const resolvedCurrency = (currencyCode || currency_code || currency || "NPR").trim().toUpperCase();
    const resolvedOrder = displayOrder ?? display_order ?? 99;
    const resolvedActive = isActive ?? is_active ?? true;

    const existing = await db.denomination.findUnique({
      where: {
        businessId_currencyCode_value: {
          businessId: context.businessId,
          currencyCode: resolvedCurrency,
          value,
        },
      },
    });

    if (existing) {
      return NextResponse.json(
        { error: `Denomination ${resolvedCurrency} ${value} already exists.` },
        { status: 409 }
      );
    }

    const denomination = await db.denomination.create({
      data: {
        businessId: context.businessId,
        currencyCode: resolvedCurrency,
        value,
        type,
        displayOrder: resolvedOrder,
        isActive: resolvedActive,
      },
    });

    return NextResponse.json(
      {
        denomination: {
          ...denomination,
          value: Number(denomination.value),
          label: `${denomination.currencyCode} ${Number(denomination.value).toLocaleString()}`,
        },
      },
      { status: 201 }
    );
  } catch (error: any) {
    return NextResponse.json(
      { error: safeErrorMessage(error, "Failed to create denomination") },
      { status: 500 }
    );
  }
}
