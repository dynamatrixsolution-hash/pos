-- ==============================================================================
-- PHASE 7: GUEST SELF-SERVICE PORTAL & LOCATION QR SYSTEM
-- ==============================================================================

-- 1. CREATE TABLES
CREATE TABLE "QrLocation" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "publicCode" TEXT NOT NULL,
    "locationType" TEXT NOT NULL,
    "roomId" TEXT,
    "tableId" TEXT,
    "label" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "rotationCount" INTEGER NOT NULL DEFAULT 1,
    "metadata" JSONB,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QrLocation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "GuestAccessGrant" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "qrLocationId" TEXT NOT NULL,
    "grantType" TEXT NOT NULL,
    "stayId" TEXT,
    "tableSessionId" TEXT,
    "grantCodeHash" TEXT NOT NULL,
    "scopes" JSONB NOT NULL,
    "guestDisplayName" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "revokedReason" TEXT,
    "revokedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GuestAccessGrant_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "GuestSession" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "qrLocationId" TEXT NOT NULL,
    "grantId" TEXT NOT NULL,
    "stayId" TEXT,
    "tableSessionId" TEXT,
    "sessionTokenHash" TEXT NOT NULL,
    "deviceFingerprint" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "lastActiveAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GuestSession_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ServiceRequest" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "qrLocationId" TEXT NOT NULL,
    "grantId" TEXT,
    "guestSessionId" TEXT,
    "stayId" TEXT,
    "tableSessionId" TEXT,
    "roomId" TEXT,
    "tableId" TEXT,
    "requestNumber" TEXT NOT NULL,
    "requestType" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'RESTAURANT',
    "priority" TEXT NOT NULL DEFAULT 'NORMAL',
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "notes" TEXT,
    "idempotencyKey" TEXT,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acknowledgedAt" TIMESTAMP(3),
    "acknowledgedById" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "resolvedById" TEXT,
    "resolutionNotes" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServiceRequest_pkey" PRIMARY KEY ("id")
);

-- 2. CREATE INDEXES & UNIQUE CONSTRAINTS
CREATE UNIQUE INDEX "QrLocation_publicCode_key" ON "QrLocation"("publicCode");
CREATE UNIQUE INDEX "QrLocation_businessId_id_key" ON "QrLocation"("businessId", "id");
CREATE UNIQUE INDEX "QrLocation_businessId_roomId_key" ON "QrLocation"("businessId", "roomId");
CREATE UNIQUE INDEX "QrLocation_businessId_tableId_key" ON "QrLocation"("businessId", "tableId");
CREATE INDEX "QrLocation_businessId_branchId_locationType_isActive_idx" ON "QrLocation"("businessId", "branchId", "locationType", "isActive");

CREATE UNIQUE INDEX "GuestAccessGrant_grantCodeHash_key" ON "GuestAccessGrant"("grantCodeHash");
CREATE UNIQUE INDEX "GuestAccessGrant_businessId_id_key" ON "GuestAccessGrant"("businessId", "id");
CREATE INDEX "GuestAccessGrant_businessId_stayId_status_idx" ON "GuestAccessGrant"("businessId", "stayId", "status");
CREATE INDEX "GuestAccessGrant_businessId_tableSessionId_status_idx" ON "GuestAccessGrant"("businessId", "tableSessionId", "status");
CREATE INDEX "GuestAccessGrant_businessId_qrLocationId_status_idx" ON "GuestAccessGrant"("businessId", "qrLocationId", "status");

CREATE UNIQUE INDEX "GuestSession_sessionTokenHash_key" ON "GuestSession"("sessionTokenHash");
CREATE UNIQUE INDEX "GuestSession_businessId_id_key" ON "GuestSession"("businessId", "id");
CREATE INDEX "GuestSession_businessId_stayId_status_idx" ON "GuestSession"("businessId", "stayId", "status");
CREATE INDEX "GuestSession_businessId_tableSessionId_status_idx" ON "GuestSession"("businessId", "tableSessionId", "status");
CREATE INDEX "GuestSession_businessId_grantId_status_idx" ON "GuestSession"("businessId", "grantId", "status");

