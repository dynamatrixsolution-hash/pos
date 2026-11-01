-- Migration: 202610310002_phase2_financial_inventory_core
-- Description: Non-destructive Decimal(12, 2) migration for 57 monetary fields, 5 new financial/inventory models, and baseline backfills.

-- ==============================================================================
-- 1. ALTER 57 MONETARY FIELDS ACROSS 22 MODELS TO DECIMAL(12, 2)
-- ==============================================================================

-- 1. Product
ALTER TABLE "Product"
    ALTER COLUMN "costPrice" TYPE DECIMAL(12, 2) USING ROUND("costPrice"::numeric, 2),
    ALTER COLUMN "costPrice" SET DEFAULT 0,
    ALTER COLUMN "sellingPrice" TYPE DECIMAL(12, 2) USING ROUND("sellingPrice"::numeric, 2),
    ALTER COLUMN "sellingPrice" SET DEFAULT 0,
    ALTER COLUMN "wholesalePrice" TYPE DECIMAL(12, 2) USING ROUND("wholesalePrice"::numeric, 2),
    ALTER COLUMN "wholesalePrice" SET DEFAULT 0;

-- 2. Batch
ALTER TABLE "Batch"
    ALTER COLUMN "costPrice" TYPE DECIMAL(12, 2) USING ROUND("costPrice"::numeric, 2),
    ALTER COLUMN "sellingPrice" TYPE DECIMAL(12, 2) USING ROUND("sellingPrice"::numeric, 2);

-- 3. Customer
ALTER TABLE "Customer"
    ALTER COLUMN "creditLimit" TYPE DECIMAL(12, 2) USING ROUND("creditLimit"::numeric, 2),
    ALTER COLUMN "creditLimit" SET DEFAULT 0,
    ALTER COLUMN "balance" TYPE DECIMAL(12, 2) USING ROUND("balance"::numeric, 2),
    ALTER COLUMN "balance" SET DEFAULT 0;

-- 4. CustomerLedger
ALTER TABLE "CustomerLedger"
    ALTER COLUMN "debit" TYPE DECIMAL(12, 2) USING ROUND("debit"::numeric, 2),
    ALTER COLUMN "debit" SET DEFAULT 0,
    ALTER COLUMN "credit" TYPE DECIMAL(12, 2) USING ROUND("credit"::numeric, 2),
    ALTER COLUMN "credit" SET DEFAULT 0,
    ALTER COLUMN "balance" TYPE DECIMAL(12, 2) USING ROUND("balance"::numeric, 2),
    ALTER COLUMN "balance" SET DEFAULT 0;

-- 5. Supplier
ALTER TABLE "Supplier"
    ALTER COLUMN "balance" TYPE DECIMAL(12, 2) USING ROUND("balance"::numeric, 2),
    ALTER COLUMN "balance" SET DEFAULT 0;

-- 6. SupplierLedger
ALTER TABLE "SupplierLedger"
    ALTER COLUMN "debit" TYPE DECIMAL(12, 2) USING ROUND("debit"::numeric, 2),
    ALTER COLUMN "debit" SET DEFAULT 0,
    ALTER COLUMN "credit" TYPE DECIMAL(12, 2) USING ROUND("credit"::numeric, 2),
    ALTER COLUMN "credit" SET DEFAULT 0,
    ALTER COLUMN "balance" TYPE DECIMAL(12, 2) USING ROUND("balance"::numeric, 2),
    ALTER COLUMN "balance" SET DEFAULT 0;

-- 7. Sale
ALTER TABLE "Sale"
    ALTER COLUMN "subtotal" TYPE DECIMAL(12, 2) USING ROUND("subtotal"::numeric, 2),
    ALTER COLUMN "subtotal" SET DEFAULT 0,
    ALTER COLUMN "discount" TYPE DECIMAL(12, 2) USING ROUND("discount"::numeric, 2),
    ALTER COLUMN "discount" SET DEFAULT 0,
    ALTER COLUMN "tax" TYPE DECIMAL(12, 2) USING ROUND("tax"::numeric, 2),
    ALTER COLUMN "tax" SET DEFAULT 0,
    ALTER COLUMN "total" TYPE DECIMAL(12, 2) USING ROUND("total"::numeric, 2),
    ALTER COLUMN "total" SET DEFAULT 0,
    ALTER COLUMN "paidAmount" TYPE DECIMAL(12, 2) USING ROUND("paidAmount"::numeric, 2),
    ALTER COLUMN "paidAmount" SET DEFAULT 0,
    ALTER COLUMN "vatRefundAmount" TYPE DECIMAL(12, 2) USING ROUND("vatRefundAmount"::numeric, 2),
    ALTER COLUMN "vatRefundAmount" SET DEFAULT 0;

