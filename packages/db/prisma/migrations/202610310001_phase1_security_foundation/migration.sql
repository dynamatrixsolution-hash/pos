-- CreateTable: UserBranchMembership
CREATE TABLE "UserBranchMembership" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "role" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserBranchMembership_pkey" PRIMARY KEY ("id")
);

-- CreateTable: AuditEvent
CREATE TABLE "AuditEvent" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "branchId" TEXT,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT,
    "entityVersion" INTEGER DEFAULT 1,
    "oldValue" JSONB,
    "newValue" JSONB,
    "metadata" JSONB,
    "reason" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditEvent_pkey" PRIMARY KEY ("id")
);

-- Indices for UserBranchMembership
CREATE UNIQUE INDEX "UserBranchMembership_userId_branchId_key" ON "UserBranchMembership"("userId", "branchId");
CREATE UNIQUE INDEX "UserBranchMembership_businessId_id_key" ON "UserBranchMembership"("businessId", "id");
CREATE INDEX "UserBranchMembership_businessId_userId_idx" ON "UserBranchMembership"("businessId", "userId");
CREATE INDEX "UserBranchMembership_businessId_branchId_idx" ON "UserBranchMembership"("businessId", "branchId");

-- Indices for AuditEvent
CREATE UNIQUE INDEX "AuditEvent_businessId_id_key" ON "AuditEvent"("businessId", "id");
CREATE INDEX "AuditEvent_businessId_entity_entityId_idx" ON "AuditEvent"("businessId", "entity", "entityId");
CREATE INDEX "AuditEvent_businessId_createdAt_idx" ON "AuditEvent"("businessId", "createdAt");
CREATE INDEX "AuditEvent_businessId_userId_idx" ON "AuditEvent"("businessId", "userId");

-- Single-column foreign keys for UserBranchMembership
ALTER TABLE "UserBranchMembership" ADD CONSTRAINT "UserBranchMembership_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UserBranchMembership" ADD CONSTRAINT "UserBranchMembership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UserBranchMembership" ADD CONSTRAINT "UserBranchMembership_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Single-column foreign keys for AuditEvent
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill existing users into UserBranchMembership
INSERT INTO "UserBranchMembership" ("id", "businessId", "userId", "branchId", "role", "isDefault", "isActive", "createdAt", "updatedAt")
SELECT gen_random_uuid(), "businessId", "id", "branchId", "role", true, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "User"
WHERE "branchId" IS NOT NULL AND "deletedAt" IS NULL;

-- Composite Unique Indices (businessId, id) on all 29 existing tenant models
CREATE UNIQUE INDEX "Subscription_businessId_id_key" ON "Subscription"("businessId", "id");
CREATE UNIQUE INDEX "Branch_businessId_id_key" ON "Branch"("businessId", "id");
CREATE UNIQUE INDEX "User_businessId_id_key" ON "User"("businessId", "id");
CREATE UNIQUE INDEX "Category_businessId_id_key" ON "Category"("businessId", "id");
CREATE UNIQUE INDEX "Brand_businessId_id_key" ON "Brand"("businessId", "id");
CREATE UNIQUE INDEX "Subcategory_businessId_id_key" ON "Subcategory"("businessId", "id");
CREATE UNIQUE INDEX "Unit_businessId_id_key" ON "Unit"("businessId", "id");
CREATE UNIQUE INDEX "Product_businessId_id_key" ON "Product"("businessId", "id");
CREATE UNIQUE INDEX "Customer_businessId_id_key" ON "Customer"("businessId", "id");
CREATE UNIQUE INDEX "Supplier_businessId_id_key" ON "Supplier"("businessId", "id");
CREATE UNIQUE INDEX "Sale_businessId_id_key" ON "Sale"("businessId", "id");
CREATE UNIQUE INDEX "Purchase_businessId_id_key" ON "Purchase"("businessId", "id");
CREATE UNIQUE INDEX "Payment_businessId_id_key" ON "Payment"("businessId", "id");
CREATE UNIQUE INDEX "RequestResult_businessId_id_key" ON "RequestResult"("businessId", "id");
CREATE UNIQUE INDEX "SaleReturn_businessId_id_key" ON "SaleReturn"("businessId", "id");
CREATE UNIQUE INDEX "PurchaseReturn_businessId_id_key" ON "PurchaseReturn"("businessId", "id");
CREATE UNIQUE INDEX "ExpenseCategory_businessId_id_key" ON "ExpenseCategory"("businessId", "id");
CREATE UNIQUE INDEX "Expense_businessId_id_key" ON "Expense"("businessId", "id");
CREATE UNIQUE INDEX "IncomeCategory_businessId_id_key" ON "IncomeCategory"("businessId", "id");
CREATE UNIQUE INDEX "Income_businessId_id_key" ON "Income"("businessId", "id");
CREATE UNIQUE INDEX "StockTransfer_businessId_id_key" ON "StockTransfer"("businessId", "id");
CREATE UNIQUE INDEX "AuditLog_businessId_id_key" ON "AuditLog"("businessId", "id");
CREATE UNIQUE INDEX "Notification_businessId_id_key" ON "Notification"("businessId", "id");
CREATE UNIQUE INDEX "OpeningStock_businessId_id_key" ON "OpeningStock"("businessId", "id");
CREATE UNIQUE INDEX "FiscalYear_businessId_id_key" ON "FiscalYear"("businessId", "id");
CREATE UNIQUE INDEX "FiscalYearInvoiceSequence_businessId_id_key" ON "FiscalYearInvoiceSequence"("businessId", "id");
CREATE UNIQUE INDEX "CreditNote_businessId_id_key" ON "CreditNote"("businessId", "id");
CREATE UNIQUE INDEX "DebitNote_businessId_id_key" ON "DebitNote"("businessId", "id");
CREATE UNIQUE INDEX "CbmsSyncQueue_businessId_id_key" ON "CbmsSyncQueue"("businessId", "id");

