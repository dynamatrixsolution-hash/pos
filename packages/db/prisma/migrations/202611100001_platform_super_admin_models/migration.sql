-- CreateTable: SubscriptionInvoice
CREATE TABLE IF NOT EXISTS "SubscriptionInvoice" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "subscriptionId" TEXT,
    "invoiceNumber" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'NPR',
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "billingPeriodStart" TIMESTAMP(3) NOT NULL,
    "billingPeriodEnd" TIMESTAMP(3) NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "paidAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SubscriptionInvoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable: SubscriptionPayment
CREATE TABLE IF NOT EXISTS "SubscriptionPayment" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'NPR',
    "paymentMethod" TEXT NOT NULL DEFAULT 'BANK_TRANSFER',
    "reference" TEXT,
    "notes" TEXT,
    "recordedById" TEXT,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SubscriptionPayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable: PlatformAuditLog
CREATE TABLE IF NOT EXISTS "PlatformAuditLog" (
    "id" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "actorRole" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT,
    "businessId" TEXT,
    "reason" TEXT NOT NULL,
    "beforeState" JSONB,
    "afterState" JSONB,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlatformAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable: PlatformSupportNote
CREATE TABLE IF NOT EXISTS "PlatformSupportNote" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "priority" TEXT NOT NULL DEFAULT 'NORMAL',
    "category" TEXT NOT NULL DEFAULT 'GENERAL',
    "isResolved" BOOLEAN NOT NULL DEFAULT false,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlatformSupportNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable: PlatformBackupRecord
CREATE TABLE IF NOT EXISTS "PlatformBackupRecord" (
    "id" TEXT NOT NULL,
    "backupFileName" TEXT NOT NULL,
    "backupType" TEXT NOT NULL DEFAULT 'DATABASE_DUMP',
    "sizeBytes" BIGINT NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'SUCCESS',
    "verifiedRestore" BOOLEAN NOT NULL DEFAULT false,
    "restoreTestedAt" TIMESTAMP(3),
    "restoreTestResult" TEXT,
    "restoreNotes" TEXT,
    "durationSec" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlatformBackupRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable: PlatformModuleConfig
CREATE TABLE IF NOT EXISTS "PlatformModuleConfig" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "iconName" TEXT NOT NULL DEFAULT 'Box',
    "restaurantIncluded" BOOLEAN NOT NULL DEFAULT false,
    "hotelIncluded" BOOLEAN NOT NULL DEFAULT false,
    "bothIncluded" BOOLEAN NOT NULL DEFAULT true,
    "starterIncluded" BOOLEAN NOT NULL DEFAULT false,
    "standardIncluded" BOOLEAN NOT NULL DEFAULT true,
    "proIncluded" BOOLEAN NOT NULL DEFAULT true,
    "enterpriseIncluded" BOOLEAN NOT NULL DEFAULT true,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlatformModuleConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable: PlatformNotice
CREATE TABLE IF NOT EXISTS "PlatformNotice" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "subheading" TEXT,
    "body" TEXT NOT NULL,
    "priority" TEXT NOT NULL DEFAULT 'INFO',
    "audience" TEXT NOT NULL DEFAULT 'ALL',
    "targetRoles" TEXT[] DEFAULT ARRAY['OWNER', 'MANAGER']::TEXT[],
    "channels" TEXT[] DEFAULT ARRAY['IN_APP']::TEXT[],
    "startsAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlatformNotice_pkey" PRIMARY KEY ("id")
);

-- CreateTable: PlatformSetting
CREATE TABLE IF NOT EXISTS "PlatformSetting" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'GENERAL',
    "description" TEXT,
    "updatedById" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlatformSetting_pkey" PRIMARY KEY ("id")
);

-- CreateTable: PlatformSupportTicket
CREATE TABLE IF NOT EXISTS "PlatformSupportTicket" (
    "id" TEXT NOT NULL,
    "ticketNumber" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "userId" TEXT,
    "subject" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'GENERAL',
    "priority" TEXT NOT NULL DEFAULT 'MEDIUM',
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "description" TEXT NOT NULL,
    "assignedTo" TEXT,
    "resolution" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlatformSupportTicket_pkey" PRIMARY KEY ("id")
);

-- CreateTable: PlatformDirectMessage
CREATE TABLE IF NOT EXISTS "PlatformDirectMessage" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "receiverId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "readAt" TIMESTAMP(3),
    "isBlocked" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlatformDirectMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable: PlatformPushBroadcast