-- 8. SaleItem
ALTER TABLE "SaleItem"
    ALTER COLUMN "costPrice" TYPE DECIMAL(12, 2) USING ROUND("costPrice"::numeric, 2),
    ALTER COLUMN "costPrice" SET DEFAULT 0,
    ALTER COLUMN "price" TYPE DECIMAL(12, 2) USING ROUND("price"::numeric, 2),
    ALTER COLUMN "price" SET DEFAULT 0,
    ALTER COLUMN "discount" TYPE DECIMAL(12, 2) USING ROUND("discount"::numeric, 2),
    ALTER COLUMN "discount" SET DEFAULT 0,
    ALTER COLUMN "tax" TYPE DECIMAL(12, 2) USING ROUND("tax"::numeric, 2),
    ALTER COLUMN "tax" SET DEFAULT 0,
    ALTER COLUMN "total" TYPE DECIMAL(12, 2) USING ROUND("total"::numeric, 2),
    ALTER COLUMN "total" SET DEFAULT 0;

-- 9. Purchase
ALTER TABLE "Purchase"
    ALTER COLUMN "subtotal" TYPE DECIMAL(12, 2) USING ROUND("subtotal"::numeric, 2),
    ALTER COLUMN "subtotal" SET DEFAULT 0,
    ALTER COLUMN "discount" TYPE DECIMAL(12, 2) USING ROUND("discount"::numeric, 2),
    ALTER COLUMN "discount" SET DEFAULT 0,
    ALTER COLUMN "tax" TYPE DECIMAL(12, 2) USING ROUND("tax"::numeric, 2),
    ALTER COLUMN "tax" SET DEFAULT 0,
    ALTER COLUMN "total" TYPE DECIMAL(12, 2) USING ROUND("total"::numeric, 2),
    ALTER COLUMN "total" SET DEFAULT 0,
    ALTER COLUMN "paidAmount" TYPE DECIMAL(12, 2) USING ROUND("paidAmount"::numeric, 2),
    ALTER COLUMN "paidAmount" SET DEFAULT 0;

-- 10. PurchaseItem
ALTER TABLE "PurchaseItem"
    ALTER COLUMN "price" TYPE DECIMAL(12, 2) USING ROUND("price"::numeric, 2),
    ALTER COLUMN "price" SET DEFAULT 0,
    ALTER COLUMN "total" TYPE DECIMAL(12, 2) USING ROUND("total"::numeric, 2),
    ALTER COLUMN "total" SET DEFAULT 0;

-- 11. Payment
ALTER TABLE "Payment"
    ALTER COLUMN "amount" TYPE DECIMAL(12, 2) USING ROUND("amount"::numeric, 2);

-- 12. SaleReturn
ALTER TABLE "SaleReturn"
    ALTER COLUMN "refundAmount" TYPE DECIMAL(12, 2) USING ROUND("refundAmount"::numeric, 2),
    ALTER COLUMN "refundAmount" SET DEFAULT 0;

-- 13. SaleReturnItem
ALTER TABLE "SaleReturnItem"
    ALTER COLUMN "price" TYPE DECIMAL(12, 2) USING ROUND("price"::numeric, 2),
    ALTER COLUMN "total" TYPE DECIMAL(12, 2) USING ROUND("total"::numeric, 2);

-- 14. PurchaseReturn
ALTER TABLE "PurchaseReturn"
    ALTER COLUMN "refundAmount" TYPE DECIMAL(12, 2) USING ROUND("refundAmount"::numeric, 2),
    ALTER COLUMN "refundAmount" SET DEFAULT 0;

-- 15. PurchaseReturnItem
ALTER TABLE "PurchaseReturnItem"
    ALTER COLUMN "price" TYPE DECIMAL(12, 2) USING ROUND("price"::numeric, 2),
    ALTER COLUMN "total" TYPE DECIMAL(12, 2) USING ROUND("total"::numeric, 2);

