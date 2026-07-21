import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionContext, authErrorResponse, roleErrorResponse } from "@/lib/api-helper";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const context = await getSessionContext();
  if (!context) return authErrorResponse();
  if (context.role !== "SUPER_ADMIN") return roleErrorResponse();

  try {
    const { id } = await params;
    const reqItem = await db.businessRegistrationRequest.findUnique({
      where: { id },
    });

    if (!reqItem) {
      return NextResponse.json({ error: "Registration request not found" }, { status: 404 });
    }

    const { passwordHash, ...safeItem } = reqItem;
    return NextResponse.json({ request: safeItem });
  } catch (error: any) {
    return NextResponse.json({ error: "Failed to fetch request details" }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const context = await getSessionContext();
  if (!context) return authErrorResponse();
  if (context.role !== "SUPER_ADMIN") return roleErrorResponse();

  try {
    const { id } = await params;
    const body = await request.json();
    const { action, rejectionReason, adminNotes, overrides } = body;

    const reqItem = await db.businessRegistrationRequest.findUnique({
      where: { id },
    });

    if (!reqItem) {
      return NextResponse.json({ error: "Registration request not found" }, { status: 404 });
    }

    if (action === "REJECT") {
      const updated = await db.businessRegistrationRequest.update({
        where: { id },
        data: {
          status: "REJECTED",
          rejectionReason: rejectionReason || "The business registration request was rejected by platform administrator.",
          adminNotes: adminNotes || null,
        },
      });

      // Audit Log
      await db.auditLog.create({
        data: {
          businessId: context.businessId,
          userId: context.userId,
          role: context.role,
          action: "REJECT_BUSINESS_REQUEST",
          module: "SUPER_ADMIN",
          details: `Rejected registration request ${reqItem.trackingCode} for business ${reqItem.businessName}`,
        },
      });

      return NextResponse.json({
        message: "Registration request has been rejected.",
        request: updated,
      });
    }

    if (action === "REQUEST_CHANGES") {
      const updated = await db.businessRegistrationRequest.update({
        where: { id },
        data: {
          status: "CHANGES_REQUESTED",
          adminNotes: adminNotes || "Please review and update your submitted details.",
        },
      });

      // Audit Log
      await db.auditLog.create({
        data: {
          businessId: context.businessId,
          userId: context.userId,
          role: context.role,
          action: "REQUEST_CHANGES_BUSINESS_REQUEST",
          module: "SUPER_ADMIN",
          details: `Requested changes for registration request ${reqItem.trackingCode} for business ${reqItem.businessName}`,
        },
      });

      return NextResponse.json({
        message: "Requested changes sent to applicant.",
        request: updated,
      });
    }

    if (action === "APPROVE") {
      if (reqItem.status === "APPROVED") {
        return NextResponse.json({ error: "This request is already approved and provisioned." }, { status: 400 });
      }

      // Check if user email or slug already taken in actual tables
      const existingUser = await db.user.findUnique({ where: { email: reqItem.ownerEmail } });
      if (existingUser) {
        return NextResponse.json({ error: `User with email ${reqItem.ownerEmail} already exists in system.` }, { status: 400 });
      }

      const existingBusiness = await db.business.findUnique({ where: { slug: reqItem.slug } });
      if (existingBusiness) {
        return NextResponse.json({ error: `Business with URL slug '${reqItem.slug}' already exists.` }, { status: 400 });
      }

      // Final plan parameters
      const planToUse = overrides?.plan || reqItem.plan || "STARTER";
      const durationMonthsToUse = overrides?.durationMonths || reqItem.durationMonths || 12;
      const modulesToUse = overrides?.selectedModules || reqItem.selectedModules || {};
      const limitsToUse = overrides?.customLimits || reqItem.customLimits || {};

      // Determine user and branch limits
      const userLimit = limitsToUse.users || (planToUse === "ENTERPRISE" ? 10 : planToUse === "PROFESSIONAL" ? 5 : 1);
      const branchLimit = limitsToUse.branches || (planToUse === "ENTERPRISE" ? 5 : planToUse === "PROFESSIONAL" ? 2 : 1);

      // Perform transaction to provision tenant, subscription, branch, owner user
      const transaction = await db.$transaction(async (tx) => {
        // 1. Create Business Tenant
        const newBusiness = await tx.business.create({
          data: {
            name: reqItem.businessName,
            slug: reqItem.slug,
            currency: reqItem.currency,
            email: reqItem.email,
            phone: reqItem.phone,
            address: reqItem.address,
            taxConfig: { taxName: reqItem.taxNumber ? "PAN/VAT" : "VAT", rate: 10, taxNumber: reqItem.taxNumber },
            settings: {
              businessType: reqItem.businessType,
              currencySymbol: reqItem.currency === "NPR" ? "Rs. " : reqItem.currency === "INR" ? "₹" : "$",
              enableVat: true,
              vatPercentage: 10,
              customFeatures: modulesToUse,
              customLimits: limitsToUse,
            },
          },
        });

        // 2. Create Subscription
        const subEndDate = new Date();
        subEndDate.setMonth(subEndDate.getMonth() + durationMonthsToUse);

        await tx.subscription.create({
          data: {
            businessId: newBusiness.id,
            plan: planToUse.toUpperCase(),
            status: "ACTIVE",
            startDate: new Date(),
            endDate: subEndDate,
            userLimit,
            branchLimit,
          },
        });

        // 3. Create Main Branch
        const newBranch = await tx.branch.create({
          data: {
            businessId: newBusiness.id,
            name: "Main Branch",
            address: reqItem.address || undefined,
            phone: reqItem.phone || undefined,
            isMain: true,
          },
        });

        // 4. Create Owner User
        const newOwner = await tx.user.create({
          data: {
            businessId: newBusiness.id,
            branchId: newBranch.id,
            name: reqItem.ownerName,
            email: reqItem.ownerEmail,
            phone: reqItem.ownerPhone,
            passwordHash: reqItem.passwordHash,
            role: "OWNER",
          },
        });

        // 5. Update Registration Request Status
        const updatedReq = await tx.businessRegistrationRequest.update({
          where: { id },
          data: {
            status: "APPROVED",
            createdBusinessId: newBusiness.id,
            adminNotes: adminNotes || "Approved and provisioned by Super Admin.",
          },
        });

        return { business: newBusiness, owner: newOwner, request: updatedReq };
      });

      // Audit Log
      await db.auditLog.create({
        data: {
          businessId: context.businessId,
          userId: context.userId,
          role: context.role,
          action: "APPROVE_BUSINESS_REQUEST",
          module: "SUPER_ADMIN",
          details: `Approved registration request ${reqItem.trackingCode} and provisioned business tenant ${transaction.business.name} (ID: ${transaction.business.id})`,
        },
      });

      return NextResponse.json({
        message: `Business '${transaction.business.name}' successfully approved and provisioned!`,
        businessId: transaction.business.id,
        request: transaction.request,
      });
    }

    return NextResponse.json({ error: "Invalid action type" }, { status: 400 });
  } catch (error: any) {
    console.error("Super Admin request action error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to process request action" },
      { status: 500 }
    );
  }
}
