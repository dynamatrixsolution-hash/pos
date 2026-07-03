import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import bcrypt from "bcryptjs";
import { z } from "zod";

const registerSchema = z.object({
  businessName: z.string().min(2, "Business name must be at least 2 characters"),
  slug: z.string().min(3, "Slug must be at least 3 characters").regex(/^[a-z0-9-]+$/, "Slug can only contain lowercase letters, numbers, and hyphens"),
  currency: z.string().default("USD"),
  ownerName: z.string().min(2, "Owner name must be at least 2 characters"),
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  phone: z.string().optional(),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const result = registerSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: "Validation failed", details: result.error.format() },
        { status: 400 }
      );
    }

    const { businessName, slug, currency, ownerName, email, password, phone } = result.data;

    // Check if email already registered
    const existingUser = await db.user.findUnique({
      where: { email },
    });
    if (existingUser) {
      return NextResponse.json(
        { error: "Email is already registered" },
        { status: 400 }
      );
    }

    // Check if business slug already exists
    const existingBusiness = await db.business.findUnique({
      where: { slug },
    });
    if (existingBusiness) {
      return NextResponse.json(
        { error: "Business slug (URL identifier) is already taken" },
        { status: 400 }
      );
    }

    // Hash the password
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    // Perform transaction
    const transaction = await db.$transaction(async (tx) => {
      // 1. Create Business
      const newBusiness = await tx.business.create({
        data: {
          name: businessName,
          slug,
          currency,
          taxConfig: { taxName: "VAT", rate: 10 },
        },
      });

      // 2. Create Subscription (30 day trial)
      const trialEndDate = new Date();
      trialEndDate.setDate(trialEndDate.getDate() + 30);

      await tx.subscription.create({
        data: {
          businessId: newBusiness.id,
          plan: "FREE_TRIAL",
          status: "ACTIVE",
          startDate: new Date(),
          endDate: trialEndDate,
          userLimit: 5,
          branchLimit: 1,
        },
      });

      // 3. Create Main Branch
      const newBranch = await tx.branch.create({
        data: {
          businessId: newBusiness.id,
          name: "Main Branch",
          isMain: true,
        },
      });

      // 4. Create User
      const newOwner = await tx.user.create({
        data: {
          businessId: newBusiness.id,
          branchId: newBranch.id,
          name: ownerName,
          email,
          passwordHash,
          role: "OWNER",
          phone,
        },
      });

      return { business: newBusiness, user: newOwner };
    });

    return NextResponse.json(
      {
        message: "Business registered successfully",
        business: {
          id: transaction.business.id,
          name: transaction.business.name,
          slug: transaction.business.slug,
        },
        user: {
          id: transaction.user.id,
          name: transaction.user.name,
          email: transaction.user.email,
          role: transaction.user.role,
        },
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("Registration error:", error);
    return NextResponse.json(
      { error: "Internal server error occurred during registration" },
      { status: 500 }
    );
  }
}