-- 16. Expense
ALTER TABLE "Expense"
    ALTER COLUMN "amount" TYPE DECIMAL(12, 2) USING ROUND("amount"::numeric, 2);

-- 17. Income
ALTER TABLE "Income"
    ALTER COLUMN "amount" TYPE DECIMAL(12, 2) USING ROUND("amount"::numeric, 2);

-- 18. OpeningStock
ALTER TABLE "OpeningStock"
    ALTER COLUMN "purchaseRate" TYPE DECIMAL(12, 2) USING ROUND("purchaseRate"::numeric, 2),
    ALTER COLUMN "purchaseRate" SET DEFAULT 0,
    ALTER COLUMN "sellingPrice" TYPE DECIMAL(12, 2) USING ROUND("sellingPrice"::numeric, 2),
    ALTER COLUMN "sellingPrice" SET DEFAULT 0,
    ALTER COLUMN "mrp" TYPE DECIMAL(12, 2) USING ROUND("mrp"::numeric, 2),
    ALTER COLUMN "mrp" SET DEFAULT 0,
    ALTER COLUMN "totalValue" TYPE DECIMAL(12, 2) USING ROUND("totalValue"::numeric, 2),
    ALTER COLUMN "totalValue" SET DEFAULT 0;

-- 19. CreditNote
ALTER TABLE "CreditNote"
    ALTER COLUMN "subtotal" TYPE DECIMAL(12, 2) USING ROUND("subtotal"::numeric, 2),
    ALTER COLUMN "subtotal" SET DEFAULT 0,
    ALTER COLUMN "discount" TYPE DECIMAL(12, 2) USING ROUND("discount"::numeric, 2),
    ALTER COLUMN "discount" SET DEFAULT 0,
    ALTER COLUMN "tax" TYPE DECIMAL(12, 2) USING ROUND("tax"::numeric, 2),
    ALTER COLUMN "tax" SET DEFAULT 0,
    ALTER COLUMN "total" TYPE DECIMAL(12, 2) USING ROUND("total"::numeric, 2),
    ALTER COLUMN "total" SET DEFAULT 0;

-- 20. CreditNoteItem
ALTER TABLE "CreditNoteItem"
    ALTER COLUMN "price" TYPE DECIMAL(12, 2) USING ROUND("price"::numeric, 2),
    ALTER COLUMN "total" TYPE DECIMAL(12, 2) USING ROUND("total"::numeric, 2);

-- 21. DebitNote
ALTER TABLE "DebitNote"
    ALTER COLUMN "subtotal" TYPE DECIMAL(12, 2) USING ROUND("subtotal"::numeric, 2),
    ALTER COLUMN "subtotal" SET DEFAULT 0,
    ALTER COLUMN "discount" TYPE DECIMAL(12, 2) USING ROUND("discount"::numeric, 2),
    ALTER COLUMN "discount" SET DEFAULT 0,
    ALTER COLUMN "tax" TYPE DECIMAL(12, 2) USING ROUND("tax"::numeric, 2),
    ALTER COLUMN "tax" SET DEFAULT 0,
    ALTER COLUMN "total" TYPE DECIMAL(12, 2) USING ROUND("total"::numeric, 2),
    ALTER COLUMN "total" SET DEFAULT 0;

-- 22. DebitNoteItem
ALTER TABLE "DebitNoteItem"
    ALTER COLUMN "price" TYPE DECIMAL(12, 2) USING ROUND("price"::numeric, 2),
    ALTER COLUMN "total" TYPE DECIMAL(12, 2) USING ROUND("total"::numeric, 2);

-- ==============================================================================
-- 2. CREATE 5 NEW FINANCIAL & INVENTORY MODELS
-- ==============================================================================

-- 1. CreateTable: PaymentAllocation
CREATE TABLE "PaymentAllocation" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "saleId" TEXT,
    "purchaseId" TEXT,
    "amount" DECIMAL(12, 2) NOT NULL,
    "allocatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "allocatedById" TEXT,

    CONSTRAINT "PaymentAllocation_pkey" PRIMARY KEY ("id")
);

-- 2. CreateTable: PaymentReversal
CREATE TABLE "PaymentReversal" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "reversedById" TEXT,
    "reversedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentReversal_pkey" PRIMARY KEY ("id")
);

