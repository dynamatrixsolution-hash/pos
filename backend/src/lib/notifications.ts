import { db } from "@/lib/db";
import { getFirebaseMessaging } from "@/lib/firebase-admin";

export type NotificationCategory =
  | "ORDER"
  | "KITCHEN"
  | "SERVICE_REQUEST"
  | "BILLING"
  | "SUBSCRIPTION"
  | "SUPPORT"
  | "CHAT"
  | "BROADCAST"
  | "SYSTEM";

export type NotificationPriority = "LOW" | "NORMAL" | "HIGH" | "URGENT";

export interface DispatchNotificationInput {
  businessId: string;
  title: string;
  message: string;
  category: NotificationCategory;
  type?: string;
  priority?: NotificationPriority;
  userId?: string | null;
  targetRoles?: string[];
  guestSessionId?: string | null;
  actionUrl?: string | null;
  metadata?: Record<string, any> | null;
  /** Deterministic key preventing duplicate / loop sends within dedupeWindowMs */
  dedupeKey?: string;
  /** Deduplication window in ms (default 5 minutes) */
  dedupeWindowMs?: number;
  /** Retention period in days (clamped 10..30, default 21) */
  retentionDays?: number;
  /** Skip FCM push (persist in-app only) */
  inAppOnly?: boolean;
}

// Fast in-memory dedupe lock to block rapid burst/loop duplicates before DB roundtrip
const recentDedupeMap = new Map<string, number>();
let lastPruneAt = 0;
const PRUNE_INTERVAL_MS = 60 * 60 * 1000; // Run retention cleanup at most once per hour

function getRetentionDays(override?: number): number {
  const envDays = Number(process.env.NOTIFICATION_RETENTION_DAYS || 21);
  const raw = override ?? (Number.isFinite(envDays) ? envDays : 21);
  return Math.max(10, Math.min(30, Math.round(raw)));
}

function triggerThrottledRetentionPrune() {
  const now = Date.now();
  if (now - lastPruneAt < PRUNE_INTERVAL_MS) return;
  lastPruneAt = now;

  // Sweep in-memory dedupe map
  for (const [k, exp] of recentDedupeMap.entries()) {
    if (exp < now) recentDedupeMap.delete(k);
  }

  const fallbackCutoff = new Date(now - getRetentionDays() * 24 * 60 * 60 * 1000);
  const staleTokenCutoff = new Date(now - 60 * 24 * 60 * 60 * 1000);

  // Fire-and-forget DB cleanup so old notifications never bloat server storage
  void Promise.all([
    db.notification.deleteMany({
      where: {
        OR: [{ expiresAt: { lt: new Date(now) } }, { createdAt: { lt: fallbackCutoff } }],
      },
    }),
    db.devicePushToken.deleteMany({
      where: {
        OR: [
          { isActive: false, updatedAt: { lt: staleTokenCutoff } },
          { lastUsedAt: { lt: staleTokenCutoff } },
        ],
      },
    }),
  ]).catch((err) => {
    console.error("[Notifications] Retention prune failed:", err);
  });
}

async function isDuplicate(dedupeKey: string, windowMs: number): Promise<boolean> {
  const now = Date.now();
  const memExpiry = recentDedupeMap.get(dedupeKey);
  if (memExpiry && memExpiry > now) {
    return true;
  }

  // Reserve immediately to stop concurrent duplicate calls
  recentDedupeMap.set(dedupeKey, now + windowMs);

  const windowStart = new Date(now - windowMs);
  const existing = await db.notification.findFirst({
    where: {
      dedupeKey,
      createdAt: { gte: windowStart },
    },
    select: { id: true },
  });

  return Boolean(existing);
}

async function resolvePushTokens(input: DispatchNotificationInput): Promise<string[]> {
  const where: any = { isActive: true };

  if (input.guestSessionId) {
    where.guestSessionId = input.guestSessionId;
  } else if (input.userId) {
    where.userId = input.userId;
  } else {
    where.businessId = input.businessId;
    if (input.targetRoles && input.targetRoles.length > 0) {
      where.role = { in: input.targetRoles.map((r) => r.toUpperCase()) };
    }
  }

  const rows = await db.devicePushToken.findMany({
    where,
    select: { token: true },
    take: 500,
  });

  return Array.from(new Set(rows.map((r) => r.token).filter(Boolean)));
}

