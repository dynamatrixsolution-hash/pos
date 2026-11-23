import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { hashGuestSecret } from "@/lib/services/guest-portal-service";

const guestProfileSchema = z.object({
  name: z.string().trim().min(2, "Please enter your name").max(100),
  phone: z.string().trim().min(7, "Please enter a valid phone number").max(25),
  email: z.string().trim().email("Please enter a valid email").optional().or(z.literal("")),
});

function extractGuestToken(req: Request): string | null {
  const headerToken =
    req.headers.get("x-guest-session-token") ||
    req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  return headerToken ? headerToken.trim() : null;
}

// POST /api/v1/guest/profile — Save optional customer details (Name, Phone, optional Email) for customer-wise reports & offers
export async function POST(request: Request) {
  try {
    const token = extractGuestToken(request);
    if (!token) {
      return NextResponse.json({ error: "Active guest session required" }, { status: 401 });
    }

    const session = await db.guestSession.findUnique({
      where: { sessionTokenHash: hashGuestSecret(token) },
      select: { id: true, status: true, businessId: true, branchId: true },
    });

    if (!session || session.status !== "ACTIVE") {
      return NextResponse.json({ error: "Guest session is no longer active" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const parsed = guestProfileSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Invalid guest details" },
        { status: 400 }
      );
    }

    const { name, phone, email } = parsed.data;
    const normalizedPhone = phone.replace(/\s+/g, "");
    const normalizedEmail = email?.trim() ? email.trim().toLowerCase() : null;

    const existing = await db.customer.findFirst({
      where: {
        businessId: session.businessId,
        phone: normalizedPhone,
        deletedAt: null,
      },
      select: { id: true, email: true },
    });

    const customer = existing
      ? await db.customer.update({
          where: { id: existing.id },
          data: {
            name,
            ...(normalizedEmail ? { email: normalizedEmail } : {}),
            updatedAt: new Date(),
          },
          select: { id: true, name: true, phone: true, email: true },
        })
      : await db.customer.create({
          data: {
            businessId: session.businessId,
            branchId: session.branchId,
            name,
            phone: normalizedPhone,
            email: normalizedEmail,
            customerType: "RETAIL",
          },
          select: { id: true, name: true, phone: true, email: true },
        });

    return NextResponse.json({ success: true, customer }, { status: 201 });
  } catch (error) {
    console.error("POST /api/v1/guest/profile error:", error);
    return NextResponse.json({ error: "Failed to save customer details" }, { status: 500 });
  }
}
