import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionContext, authErrorResponse, roleErrorResponse } from "@/lib/api-helper";

export async function GET(request: Request) {
  const context = await getSessionContext();
  if (!context) return authErrorResponse();
  if (context.role !== "SUPER_ADMIN") return roleErrorResponse();

  try {
    const { searchParams } = new URL(request.url);
    const statusFilter = searchParams.get("status") || "ALL";
    const search = searchParams.get("search") || "";

    const whereCondition: any = {};

    if (statusFilter !== "ALL") {
      whereCondition.status = statusFilter;
    }

    if (search.trim()) {
      const q = search.trim();
      whereCondition.OR = [
        { businessName: { contains: q, mode: "insensitive" } },
        { slug: { contains: q, mode: "insensitive" } },
        { email: { contains: q, mode: "insensitive" } },
        { ownerName: { contains: q, mode: "insensitive" } },
        { ownerEmail: { contains: q, mode: "insensitive" } },
        { trackingCode: { contains: q, mode: "insensitive" } },
      ];
    }

    const [requests, total, pending, changesRequested, approved, rejected] = await Promise.all([
      db.businessRegistrationRequest.findMany({
        where: whereCondition,
        orderBy: { createdAt: "desc" },
      }),
      db.businessRegistrationRequest.count(),
      db.businessRegistrationRequest.count({ where: { status: "PENDING" } }),
      db.businessRegistrationRequest.count({ where: { status: "CHANGES_REQUESTED" } }),
      db.businessRegistrationRequest.count({ where: { status: "APPROVED" } }),
      db.businessRegistrationRequest.count({ where: { status: "REJECTED" } }),
    ]);

    const safeRequests = requests.map(({ passwordHash, ...r }) => ({
      ...r,
      // Onboarding progress indicator calculation
      onboardingStep: r.status === "APPROVED" ? 5 : r.status === "CHANGES_REQUESTED" ? 3 : 4,
      onboardingProgress: r.status === "APPROVED" ? 100 : r.status === "CHANGES_REQUESTED" ? 60 : 80,
    }));

    return NextResponse.json({
      registrations: safeRequests,
      counts: {
        total,
        pending,
        changesRequested,
        approved,
        rejected,
        inProgress: pending + changesRequested,
      },
    });
  } catch (error: any) {
    console.error("GET super admin onboarding error:", error);
    return NextResponse.json(
      { error: "Failed to fetch onboarding pipeline records" },
      { status: 500 }
    );
  }
}

