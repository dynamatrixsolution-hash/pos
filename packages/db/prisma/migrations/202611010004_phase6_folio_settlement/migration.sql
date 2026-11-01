-- ==============================================================================
-- PHASE 6: GUEST FOLIOS & CROSS-MODULE COMBINED SETTLEMENT
-- ==============================================================================

-- 1. CREATE TABLES
CREATE TABLE "GuestFolio" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "stayId" TEXT NOT NULL,
    "folioNumber" TEXT NOT NULL,
    "windowName" TEXT NOT NULL DEFAULT 'PRIMARY',
    "guestName" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "chargesTotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "creditsTotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "paymentsTotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "balance" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "lockedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "notes" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GuestFolio_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RoomNightCharge" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "stayId" TEXT NOT NULL,
    "folioId" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "chargeDate" TIMESTAMP(3) NOT NULL,
    "ratePlan" TEXT DEFAULT 'STANDARD',
    "baseRate" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "taxAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "totalAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'POSTED',
    "postedById" TEXT,
    "postedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RoomNightCharge_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "FolioEntry" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "folioId" TEXT NOT NULL,
    "stayId" TEXT NOT NULL,
    "entryNumber" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "postingKind" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'OTHER',
    "description" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "taxAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "totalAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "direction" TEXT NOT NULL DEFAULT 'DEBIT',
    "isRevenueRecognizedHere" BOOLEAN NOT NULL DEFAULT true,
    "reversedEntryId" TEXT,
    "metadata" JSONB,
    "postedById" TEXT,
    "postedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FolioEntry_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "FolioSettlementAllocation" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "folioId" TEXT NOT NULL,
    "stayId" TEXT NOT NULL,
    "paymentId" TEXT,
    "paymentMethod" TEXT NOT NULL DEFAULT 'CASH',
    "amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "reference" TEXT,
    "status" TEXT NOT NULL DEFAULT 'APPLIED',
    "notes" TEXT,
    "allocatedById" TEXT,
    "allocatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FolioSettlementAllocation_pkey" PRIMARY KEY ("id")
);

-- 2. CREATE INDEXES & UNIQUE CONSTRAINTS
CREATE UNIQUE INDEX "GuestFolio_businessId_id_key" ON "GuestFolio"("businessId", "id");
CREATE UNIQUE INDEX "GuestFolio_businessId_branchId_folioNumber_key" ON "GuestFolio"("businessId", "branchId", "folioNumber");
CREATE UNIQUE INDEX "GuestFolio_businessId_stayId_windowName_key" ON "GuestFolio"("businessId", "stayId", "windowName");
CREATE INDEX "GuestFolio_businessId_stayId_status_idx" ON "GuestFolio"("businessId", "stayId", "status");
CREATE INDEX "GuestFolio_businessId_branchId_status_idx" ON "GuestFolio"("businessId", "branchId", "status");

CREATE UNIQUE INDEX "RoomNightCharge_businessId_id_key" ON "RoomNightCharge"("businessId", "id");
CREATE UNIQUE INDEX "RoomNightCharge_businessId_stayId_chargeDate_key" ON "RoomNightCharge"("businessId", "stayId", "chargeDate");
CREATE INDEX "RoomNightCharge_businessId_folioId_idx" ON "RoomNightCharge"("businessId", "folioId");
CREATE INDEX "RoomNightCharge_businessId_branchId_chargeDate_idx" ON "RoomNightCharge"("businessId", "branchId", "chargeDate");

CREATE UNIQUE INDEX "FolioEntry_businessId_id_key" ON "FolioEntry"("businessId", "id");
CREATE UNIQUE INDEX "FolioEntry_businessId_sourceType_sourceId_postingKind_key" ON "FolioEntry"("businessId", "sourceType", "sourceId", "postingKind");
CREATE INDEX "FolioEntry_businessId_folioId_postedAt_idx" ON "FolioEntry"("businessId", "folioId", "postedAt");
CREATE INDEX "FolioEntry_businessId_stayId_category_idx" ON "FolioEntry"("businessId", "stayId", "category");
CREATE INDEX "FolioEntry_businessId_sourceType_sourceId_idx" ON "FolioEntry"("businessId", "sourceType", "sourceId");

CREATE UNIQUE INDEX "FolioSettlementAllocation_businessId_id_key" ON "FolioSettlementAllocation"("businessId", "id");
CREATE INDEX "FolioSettlementAllocation_businessId_folioId_idx" ON "FolioSettlementAllocation"("businessId", "folioId");
CREATE INDEX "FolioSettlementAllocation_businessId_stayId_idx" ON "FolioSettlementAllocation"("businessId", "stayId");

-- 3. ADD FOREIGN KEY CONSTRAINTS
ALTER TABLE "GuestFolio" ADD CONSTRAINT "GuestFolio_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GuestFolio" ADD CONSTRAINT "GuestFolio_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GuestFolio" ADD CONSTRAINT "GuestFolio_stayId_fkey" FOREIGN KEY ("stayId") REFERENCES "Stay"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "RoomNightCharge" ADD CONSTRAINT "RoomNightCharge_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RoomNightCharge" ADD CONSTRAINT "RoomNightCharge_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RoomNightCharge" ADD CONSTRAINT "RoomNightCharge_stayId_fkey" FOREIGN KEY ("stayId") REFERENCES "Stay"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RoomNightCharge" ADD CONSTRAINT "RoomNightCharge_folioId_fkey" FOREIGN KEY ("folioId") REFERENCES "GuestFolio"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RoomNightCharge" ADD CONSTRAINT "RoomNightCharge_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RoomNightCharge" ADD CONSTRAINT "RoomNightCharge_postedById_fkey" FOREIGN KEY ("postedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "FolioEntry" ADD CONSTRAINT "FolioEntry_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FolioEntry" ADD CONSTRAINT "FolioEntry_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FolioEntry" ADD CONSTRAINT "FolioEntry_folioId_fkey" FOREIGN KEY ("folioId") REFERENCES "GuestFolio"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FolioEntry" ADD CONSTRAINT "FolioEntry_stayId_fkey" FOREIGN KEY ("stayId") REFERENCES "Stay"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FolioEntry" ADD CONSTRAINT "FolioEntry_postedById_fkey" FOREIGN KEY ("postedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "FolioSettlementAllocation" ADD CONSTRAINT "FolioSettlementAllocation_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FolioSettlementAllocation" ADD CONSTRAINT "FolioSettlementAllocation_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FolioSettlementAllocation" ADD CONSTRAINT "FolioSettlementAllocation_folioId_fkey" FOREIGN KEY ("folioId") REFERENCES "GuestFolio"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FolioSettlementAllocation" ADD CONSTRAINT "FolioSettlementAllocation_stayId_fkey" FOREIGN KEY ("stayId") REFERENCES "Stay"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FolioSettlementAllocation" ADD CONSTRAINT "FolioSettlementAllocation_allocatedById_fkey" FOREIGN KEY ("allocatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
