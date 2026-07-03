import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionContext, authErrorResponse } from "@/lib/api-helper";
import { z } from "zod";
import bcrypt from "bcryptjs";

const profileSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  phone: z.string().optional().nullable(),
  password: z.string().min(6, "Password must be at least 6 characters").optional().nullable().or(z.literal("")),
});

export async function GET() {
  const context = await getSessionContext();
  if (!context) return authErrorResponse();

  try {
    const user = await db.user.findFirst({
      where: {
        id: context.userId,
        businessId: context.businessId,
        deletedAt: null,
      },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        createdAt: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json(user);
  } catch (error: any) {
    console.error("GET profile error:", error);
    return NextResponse.json({ error: "Failed to fetch profile" }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  const context = await getSessionContext();
  if (!context) return authErrorResponse();

  try {
    const body = await request.json();
    const result = profileSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: "Validation failed", details: result.error.format() },
        { status: 400 }
      );
    }

    const { name, phone, password } = result.data;

    // Verify user exists
    const user = await db.user.findFirst({
      where: {
        id: context.userId,
        businessId: context.businessId,
        deletedAt: null,
      },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const dataToUpdate: any = {
      name,
      phone: phone || null,
    };

    if (password && password.trim() !== "") {
      const salt = bcrypt.genSaltSync(10);
      dataToUpdate.passwordHash = bcrypt.hashSync(password, salt);
    }

    // Update user
    const updatedUser = await db.user.update({
      where: { id: context.userId },
      data: dataToUpdate,
    });

    // Write audit log
    await db.auditLog.create({
      data: {
        businessId: context.businessId,
        userId: context.userId,
        action: "UPDATE",
        module: "USER",
        details: `Updated personal profile settings for user ${updatedUser.name}.`,
      },
    });

    const { passwordHash: _ph, ...safeUser } = updatedUser;

    return NextResponse.json(safeUser);
  } catch (error: any) {
    console.error("PUT profile error:", error);
    return NextResponse.json({ error: "Failed to update profile" }, { status: 500 });
  }
}
