import { NextResponse } from "next/server";
import { verifyAndCreateGuestSession } from "@/lib/services/guest-portal-service";
import { HotelError } from "@/lib/services/room-availability-service";
import { z } from "zod";

const verifyGuestSchema = z.object({
  publicCode: z.string().min(1, "Public code is required"),
  guestLastName: z.string().optional().nullable(),
  guestPhoneLast4: z.string().optional().nullable(),
  verificationCode: z.string().optional().nullable(),
  deviceFingerprint: z.string().optional().nullable(),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = verifyGuestSchema.parse(body);

    const result = await verifyAndCreateGuestSession(parsed);
    return NextResponse.json(result, { status: 201 });
  } catch (error: any) {
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
      { error: error.message || "Failed to verify guest session" },
      { status: 500 }
    );
  }
}
