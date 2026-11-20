import { NextResponse } from "next/server";
import { getSessionContext, authErrorResponse, safeErrorMessage, requireRoles, ROLE_GROUPS } from "@/lib/api-helper";
import { runWithOptionalIdempotency } from "@/lib/commerce-transaction";
import { CommerceError } from "@/lib/commerce-policy";
import { settleGuestFolio, FolioPaymentMethod } from "@/lib/services/folio-service";
import { HotelError } from "@/lib/services/room-availability-service";
import { z } from "zod";

const settleFolioSchema = z.object({
  tenders: z
    .array(
      z.object({
        paymentMethod: z.enum([
          "CASH",
          "CARD",
          "QR",
          "BANK_TRANSFER",
          "DEPOSIT",
          "FONEPAY",
          "FONE_PAY",
          "KHALTI",
          "ESEWA",
          "NEPAL_PAY",
        ]),
        amount: z.union([z.number(), z.string()]),
        reference: z.string().optional().nullable(),
        notes: z.string().optional().nullable(),
      })
    )
    .min(1, "At least one payment tender is required"),
  branchId: z.string().uuid().optional().nullable(),
});

function normalizeFolioPaymentMethod(method: string): FolioPaymentMethod {
  if (["FONEPAY", "FONE_PAY", "KHALTI", "ESEWA", "NEPAL_PAY"].includes(method)) {
    return "QR";
  }
  return method as FolioPaymentMethod;
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSessionContext();
    if (!session) return authErrorResponse();
    const denied = requireRoles(session, ROLE_GROUPS.HOTEL_FRONT_DESK);
    if (denied) return denied;

    const { id } = await params;
    const body = await req.json();
    const parsed = settleFolioSchema.parse(body);

    const branchId = parsed.branchId || session.branchId || undefined;
    const normalizedTenders = parsed.tenders.map((t) => ({
      ...t,
      paymentMethod: normalizeFolioPaymentMethod(t.paymentMethod),
      reference:
        t.reference ||
        (["FONEPAY", "FONE_PAY", "KHALTI", "ESEWA", "NEPAL_PAY"].includes(t.paymentMethod)
          ? t.paymentMethod
          : null),
    }));

    const { result, replayed } = await runWithOptionalIdempotency(
      req,
      session,
      `HOTEL_FOLIO_SETTLE:${id}`,
      parsed,
      async (tx) =>
        settleGuestFolio(
          {
            businessId: session.businessId,
            branchId,
            folioId: id,
            tenders: normalizedTenders,
            actorId: session.userId,
          },
          tx
        )
    );

    return NextResponse.json(
      {
        folio: result.folio,
        allocations: result.allocations,
      },
      replayed ? { headers: { "X-Idempotent-Replay": "true" } } : undefined
    );
  } catch (error: any) {
    console.error("[Folio Settle Error]:", error);
    if (error instanceof CommerceError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    if (
      error instanceof HotelError ||
      error?.name === "HotelError" ||
      typeof error?.statusCode === "number"
    ) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.statusCode || 400 }
      );
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0]?.message || "Validation failed" },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: safeErrorMessage(error, "Failed to settle guest folio") },
      { status: 500 }
    );
  }
}
