import { NextResponse } from "next/server";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { db } from "@/lib/db";
import { pepperPassword } from "@/lib/security";

const resetSchema = z.object({
  email: z.string().trim().toLowerCase().email("Valid email is required"),
  token: z.string().trim().min(32, "Invalid or malformed reset token"),
  password: z.string().min(6, "Password must be at least 6 characters").max(128),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = resetSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Invalid reset request" },
        { status: 400 }
      );
    }

    const { email, token, password } = parsed.data;

    const user = await db.user.findUnique({
      where: { email },
      include: { business: { select: { id: true, settings: true, deletedAt: true } } },
    });

    if (!user || user.deletedAt || !user.business || user.business.deletedAt) {
      return NextResponse.json({ error: "Invalid or expired password reset link." }, { status: 400 });
    }

    const settings = (user.business.settings as Record<string, any>) || {};
    const pending = settings.pendingPasswordReset;
    if (!pending || pending.userId !== user.id || !pending.tokenHash || !pending.expiresAt) {
      return NextResponse.json({ error: "Invalid or already used password reset link." }, { status: 400 });
    }

    if (new Date(pending.expiresAt).getTime() < Date.now()) {
      return NextResponse.json({ error: "This password reset link has expired. Ask Super Admin to generate a new one." }, { status: 400 });
    }

    const providedHash = crypto.createHash("sha256").update(token).digest("hex");
    const a = Buffer.from(providedHash, "hex");
    const b = Buffer.from(String(pending.tokenHash), "hex");
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
      return NextResponse.json({ error: "Invalid password reset token." }, { status: 400 });
    }

    const passwordHash = await bcrypt.hash(pepperPassword(password), 10);
    const { pendingPasswordReset: _removed, ...restSettings } = settings;

    await db.$transaction([
      db.user.update({
        where: { id: user.id },
        data: { passwordHash, isActive: true },
      }),
      db.business.update({
        where: { id: user.business.id },
        data: { settings: restSettings as any },
      }),
      db.auditLog.create({
        data: {
          businessId: user.business.id,
          userId: user.id,
          role: user.role,
          action: "PASSWORD_RESET_COMPLETED",
          module: "USER",
          details: `User ${user.email} completed password reset via one-time link.`,
        },
      }),
    ]);

    return NextResponse.json({
      success: true,
      message: "Password updated successfully. You can now sign in with your new password.",
    });
  } catch (error) {
    console.error("POST /api/v1/auth/reset-password error:", error);
    return NextResponse.json({ error: "Failed to reset password. Please try again." }, { status: 500 });
  }
}
