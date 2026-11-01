-- Migration: 202611010001_phase3_restaurant_staff_mvp
-- Description: Add 12 Phase 3 restaurant hospitality models with strict multi-tenant composite isolation, Decimal(12, 2) monetary fields, and acyclic schema relations.

-- ==============================================================================
-- 1. CREATE 12 PHASE 3 RESTAURANT HOSPITALITY TABLES
-- ==============================================================================

-- 1. CreateTable: Floor
CREATE TABLE "Floor" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Floor_pkey" PRIMARY KEY ("id")
);

-- 2. CreateTable: RestaurantTable
CREATE TABLE "RestaurantTable" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "floorId" TEXT NOT NULL,
    "tableNumber" TEXT NOT NULL,
    "capacity" INTEGER NOT NULL DEFAULT 4,
    "status" TEXT NOT NULL DEFAULT 'AVAILABLE',
    "currentSessionId" TEXT,
    "shape" TEXT NOT NULL DEFAULT 'RECTANGLE',
    "posX" INTEGER NOT NULL DEFAULT 0,
    "posY" INTEGER NOT NULL DEFAULT 0,
    "width" INTEGER NOT NULL DEFAULT 1,
    "height" INTEGER NOT NULL DEFAULT 1,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RestaurantTable_pkey" PRIMARY KEY ("id")
);

-- 3. CreateTable: TableSession
CREATE TABLE "TableSession" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "tableId" TEXT NOT NULL,
    "sessionNumber" TEXT NOT NULL,
    "guestCount" INTEGER NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMP(3),
    "openedById" TEXT,
    "closedById" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TableSession_pkey" PRIMARY KEY ("id")
);

-- 4. CreateTable: Menu
CREATE TABLE "Menu" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "branchId" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "availableFrom" TEXT,
    "availableTo" TEXT,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Menu_pkey" PRIMARY KEY ("id")
);

-- 5. CreateTable: MenuSection
CREATE TABLE "MenuSection" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "menuId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MenuSection_pkey" PRIMARY KEY ("id")
);

-- 6. CreateTable: MenuItem
CREATE TABLE "MenuItem" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "sectionId" TEXT NOT NULL,
    "productId" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "basePrice" DECIMAL(12, 2) NOT NULL,
    "taxRate" DECIMAL(5, 2) NOT NULL DEFAULT 0,
    "imageUrl" TEXT,
    "isAvailable" BOOLEAN NOT NULL DEFAULT true,
    "isKitchenItem" BOOLEAN NOT NULL DEFAULT true,
    "prepTimeMinutes" INTEGER,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MenuItem_pkey" PRIMARY KEY ("id")
);

-- 7. CreateTable: ModifierGroup
CREATE TABLE "ModifierGroup" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "displayName" TEXT,
    "minSelections" INTEGER NOT NULL DEFAULT 0,
    "maxSelections" INTEGER NOT NULL DEFAULT 1,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ModifierGroup_pkey" PRIMARY KEY ("id")
);

-- 8. CreateTable: ModifierOption
CREATE TABLE "ModifierOption" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "modifierGroupId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "priceDelta" DECIMAL(12, 2) NOT NULL DEFAULT 0,
    "isAvailable" BOOLEAN NOT NULL DEFAULT true,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ModifierOption_pkey" PRIMARY KEY ("id")
);

-- 9. CreateTable: MenuItemModifierGroup
CREATE TABLE "MenuItemModifierGroup" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "menuItemId" TEXT NOT NULL,
    "modifierGroupId" TEXT NOT NULL,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "overrideMinSelections" INTEGER,
    "overrideMaxSelections" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MenuItemModifierGroup_pkey" PRIMARY KEY ("id")
);

