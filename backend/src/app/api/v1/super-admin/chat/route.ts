import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionContext, authErrorResponse, roleErrorResponse, safeErrorMessage } from "@/lib/api-helper";
import { logPlatformAudit } from "@/lib/platform-audit";
import { dispatchNotification } from "@/lib/notifications";

// Default initial sample messages if thread is empty
const INITIAL_DEMO_MESSAGES: Record<string, Array<{ text: string; fromAdmin: boolean; minutesAgo: number }>> = {
  "pokhara-lakeside": [
    { text: "Hello Platform Admin, regarding our winter tariff updates and room folio taxes, can we confirm the CBMS fiscal sync status?", fromAdmin: false, minutesAgo: 35 },
    { text: "Hello Deepak. Yes, your CBMS fiscal sequence is active and syncing smoothly with Nepal IRD. All room folios will reflect the revised tariffs immediately.", fromAdmin: true, minutesAgo: 20 },
    { text: "Excellent, thank you for the quick confirmation!", fromAdmin: false, minutesAgo: 5 },
  ],
  "himalayan-coffee": [
    { text: "Hi, we are setting up two additional barista cashier terminals for the festive rush. Does our Professional plan allow this?", fromAdmin: false, minutesAgo: 120 },
    { text: "Hi Suman, yes! Your plan includes up to 8 staff accounts and 30 tables. You can generate cashier logins directly from Users & Access.", fromAdmin: true, minutesAgo: 95 },
  ],
  "restroinn-demo": [
    { text: "Greetings. We verified the offline SQLite pilot cache during our peak dinner shift yesterday. 142 KOT tickets reconciled without error.", fromAdmin: false, minutesAgo: 240 },
    { text: "Great news! The pilot resilience layer is designed for zero data loss during network hiccups.", fromAdmin: true, minutesAgo: 210 },
  ],
};

