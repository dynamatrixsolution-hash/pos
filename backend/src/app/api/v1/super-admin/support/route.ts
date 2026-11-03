import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionContext, authErrorResponse, roleErrorResponse } from "@/lib/api-helper";
import { logPlatformAudit } from "@/lib/platform-audit";

function parseTicketConversation(ticket: any) {
  const messages: any[] = [];

  // 1. Root message from the requester / property
  messages.push({
    id: `init-${ticket.id}`,
    senderName: ticket.user?.name || ticket.business?.name || "Client Requester",
    role: "CLIENT",
    message: ticket.description,
    createdAt: ticket.createdAt,
  });

  // 2. Follow-up conversation messages or resolution
  if (ticket.resolution) {
    try {
      const parsed = JSON.parse(ticket.resolution);
      if (Array.isArray(parsed)) {
        for (const msg of parsed) {
          messages.push(msg);
        }
        return messages;
      }
    } catch {
      // Plain text resolution
      messages.push({
        id: `res-${ticket.id}`,
        senderName: ticket.assignedTo || "Platform Support",
        role: "SUPER_ADMIN",
        message: ticket.resolution,
        createdAt: ticket.resolvedAt || ticket.updatedAt || ticket.createdAt,
      });
    }
  }

  return messages;
}

// GET /api/v1/super-admin/support
export async function GET(request: Request) {
  const context = await getSessionContext();
  if (!context) return authErrorResponse();
  if (context.role !== "SUPER_ADMIN") return roleErrorResponse();

  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const priority = searchParams.get("priority");
    const category = searchParams.get("category");

    const where: any = {};
    if (status && status !== "ALL") where.status = status;
    if (priority && priority !== "ALL") where.priority = priority;
    if (category && category !== "ALL") where.category = category;

    const tickets = await db.platformSupportTicket.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        business: {
          select: {
            id: true,
            name: true,
            slug: true,
            email: true,
            phone: true,
            subscription: {
              select: { packageType: true },
            },
          },
        },
        user: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    const allTickets = await db.platformSupportTicket.findMany({
      select: { status: true, priority: true },
    });

    const metrics = {
      total: allTickets.length,
      open: allTickets.filter((t) => t.status === "OPEN").length,
      inProgress: allTickets.filter((t) => t.status === "IN_PROGRESS").length,
      resolved: allTickets.filter((t) => t.status === "RESOLVED" || t.status === "CLOSED").length,
      urgent: allTickets.filter((t) => (t.priority === "URGENT" || t.priority === "HIGH") && t.status !== "RESOLVED" && t.status !== "CLOSED").length,
    };

    return NextResponse.json({
      tickets: tickets.map((t) => ({
        id: t.id,
        ticketNumber: t.ticketNumber,
        businessId: t.businessId,
        business: {
          id: t.business.id,
          name: t.business.name,
          slug: t.business.slug,
          email: t.business.email,
          phone: t.business.phone,
          packageType: t.business.subscription?.packageType || "RESTAURANT",
        },
        user: t.user,
        subject: t.subject,
        category: t.category,
        priority: t.priority,
        status: t.status,
        description: t.description,
        assignedTo: t.assignedTo,
        resolution: t.resolution,
        conversation: parseTicketConversation(t),
        resolvedAt: t.resolvedAt,
        createdAt: t.createdAt,
      })),
      metrics,
    });
  } catch (error: any) {
    console.error("GET support tickets error:", error);
    return NextResponse.json({ error: error.message || "Failed to load support tickets" }, { status: 500 });
  }
}

