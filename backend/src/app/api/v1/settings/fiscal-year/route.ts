import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionContext, authErrorResponse, roleErrorResponse } from "@/lib/api-helper";
import { z } from "zod";

const fiscalYearSchema = z.object({
  name: z.string().min(3, "Fiscal year name must be at least 3 characters"),
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
  isActive: z.boolean().default(false),
});

export async function GET() {
  const context = await getSessionContext();
  if (!context) return authErrorResponse();

  try {
    const fiscalYears = await db.fiscalYear.findMany({
      where: { businessId: context.businessId },
      orderBy: { startDate: "desc" },
    });

    return NextResponse.json(fiscalYears);
  } catch (error: any) {
    console.error("GET fiscal years error:", error);
    return NextResponse.json({ error: "Failed to retrieve fiscal years" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const context = await getSessionContext();
  if (!context) return authErrorResponse();

  // Settings are typically restricted to Owner or Manager
  if (context.role !== "OWNER" && context.role !== "SUPER_ADMIN" && context.role !== "MANAGER") {
    return roleErrorResponse();
  }

  try {
    const body = await request.json();
    const result = fiscalYearSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: "Validation failed", details: result.error.format() },
        { status: 400 }
      );
    }

    const { name, startDate, endDate, isActive } = result.data;

    const fiscalYear = await db.$transaction(async (tx) => {
      // If setting as active, deactivate all other fiscal years
      if (isActive) {
        await tx.fiscalYear.updateMany({
          where: { businessId: context.businessId, isActive: true },
          data: { isActive: false },
        });
      }

      // Create new fiscal year
      const fy = await tx.fiscalYear.create({
        data: {
          businessId: context.businessId,
          name,
          startDate: new Date(startDate),
          endDate: new Date(endDate),
          isActive,
        },
      });

      // Initialize invoice sequences for all existing branches
      const branches = await tx.branch.findMany({
        where: { businessId: context.businessId },
      });

      for (const branch of branches) {
        await tx.fiscalYearInvoiceSequence.upsert({
          where: {
            businessId_branchId_fiscalYearId: {
              businessId: context.businessId,
              branchId: branch.id,
              fiscalYearId: fy.id,
            },
          },
          update: {},
          create: {
            businessId: context.businessId,
            branchId: branch.id,
            fiscalYearId: fy.id,
            nextValue: 1,
          },
        });
      }

      // Write audit log
      const headers = request.headers;
      const xForwardedFor = headers.get("x-forwarded-for");
      const ipAddress = xForwardedFor ? xForwardedFor.split(",")[0].trim() : (headers.get("x-real-ip") || "127.0.0.1");
      const deviceInfo = headers.get("user-agent") || "Unknown Device";

      await tx.auditLog.create({
        data: {
          businessId: context.businessId,
          userId: context.userId,
          role: context.role,
          action: "CREATE",
          module: "SETTINGS",
          details: `Created fiscal year: "${name}" (${startDate.split("T")[0]} to ${endDate.split("T")[0]}). Active: ${isActive}`,
          newValue: JSON.parse(JSON.stringify(fy)),
          ipAddress,
          deviceInfo,
        },
      });

      return fy;
    });

    return NextResponse.json(fiscalYear, { status: 201 });
  } catch (error: any) {
    console.error("POST fiscal year error:", error);
    return NextResponse.json({ error: "Failed to create fiscal year" }, { status: 500 });
  }
}