-- 3. CreateTable: Refund
CREATE TABLE "Refund" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "saleId" TEXT,
    "paymentId" TEXT,
    "customerId" TEXT,
    "amount" DECIMAL(12, 2) NOT NULL,
    "method" TEXT NOT NULL DEFAULT 'CASH',
    "reason" TEXT NOT NULL,
    "reference" TEXT,
    "status" TEXT NOT NULL DEFAULT 'COMPLETED',
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Refund_pkey" PRIMARY KEY ("id")
);

-- 4. CreateTable: StockMovement (Append-only Ledger)
CREATE TABLE "StockMovement" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "batchNumber" TEXT,
    "quantity" DECIMAL(12, 4) NOT NULL,
    "unit" TEXT NOT NULL DEFAULT 'pcs',
    "sourceType" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "eventKey" TEXT,
    "actorId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StockMovement_pkey" PRIMARY KEY ("id")
);

-- 5. CreateTable: OutboxEvent (Transactional Outbox)
CREATE TABLE "OutboxEvent" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "aggregateType" TEXT NOT NULL,
    "aggregateId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "headers" JSONB,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "scheduledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OutboxEvent_pkey" PRIMARY KEY ("id")
);

-- ==============================================================================
-- 3. CREATE INDICES AND CONSTRAINTS FOR NEW MODELS
-- ==============================================================================

-- Indices for PaymentAllocation
CREATE UNIQUE INDEX "PaymentAllocation_businessId_id_key" ON "PaymentAllocation"("businessId", "id");
CREATE INDEX "PaymentAllocation_businessId_paymentId_idx" ON "PaymentAllocation"("businessId", "paymentId");
CREATE INDEX "PaymentAllocation_businessId_saleId_idx" ON "PaymentAllocation"("businessId", "saleId");
CREATE INDEX "PaymentAllocation_businessId_purchaseId_idx" ON "PaymentAllocation"("businessId", "purchaseId");

-- Indices for PaymentReversal
CREATE UNIQUE INDEX "PaymentReversal_paymentId_key" ON "PaymentReversal"("paymentId");
CREATE UNIQUE INDEX "PaymentReversal_businessId_id_key" ON "PaymentReversal"("businessId", "id");
CREATE INDEX "PaymentReversal_businessId_paymentId_idx" ON "PaymentReversal"("businessId", "paymentId");

-- Indices for Refund
CREATE UNIQUE INDEX "Refund_businessId_id_key" ON "Refund"("businessId", "id");
CREATE INDEX "Refund_businessId_branchId_idx" ON "Refund"("businessId", "branchId");
CREATE INDEX "Refund_businessId_saleId_idx" ON "Refund"("businessId", "saleId");
CREATE INDEX "Refund_businessId_paymentId_idx" ON "Refund"("businessId", "paymentId");
CREATE INDEX "Refund_businessId_customerId_idx" ON "Refund"("businessId", "customerId");

-- Indices for StockMovement
CREATE UNIQUE INDEX "StockMovement_businessId_id_key" ON "StockMovement"("businessId", "id");
CREATE UNIQUE INDEX "StockMovement_businessId_eventKey_key" ON "StockMovement"("businessId", "eventKey");
CREATE INDEX "StockMovement_businessId_branchId_productId_createdAt_idx" ON "StockMovement"("businessId", "branchId", "productId", "createdAt");
CREATE INDEX "StockMovement_businessId_productId_batchNumber_idx" ON "StockMovement"("businessId", "productId", "batchNumber");
CREATE INDEX "StockMovement_businessId_sourceType_sourceId_idx" ON "StockMovement"("businessId", "sourceType", "sourceId");

-- Indices for OutboxEvent
CREATE UNIQUE INDEX "OutboxEvent_businessId_id_key" ON "OutboxEvent"("businessId", "id");
CREATE INDEX "OutboxEvent_status_scheduledAt_idx" ON "OutboxEvent"("status", "scheduledAt");
CREATE INDEX "OutboxEvent_businessId_aggregateType_aggregateId_idx" ON "OutboxEvent"("businessId", "aggregateType", "aggregateId");

-- ==============================================================================
-- 4. FOREIGN KEY CONSTRAINTS (Single-Column & Composite Tenant Isolation)
-- ==============================================================================