-- 10. CreateTable: RestaurantOrder
CREATE TABLE "RestaurantOrder" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "tableSessionId" TEXT,
    "tableId" TEXT,
    "orderNumber" TEXT NOT NULL,
    "orderType" TEXT NOT NULL DEFAULT 'DINE_IN',
    "acceptanceStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "fulfillmentStatus" TEXT NOT NULL DEFAULT 'QUEUED',
    "settlementStatus" TEXT NOT NULL DEFAULT 'UNPAID',
    "subtotal" DECIMAL(12, 2) NOT NULL DEFAULT 0,
    "discountTotal" DECIMAL(12, 2) NOT NULL DEFAULT 0,
    "taxTotal" DECIMAL(12, 2) NOT NULL DEFAULT 0,
    "totalAmount" DECIMAL(12, 2) NOT NULL DEFAULT 0,
    "paidAmount" DECIMAL(12, 2) NOT NULL DEFAULT 0,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdById" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RestaurantOrder_pkey" PRIMARY KEY ("id")
);

-- 11. CreateTable: OrderRound
CREATE TABLE "OrderRound" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "roundNumber" INTEGER NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL DEFAULT 'SUBMITTED',
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "submittedById" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrderRound_pkey" PRIMARY KEY ("id")
);

-- 12. CreateTable: OrderLine
CREATE TABLE "OrderLine" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "roundId" TEXT NOT NULL,
    "menuItemId" TEXT,
    "itemName" TEXT NOT NULL,
    "basePrice" DECIMAL(12, 2) NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "appliedModifiers" JSONB NOT NULL,
    "unitPrice" DECIMAL(12, 2) NOT NULL,
    "taxRate" DECIMAL(5, 2) NOT NULL DEFAULT 0,
    "taxAmount" DECIMAL(12, 2) NOT NULL DEFAULT 0,
    "subtotal" DECIMAL(12, 2) NOT NULL,
    "total" DECIMAL(12, 2) NOT NULL,
    "notes" TEXT,
    "acceptanceStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "fulfillmentStatus" TEXT NOT NULL DEFAULT 'QUEUED',
    "settlementStatus" TEXT NOT NULL DEFAULT 'UNPAID',
    "rejectionReason" TEXT,
    "voidReason" TEXT,
    "auditEventId" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrderLine_pkey" PRIMARY KEY ("id")
);

-- ==============================================================================
-- 2. CREATE UNIQUE INDICES & PERFORMANCE INDICES
-- ==============================================================================

-- Floor
CREATE UNIQUE INDEX "Floor_businessId_id_key" ON "Floor"("businessId", "id");
CREATE UNIQUE INDEX "Floor_businessId_branchId_name_key" ON "Floor"("businessId", "branchId", "name");
CREATE INDEX "Floor_businessId_branchId_displayOrder_idx" ON "Floor"("businessId", "branchId", "displayOrder");

-- RestaurantTable
CREATE UNIQUE INDEX "RestaurantTable_businessId_id_key" ON "RestaurantTable"("businessId", "id");
CREATE UNIQUE INDEX "RestaurantTable_businessId_branchId_tableNumber_key" ON "RestaurantTable"("businessId", "branchId", "tableNumber");
CREATE INDEX "RestaurantTable_businessId_branchId_floorId_idx" ON "RestaurantTable"("businessId", "branchId", "floorId");
CREATE INDEX "RestaurantTable_businessId_status_idx" ON "RestaurantTable"("businessId", "status");

-- TableSession
CREATE UNIQUE INDEX "TableSession_businessId_id_key" ON "TableSession"("businessId", "id");
CREATE UNIQUE INDEX "TableSession_businessId_branchId_sessionNumber_key" ON "TableSession"("businessId", "branchId", "sessionNumber");
CREATE INDEX "TableSession_businessId_branchId_status_idx" ON "TableSession"("businessId", "branchId", "status");
CREATE INDEX "TableSession_businessId_tableId_status_idx" ON "TableSession"("businessId", "tableId", "status");

-- Menu
CREATE UNIQUE INDEX "Menu_businessId_id_key" ON "Menu"("businessId", "id");
CREATE INDEX "Menu_businessId_isActive_displayOrder_idx" ON "Menu"("businessId", "isActive", "displayOrder");
CREATE INDEX "Menu_businessId_branchId_idx" ON "Menu"("businessId", "branchId");

