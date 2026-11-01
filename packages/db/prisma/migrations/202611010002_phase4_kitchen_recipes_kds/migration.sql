-- DropForeignKey
ALTER TABLE "AuditEvent" DROP CONSTRAINT "AuditEvent_businessId_branchId_fkey";

-- DropForeignKey
ALTER TABLE "AuditEvent" DROP CONSTRAINT "AuditEvent_businessId_userId_fkey";

-- DropForeignKey
ALTER TABLE "Floor" DROP CONSTRAINT "Floor_businessId_branchId_fkey";

-- DropForeignKey
ALTER TABLE "MenuItem" DROP CONSTRAINT "MenuItem_businessId_sectionId_fkey";

-- DropForeignKey
ALTER TABLE "MenuItemModifierGroup" DROP CONSTRAINT "MenuItemModifierGroup_businessId_menuItemId_fkey";

-- DropForeignKey
ALTER TABLE "MenuItemModifierGroup" DROP CONSTRAINT "MenuItemModifierGroup_businessId_modifierGroupId_fkey";

-- DropForeignKey
ALTER TABLE "MenuSection" DROP CONSTRAINT "MenuSection_businessId_menuId_fkey";

-- DropForeignKey
ALTER TABLE "ModifierOption" DROP CONSTRAINT "ModifierOption_businessId_modifierGroupId_fkey";

-- DropForeignKey
ALTER TABLE "OrderLine" DROP CONSTRAINT "OrderLine_businessId_orderId_fkey";

-- DropForeignKey
ALTER TABLE "OrderLine" DROP CONSTRAINT "OrderLine_businessId_roundId_fkey";

-- DropForeignKey
ALTER TABLE "OrderRound" DROP CONSTRAINT "OrderRound_businessId_orderId_fkey";

-- DropForeignKey
ALTER TABLE "Payment" DROP CONSTRAINT "Payment_businessId_branchId_fkey";

-- DropForeignKey
ALTER TABLE "Payment" DROP CONSTRAINT "Payment_businessId_customerId_fkey";

-- DropForeignKey
ALTER TABLE "Payment" DROP CONSTRAINT "Payment_businessId_purchaseId_fkey";

-- DropForeignKey
ALTER TABLE "Payment" DROP CONSTRAINT "Payment_businessId_saleId_fkey";

-- DropForeignKey
ALTER TABLE "Payment" DROP CONSTRAINT "Payment_businessId_supplierId_fkey";

-- DropForeignKey
ALTER TABLE "Payment" DROP CONSTRAINT "Payment_businessId_userId_fkey";

-- DropForeignKey
ALTER TABLE "PaymentAllocation" DROP CONSTRAINT "PaymentAllocation_businessId_paymentId_fkey";

-- DropForeignKey
ALTER TABLE "PaymentReversal" DROP CONSTRAINT "PaymentReversal_businessId_paymentId_fkey";

-- DropForeignKey
ALTER TABLE "Purchase" DROP CONSTRAINT "Purchase_businessId_branchId_fkey";

-- DropForeignKey
ALTER TABLE "Purchase" DROP CONSTRAINT "Purchase_businessId_supplierId_fkey";

-- DropForeignKey
ALTER TABLE "Purchase" DROP CONSTRAINT "Purchase_businessId_userId_fkey";

-- DropForeignKey
ALTER TABLE "Refund" DROP CONSTRAINT "Refund_businessId_branchId_fkey";

-- DropForeignKey
ALTER TABLE "RestaurantOrder" DROP CONSTRAINT "RestaurantOrder_businessId_branchId_fkey";

-- DropForeignKey
ALTER TABLE "RestaurantTable" DROP CONSTRAINT "RestaurantTable_businessId_branchId_fkey";

-- DropForeignKey
ALTER TABLE "RestaurantTable" DROP CONSTRAINT "RestaurantTable_businessId_floorId_fkey";

-- DropForeignKey
ALTER TABLE "Sale" DROP CONSTRAINT "Sale_businessId_branchId_fkey";

-- DropForeignKey
ALTER TABLE "Sale" DROP CONSTRAINT "Sale_businessId_customerId_fkey";

-- DropForeignKey
ALTER TABLE "Sale" DROP CONSTRAINT "Sale_businessId_userId_fkey";

-- DropForeignKey
ALTER TABLE "StockMovement" DROP CONSTRAINT "StockMovement_businessId_branchId_fkey";

-- DropForeignKey
ALTER TABLE "StockMovement" DROP CONSTRAINT "StockMovement_businessId_productId_fkey";

-- DropForeignKey
ALTER TABLE "TableSession" DROP CONSTRAINT "TableSession_businessId_branchId_fkey";

