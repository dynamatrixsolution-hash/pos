import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionContext, authErrorResponse, roleErrorResponse } from "@/lib/api-helper";
import { logPlatformAudit } from "@/lib/platform-audit";
import { PACKAGE_DEFAULT_MODULES } from "@/lib/module-gatekeeper";

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
      const reason = rejectionReason || adminNotes || "Application did not meet onboarding compliance standards.";
      const updated = await db.businessRegistrationRequest.update({
        where: { id },
        data: {
          status: "REJECTED",
          rejectionReason: reason,
          adminNotes: adminNotes ? `${adminNotes} (Reviewed by Super Admin)` : `Rejected by Super Admin: ${reason}`,
        },
      });

      await logPlatformAudit({
        actorId: context.userId,
        actorRole: context.role,
        action: "REGISTRATION_REJECTED",
        targetType: "BUSINESS",
        targetId: id,
        reason,
        afterState: { trackingCode: reqItem.trackingCode, status: "REJECTED" },
      });

      return NextResponse.json({
        message: "Registration request has been rejected.",
        request: updated,
      });
    }

    if (action === "REQUEST_CHANGES") {
      const reason = adminNotes || "Please review and correct registration details.";
      const updated = await db.businessRegistrationRequest.update({
        where: { id },
        data: {
          status: "CHANGES_REQUESTED",
          adminNotes: reason,
        },
      });

      await logPlatformAudit({
        actorId: context.userId,
        actorRole: context.role,
        action: "REGISTRATION_CHANGES_REQUESTED",
        targetType: "BUSINESS",
        targetId: id,
        reason,
        afterState: { trackingCode: reqItem.trackingCode, status: "CHANGES_REQUESTED" },
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

      const existingUser = await db.user.findUnique({ where: { email: reqItem.ownerEmail } });
      if (existingUser) {
        return NextResponse.json({ error: `User with email ${reqItem.ownerEmail} already exists in system.` }, { status: 400 });
      }

      const existingBusiness = await db.business.findUnique({ where: { slug: reqItem.slug } });
      if (existingBusiness) {
        return NextResponse.json({ error: `Business with URL slug '${reqItem.slug}' already exists.` }, { status: 400 });
      }

      // Map business type to package type
      let packageType = "RESTAURANT";
      const bTypeUpper = (reqItem.businessType || "").toUpperCase();
      if (bTypeUpper.includes("HOTEL") && (bTypeUpper.includes("REST") || bTypeUpper.includes("BOTH"))) {
        packageType = "BOTH";
      } else if (bTypeUpper.includes("HOTEL") || bTypeUpper.includes("STAY")) {
        packageType = "HOTEL";
      }

      const planToUse = overrides?.plan || reqItem.plan || "STARTER";
      const durationMonthsToUse = overrides?.durationMonths || reqItem.durationMonths || 12;
      const defaultModules = PACKAGE_DEFAULT_MODULES[packageType] || PACKAGE_DEFAULT_MODULES.RESTAURANT;
      const modulesToUse = overrides?.enabledModules || (Array.isArray(reqItem.selectedModules) ? reqItem.selectedModules : defaultModules);
      const limitsToUse = overrides?.customLimits || reqItem.customLimits || {};

      const userLimit = limitsToUse.users || (planToUse === "ENTERPRISE" ? 25 : planToUse === "PROFESSIONAL" ? 10 : 5);
      const branchLimit = limitsToUse.branches || (planToUse === "ENTERPRISE" ? 5 : planToUse === "PROFESSIONAL" ? 2 : 1);

      const transaction = await db.$transaction(async (tx) => {
        // 1. Create Business
        const newBusiness = await tx.business.create({
          data: {
            name: reqItem.businessName,
            slug: reqItem.slug,
            currency: reqItem.currency || "NPR",
            email: reqItem.email,
            phone: reqItem.phone,
            address: reqItem.address,
            status: "ACTIVE",
            taxConfig: { taxName: reqItem.taxNumber ? "PAN/VAT" : "VAT", rate: 13, taxNumber: reqItem.taxNumber },
            settings: {
              businessType: reqItem.businessType,
              currencySymbol: reqItem.currency === "NPR" ? "Rs. " : reqItem.currency === "INR" ? "₹" : "$",
              enableVat: true,
              vatPercentage: 13,
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
            packageType,
            billingCycle: reqItem.billingCycle || "MONTHLY",
            enabledModules: modulesToUse,
            customLimits: limitsToUse,
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

        // 5. Update Registration Request
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

      await logPlatformAudit({
        actorId: context.userId,
        actorRole: context.role,
        action: "REGISTRATION_APPROVED",
        targetType: "BUSINESS",
        targetId: transaction.business.id,
        businessId: transaction.business.id,
        reason: adminNotes || `Approved application ${reqItem.trackingCode} and provisioned workspace for ${reqItem.businessName}`,
        afterState: {
          businessId: transaction.business.id,
          plan: planToUse,
          packageType,
          modules: modulesToUse,
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
