-- Phase 8: Operational Readiness, Hardware Rehearsals & Pilot Rollout

-- CreateTable
CREATE TABLE "PropertyFeatureFlag" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "hotelEnabled" BOOLEAN NOT NULL DEFAULT true,
    "restaurantEnabled" BOOLEAN NOT NULL DEFAULT true,
    "kdsEnabled" BOOLEAN NOT NULL DEFAULT true,
    "guestQrEnabled" BOOLEAN NOT NULL DEFAULT true,
    "folioBridgeEnabled" BOOLEAN NOT NULL DEFAULT true,
    "offlineDraftSyncEnabled" BOOLEAN NOT NULL DEFAULT true,
    "printerFailoverEnabled" BOOLEAN NOT NULL DEFAULT true,
    "pilotMode" BOOLEAN NOT NULL DEFAULT false,
    "metadata" JSONB,
    "updatedById" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PropertyFeatureFlag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PrintJob" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "stationId" TEXT,
    "ticketId" TEXT,
    "jobNumber" TEXT NOT NULL,
    "jobType" TEXT NOT NULL,
    "printerWidthMm" INTEGER NOT NULL DEFAULT 80,
    "targetPrinterIp" TEXT,
    "targetPrinterPort" INTEGER NOT NULL DEFAULT 9100,
    "fallbackStationId" TEXT,
    "routedStationId" TEXT,
    "cashDrawerPulse" BOOLEAN NOT NULL DEFAULT false,
    "escPosPayload" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'QUEUED',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "idempotencyKey" TEXT,
    "printedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PrintJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OfflineSyncBatch" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "terminalId" TEXT NOT NULL,
    "batchKey" TEXT NOT NULL,
    "operationsCount" INTEGER NOT NULL DEFAULT 1,
    "appliedCount" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'COMPLETED',
    "payload" JSONB,
    "results" JSONB,
    "syncedById" TEXT,
    "syncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OfflineSyncBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PilotDailyReconciliation" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "businessDate" TIMESTAMP(3) NOT NULL,
    "expectedCashTotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "declaredCashTotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "cashVariance" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "retailSalesTotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "restaurantOrdersTotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "folioSettlementsTotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'BALANCED',
    "notes" TEXT,
    "reconciledById" TEXT,
    "reconciledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PilotDailyReconciliation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PropertyFeatureFlag_businessId_branchId_idx" ON "PropertyFeatureFlag"("businessId", "branchId");

-- CreateIndex
CREATE UNIQUE INDEX "PropertyFeatureFlag_businessId_id_key" ON "PropertyFeatureFlag"("businessId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "PropertyFeatureFlag_businessId_branchId_key" ON "PropertyFeatureFlag"("businessId", "branchId");

-- CreateIndex
CREATE INDEX "PrintJob_businessId_branchId_status_idx" ON "PrintJob"("businessId", "branchId", "status");

-- CreateIndex
CREATE INDEX "PrintJob_businessId_stationId_status_idx" ON "PrintJob"("businessId", "stationId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "PrintJob_businessId_id_key" ON "PrintJob"("businessId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "PrintJob_businessId_branchId_jobNumber_key" ON "PrintJob"("businessId", "branchId", "jobNumber");

-- CreateIndex
CREATE INDEX "OfflineSyncBatch_businessId_branchId_syncedAt_idx" ON "OfflineSyncBatch"("businessId", "branchId", "syncedAt");

-- CreateIndex
CREATE UNIQUE INDEX "OfflineSyncBatch_businessId_id_key" ON "OfflineSyncBatch"("businessId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "OfflineSyncBatch_businessId_branchId_batchKey_key" ON "OfflineSyncBatch"("businessId", "branchId", "batchKey");

-- CreateIndex
CREATE INDEX "PilotDailyReconciliation_businessId_branchId_status_idx" ON "PilotDailyReconciliation"("businessId", "branchId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "PilotDailyReconciliation_businessId_id_key" ON "PilotDailyReconciliation"("businessId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "PilotDailyReconciliation_businessId_branchId_businessDate_key" ON "PilotDailyReconciliation"("businessId", "branchId", "businessDate");

-- AddForeignKey
ALTER TABLE "PropertyFeatureFlag" ADD CONSTRAINT "PropertyFeatureFlag_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PropertyFeatureFlag" ADD CONSTRAINT "PropertyFeatureFlag_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PropertyFeatureFlag" ADD CONSTRAINT "PropertyFeatureFlag_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrintJob" ADD CONSTRAINT "PrintJob_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrintJob" ADD CONSTRAINT "PrintJob_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrintJob" ADD CONSTRAINT "PrintJob_stationId_fkey" FOREIGN KEY ("stationId") REFERENCES "KitchenStation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrintJob" ADD CONSTRAINT "PrintJob_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "KitchenTicket"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OfflineSyncBatch" ADD CONSTRAINT "OfflineSyncBatch_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OfflineSyncBatch" ADD CONSTRAINT "OfflineSyncBatch_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OfflineSyncBatch" ADD CONSTRAINT "OfflineSyncBatch_syncedById_fkey" FOREIGN KEY ("syncedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PilotDailyReconciliation" ADD CONSTRAINT "PilotDailyReconciliation_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PilotDailyReconciliation" ADD CONSTRAINT "PilotDailyReconciliation_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PilotDailyReconciliation" ADD CONSTRAINT "PilotDailyReconciliation_reconciledById_fkey" FOREIGN KEY ("reconciledById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