// POST /api/v1/super-admin/support - Create ticket
export async function POST(request: Request) {
  const context = await getSessionContext();
  if (!context) return authErrorResponse();

  try {
    const body = await request.json();
    const { businessId, subject, category, priority, description } = body;

    const targetBusinessId = businessId || context.businessId;
    if (!targetBusinessId) {
      return NextResponse.json({ error: "Target business ID is required" }, { status: 400 });
    }
    if (!subject || !subject.trim()) {
      return NextResponse.json({ error: "Ticket subject is required" }, { status: 400 });
    }
    if (!description || !description.trim()) {
      return NextResponse.json({ error: "Ticket description is required" }, { status: 400 });
    }

    const ticketNumber = `TICK-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;

    const ticket = await db.platformSupportTicket.create({
      data: {
        ticketNumber,
        businessId: targetBusinessId,
        userId: context.userId,
        subject: subject.trim(),
        category: category || "GENERAL",
        priority: priority || "MEDIUM",
        status: "OPEN",
        description: description.trim(),
      },
      include: {
        business: { select: { name: true } },
      },
    });

    return NextResponse.json({ success: true, ticket });
  } catch (error: any) {
    console.error("POST support ticket error:", error);
    return NextResponse.json({ error: error.message || "Failed to create support ticket" }, { status: 500 });
  }
}

// PUT /api/v1/super-admin/support - Update status, reply to ticket, or resolve
export async function PUT(request: Request) {
  const context = await getSessionContext();
  if (!context) return authErrorResponse();
  if (context.role !== "SUPER_ADMIN") return roleErrorResponse();

  try {
    const body = await request.json();
    const { id, status, assignedTo, resolution, replyMessage, reason } = body;

    if (!id) {
      return NextResponse.json({ error: "Ticket ID is required" }, { status: 400 });
    }
    const auditReason = reason || (replyMessage ? `Support reply dispatched: ${replyMessage.slice(0, 30)}` : "Support ticket status update");
    if (auditReason.trim().length < 5) {
      return NextResponse.json({ error: "A valid administrative audit reason (min 5 characters) is required" }, { status: 400 });
    }

    const existing = await db.platformSupportTicket.findUnique({
      where: { id },
      include: {
        business: true,
        user: true,
      },
    });
    if (!existing) {
      return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
    }

    const updateData: any = {};
    if (status) {
      updateData.status = status;
      if (status === "RESOLVED" || status === "CLOSED") {
        updateData.resolvedAt = new Date();
      }
    } else if (replyMessage && existing.status === "OPEN") {
      updateData.status = "IN_PROGRESS";
    }

    if (assignedTo !== undefined) updateData.assignedTo = assignedTo;

    // Handle conversation reply
    if (replyMessage && replyMessage.trim()) {
      let conversationList: any[] = [];
      if (existing.resolution) {
        try {
          const parsed = JSON.parse(existing.resolution);
          if (Array.isArray(parsed)) {
            conversationList = parsed;
          } else {
            conversationList = [{
              id: `res-${existing.id}`,
              senderName: existing.assignedTo || "Platform Support",
              role: "SUPER_ADMIN",
              message: existing.resolution,
              createdAt: existing.resolvedAt || new Date().toISOString(),
            }];
          }
        } catch {
          conversationList = [{
            id: `res-${existing.id}`,
            senderName: existing.assignedTo || "Platform Support",
            role: "SUPER_ADMIN",
            message: existing.resolution,
            createdAt: existing.resolvedAt || new Date().toISOString(),
          }];
        }
      }

      conversationList.push({
        id: `msg-${Date.now()}`,
        senderName: context.name || "Platform Support",
        role: "SUPER_ADMIN",
        message: replyMessage.trim(),
        createdAt: new Date().toISOString(),
      });

      updateData.resolution = JSON.stringify(conversationList);
    } else if (resolution !== undefined) {
      updateData.resolution = resolution;
    }

    const updated = await db.platformSupportTicket.update({
      where: { id },
      data: updateData,
      include: {
        business: {
          select: {
            id: true,
            name: true,
            slug: true,
            email: true,
            phone: true,
            subscription: { select: { packageType: true } },
          },
        },
        user: { select: { id: true, name: true, email: true } },
      },
    });

    await logPlatformAudit({
      actorId: context.userId,
      actorRole: context.role,
      action: "SUPPORT_TICKET_UPDATED",
      targetType: "SYSTEM",
      targetId: id,
      businessId: existing.businessId,
      reason: auditReason.trim(),
      beforeState: { status: existing.status, assignedTo: existing.assignedTo },
      afterState: { status: updated.status, assignedTo: updated.assignedTo, resolution: updated.resolution },
    });

    return NextResponse.json({
      success: true,
      ticket: {
        id: updated.id,
        ticketNumber: updated.ticketNumber,
        businessId: updated.businessId,
        business: updated.business,
        user: updated.user,
        subject: updated.subject,
        category: updated.category,
        priority: updated.priority,
        status: updated.status,
        description: updated.description,
        assignedTo: updated.assignedTo,
        resolution: updated.resolution,
        conversation: parseTicketConversation(updated),
        resolvedAt: updated.resolvedAt,
        createdAt: updated.createdAt,
      },
    });
  } catch (error: any) {
    console.error("PUT support ticket error:", error);
    return NextResponse.json({ error: error.message || "Failed to update support ticket" }, { status: 500 });
  }
}