-- DropForeignKey
ALTER TABLE "TableSession" DROP CONSTRAINT "TableSession_businessId_tableId_fkey";

-- DropForeignKey
ALTER TABLE "User" DROP CONSTRAINT "User_businessId_branchId_fkey";

-- DropForeignKey
ALTER TABLE "UserBranchMembership" DROP CONSTRAINT "UserBranchMembership_businessId_branchId_fkey";

-- DropForeignKey
ALTER TABLE "UserBranchMembership" DROP CONSTRAINT "UserBranchMembership_businessId_userId_fkey";

-- CreateTable
CREATE TABLE "KitchenStation" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "printerIp" TEXT,
    "printerPort" INTEGER DEFAULT 9100,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KitchenStation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StationRoute" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "stationId" TEXT NOT NULL,
    "menuItemId" TEXT,
    "categoryId" TEXT,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StationRoute_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KitchenTicket" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "stationId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "roundId" TEXT NOT NULL,
    "ticketNumber" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'QUEUED',
    "revisionNumber" INTEGER NOT NULL DEFAULT 1,
    "notes" TEXT,
    "printedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KitchenTicket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KitchenTicketLine" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "orderLineId" TEXT NOT NULL,
    "itemName" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "modifiersSnapshot" JSONB NOT NULL,
    "dietaryAlerts" JSONB,
    "notes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'QUEUED',
    "isWaste" BOOLEAN NOT NULL DEFAULT false,
    "wasteReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KitchenTicketLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecipeVersion" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "menuItemId" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL DEFAULT 1,
    "yieldQuantity" DECIMAL(12,4) NOT NULL DEFAULT 1,
    "yieldUnit" TEXT NOT NULL DEFAULT 'PORTION',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RecipeVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecipeIngredient" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "recipeVersionId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantity" DECIMAL(12,4) NOT NULL,
    "unit" TEXT NOT NULL,
    "wastagePercent" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RecipeIngredient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConsumptionPosting" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "ticketLineId" TEXT NOT NULL,
    "recipeVersionId" TEXT,
    "productId" TEXT NOT NULL,
    "quantity" DECIMAL(12,4) NOT NULL,
    "unit" TEXT NOT NULL,
    "stockMovementId" TEXT,
    "isWaste" BOOLEAN NOT NULL DEFAULT false,
    "reason" TEXT,
    "postedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "postedById" TEXT,

    CONSTRAINT "ConsumptionPosting_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "KitchenStation_businessId_branchId_isActive_idx" ON "KitchenStation"("businessId", "branchId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "KitchenStation_businessId_id_key" ON "KitchenStation"("businessId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "KitchenStation_businessId_branchId_code_key" ON "KitchenStation"("businessId", "branchId", "code");

-- CreateIndex
CREATE INDEX "StationRoute_businessId_stationId_idx" ON "StationRoute"("businessId", "stationId");

-- CreateIndex
CREATE INDEX "StationRoute_businessId_menuItemId_idx" ON "StationRoute"("businessId", "menuItemId");

-- CreateIndex
CREATE INDEX "StationRoute_businessId_categoryId_idx" ON "StationRoute"("businessId", "categoryId");

-- CreateIndex
CREATE UNIQUE INDEX "StationRoute_businessId_id_key" ON "StationRoute"("businessId", "id");

-- CreateIndex
CREATE INDEX "KitchenTicket_businessId_branchId_status_idx" ON "KitchenTicket"("businessId", "branchId", "status");

-- CreateIndex
CREATE INDEX "KitchenTicket_businessId_stationId_status_idx" ON "KitchenTicket"("businessId", "stationId", "status");

-- CreateIndex
CREATE INDEX "KitchenTicket_businessId_orderId_idx" ON "KitchenTicket"("businessId", "orderId");

-- CreateIndex
CREATE UNIQUE INDEX "KitchenTicket_businessId_id_key" ON "KitchenTicket"("businessId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "KitchenTicket_businessId_roundId_stationId_key" ON "KitchenTicket"("businessId", "roundId", "stationId");

-- CreateIndex
CREATE INDEX "KitchenTicketLine_businessId_ticketId_status_idx" ON "KitchenTicketLine"("businessId", "ticketId", "status");

-- CreateIndex
CREATE INDEX "KitchenTicketLine_businessId_orderLineId_idx" ON "KitchenTicketLine"("businessId", "orderLineId");

-- CreateIndex
CREATE UNIQUE INDEX "KitchenTicketLine_businessId_id_key" ON "KitchenTicketLine"("businessId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "KitchenTicketLine_businessId_ticketId_orderLineId_key" ON "KitchenTicketLine"("businessId", "ticketId", "orderLineId");

-- CreateIndex
CREATE INDEX "RecipeVersion_businessId_menuItemId_isActive_idx" ON "RecipeVersion"("businessId", "menuItemId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "RecipeVersion_businessId_id_key" ON "RecipeVersion"("businessId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "RecipeVersion_businessId_menuItemId_versionNumber_key" ON "RecipeVersion"("businessId", "menuItemId", "versionNumber");

-- CreateIndex
CREATE INDEX "RecipeIngredient_businessId_recipeVersionId_idx" ON "RecipeIngredient"("businessId", "recipeVersionId");

-- CreateIndex
CREATE INDEX "RecipeIngredient_businessId_productId_idx" ON "RecipeIngredient"("businessId", "productId");

-- CreateIndex
CREATE UNIQUE INDEX "RecipeIngredient_businessId_id_key" ON "RecipeIngredient"("businessId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "RecipeIngredient_businessId_recipeVersionId_productId_key" ON "RecipeIngredient"("businessId", "recipeVersionId", "productId");

-- CreateIndex
CREATE INDEX "ConsumptionPosting_businessId_ticketLineId_idx" ON "ConsumptionPosting"("businessId", "ticketLineId");

-- CreateIndex
CREATE INDEX "ConsumptionPosting_businessId_branchId_productId_idx" ON "ConsumptionPosting"("businessId", "branchId", "productId");

-- CreateIndex
CREATE INDEX "ConsumptionPosting_businessId_stockMovementId_idx" ON "ConsumptionPosting"("businessId", "stockMovementId");

-- CreateIndex
CREATE UNIQUE INDEX "ConsumptionPosting_businessId_id_key" ON "ConsumptionPosting"("businessId", "id");

-- AddForeignKey
ALTER TABLE "KitchenStation" ADD CONSTRAINT "KitchenStation_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KitchenStation" ADD CONSTRAINT "KitchenStation_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StationRoute" ADD CONSTRAINT "StationRoute_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StationRoute" ADD CONSTRAINT "StationRoute_stationId_fkey" FOREIGN KEY ("stationId") REFERENCES "KitchenStation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StationRoute" ADD CONSTRAINT "StationRoute_menuItemId_fkey" FOREIGN KEY ("menuItemId") REFERENCES "MenuItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StationRoute" ADD CONSTRAINT "StationRoute_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KitchenTicket" ADD CONSTRAINT "KitchenTicket_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KitchenTicket" ADD CONSTRAINT "KitchenTicket_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KitchenTicket" ADD CONSTRAINT "KitchenTicket_stationId_fkey" FOREIGN KEY ("stationId") REFERENCES "KitchenStation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KitchenTicket" ADD CONSTRAINT "KitchenTicket_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "RestaurantOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KitchenTicket" ADD CONSTRAINT "KitchenTicket_roundId_fkey" FOREIGN KEY ("roundId") REFERENCES "OrderRound"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KitchenTicketLine" ADD CONSTRAINT "KitchenTicketLine_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KitchenTicketLine" ADD CONSTRAINT "KitchenTicketLine_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "KitchenTicket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KitchenTicketLine" ADD CONSTRAINT "KitchenTicketLine_orderLineId_fkey" FOREIGN KEY ("orderLineId") REFERENCES "OrderLine"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecipeVersion" ADD CONSTRAINT "RecipeVersion_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecipeVersion" ADD CONSTRAINT "RecipeVersion_menuItemId_fkey" FOREIGN KEY ("menuItemId") REFERENCES "MenuItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecipeIngredient" ADD CONSTRAINT "RecipeIngredient_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecipeIngredient" ADD CONSTRAINT "RecipeIngredient_recipeVersionId_fkey" FOREIGN KEY ("recipeVersionId") REFERENCES "RecipeVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecipeIngredient" ADD CONSTRAINT "RecipeIngredient_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsumptionPosting" ADD CONSTRAINT "ConsumptionPosting_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsumptionPosting" ADD CONSTRAINT "ConsumptionPosting_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsumptionPosting" ADD CONSTRAINT "ConsumptionPosting_ticketLineId_fkey" FOREIGN KEY ("ticketLineId") REFERENCES "KitchenTicketLine"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsumptionPosting" ADD CONSTRAINT "ConsumptionPosting_recipeVersionId_fkey" FOREIGN KEY ("recipeVersionId") REFERENCES "RecipeVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsumptionPosting" ADD CONSTRAINT "ConsumptionPosting_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsumptionPosting" ADD CONSTRAINT "ConsumptionPosting_stockMovementId_fkey" FOREIGN KEY ("stockMovementId") REFERENCES "StockMovement"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsumptionPosting" ADD CONSTRAINT "ConsumptionPosting_postedById_fkey" FOREIGN KEY ("postedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

