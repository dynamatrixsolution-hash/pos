import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import bcrypt from "bcryptjs";
import { z } from "zod";

function generateTrackingCode(): string {
  const year = new Date().getFullYear();
  const randomChars = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `REQ-${year}-${randomChars}`;
}

const registerRequestSchema = z.object({
  businessName: z.string().min(2, "Business name must be at least 2 characters"),
  slug: z.string().min(3, "Slug must be at least 3 characters").regex(/^[a-z0-9-]+$/, "Slug can only contain lowercase letters, numbers, and hyphens"),
  businessType: z.string().default("RETAIL"),
  currency: z.string().default("USD"),
  taxNumber: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  email: z.string().email("Invalid business email"),
  address: z.string().optional().nullable(),
  logo: z.string().optional().nullable(),

  plan: z.string().default("STARTER"),
  billingCycle: z.string().default("MONTHLY"),
  durationMonths: z.number().default(12),
  selectedModules: z.record(z.string(), z.boolean()).optional(),
  customLimits: z.record(z.string(), z.number()).optional(),

  ownerName: z.string().min(2, "Owner name must be at least 2 characters"),
  ownerEmail: z.string().email("Invalid owner email address"),
  ownerPhone: z.string().optional().nullable(),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const result = registerRequestSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: "Validation failed", details: result.error.format() },
        { status: 400 }
      );
    }

    const data = result.data;

    // Check if owner email is already taken in registered users
    const existingUser = await db.user.findUnique({
      where: { email: data.ownerEmail },
    });
    if (existingUser) {
      return NextResponse.json(
        { error: "An account with this email address already exists" },
        { status: 400 }
      );
    }

    // Check if business slug is already taken
    const existingBusiness = await db.business.findUnique({
      where: { slug: data.slug },
    });
    if (existingBusiness) {
      return NextResponse.json(
        { error: "Business workspace URL slug is already taken" },
        { status: 400 }
      );
    }

    // Check if there's already a pending request for this slug or owner email
    const existingPending = await db.businessRegistrationRequest.findFirst({
      where: {
        OR: [
          { slug: data.slug },
          { ownerEmail: data.ownerEmail }
        ],
        status: { in: ["PENDING", "CHANGES_REQUESTED"] },
      },
    });

    if (existingPending) {
      return NextResponse.json(
        {
          error: "A registration request with this URL slug or owner email is currently undergoing review.",
          requestId: existingPending.id,
          trackingCode: existingPending.trackingCode,
        },
        { status: 400 }
      );
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(data.password, salt);

    let trackingCode = generateTrackingCode();
    // Ensure tracking code uniqueness
    let attempts = 0;
    while (attempts < 5) {
      const checkCode = await db.businessRegistrationRequest.findUnique({
        where: { trackingCode },
      });
      if (!checkCode) break;
      trackingCode = generateTrackingCode();
      attempts++;
    }

    const newRequest = await db.businessRegistrationRequest.create({
      data: {
        trackingCode,
        businessName: data.businessName,
        slug: data.slug,
        businessType: data.businessType,
        currency: data.currency,
        taxNumber: data.taxNumber,
        phone: data.phone,
        email: data.email,
        address: data.address,
        logo: data.logo,
        plan: data.plan,
        billingCycle: data.billingCycle,
        durationMonths: data.durationMonths,
        selectedModules: (data.selectedModules || {}) as any,
        customLimits: (data.customLimits || {}) as any,
        ownerName: data.ownerName,
        ownerEmail: data.ownerEmail,
        ownerPhone: data.ownerPhone,
        passwordHash,
        status: "PENDING",
      },
    });

    return NextResponse.json(
      {
        message: "Business registration request submitted successfully",
        request: {
          id: newRequest.id,
          trackingCode: newRequest.trackingCode,
          businessName: newRequest.businessName,
          status: newRequest.status,
          createdAt: newRequest.createdAt,
        },
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("Register request error:", error);
    return NextResponse.json(
      { error: "Failed to submit business registration request" },
      { status: 500 }
    );
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    const code = searchParams.get("code");

    if (!id && !code) {
      return NextResponse.json(
        { error: "Request ID or Tracking Code is required" },
        { status: 400 }
      );
    }

    const regRequest = await db.businessRegistrationRequest.findFirst({
      where: {
        OR: [
          id ? { id } : {},
          code ? { trackingCode: code } : {},
        ],
      },
    });

    if (!regRequest) {
      return NextResponse.json(
        { error: "Registration request not found" },
        { status: 404 }
      );
    }

    // Omit sensitive hash
    const { passwordHash, ...safeData } = regRequest;

    return NextResponse.json({ request: safeData });
  } catch (error: any) {
    console.error("Get request status error:", error);
    return NextResponse.json(
      { error: "Failed to retrieve registration request" },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { id, trackingCode, ...updateData } = body;

    if (!id && !trackingCode) {
      return NextResponse.json(
        { error: "Request ID or Tracking Code is required" },
        { status: 400 }
      );
    }

    const existingRequest = await db.businessRegistrationRequest.findFirst({
      where: {
        OR: [
          id ? { id } : {},
          trackingCode ? { trackingCode } : {},
        ],
      },
    });

    if (!existingRequest) {
      return NextResponse.json(
        { error: "Registration request not found" },
        { status: 404 }
      );
    }

    if (existingRequest.status !== "CHANGES_REQUESTED") {
      return NextResponse.json(
        { error: `Request cannot be modified in state '${existingRequest.status}'` },
        { status: 400 }
      );
    }

    let passwordHash = existingRequest.passwordHash;
    if (updateData.password && updateData.password.trim().length >= 6) {
      const salt = await bcrypt.genSalt(10);
      passwordHash = await bcrypt.hash(updateData.password, salt);
    }

    const updated = await db.businessRegistrationRequest.update({
      where: { id: existingRequest.id },
      data: {
        businessName: updateData.businessName || existingRequest.businessName,
        slug: updateData.slug || existingRequest.slug,
        businessType: updateData.businessType || existingRequest.businessType,
        currency: updateData.currency || existingRequest.currency,
        taxNumber: updateData.taxNumber !== undefined ? updateData.taxNumber : existingRequest.taxNumber,
        phone: updateData.phone !== undefined ? updateData.phone : existingRequest.phone,
        email: updateData.email || existingRequest.email,
        address: updateData.address !== undefined ? updateData.address : existingRequest.address,
        plan: updateData.plan || existingRequest.plan,
        billingCycle: updateData.billingCycle || existingRequest.billingCycle,
        durationMonths: updateData.durationMonths || existingRequest.durationMonths,
        selectedModules: (updateData.selectedModules || existingRequest.selectedModules || {}) as any,
        customLimits: (updateData.customLimits || existingRequest.customLimits || {}) as any,
        ownerName: updateData.ownerName || existingRequest.ownerName,
        ownerEmail: updateData.ownerEmail || existingRequest.ownerEmail,
        ownerPhone: updateData.ownerPhone !== undefined ? updateData.ownerPhone : existingRequest.ownerPhone,
        passwordHash,
        status: "PENDING", // Reset to pending for admin review
        rejectionReason: null,
      },
    });

    const { passwordHash: _, ...safeUpdated } = updated;

    return NextResponse.json({
      message: "Request details updated and resubmitted for approval.",
      request: safeUpdated,
    });
  } catch (error: any) {
    console.error("Update registration request error:", error);
    return NextResponse.json(
      { error: "Failed to update registration request" },
      { status: 500 }
    );
  }
}
