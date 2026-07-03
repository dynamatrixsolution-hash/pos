import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionContext, authErrorResponse, roleErrorResponse } from "@/lib/api-helper";
import bcrypt from "bcryptjs";
import { z } from "zod";

const businessCreationSchema = z.object({
  businessName: z.string().min(2, "Business name must be at least 2 characters"),
  slug: z.string().min(3, "Slug must be at least 3 characters").regex(/^[a-z0-9-]+$/, "Slug can only contain lowercase letters, numbers, and hyphens"),
  currency: z.string().default("USD"),
  ownerName: z.string().min(2, "Owner name must be at least 2 characters"),
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  phone: z.string().optional().nullable(),
  plan: z.enum(["FREE_TRIAL", "BASIC", "PREMIUM", "ENTERPRISE"]).default("FREE_TRIAL"),
  durationMonths: z.number().min(1).max(60).default(12),
});

export async function GET(request: Request) {
  const context = await getSessionContext();
  if (!context) return authErrorResponse();
  if (context.role !== "SUPER_ADMIN") return roleErrorResponse();

  try {
    const businesses = await db.business.findMany({
      where: {
        slug: { not: "platform-admin" },
      },
      include: {
        subscription: {
          select: {
            plan: true,
            status: true,
            endDate: true,
          },
        },
        users: {
          where: {
            role: "OWNER",
          },
          select: {
            name: true,
            email: true,
            phone: true,
          },
        },
        _count: {
          select: {
            branches: true,
            users: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return NextResponse.json({ businesses });
  } catch (error: any) {
    console.error("GET businesses error:", error);
    return NextResponse.json({ error: "Failed to fetch businesses" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const context = await getSessionContext();
  if (!context) return authErrorResponse();
  if (context.role !== "SUPER_ADMIN") return roleErrorResponse();

  try {
    const body = await request.json();
    const result = businessCreationSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: "Validation failed", details: result.error.format() },
        { status: 400 }
      );
    }

    const {
      businessName,
      slug,
      currency,
      ownerName,
      email,
      password,
      phone,
      plan,
      durationMonths,
    } = result.data;

    // Check if email is already taken
    const existingUser = await db.user.findUnique({ where: { email } });
    if (existingUser) {
      return NextResponse.json({ error: "Email is already registered" }, { status: 400 });
    }

    // Check if slug is already taken
    const existingBusiness = await db.business.findUnique({ where: { slug } });
    if (existingBusiness) {
      return NextResponse.json({ error: "Business slug (URL identifier) is already taken" }, { status: 400 });
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

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

      // 2. Create Subscription
      const subEndDate = new Date();
      subEndDate.setMonth(subEndDate.getMonth() + durationMonths);

      await tx.subscription.create({
        data: {
          businessId: newBusiness.id,
          plan,
          status: "ACTIVE",
          startDate: new Date(),
          endDate: subEndDate,
          userLimit: plan === "FREE_TRIAL" ? 5 : plan === "BASIC" ? 10 : plan === "PREMIUM" ? 25 : 100,
          branchLimit: plan === "FREE_TRIAL" ? 1 : plan === "BASIC" ? 2 : plan === "PREMIUM" ? 5 : 20,
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

      // 4. Create Owner User
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

      return { business: newBusiness, owner: newOwner };
    });

    // Write audit log entry
    try {
      await db.auditLog.create({
        data: {
          businessId: context.businessId,
          userId: context.userId,
          role: context.role,
          action: "CREATE_BUSINESS",
          module: "SUPER_ADMIN",
          details: `Provisioned business ${businessName} (slug: ${slug}) for owner ${ownerName} (${email})`,
        },
      });
    } catch (auditError) {
      console.error("Failed to write superadmin audit log:", auditError);
    }

    return NextResponse.json({
      message: "Business provisioned successfully",
      businessId: transaction.business.id,
      slug: transaction.business.slug,
    }, { status: 201 });

  } catch (error: any) {
    console.error("POST business creation error:", error);
    return NextResponse.json({ error: "Failed to provision business" }, { status: 500 });
  }
}
