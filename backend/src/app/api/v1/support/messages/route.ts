import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getSessionContext, authErrorResponse } from "@/lib/api-helper";

const sendMessageSchema = z.object({
  content: z.string().trim().min(1, "Message cannot be empty").max(1500),
});

async function resolveAdminUser() {
  return db.user.findFirst({
    where: { role: "SUPER_ADMIN", isActive: true, deletedAt: null },
    select: { id: true, name: true, email: true },
    orderBy: { createdAt: "asc" },
  });
}

async function isUserChatBlocked(userId: string) {
  const blockedSetting = await db.platformSetting.findUnique({
    where: { key: "CHAT_BLOCKED_OWNERS" },
  });
  const ids: string[] = Array.isArray((blockedSetting?.value as any)?.ownerIds)
    ? (blockedSetting?.value as any).ownerIds
    : [];
  if (ids.includes(userId)) return true;

  const blockedMsg = await db.platformDirectMessage.findFirst({
    where: { senderId: userId, isBlocked: true },
    select: { id: true },
  });
  return Boolean(blockedMsg);
}

export async function GET() {
  const context = await getSessionContext();
  if (!context) return authErrorResponse();

  try {
    const admin = await resolveAdminUser();
    if (!admin) {
      return NextResponse.json({ messages: [], admin: null, isBlocked: false });
    }

    // Mark incoming messages from Super Admin as read
    await db.platformDirectMessage.updateMany({
      where: {
        businessId: context.businessId,
        senderId: admin.id,
        receiverId: context.userId,
        isRead: false,
      },
      data: { isRead: true, readAt: new Date() },
    });

    const [messages, isBlocked] = await Promise.all([
      db.platformDirectMessage.findMany({
        where: {
          businessId: context.businessId,
          OR: [
            { senderId: context.userId, receiverId: admin.id },
            { senderId: admin.id, receiverId: context.userId },
          ],
        },
        orderBy: { createdAt: "asc" },
        take: 100,
      }),
      isUserChatBlocked(context.userId),
    ]);

    return NextResponse.json({
      admin: { id: admin.id, name: admin.name || "RestroInn Platform Support" },
      isBlocked,
      messages: messages.map((m) => ({
        id: m.id,
        content: m.content,
        isMine: m.senderId === context.userId,
        isRead: m.isRead,
        createdAt: m.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    console.error("GET /api/v1/support/messages error:", error);
    return NextResponse.json({ error: "Failed to load direct messages" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const context = await getSessionContext();
  if (!context) return authErrorResponse();

  try {
    const body = await request.json();
    const parsed = sendMessageSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Invalid message" },
        { status: 400 }
      );
    }

    const admin = await resolveAdminUser();
    if (!admin) {
      return NextResponse.json({ error: "Platform support is currently unavailable." }, { status: 503 });
    }

    const blocked = await isUserChatBlocked(context.userId);
    if (blocked) {
      return NextResponse.json(
        { error: "Direct messaging has been restricted for this account. Please open a support ticket instead." },
        { status: 403 }
      );
    }

    const created = await db.platformDirectMessage.create({
      data: {
        businessId: context.businessId,
        senderId: context.userId,
        receiverId: admin.id,
        content: parsed.data.content,
        isRead: false,
      },
    });

    return NextResponse.json(
      {
        success: true,
        message: {
          id: created.id,
          content: created.content,
          isMine: true,
          isRead: created.isRead,
          createdAt: created.createdAt.toISOString(),
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("POST /api/v1/support/messages error:", error);
    return NextResponse.json({ error: "Failed to send message" }, { status: 500 });
  }
}