-- MenuSection
CREATE UNIQUE INDEX "MenuSection_businessId_id_key" ON "MenuSection"("businessId", "id");
CREATE INDEX "MenuSection_businessId_menuId_displayOrder_idx" ON "MenuSection"("businessId", "menuId", "displayOrder");

-- MenuItem
CREATE UNIQUE INDEX "MenuItem_businessId_id_key" ON "MenuItem"("businessId", "id");
CREATE INDEX "MenuItem_businessId_sectionId_displayOrder_idx" ON "MenuItem"("businessId", "sectionId", "displayOrder");
CREATE INDEX "MenuItem_businessId_isAvailable_idx" ON "MenuItem"("businessId", "isAvailable");
CREATE INDEX "MenuItem_businessId_productId_idx" ON "MenuItem"("businessId", "productId");

-- ModifierGroup
CREATE UNIQUE INDEX "ModifierGroup_businessId_id_key" ON "ModifierGroup"("businessId", "id");
CREATE INDEX "ModifierGroup_businessId_isActive_idx" ON "ModifierGroup"("businessId", "isActive");

-- ModifierOption
CREATE UNIQUE INDEX "ModifierOption_businessId_id_key" ON "ModifierOption"("businessId", "id");
CREATE INDEX "ModifierOption_businessId_modifierGroupId_displayOrder_idx" ON "ModifierOption"("businessId", "modifierGroupId", "displayOrder");

-- MenuItemModifierGroup
CREATE UNIQUE INDEX "MenuItemModifierGroup_businessId_id_key" ON "MenuItemModifierGroup"("businessId", "id");
CREATE UNIQUE INDEX "MenuItemModifierGroup_businessId_menuItemId_modifierGroupId_key" ON "MenuItemModifierGroup"("businessId", "menuItemId", "modifierGroupId");
CREATE INDEX "MenuItemModifierGroup_businessId_menuItemId_idx" ON "MenuItemModifierGroup"("businessId", "menuItemId");
CREATE INDEX "MenuItemModifierGroup_businessId_modifierGroupId_idx" ON "MenuItemModifierGroup"("businessId", "modifierGroupId");

-- RestaurantOrder
CREATE UNIQUE INDEX "RestaurantOrder_businessId_id_key" ON "RestaurantOrder"("businessId", "id");
CREATE UNIQUE INDEX "RestaurantOrder_businessId_branchId_orderNumber_key" ON "RestaurantOrder"("businessId", "branchId", "orderNumber");
CREATE INDEX "RestaurantOrder_businessId_branchId_settlementStatus_idx" ON "RestaurantOrder"("businessId", "branchId", "settlementStatus");
CREATE INDEX "RestaurantOrder_businessId_tableSessionId_idx" ON "RestaurantOrder"("businessId", "tableSessionId");
CREATE INDEX "RestaurantOrder_businessId_tableId_idx" ON "RestaurantOrder"("businessId", "tableId");
CREATE INDEX "RestaurantOrder_businessId_acceptanceStatus_idx" ON "RestaurantOrder"("businessId", "acceptanceStatus");
CREATE INDEX "RestaurantOrder_businessId_fulfillmentStatus_idx" ON "RestaurantOrder"("businessId", "fulfillmentStatus");

-- OrderRound
CREATE UNIQUE INDEX "OrderRound_businessId_id_key" ON "OrderRound"("businessId", "id");
CREATE UNIQUE INDEX "OrderRound_businessId_orderId_roundNumber_key" ON "OrderRound"("businessId", "orderId", "roundNumber");
CREATE INDEX "OrderRound_businessId_orderId_roundNumber_idx" ON "OrderRound"("businessId", "orderId", "roundNumber");

-- OrderLine
CREATE UNIQUE INDEX "OrderLine_businessId_id_key" ON "OrderLine"("businessId", "id");
CREATE INDEX "OrderLine_businessId_orderId_roundId_idx" ON "OrderLine"("businessId", "orderId", "roundId");
CREATE INDEX "OrderLine_businessId_fulfillmentStatus_idx" ON "OrderLine"("businessId", "fulfillmentStatus");
CREATE INDEX "OrderLine_businessId_settlementStatus_idx" ON "OrderLine"("businessId", "settlementStatus");
CREATE INDEX "OrderLine_businessId_menuItemId_idx" ON "OrderLine"("businessId", "menuItemId");