-- Foreign Keys for PaymentAllocation
ALTER TABLE "PaymentAllocation" ADD CONSTRAINT "PaymentAllocation_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PaymentAllocation" ADD CONSTRAINT "PaymentAllocation_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PaymentAllocation" ADD CONSTRAINT "PaymentAllocation_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "Sale"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PaymentAllocation" ADD CONSTRAINT "PaymentAllocation_purchaseId_fkey" FOREIGN KEY ("purchaseId") REFERENCES "Purchase"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PaymentAllocation" ADD CONSTRAINT "PaymentAllocation_allocatedById_fkey" FOREIGN KEY ("allocatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PaymentAllocation" ADD CONSTRAINT "PaymentAllocation_businessId_paymentId_fkey" FOREIGN KEY ("businessId", "paymentId") REFERENCES "Payment"("businessId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Foreign Keys for PaymentReversal
ALTER TABLE "PaymentReversal" ADD CONSTRAINT "PaymentReversal_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PaymentReversal" ADD CONSTRAINT "PaymentReversal_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PaymentReversal" ADD CONSTRAINT "PaymentReversal_reversedById_fkey" FOREIGN KEY ("reversedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PaymentReversal" ADD CONSTRAINT "PaymentReversal_businessId_paymentId_fkey" FOREIGN KEY ("businessId", "paymentId") REFERENCES "Payment"("businessId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Foreign Keys for Refund
ALTER TABLE "Refund" ADD CONSTRAINT "Refund_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Refund" ADD CONSTRAINT "Refund_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Refund" ADD CONSTRAINT "Refund_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "Sale"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Refund" ADD CONSTRAINT "Refund_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Refund" ADD CONSTRAINT "Refund_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Refund" ADD CONSTRAINT "Refund_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Refund" ADD CONSTRAINT "Refund_businessId_branchId_fkey" FOREIGN KEY ("businessId", "branchId") REFERENCES "Branch"("businessId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Foreign Keys for StockMovement
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_businessId_branchId_fkey" FOREIGN KEY ("businessId", "branchId") REFERENCES "Branch"("businessId", "id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_businessId_productId_fkey" FOREIGN KEY ("businessId", "productId") REFERENCES "Product"("businessId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Foreign Keys for OutboxEvent
ALTER TABLE "OutboxEvent" ADD CONSTRAINT "OutboxEvent_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ==============================================================================
-- 5. NON-DESTRUCTIVE HISTORICAL DATA BACKFILLS
-- ==============================================================================

-- 1. Backfill PaymentAllocation rows from existing invoice-linked payments
INSERT INTO "PaymentAllocation" ("id", "businessId", "paymentId", "saleId", "purchaseId", "amount", "allocatedAt", "allocatedById")
SELECT 
    gen_random_uuid(),
    p."businessId",
    p."id",
    p."saleId",
    p."purchaseId",
    p."amount",
    p."createdAt",
    p."userId"
FROM "Payment" p
WHERE (p."saleId" IS NOT NULL OR p."purchaseId" IS NOT NULL)
  AND NOT EXISTS (
    SELECT 1 FROM "PaymentAllocation" pa WHERE pa."paymentId" = p."id"
  );

-- 2. Backfill baseline StockMovement ledger lines from existing non-zero ProductStock projections
INSERT INTO "StockMovement" ("id", "businessId", "branchId", "productId", "batchNumber", "quantity", "unit", "sourceType", "sourceId", "eventKey", "notes", "createdAt")
SELECT 
    gen_random_uuid(),
    b."id",
    ps."branchId",
    ps."productId",
    NULL,
    ps."quantity"::decimal(12, 4),
    COALESCE(u."name", 'pcs'),
    'OPENING',
    ps."id",
    CONCAT('BASELINE_STOCK:', ps."id"),
    'Automated baseline migration stock movement',
    ps."createdAt"
FROM "ProductStock" ps
JOIN "Product" pr ON pr."id" = ps."productId"
JOIN "Business" b ON b."id" = pr."businessId"
LEFT JOIN "Unit" u ON u."id" = pr."unitId"
WHERE ps."quantity" != 0
  AND NOT EXISTS (
    SELECT 1 FROM "StockMovement" sm WHERE sm."eventKey" = CONCAT('BASELINE_STOCK:', ps."id")
  );