-- Composite Foreign Keys for Relational Tenant Isolation

-- User -> Branch
ALTER TABLE "User" ADD CONSTRAINT "User_businessId_branchId_fkey"
    FOREIGN KEY ("businessId", "branchId") REFERENCES "Branch"("businessId", "id") ON DELETE SET NULL ("branchId") ON UPDATE CASCADE;

-- UserBranchMembership -> User, Branch
ALTER TABLE "UserBranchMembership" ADD CONSTRAINT "UserBranchMembership_businessId_userId_fkey"
    FOREIGN KEY ("businessId", "userId") REFERENCES "User"("businessId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "UserBranchMembership" ADD CONSTRAINT "UserBranchMembership_businessId_branchId_fkey"
    FOREIGN KEY ("businessId", "branchId") REFERENCES "Branch"("businessId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AuditEvent -> Branch, User
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_businessId_branchId_fkey"
    FOREIGN KEY ("businessId", "branchId") REFERENCES "Branch"("businessId", "id") ON DELETE SET NULL ("branchId") ON UPDATE CASCADE;

ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_businessId_userId_fkey"
    FOREIGN KEY ("businessId", "userId") REFERENCES "User"("businessId", "id") ON DELETE SET NULL ("userId") ON UPDATE CASCADE;

-- Sale -> Branch, User, Customer
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_businessId_branchId_fkey"
    FOREIGN KEY ("businessId", "branchId") REFERENCES "Branch"("businessId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Sale" ADD CONSTRAINT "Sale_businessId_userId_fkey"
    FOREIGN KEY ("businessId", "userId") REFERENCES "User"("businessId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Sale" ADD CONSTRAINT "Sale_businessId_customerId_fkey"
    FOREIGN KEY ("businessId", "customerId") REFERENCES "Customer"("businessId", "id") ON DELETE SET NULL ("customerId") ON UPDATE CASCADE;

-- Purchase -> Branch, Supplier, User
ALTER TABLE "Purchase" ADD CONSTRAINT "Purchase_businessId_branchId_fkey"
    FOREIGN KEY ("businessId", "branchId") REFERENCES "Branch"("businessId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Purchase" ADD CONSTRAINT "Purchase_businessId_supplierId_fkey"
    FOREIGN KEY ("businessId", "supplierId") REFERENCES "Supplier"("businessId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Purchase" ADD CONSTRAINT "Purchase_businessId_userId_fkey"
    FOREIGN KEY ("businessId", "userId") REFERENCES "User"("businessId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Payment -> Branch, User, Sale, Purchase, Customer, Supplier
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_businessId_branchId_fkey"
    FOREIGN KEY ("businessId", "branchId") REFERENCES "Branch"("businessId", "id") ON DELETE SET NULL ("branchId") ON UPDATE CASCADE;

ALTER TABLE "Payment" ADD CONSTRAINT "Payment_businessId_userId_fkey"
    FOREIGN KEY ("businessId", "userId") REFERENCES "User"("businessId", "id") ON DELETE SET NULL ("userId") ON UPDATE CASCADE;

ALTER TABLE "Payment" ADD CONSTRAINT "Payment_businessId_saleId_fkey"
    FOREIGN KEY ("businessId", "saleId") REFERENCES "Sale"("businessId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Payment" ADD CONSTRAINT "Payment_businessId_purchaseId_fkey"
    FOREIGN KEY ("businessId", "purchaseId") REFERENCES "Purchase"("businessId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Payment" ADD CONSTRAINT "Payment_businessId_customerId_fkey"
    FOREIGN KEY ("businessId", "customerId") REFERENCES "Customer"("businessId", "id") ON DELETE SET NULL ("customerId") ON UPDATE CASCADE;

ALTER TABLE "Payment" ADD CONSTRAINT "Payment_businessId_supplierId_fkey"
    FOREIGN KEY ("businessId", "supplierId") REFERENCES "Supplier"("businessId", "id") ON DELETE SET NULL ("supplierId") ON UPDATE CASCADE;