-- ==============================================================================
-- 3. STANDARD FOREIGN KEY CONSTRAINTS (Prisma Navigation Compatibility)
-- ==============================================================================

-- Floor
ALTER TABLE "Floor" ADD CONSTRAINT "Floor_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Floor" ADD CONSTRAINT "Floor_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RestaurantTable
ALTER TABLE "RestaurantTable" ADD CONSTRAINT "RestaurantTable_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RestaurantTable" ADD CONSTRAINT "RestaurantTable_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RestaurantTable" ADD CONSTRAINT "RestaurantTable_floorId_fkey" FOREIGN KEY ("floorId") REFERENCES "Floor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- TableSession
ALTER TABLE "TableSession" ADD CONSTRAINT "TableSession_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TableSession" ADD CONSTRAINT "TableSession_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TableSession" ADD CONSTRAINT "TableSession_tableId_fkey" FOREIGN KEY ("tableId") REFERENCES "RestaurantTable"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TableSession" ADD CONSTRAINT "TableSession_openedById_fkey" FOREIGN KEY ("openedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TableSession" ADD CONSTRAINT "TableSession_closedById_fkey" FOREIGN KEY ("closedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Menu
ALTER TABLE "Menu" ADD CONSTRAINT "Menu_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Menu" ADD CONSTRAINT "Menu_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- MenuSection
ALTER TABLE "MenuSection" ADD CONSTRAINT "MenuSection_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MenuSection" ADD CONSTRAINT "MenuSection_menuId_fkey" FOREIGN KEY ("menuId") REFERENCES "Menu"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- MenuItem
ALTER TABLE "MenuItem" ADD CONSTRAINT "MenuItem_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MenuItem" ADD CONSTRAINT "MenuItem_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "MenuSection"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MenuItem" ADD CONSTRAINT "MenuItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ModifierGroup
ALTER TABLE "ModifierGroup" ADD CONSTRAINT "ModifierGroup_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ModifierOption
ALTER TABLE "ModifierOption" ADD CONSTRAINT "ModifierOption_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ModifierOption" ADD CONSTRAINT "ModifierOption_modifierGroupId_fkey" FOREIGN KEY ("modifierGroupId") REFERENCES "ModifierGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- MenuItemModifierGroup
ALTER TABLE "MenuItemModifierGroup" ADD CONSTRAINT "MenuItemModifierGroup_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MenuItemModifierGroup" ADD CONSTRAINT "MenuItemModifierGroup_menuItemId_fkey" FOREIGN KEY ("menuItemId") REFERENCES "MenuItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MenuItemModifierGroup" ADD CONSTRAINT "MenuItemModifierGroup_modifierGroupId_fkey" FOREIGN KEY ("modifierGroupId") REFERENCES "ModifierGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RestaurantOrder
ALTER TABLE "RestaurantOrder" ADD CONSTRAINT "RestaurantOrder_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RestaurantOrder" ADD CONSTRAINT "RestaurantOrder_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RestaurantOrder" ADD CONSTRAINT "RestaurantOrder_tableSessionId_fkey" FOREIGN KEY ("tableSessionId") REFERENCES "TableSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "RestaurantOrder" ADD CONSTRAINT "RestaurantOrder_tableId_fkey" FOREIGN KEY ("tableId") REFERENCES "RestaurantTable"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "RestaurantOrder" ADD CONSTRAINT "RestaurantOrder_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- OrderRound
ALTER TABLE "OrderRound" ADD CONSTRAINT "OrderRound_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OrderRound" ADD CONSTRAINT "OrderRound_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "RestaurantOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OrderRound" ADD CONSTRAINT "OrderRound_submittedById_fkey" FOREIGN KEY ("submittedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- OrderLine
ALTER TABLE "OrderLine" ADD CONSTRAINT "OrderLine_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OrderLine" ADD CONSTRAINT "OrderLine_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "RestaurantOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OrderLine" ADD CONSTRAINT "OrderLine_roundId_fkey" FOREIGN KEY ("roundId") REFERENCES "OrderRound"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OrderLine" ADD CONSTRAINT "OrderLine_menuItemId_fkey" FOREIGN KEY ("menuItemId") REFERENCES "MenuItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ==============================================================================
-- 4. COMPOSITE FOREIGN KEY CONSTRAINTS (Strict Relational Tenant Isolation)
-- ==============================================================================