// GET /api/v1/super-admin/chat
export async function GET(request: Request) {
  const context = await getSessionContext();
  if (!context) return authErrorResponse();
  if (context.role !== "SUPER_ADMIN") return roleErrorResponse();

  try {
    const { searchParams } = new URL(request.url);
    const selectedOwnerId = searchParams.get("ownerId");
    const search = searchParams.get("search") || "";

    // 1. Fetch all tenant businesses with their owners/managers
    const businesses = await db.business.findMany({
      where: { slug: { not: "platform-admin" }, deletedAt: null },
      include: {
        users: {
          where: { role: { in: ["OWNER", "MANAGER"] }, deletedAt: null },
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            role: true,
            createdAt: true,
          },
        },
      },
      orderBy: { name: "asc" },
    });

    // 2. Build list of owners (strictly prioritize actual OWNER role)
    const ownerList: any[] = [];
    for (const b of businesses) {
      const primaryUser = b.users.find((u) => u.role === "OWNER") || b.users.find((u) => u.role === "MANAGER") || b.users[0];
      if (primaryUser) {
        ownerList.push({
          id: primaryUser.id,
          name: primaryUser.name,
          email: primaryUser.email,
          phone: primaryUser.phone || "+977-9800000000",
          role: primaryUser.role,
          businessId: b.id,
          businessName: b.name,
          businessSlug: b.slug,
          businessType: b.settings && (b.settings as any).businessType ? (b.settings as any).businessType : "Hospitality",
        });
      }
    }

    // 3. Load blocked owner IDs from PlatformSetting
    const blockedSetting = await db.platformSetting.findUnique({
      where: { key: "CHAT_BLOCKED_OWNERS" },
    });
    const blockedOwnerSet = new Set<string>(
      Array.isArray((blockedSetting?.value as any)?.ownerIds)
        ? (blockedSetting?.value as any).ownerIds
        : []
    );

    // 4. Attach latest message snippet and unread counts for each owner
    const ownersWithChat = await Promise.all(
      ownerList.map(async (owner) => {
        const lastMsg = await db.platformDirectMessage.findFirst({
          where: {
            OR: [
              { senderId: owner.id, receiverId: context.userId },
              { senderId: context.userId, receiverId: owner.id },
            ],
          },
          orderBy: { createdAt: "desc" },
        });

        const unreadCount = await db.platformDirectMessage.count({
          where: {
            senderId: owner.id,
            receiverId: context.userId,
            isRead: false,
          },
        });

        // Check if owner is blocked (setting is source of truth, fallback to legacy message flag)
        const isBlocked =
          blockedOwnerSet.has(owner.id) ||
          Boolean(
            await db.platformDirectMessage.findFirst({
              where: { senderId: owner.id, isBlocked: true },
              select: { id: true },
            })
          );

        return {
          ...owner,
          lastMessage: lastMsg
            ? {
                content: lastMsg.content,
                createdAt: lastMsg.createdAt.toISOString(),
                isMine: lastMsg.senderId === context.userId,
                isRead: lastMsg.isRead,
              }
            : {
                content: "Click to message owner",
                createdAt: new Date().toISOString(),
                isMine: false,
                isRead: true,
              },
          unreadCount,
          isBlocked,
        };
      })
    );

    // Filter by search query if present
    const filteredOwners = search.trim()
      ? ownersWithChat.filter(
          (o) =>
            o.name.toLowerCase().includes(search.toLowerCase()) ||
            o.businessName.toLowerCase().includes(search.toLowerCase()) ||
            o.email.toLowerCase().includes(search.toLowerCase())
        )
      : ownersWithChat;

    // 5. If an owner is selected, fetch their full conversation thread
    let activeMessages: any[] = [];
    const activeOwnerId = selectedOwnerId || (filteredOwners[0] ? filteredOwners[0].id : null);

    if (activeOwnerId) {
      // Mark received messages from this owner as read
      await db.platformDirectMessage.updateMany({
        where: {
          senderId: activeOwnerId,
          receiverId: context.userId,
          isRead: false,
        },
        data: {
          isRead: true,
          readAt: new Date(),
        },
      });

      const thread = await db.platformDirectMessage.findMany({
        where: {
          OR: [
            { senderId: activeOwnerId, receiverId: context.userId },
            { senderId: context.userId, receiverId: activeOwnerId },
          ],
        },
        orderBy: { createdAt: "asc" },
        include: {
          sender: { select: { id: true, name: true, role: true } },
        },
      });

      activeMessages = thread.map((m) => ({
        id: m.id,
        content: m.content,
        createdAt: m.createdAt.toISOString(),
        isMine: m.senderId === context.userId,
        isRead: m.isRead,
        senderName: m.sender.name,
      }));
    }

    return NextResponse.json({
      owners: filteredOwners,
      activeOwnerId,
      messages: activeMessages,
      summary: {
        totalConversations: filteredOwners.length,
        unreadTotal: filteredOwners.reduce((acc, o) => acc + o.unreadCount, 0),
      },
    });
  } catch (error: any) {
    console.error("GET direct chat error:", error);
    return NextResponse.json({ error: safeErrorMessage(error, "Failed to load direct messages") }, { status: 500 });
  }
}