CREATE UNIQUE INDEX "ServiceRequest_businessId_id_key" ON "ServiceRequest"("businessId", "id");
CREATE UNIQUE INDEX "ServiceRequest_businessId_branchId_requestNumber_key" ON "ServiceRequest"("businessId", "branchId", "requestNumber");
CREATE INDEX "ServiceRequest_businessId_branchId_status_requestedAt_idx" ON "ServiceRequest"("businessId", "branchId", "status", "requestedAt");
CREATE INDEX "ServiceRequest_businessId_qrLocationId_requestType_requested_idx" ON "ServiceRequest"("businessId", "qrLocationId", "requestType", "requestedAt");
CREATE INDEX "ServiceRequest_businessId_stayId_status_idx" ON "ServiceRequest"("businessId", "stayId", "status");
CREATE INDEX "ServiceRequest_businessId_tableSessionId_status_idx" ON "ServiceRequest"("businessId", "tableSessionId", "status");

-- 3. ADD FOREIGN KEY CONSTRAINTS
ALTER TABLE "QrLocation" ADD CONSTRAINT "QrLocation_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "QrLocation" ADD CONSTRAINT "QrLocation_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "QrLocation" ADD CONSTRAINT "QrLocation_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "QrLocation" ADD CONSTRAINT "QrLocation_tableId_fkey" FOREIGN KEY ("tableId") REFERENCES "RestaurantTable"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "QrLocation" ADD CONSTRAINT "QrLocation_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "GuestAccessGrant" ADD CONSTRAINT "GuestAccessGrant_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GuestAccessGrant" ADD CONSTRAINT "GuestAccessGrant_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GuestAccessGrant" ADD CONSTRAINT "GuestAccessGrant_qrLocationId_fkey" FOREIGN KEY ("qrLocationId") REFERENCES "QrLocation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GuestAccessGrant" ADD CONSTRAINT "GuestAccessGrant_stayId_fkey" FOREIGN KEY ("stayId") REFERENCES "Stay"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GuestAccessGrant" ADD CONSTRAINT "GuestAccessGrant_tableSessionId_fkey" FOREIGN KEY ("tableSessionId") REFERENCES "TableSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GuestAccessGrant" ADD CONSTRAINT "GuestAccessGrant_revokedById_fkey" FOREIGN KEY ("revokedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "GuestSession" ADD CONSTRAINT "GuestSession_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GuestSession" ADD CONSTRAINT "GuestSession_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GuestSession" ADD CONSTRAINT "GuestSession_qrLocationId_fkey" FOREIGN KEY ("qrLocationId") REFERENCES "QrLocation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GuestSession" ADD CONSTRAINT "GuestSession_grantId_fkey" FOREIGN KEY ("grantId") REFERENCES "GuestAccessGrant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GuestSession" ADD CONSTRAINT "GuestSession_stayId_fkey" FOREIGN KEY ("stayId") REFERENCES "Stay"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GuestSession" ADD CONSTRAINT "GuestSession_tableSessionId_fkey" FOREIGN KEY ("tableSessionId") REFERENCES "TableSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ServiceRequest" ADD CONSTRAINT "ServiceRequest_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ServiceRequest" ADD CONSTRAINT "ServiceRequest_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ServiceRequest" ADD CONSTRAINT "ServiceRequest_qrLocationId_fkey" FOREIGN KEY ("qrLocationId") REFERENCES "QrLocation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ServiceRequest" ADD CONSTRAINT "ServiceRequest_grantId_fkey" FOREIGN KEY ("grantId") REFERENCES "GuestAccessGrant"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ServiceRequest" ADD CONSTRAINT "ServiceRequest_guestSessionId_fkey" FOREIGN KEY ("guestSessionId") REFERENCES "GuestSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ServiceRequest" ADD CONSTRAINT "ServiceRequest_stayId_fkey" FOREIGN KEY ("stayId") REFERENCES "Stay"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ServiceRequest" ADD CONSTRAINT "ServiceRequest_tableSessionId_fkey" FOREIGN KEY ("tableSessionId") REFERENCES "TableSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ServiceRequest" ADD CONSTRAINT "ServiceRequest_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ServiceRequest" ADD CONSTRAINT "ServiceRequest_tableId_fkey" FOREIGN KEY ("tableId") REFERENCES "RestaurantTable"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ServiceRequest" ADD CONSTRAINT "ServiceRequest_acknowledgedById_fkey" FOREIGN KEY ("acknowledgedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ServiceRequest" ADD CONSTRAINT "ServiceRequest_resolvedById_fkey" FOREIGN KEY ("resolvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
