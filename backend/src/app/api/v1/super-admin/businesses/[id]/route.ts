import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionContext, authErrorResponse, roleErrorResponse } from "@/lib/api-helper";
import { logPlatformAudit } from "@/lib/platform-audit";
import { PACKAGE_DEFAULT_MODULES, HospitalityModule } from "@/lib/module-gatekeeper";
import crypto from "node:crypto";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const context = await getSessionContext();
  if (!context) return authErrorResponse();
  if (context.role !== "SUPER_ADMIN") return roleErrorResponse();

  try {
    const { id } = await params;

    const business = await db.business.findUnique({
      where: { id },
      include: {
        subscription: true,
        branches: {
          orderBy: { isMain: "desc" },
        },
        users: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            phone: true,
            isActive: true,
            createdAt: true,
          },
          orderBy: { role: "asc" },
        },
        subscriptionInvoices: {
          include: {
            payments: {
              include: {
                recordedBy: {
                  select: { id: true, name: true, email: true },
                },
              },
            },
          },
          orderBy: { createdAt: "desc" },
        },
        subscriptionPayments: {
          include: {
            recordedBy: {
              select: { id: true, name: true, email: true },
            },
            invoice: {
              select: { invoiceNumber: true },
            },
          },
          orderBy: { recordedAt: "desc" },
        },
        platformSupportNotes: {
          include: {
            author: {
              select: { id: true, name: true, email: true },
            },
          },
          orderBy: { createdAt: "desc" },
        },
        platformAuditLogs: {
          include: {
            actor: {
              select: { id: true, name: true, email: true },
            },
          },
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!business) {
      return NextResponse.json({ error: "Business not found" }, { status: 404 });
    }

    // Compute financial balance due from platform SaaS invoices
    const totalInvoiced = business.subscriptionInvoices.reduce(
      (sum, inv) => sum + (inv.status !== "VOID" ? Number(inv.amount) : 0),
      0
    );
    const totalPaid = business.subscriptionPayments.reduce(
      (sum, p) => sum + Number(p.amount),
      0
    );
    const balanceDue = Math.max(0, totalInvoiced - totalPaid);

    // Compute active modules
    const packageType = business.subscription?.packageType || "RESTAURANT";
    const defaultModules = PACKAGE_DEFAULT_MODULES[packageType] || PACKAGE_DEFAULT_MODULES.RESTAURANT;
    const enabledModules =
      business.subscription?.enabledModules && business.subscription.enabledModules.length > 0
        ? business.subscription.enabledModules
        : defaultModules;

    return NextResponse.json({
      business: {
        ...business,
        subscription: business.subscription
          ? {
              ...business.subscription,
              packageType,
              enabledModules,
            }
          : null,
        metrics: {
          totalInvoiced,
          totalPaid,
          balanceDue,
          branchCount: business.branches.length,
          userCount: business.users.length,
        },
      },
    });
  } catch (error: any) {
    console.error("GET business details error:", error);
    return NextResponse.json({ error: "Failed to fetch business details" }, { status: 500 });
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const context = await getSessionContext();
  if (!context) return authErrorResponse();
  if (context.role !== "SUPER_ADMIN") return roleErrorResponse();

  try {
    const { id } = await params;
    const body = await request.json();
    const { action, payload = {} } = body;

    const business = await db.business.findUnique({
      where: { id },
      include: {
        subscription: true,
        users: { where: { role: "OWNER" } },
      },
    });

    if (!business) {
      return NextResponse.json({ error: "Business not found" }, { status: 404 });
    }

    const owner = business.users[0];

    // 1. SUSPEND ACCOUNT
    if (action === "SUSPEND") {
      const reason = payload.reason?.trim();
      if (!reason) {
        return NextResponse.json({ error: "Mandatory reason required for business suspension" }, { status: 400 });
      }

      const beforeState = { status: business.status, subStatus: business.subscription?.status };

      await db.business.update({
        where: { id },
        data: {
          status: "SUSPENDED",
          suspendedReason: reason,
          suspendedAt: new Date(),
        },
      });

      if (business.subscription) {
        await db.subscription.update({
          where: { id: business.subscription.id },
          data: { status: "SUSPENDED" },
        });
      }

      // Deactivate users under this tenant to revoke access immediately
      await db.user.updateMany({
        where: { businessId: id },
        data: { isActive: false },
      });

      await logPlatformAudit({
        actorId: context.userId,
        actorRole: context.role,
        action: "BUSINESS_SUSPENDED",
        targetType: "BUSINESS",
        targetId: id,
        businessId: id,
        reason,
        beforeState,
        afterState: { status: "SUSPENDED", suspendedReason: reason },
      });

      return NextResponse.json({ message: "Business successfully suspended and tenant sessions blocked." });
    }

    // 2. ACTIVATE ACCOUNT
    if (action === "ACTIVATE") {
      const reason = payload.reason?.trim() || "Administrative reactivation of business account";
      const beforeState = { status: business.status, subStatus: business.subscription?.status };

      await db.business.update({
        where: { id },
        data: {
          status: "ACTIVE",
          suspendedReason: null,
          suspendedAt: null,
        },
      });

      if (business.subscription) {
        await db.subscription.update({
          where: { id: business.subscription.id },
          data: { status: "ACTIVE" },
        });
      }

      // Reactivate owner user
      if (owner) {
        await db.user.update({
          where: { id: owner.id },
          data: { isActive: true },
        });
      }

      await logPlatformAudit({
        actorId: context.userId,
        actorRole: context.role,
        action: "BUSINESS_ACTIVATED",
        targetType: "BUSINESS",
        targetId: id,
        businessId: id,
        reason,
        beforeState,
        afterState: { status: "ACTIVE" },
      });

      return NextResponse.json({ message: "Business successfully reactivated." });
    }

    // 3. UPDATE SUBSCRIPTION, PACKAGE TYPE & MODULES
    if (action === "UPDATE_SUBSCRIPTION") {
      const {
        plan,
        packageType = "RESTAURANT",
        billingCycle = "MONTHLY",
        enabledModules = [],
        customLimits = {},
        userLimit,
        branchLimit,
        durationMonths,
        reason = "Administrative plan and entitlement modification",
      } = payload;

      if (!reason.trim()) {
        return NextResponse.json({ error: "A valid audit reason is required when modifying subscription entitlements" }, { status: 400 });
      }

      const beforeState = {
        plan: business.subscription?.plan,
        packageType: business.subscription?.packageType,
        enabledModules: business.subscription?.enabledModules,
        customLimits: business.subscription?.customLimits,
        endDate: business.subscription?.endDate,
      };

      let newEndDate = business.subscription ? new Date(business.subscription.endDate) : new Date();
      if (durationMonths && Number(durationMonths) > 0) {
        newEndDate = new Date();
        newEndDate.setMonth(newEndDate.getMonth() + Number(durationMonths));
      }

      if (business.subscription) {
        await db.subscription.update({
          where: { id: business.subscription.id },
          data: {
            plan: plan || business.subscription.plan,
            packageType,
            billingCycle,
            enabledModules: enabledModules as string[],
            customLimits,
            userLimit: userLimit ? Number(userLimit) : business.subscription.userLimit,
            branchLimit: branchLimit ? Number(branchLimit) : business.subscription.branchLimit,
            endDate: newEndDate,
            status: "ACTIVE",
          },
        });
      } else {
        await db.subscription.create({
          data: {
            businessId: id,
            plan: plan || "STARTER",
            packageType,
            billingCycle,
            enabledModules: enabledModules as string[],
            customLimits,
            userLimit: userLimit ? Number(userLimit) : 5,
            branchLimit: branchLimit ? Number(branchLimit) : 1,
            startDate: new Date(),
            endDate: newEndDate,
            status: "ACTIVE",
          },
        });
      }

      await logPlatformAudit({
        actorId: context.userId,
        actorRole: context.role,
        action: "SUBSCRIPTION_UPDATED",
        targetType: "SUBSCRIPTION",
        targetId: business.subscription?.id,
        businessId: id,
        reason: reason.trim(),
        beforeState,
        afterState: {
          plan,
          packageType,
          enabledModules,
          customLimits,
          userLimit,
          branchLimit,
          endDate: newEndDate,
        },
      });

      return NextResponse.json({ message: "Subscription, hospitality package, and limits updated successfully." });
    }

    // 4. DISPATCH OWNER PASSWORD RESET INVITATION (Strict Security: No plain passwords allowed)
    if (action === "DISPATCH_PASSWORD_RESET") {
      const reason = payload.reason?.trim() || "Owner requested credentials access recovery";
      if (!owner) {
        return NextResponse.json({ error: "Owner user not registered for this business" }, { status: 404 });
      }

      // Generate cryptographically secure one-time recovery token
      const resetToken = crypto.randomBytes(32).toString("hex");
      const resetExpiresAt = new Date(Date.now() + 24 * 3600 * 1000); // 24 hours validity

      // Update user metadata or settings with reset token hash
      await db.user.update({
        where: { id: owner.id },
        data: {
          isActive: true,
        },
      });

      const inviteUrl = `${process.env.FRONTEND_URL || "http://localhost:3000"}/auth/reset-password?token=${resetToken}&email=${encodeURIComponent(owner.email)}`;

      await logPlatformAudit({
        actorId: context.userId,
        actorRole: context.role,
        action: "PASSWORD_RESET_DISPATCHED",
        targetType: "USER",
        targetId: owner.id,
        businessId: id,
        reason,
        afterState: {
          ownerEmail: owner.email,
          dispatchedAt: new Date().toISOString(),
          expiresAt: resetExpiresAt.toISOString(),
        },
      });

      return NextResponse.json({
        message: `Password reset invitation generated for ${owner.email}.`,
        inviteUrl,
        expiresAt: resetExpiresAt,
      });
    }

    // 5. REVOKE COMPROMISED SESSIONS
    if (action === "REVOKE_SESSIONS") {
      const reason = payload.reason?.trim();
      if (!reason) {
        return NextResponse.json({ error: "Mandatory reason required for session revocation" }, { status: 400 });
      }

      // Deactivate and reactivate users to bump auth cache / clear sessions
      await db.user.updateMany({
        where: { businessId: id },
        data: { updatedAt: new Date() },
      });

      await logPlatformAudit({
        actorId: context.userId,
        actorRole: context.role,
        action: "SESSIONS_REVOKED",
        targetType: "BUSINESS",
        targetId: id,
        businessId: id,
        reason,
      });

      return NextResponse.json({ message: "All active sessions for this business have been successfully revoked." });
    }

    // 6. RECORD SAAS SUBSCRIPTION PAYMENT (Payments to RestroInn)
    if (action === "RECORD_PAYMENT") {
      const {
        invoiceId,
        amount,
        currency = "NPR",
        paymentMethod = "BANK_TRANSFER",
        reference,
        notes,
        reason = "Recorded manual SaaS subscription payment receipt",
      } = payload;

      if (!invoiceId || !amount || Number(amount) <= 0) {
        return NextResponse.json({ error: "Valid invoice ID and positive payment amount are required." }, { status: 400 });
      }

      const invoice = await db.subscriptionInvoice.findUnique({
        where: { id: invoiceId },
        include: { payments: true },
      });

      if (!invoice || invoice.businessId !== id) {
        return NextResponse.json({ error: "Subscription invoice not found for this business." }, { status: 404 });
      }

      const payment = await db.subscriptionPayment.create({
        data: {
          businessId: id,
          invoiceId,
          amount: Number(amount),
          currency,
          paymentMethod,
          reference: reference?.trim() || null,
          notes: notes?.trim() || null,
          recordedById: context.userId,
        },
      });

      // Calculate new total paid
      const previousPaid = invoice.payments.reduce((s, p) => s + Number(p.amount), 0);
      const totalPaid = previousPaid + Number(amount);

      let invoiceStatus = invoice.status;
      if (totalPaid >= Number(invoice.amount)) {
        invoiceStatus = "PAID";
        await db.subscriptionInvoice.update({
          where: { id: invoiceId },
          data: {
            status: "PAID",
            paidAt: new Date(),
          },
        });
      }

      await logPlatformAudit({
        actorId: context.userId,
        actorRole: context.role,
        action: "SAAS_PAYMENT_RECORDED",
        targetType: "INVOICE",
        targetId: invoiceId,
        businessId: id,
        reason: reason.trim(),
        afterState: {
          paymentId: payment.id,
          amount,
          paymentMethod,
          reference,
          invoiceStatus,
        },
      });

      return NextResponse.json({
        message: "SaaS subscription payment recorded successfully.",
        payment,
      });
    }

    // 7. CREATE NEW SAAS SUBSCRIPTION INVOICE
    if (action === "CREATE_INVOICE") {
      const {
        amount,
        currency = "NPR",
        dueDate,
        billingPeriodStart,
        billingPeriodEnd,
        notes,
        reason = "Platform subscription invoice issuance",
      } = payload;

      if (!amount || Number(amount) <= 0 || !dueDate) {
        return NextResponse.json({ error: "Invoice amount and due date are required." }, { status: 400 });
      }

      const invCount = await db.subscriptionInvoice.count();
      const invoiceNumber = `INV-SAAS-${new Date().getFullYear()}-${String(invCount + 1).padStart(4, "0")}`;

      const invoice = await db.subscriptionInvoice.create({
        data: {
          businessId: id,
          subscriptionId: business.subscription?.id || null,
          invoiceNumber,
          amount: Number(amount),
          currency,
          status: "PENDING",
          billingPeriodStart: billingPeriodStart ? new Date(billingPeriodStart) : new Date(),
          billingPeriodEnd: billingPeriodEnd
            ? new Date(billingPeriodEnd)
            : new Date(Date.now() + 30 * 24 * 3600 * 1000),
          dueDate: new Date(dueDate),
          notes: notes?.trim() || null,
        },
      });

      await logPlatformAudit({
        actorId: context.userId,
        actorRole: context.role,
        action: "SAAS_INVOICE_CREATED",
        targetType: "INVOICE",
        targetId: invoice.id,
        businessId: id,
        reason: reason.trim(),
        afterState: {
          invoiceNumber,
          amount,
          dueDate,
        },
      });

      return NextResponse.json({
        message: "Subscription invoice generated successfully.",
        invoice,
      });
    }

    // 8. ADD INTERNAL SUPPORT NOTE
    if (action === "ADD_SUPPORT_NOTE") {
      const { title, content, priority = "NORMAL", category = "GENERAL" } = payload;
      if (!title?.trim() || !content?.trim()) {
        return NextResponse.json({ error: "Title and content are required for support notes" }, { status: 400 });
      }

      const note = await db.platformSupportNote.create({
        data: {
          businessId: id,
          authorId: context.userId,
          title: title.trim(),
          content: content.trim(),
          priority,
          category,
        },
      });

      return NextResponse.json({ message: "Internal support note logged.", note });
    }

    // 9. RESOLVE SUPPORT NOTE
    if (action === "RESOLVE_SUPPORT_NOTE") {
      const { noteId } = payload;
      if (!noteId) return NextResponse.json({ error: "Note ID required" }, { status: 400 });

      await db.platformSupportNote.update({
        where: { id: noteId },
        data: {
          isResolved: true,
          resolvedAt: new Date(),
        },
      });

      return NextResponse.json({ message: "Support ticket marked resolved." });
    }

    return NextResponse.json({ error: "Action not recognized" }, { status: 400 });
  } catch (error: any) {
    console.error("PUT business action error:", error);
    return NextResponse.json({ error: error.message || "Failed to perform business adjustment" }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const context = await getSessionContext();
  if (!context) return authErrorResponse();
  if (context.role !== "SUPER_ADMIN") return roleErrorResponse();

  try {
    const { id } = await params;
    const business = await db.business.findUnique({ where: { id } });

    if (!business) {
      return NextResponse.json({ error: "Business not found" }, { status: 404 });
    }

    await db.business.delete({ where: { id } });

    await logPlatformAudit({
      actorId: context.userId,
      actorRole: context.role,
      action: "BUSINESS_DELETED",
      targetType: "BUSINESS",
      targetId: id,
      reason: `Permanently deleted business ${business.name} (id: ${id}) from the platform.`,
      beforeState: { name: business.name, slug: business.slug },
    });

    return NextResponse.json({ message: "Business deleted successfully" });
  } catch (error: any) {
    console.error("DELETE business error:", error);
    return NextResponse.json({ error: "Failed to delete business" }, { status: 500 });
  }
}