CREATE TABLE IF NOT EXISTS "PlatformPushBroadcast" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "targetRole" TEXT NOT NULL DEFAULT 'ALL',
    "targetProperty" TEXT NOT NULL DEFAULT 'ALL',
    "propertySlug" TEXT,
    "propertyName" TEXT,
    "imageUrl" TEXT,
    "channels" TEXT[] DEFAULT ARRAY['IN_APP', 'PUSH']::TEXT[],
    "sentCount" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'DELIVERED',
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlatformPushBroadcast_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "SubscriptionInvoice_invoiceNumber_key" ON "SubscriptionInvoice"("invoiceNumber");
CREATE UNIQUE INDEX IF NOT EXISTS "SubscriptionInvoice_businessId_id_key" ON "SubscriptionInvoice"("businessId", "id");
CREATE INDEX IF NOT EXISTS "SubscriptionInvoice_businessId_status_idx" ON "SubscriptionInvoice"("businessId", "status");
CREATE INDEX IF NOT EXISTS "SubscriptionInvoice_status_dueDate_idx" ON "SubscriptionInvoice"("status", "dueDate");

CREATE UNIQUE INDEX IF NOT EXISTS "SubscriptionPayment_businessId_id_key" ON "SubscriptionPayment"("businessId", "id");
CREATE INDEX IF NOT EXISTS "SubscriptionPayment_businessId_recordedAt_idx" ON "SubscriptionPayment"("businessId", "recordedAt");

CREATE INDEX IF NOT EXISTS "PlatformAuditLog_actorId_createdAt_idx" ON "PlatformAuditLog"("actorId", "createdAt");
CREATE INDEX IF NOT EXISTS "PlatformAuditLog_businessId_createdAt_idx" ON "PlatformAuditLog"("businessId", "createdAt");
CREATE INDEX IF NOT EXISTS "PlatformAuditLog_action_createdAt_idx" ON "PlatformAuditLog"("action", "createdAt");

CREATE INDEX IF NOT EXISTS "PlatformSupportNote_businessId_createdAt_idx" ON "PlatformSupportNote"("businessId", "createdAt");
CREATE INDEX IF NOT EXISTS "PlatformSupportNote_isResolved_priority_idx" ON "PlatformSupportNote"("isResolved", "priority");

CREATE INDEX IF NOT EXISTS "PlatformBackupRecord_status_createdAt_idx" ON "PlatformBackupRecord"("status", "createdAt");

CREATE UNIQUE INDEX IF NOT EXISTS "PlatformModuleConfig_code_key" ON "PlatformModuleConfig"("code");
CREATE INDEX IF NOT EXISTS "PlatformModuleConfig_category_sortOrder_idx" ON "PlatformModuleConfig"("category", "sortOrder");

CREATE INDEX IF NOT EXISTS "PlatformNotice_isActive_priority_startsAt_idx" ON "PlatformNotice"("isActive", "priority", "startsAt");

CREATE UNIQUE INDEX IF NOT EXISTS "PlatformSetting_key_key" ON "PlatformSetting"("key");
CREATE INDEX IF NOT EXISTS "PlatformSetting_category_key_idx" ON "PlatformSetting"("category", "key");

CREATE UNIQUE INDEX IF NOT EXISTS "PlatformSupportTicket_ticketNumber_key" ON "PlatformSupportTicket"("ticketNumber");
CREATE INDEX IF NOT EXISTS "PlatformSupportTicket_businessId_status_priority_idx" ON "PlatformSupportTicket"("businessId", "status", "priority");

CREATE INDEX IF NOT EXISTS "PlatformDirectMessage_businessId_createdAt_idx" ON "PlatformDirectMessage"("businessId", "createdAt");
CREATE INDEX IF NOT EXISTS "PlatformDirectMessage_senderId_receiverId_createdAt_idx" ON "PlatformDirectMessage"("senderId", "receiverId", "createdAt");

CREATE INDEX IF NOT EXISTS "PlatformPushBroadcast_targetRole_createdAt_idx" ON "PlatformPushBroadcast"("targetRole", "createdAt");
CREATE INDEX IF NOT EXISTS "PlatformPushBroadcast_targetProperty_createdAt_idx" ON "PlatformPushBroadcast"("targetProperty", "createdAt");

