import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionContext, authErrorResponse, roleErrorResponse } from "@/lib/api-helper";
import bcrypt from "bcryptjs";

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
    const { action, payload } = body;

    // Fetch existing business
    const business = await db.business.findUnique({
      where: { id },
      include: { subscription: true, users: { where: { role: "OWNER" } } },
    });

    if (!business) {
      return NextResponse.json({ error: "Business not found" }, { status: 404 });
    }

    const owner = business.users[0];

    // Handle actions
    if (action === "SUSPEND") {
      // 1. Suspend the subscription
      if (business.subscription) {
        await db.subscription.update({
          where: { id: business.subscription.id },
          data: { status: "SUSPENDED" },
        });
      }

      // 2. Set all users under this business as inactive to block login
      await db.user.updateMany({
        where: { businessId: id },
        data: { isActive: false },
      });

      await db.auditLog.create({
        data: {
          businessId: context.businessId,
          userId: context.userId,
          role: context.role,
          action: "SUSPEND_BUSINESS",
          module: "SUPER_ADMIN",
          details: `Suspended business ${business.name} (id: ${id}) and deactivated users`,
        },
      });

      return NextResponse.json({ message: "Business suspended successfully" });
    }

    if (action === "ACTIVATE") {
      // 1. Reactivate the subscription
      if (business.subscription) {
        await db.subscription.update({
          where: { id: business.subscription.id },
          data: { status: "ACTIVE" },
        });
      }

      // 2. Reactivate the OWNER user so they can log back in
      if (owner) {
        await db.user.update({
          where: { id: owner.id },
          data: { isActive: true },
        });
      }

      await db.auditLog.create({
        data: {
          businessId: context.businessId,
          userId: context.userId,
          role: context.role,
          action: "ACTIVATE_BUSINESS",
          module: "SUPER_ADMIN",
          details: `Activated business ${business.name} (id: ${id}) and reactivated owner`,
        },
      });

      return NextResponse.json({ message: "Business activated successfully" });
    }

    if (action === "RESET_PASSWORD") {
      if (!owner) {
        return NextResponse.json({ error: "Owner user not found for this business" }, { status: 404 });
      }

      const { newPassword } = payload;
      if (!newPassword || newPassword.length < 6) {
        return NextResponse.json({ error: "Password must be at least 6 characters" }, { status: 400 });
      }

      const salt = await bcrypt.genSalt(10);
      const passwordHash = await bcrypt.hash(newPassword, salt);

      await db.user.update({
        where: { id: owner.id },
        data: { passwordHash },
      });

      await db.auditLog.create({
        data: {
          businessId: context.businessId,
          userId: context.userId,
          role: context.role,
          action: "RESET_PASSWORD",
          module: "SUPER_ADMIN",
          details: `Reset password for owner ${owner.email} of business ${business.name}`,
        },
      });

      return NextResponse.json({ message: "Password reset successfully" });
    }

    if (action === "CREDENTIALS_CONTROL") {
      if (!owner) {
        return NextResponse.json({ error: "Owner user not found for this business" }, { status: 404 });
      }

      const { disableLogin, unlockAccount } = payload;

      const dataToUpdate: any = {};
      if (disableLogin !== undefined) {
        dataToUpdate.isActive = !disableLogin;
      }
      if (unlockAccount) {
        dataToUpdate.isActive = true;
        dataToUpdate.allowedDeviceId = null; // Unbind bound devices
        dataToUpdate.deviceName = null;
      }

      await db.user.update({
        where: { id: owner.id },
        data: dataToUpdate,
      });

      await db.auditLog.create({
        data: {
          businessId: context.businessId,
          userId: context.userId,
          role: context.role,
          action: "UPDATE_CREDENTIALS",
          module: "SUPER_ADMIN",
          details: `Updated credentials parameters for owner ${owner.email}`,
        },
      });

      return NextResponse.json({ message: "Credentials updated successfully" });
    }

    if (action === "PLAN_OVERRIDE") {
      const { plan, durationMonths, customFeatures, customLimits } = payload;

      // 1. Update subscription parameters
      if (business.subscription) {
        const subEndDate = new Date(business.subscription.endDate);
        if (durationMonths) {
          subEndDate.setMonth(subEndDate.getMonth() + Number(durationMonths));
        }

        await db.subscription.update({
          where: { id: business.subscription.id },
          data: {
            plan: plan || business.subscription.plan,
            endDate: subEndDate,
            userLimit: customLimits?.users || business.subscription.userLimit,
            branchLimit: customLimits?.branches || business.subscription.branchLimit,
          },
        });
      }

      // 2. Save overrides inside business settings
      const settings = (business.settings as any) || {};
      const newSettings = {
        ...settings,
        customFeatures: customFeatures || settings.customFeatures || {},
        customLimits: customLimits || settings.customLimits || {},
      };

      await db.business.update({
        where: { id },
        data: { settings: newSettings },
      });

      await db.auditLog.create({
        data: {
          businessId: context.businessId,
          userId: context.userId,
          role: context.role,
          action: "UPDATE_PLAN",
          module: "SUPER_ADMIN",
          details: `Updated subscription & custom overrides for business ${business.name}`,
        },
      });

      return NextResponse.json({ message: "Subscription updated successfully" });
    }

    return NextResponse.json({ error: "Action not recognized" }, { status: 400 });
  } catch (error: any) {
    console.error("PUT business action error:", error);
    return NextResponse.json({ error: "Failed to perform business adjustment" }, { status: 500 });
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

    // Cascade delete business
    await db.business.delete({ where: { id } });

    await db.auditLog.create({
      data: {
        businessId: context.businessId,
        userId: context.userId,
        role: context.role,
        action: "DELETE_BUSINESS",
        module: "SUPER_ADMIN",
        details: `Deleted business ${business.name} (id: ${id}) from the platform`,
      },
    });

    return NextResponse.json({ message: "Business deleted successfully" });
  } catch (error: any) {
    console.error("DELETE business error:", error);
    return NextResponse.json({ error: "Failed to delete business" }, { status: 500 });
  }
}
