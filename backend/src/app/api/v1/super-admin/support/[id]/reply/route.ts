import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionContext, authErrorResponse, roleErrorResponse } from "@/lib/api-helper";
import { logPlatformAudit } from "@/lib/platform-audit";
import { z } from "zod";

const replySchema = z.object({
  message: z.string().min(1, "Reply message cannot be empty"),
  status: z.string().optional(),
  reason: z.string().optional(),
});

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
    const parsed = replySchema.parse(body);

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

    let conversationList: any[] = [];
    if (existing.resolution) {
      try {
        const p = JSON.parse(existing.resolution);
        if (Array.isArray(p)) {
          conversationList = p;
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

    const newReply = {
      id: `msg-${Date.now()}`,
      senderName: (context as any).name || "Platform Support",
      role: "SUPER_ADMIN",
      message: parsed.message.trim(),
      createdAt: new Date().toISOString(),
    };

    conversationList.push(newReply);

    const targetStatus = parsed.status || (existing.status === "OPEN" ? "IN_PROGRESS" : existing.status);

    const updated = await db.platformSupportTicket.update({
      where: { id },
      data: {
        status: targetStatus,
        resolution: JSON.stringify(conversationList),
        ...(targetStatus === "RESOLVED" || targetStatus === "CLOSED" ? { resolvedAt: new Date() } : {}),
      },
      include: {
        business: {
          select: { id: true, name: true, slug: true, email: true },
        },
        user: { select: { id: true, name: true, email: true } },
      },
    });

    await logPlatformAudit({
      actorId: context.userId,
      actorRole: context.role,
      action: "SUPPORT_TICKET_REPLIED",
      targetType: "SYSTEM",
      targetId: id,
      businessId: existing.businessId,
      reason: parsed.reason || `Support reply dispatched: ${parsed.message.slice(0, 30)}`,
      beforeState: { status: existing.status },
      afterState: { status: targetStatus, repliesCount: conversationList.length },
    });

    return NextResponse.json({
      success: true,
      ticket: updated,
      reply: newReply,
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message || "Validation failed" }, { status: 400 });
    }
    console.error("POST /super-admin/support/[id]/reply error:", error);
    return NextResponse.json({ error: error.message || "Failed to reply to support ticket" }, { status: 500 });
  }
}

