import { NextResponse } from "next/server";
import crypto from "crypto";
import { z } from "zod";
import { db } from "@/lib/db";
import { getSessionContext, authErrorResponse } from "@/lib/api-helper";
import { notifySuperAdmins } from "@/lib/notifications";

const createTicketSchema = z.object({
  subject: z.string().trim().min(3, "Subject must be at least 3 characters").max(160),
  category: z.enum(["GENERAL", "BILLING", "TECHNICAL", "HARDWARE", "FEATURE_REQUEST"]).default("GENERAL"),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).default("MEDIUM"),
  description: z.string().trim().min(10, "Please describe the issue (at least 10 characters)").max(2000),
});

export async function GET() {
  const context = await getSessionContext();
  if (!context) return authErrorResponse();

  try {
    const tickets = await db.platformSupportTicket.findMany({
      where: { businessId: context.businessId },
      include: {
        user: { select: { id: true, name: true, email: true, role: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    return NextResponse.json({ tickets });
  } catch (error) {
    console.error("GET /api/v1/support/tickets error:", error);
    return NextResponse.json({ error: "Failed to load support tickets" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const context = await getSessionContext();
  if (!context) return authErrorResponse();

  try {
    const body = await request.json();
    const parsed = createTicketSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Invalid support ticket" },
        { status: 400 }
      );
    }

    const { subject, category, priority, description } = parsed.data;
    const ticketNumber = `TICK-${new Date().getFullYear()}-${crypto.randomInt(1000, 9999)}`;

    const ticket = await db.platformSupportTicket.create({
      data: {
        ticketNumber,
        businessId: context.businessId,
        userId: context.userId,
        subject,
        category,
        priority,
        status: "OPEN",
        description,
      },
      include: {
        user: { select: { id: true, name: true, email: true, role: true } },
      },
    });

    void notifySuperAdmins({
      category: "SUPPORT",
      priority: priority === "URGENT" ? "URGENT" : "HIGH",
      title: `New Support Ticket (${ticketNumber})`,
      message: `${subject} — Priority: ${priority}`,
      actionUrl: "/dashboard/super-admin/support",
      dedupeKey: `ticket-new:${ticket.id}`,
    }).catch(() => {});

    return NextResponse.json(
      { success: true, ticket, message: `Support ticket ${ticketNumber} submitted.` },
      { status: 201 }
    );
  } catch (error) {
    console.error("POST /api/v1/support/tickets error:", error);
    return NextResponse.json({ error: "Failed to submit support ticket" }, { status: 500 });
  }
}