// POST /api/v1/super-admin/chat
export async function POST(request: Request) {
  const context = await getSessionContext();
  if (!context) return authErrorResponse();
  if (context.role !== "SUPER_ADMIN") return roleErrorResponse();

  try {
    const body = await request.json();
    const { receiverId, content } = body;

    if (!receiverId) {
      return NextResponse.json({ error: "Receiver ID is required" }, { status: 400 });
    }
    if (!content || !content.trim()) {
      return NextResponse.json({ error: "Message content cannot be empty" }, { status: 400 });
    }

    // Verify receiver exists and find their business
    const receiver = await db.user.findUnique({
      where: { id: receiverId },
      include: { business: true },
    });

    if (!receiver) {
      return NextResponse.json({ error: "Target recipient not found" }, { status: 404 });
    }

    const message = await db.platformDirectMessage.create({
      data: {
        businessId: receiver.businessId,
        senderId: context.userId,
        receiverId: receiver.id,
        content: content.trim(),
        isRead: false,
      },
      include: {
        sender: { select: { id: true, name: true } },
      },
    });

    await logPlatformAudit({
      actorId: context.userId,
      actorRole: context.role,
      action: "DIRECT_MESSAGE_SENT",
      targetType: "SYSTEM",
      targetId: message.id,
      businessId: receiver.businessId,
      reason: `Direct message sent to ${receiver.name} (${receiver.business.name})`,
      afterState: { id: message.id, receiverId, contentLength: content.length },
    });

    void dispatchNotification({
      businessId: receiver.businessId,
      userId: receiver.id,
      category: "CHAT",
      priority: "HIGH",
      title: "New message from RestroInn Support",
      message: content.trim(),
      actionUrl: "/dashboard/support",
      dedupeKey: `sa-chat:${message.id}`,
    }).catch(() => {});

    return NextResponse.json({
      success: true,
      message: {
        id: message.id,
        content: message.content,
        createdAt: message.createdAt.toISOString(),
        isMine: true,
        isRead: false,
        senderName: message.sender.name,
      },
    });
  } catch (error: any) {
    console.error("POST direct chat error:", error);
    return NextResponse.json({ error: safeErrorMessage(error, "Failed to send message") }, { status: 500 });
  }
}

// PUT /api/v1/super-admin/chat (Block/Unblock or Mark Read)
export async function PUT(request: Request) {
  const context = await getSessionContext();
  if (!context) return authErrorResponse();
  if (context.role !== "SUPER_ADMIN") return roleErrorResponse();

  try {
    const body = await request.json();
    const { ownerId, action } = body;

    if (!ownerId) {
      return NextResponse.json({ error: "Owner ID is required" }, { status: 400 });
    }

    const targetUser = await db.user.findUnique({
      where: { id: ownerId },
      include: { business: true },
    });
    if (!targetUser) {
      return NextResponse.json({ error: "Owner not found" }, { status: 404 });
    }

    if (action === "TOGGLE_BLOCK") {
      const blockedSetting = await db.platformSetting.findUnique({
        where: { key: "CHAT_BLOCKED_OWNERS" },
      });
      const currentIds: string[] = Array.isArray((blockedSetting?.value as any)?.ownerIds)
        ? (blockedSetting?.value as any).ownerIds
        : [];
      const wasBlockedInSetting = currentIds.includes(ownerId);
      const wasBlockedInMsgs = Boolean(
        await db.platformDirectMessage.findFirst({
          where: { senderId: ownerId, isBlocked: true },
          select: { id: true },
        })
      );

      const nextBlockedState = !(wasBlockedInSetting || wasBlockedInMsgs);
      const nextIds = nextBlockedState
        ? Array.from(new Set([...currentIds, ownerId]))
        : currentIds.filter((id) => id !== ownerId);

      await db.$transaction([
        db.platformSetting.upsert({
          where: { key: "CHAT_BLOCKED_OWNERS" },
          update: { value: { ownerIds: nextIds }, updatedById: context.userId },
          create: {
            key: "CHAT_BLOCKED_OWNERS",
            value: { ownerIds: nextIds },
            category: "CHAT",
            description: "Blocked tenant owners in Super Admin direct chat",
            updatedById: context.userId,
          },
        }),
        db.platformDirectMessage.updateMany({
          where: { senderId: ownerId },
          data: { isBlocked: nextBlockedState },
        }),
      ]);

      await logPlatformAudit({
        actorId: context.userId,
        actorRole: context.role,
        action: nextBlockedState ? "DIRECT_MESSAGE_BLOCKED" : "DIRECT_MESSAGE_UNBLOCKED",
        targetType: "SYSTEM",
        targetId: ownerId,
        businessId: targetUser.businessId,
        reason: `Super Admin ${nextBlockedState ? "blocked" : "unblocked"} direct messaging with ${targetUser.name}`,
      });

      return NextResponse.json({
        success: true,
        isBlocked: nextBlockedState,
        message: nextBlockedState ? "Owner blocked from direct chat" : "Owner unblocked",
      });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("PUT direct chat error:", error);
    return NextResponse.json({ error: safeErrorMessage(error, "Failed to update chat state") }, { status: 500 });
  }
}