async function sendFcmMulticast(
  tokens: string[],
  input: DispatchNotificationInput,
  notificationId: string
): Promise<number> {
  if (tokens.length === 0) return 0;
  const messaging = getFirebaseMessaging();
  if (!messaging) return 0;

  let successCount = 0;
  const deadTokens: string[] = [];

  const dataPayload: Record<string, string> = {
    notificationId,
    category: input.category,
    priority: input.priority || "NORMAL",
    actionUrl: input.actionUrl || "/dashboard",
    businessId: input.businessId,
  };
  if (input.dedupeKey) dataPayload.dedupeKey = input.dedupeKey;

  for (let i = 0; i < tokens.length; i += 500) {
    const batch = tokens.slice(i, i + 500);
    try {
      const response = await messaging.sendEachForMulticast({
        tokens: batch,
        notification: {
          title: input.title,
          body: input.message,
        },
        data: dataPayload,
        webpush: {
          headers: {
            Urgency: input.priority === "URGENT" || input.priority === "HIGH" ? "high" : "normal",
          },
          fcmOptions: {
            link: input.actionUrl || "/dashboard",
          },
        },
        android: {
          priority: input.priority === "URGENT" || input.priority === "HIGH" ? "high" : "normal",
          notification: {
            sound: "default",
            channelId: "restroinn_alerts",
          },
        },
        apns: {
          payload: {
            aps: {
              sound: "default",
              badge: 1,
            },
          },
        },
      });

      successCount += response.successCount;
      response.responses.forEach((res, idx) => {
        if (!res.success && res.error?.code) {
          const code = res.error.code;
          if (
            code === "messaging/registration-token-not-registered" ||
            code === "messaging/invalid-registration-token"
          ) {
            deadTokens.push(batch[idx]);
          }
        }
      });
    } catch (err) {
      console.error("[FCM] Multicast send failed:", err);
    }
  }

  if (deadTokens.length > 0) {
    void db.devicePushToken
      .updateMany({
        where: { token: { in: deadTokens } },
        data: { isActive: false },
      })
      .catch(() => {});
  }

  return successCount;
}

/**
 * Unified 4-way notification dispatcher:
 * - Prevents duplicate/loop notifications via `dedupeKey`
 * - Enforces automatic 10-30 day retention cleanup
 * - Persists in-app notification + sends FCM push to Web & Mobile devices
 */
export async function dispatchNotification(input: DispatchNotificationInput) {
  triggerThrottledRetentionPrune();

  const windowMs = input.dedupeWindowMs ?? 5 * 60 * 1000;
  if (input.dedupeKey && (await isDuplicate(input.dedupeKey, windowMs))) {
    return { skipped: true as const, id: null, fcmSent: 0 };
  }

  const retentionMs = getRetentionDays(input.retentionDays) * 24 * 60 * 60 * 1000;
  const expiresAt = new Date(Date.now() + retentionMs);
  const normalizedRoles = (input.targetRoles || []).map((r) => r.toUpperCase());

  const record = await db.notification.create({
    data: {
      businessId: input.businessId,
      userId: input.userId || null,
      targetRoles: normalizedRoles,
      guestSessionId: input.guestSessionId || null,
      title: input.title.slice(0, 160),
      message: input.message.slice(0, 500),
      type: input.type || input.category,
      category: input.category,
      priority: input.priority || "NORMAL",
      actionUrl: input.actionUrl || null,
      metadata: (input.metadata ?? undefined) as any,
      dedupeKey: input.dedupeKey || null,
      expiresAt,
    },
  });

  let fcmSent = 0;
  if (!input.inAppOnly) {
    const tokens = await resolvePushTokens({ ...input, targetRoles: normalizedRoles });
    fcmSent = await sendFcmMulticast(tokens, input, record.id);
  }

  return { skipped: false as const, id: record.id, fcmSent };
}

/**
 * Convenience helper to notify all active Super Admins (Business -> Super Admin flow).
 */
export async function notifySuperAdmins(
  input: Omit<DispatchNotificationInput, "businessId" | "targetRoles" | "userId">
) {
  const platformBiz = await db.business.findUnique({
    where: { slug: "platform-admin" },
    select: { id: true },
  });
  if (!platformBiz) return { skipped: true as const, id: null, fcmSent: 0 };

  return dispatchNotification({
    ...input,
    businessId: platformBiz.id,
    targetRoles: ["SUPER_ADMIN"],
  });
}