-- Floor -> Branch
ALTER TABLE "Floor" ADD CONSTRAINT "Floor_businessId_branchId_fkey"
    FOREIGN KEY ("businessId", "branchId") REFERENCES "Branch"("businessId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RestaurantTable -> Branch, Floor
ALTER TABLE "RestaurantTable" ADD CONSTRAINT "RestaurantTable_businessId_branchId_fkey"
    FOREIGN KEY ("businessId", "branchId") REFERENCES "Branch"("businessId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "RestaurantTable" ADD CONSTRAINT "RestaurantTable_businessId_floorId_fkey"
    FOREIGN KEY ("businessId", "floorId") REFERENCES "Floor"("businessId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- TableSession -> Branch, RestaurantTable
ALTER TABLE "TableSession" ADD CONSTRAINT "TableSession_businessId_branchId_fkey"
    FOREIGN KEY ("businessId", "branchId") REFERENCES "Branch"("businessId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TableSession" ADD CONSTRAINT "TableSession_businessId_tableId_fkey"
    FOREIGN KEY ("businessId", "tableId") REFERENCES "RestaurantTable"("businessId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- MenuSection -> Menu
ALTER TABLE "MenuSection" ADD CONSTRAINT "MenuSection_businessId_menuId_fkey"
    FOREIGN KEY ("businessId", "menuId") REFERENCES "Menu"("businessId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- MenuItem -> MenuSection
ALTER TABLE "MenuItem" ADD CONSTRAINT "MenuItem_businessId_sectionId_fkey"
    FOREIGN KEY ("businessId", "sectionId") REFERENCES "MenuSection"("businessId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ModifierOption -> ModifierGroup
ALTER TABLE "ModifierOption" ADD CONSTRAINT "ModifierOption_businessId_modifierGroupId_fkey"
    FOREIGN KEY ("businessId", "modifierGroupId") REFERENCES "ModifierGroup"("businessId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- MenuItemModifierGroup -> MenuItem, ModifierGroup
ALTER TABLE "MenuItemModifierGroup" ADD CONSTRAINT "MenuItemModifierGroup_businessId_menuItemId_fkey"
    FOREIGN KEY ("businessId", "menuItemId") REFERENCES "MenuItem"("businessId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MenuItemModifierGroup" ADD CONSTRAINT "MenuItemModifierGroup_businessId_modifierGroupId_fkey"
    FOREIGN KEY ("businessId", "modifierGroupId") REFERENCES "ModifierGroup"("businessId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RestaurantOrder -> Branch
ALTER TABLE "RestaurantOrder" ADD CONSTRAINT "RestaurantOrder_businessId_branchId_fkey"
    FOREIGN KEY ("businessId", "branchId") REFERENCES "Branch"("businessId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- OrderRound -> RestaurantOrder
ALTER TABLE "OrderRound" ADD CONSTRAINT "OrderRound_businessId_orderId_fkey"
    FOREIGN KEY ("businessId", "orderId") REFERENCES "RestaurantOrder"("businessId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- OrderLine -> RestaurantOrder, OrderRound
ALTER TABLE "OrderLine" ADD CONSTRAINT "OrderLine_businessId_orderId_fkey"
    FOREIGN KEY ("businessId", "orderId") REFERENCES "RestaurantOrder"("businessId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "OrderLine" ADD CONSTRAINT "OrderLine_businessId_roundId_fkey"
    FOREIGN KEY ("businessId", "roundId") REFERENCES "OrderRound"("businessId", "id") ON DELETE CASCADE ON UPDATE CASCADE;
