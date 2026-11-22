-- Idempotent migration for 4-way Push Notifications (FCM + In-App) with Deduplication & Auto-Retention
ALTER TABLE "Notification"
  ADD COLUMN IF NOT EXISTS "userId" TEXT,
  ADD COLUMN IF NOT EXISTS "targetRoles" TEXT[] DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN IF NOT EXISTS "guestSessionId" TEXT,
  ADD COLUMN IF NOT EXISTS "category" TEXT NOT NULL DEFAULT 'SYSTEM',
  ADD COLUMN IF NOT EXISTS "priority" TEXT NOT NULL DEFAULT 'NORMAL',
  ADD COLUMN IF NOT EXISTS "actionUrl" TEXT,
  ADD COLUMN IF NOT EXISTS "metadata" JSONB,
  ADD COLUMN IF NOT EXISTS "dedupeKey" TEXT,
  ADD COLUMN IF NOT EXISTS "expiresAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "Notification_businessId_isRead_createdAt_idx" ON "Notification"("businessId", "isRead", "createdAt");
CREATE INDEX IF NOT EXISTS "Notification_userId_isRead_createdAt_idx" ON "Notification"("userId", "isRead", "createdAt");
CREATE INDEX IF NOT EXISTS "Notification_guestSessionId_createdAt_idx" ON "Notification"("guestSessionId", "createdAt");
CREATE INDEX IF NOT EXISTS "Notification_dedupeKey_createdAt_idx" ON "Notification"("dedupeKey", "createdAt");
CREATE INDEX IF NOT EXISTS "Notification_expiresAt_idx" ON "Notification"("expiresAt");

CREATE TABLE IF NOT EXISTS "DevicePushToken" (
  "id" TEXT NOT NULL,
  "token" TEXT NOT NULL,
  "platform" TEXT NOT NULL DEFAULT 'WEB',
  "userId" TEXT,
  "businessId" TEXT,
  "role" TEXT,
  "guestSessionId" TEXT,
  "deviceLabel" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "lastUsedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "DevicePushToken_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "DevicePushToken_token_key" ON "DevicePushToken"("token");
CREATE INDEX IF NOT EXISTS "DevicePushToken_userId_isActive_idx" ON "DevicePushToken"("userId", "isActive");
CREATE INDEX IF NOT EXISTS "DevicePushToken_businessId_role_isActive_idx" ON "DevicePushToken"("businessId", "role", "isActive");
CREATE INDEX IF NOT EXISTS "DevicePushToken_guestSessionId_isActive_idx" ON "DevicePushToken"("guestSessionId", "isActive");
