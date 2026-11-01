# Milestone M1: Core Schema Additions, Additive Migration & Verification Plan

**Author**: M1 Explorer 3 (Monorepo Verification & Migration Analyst)  
**Target Milestone**: Milestone M1 (Core Schema Additions & Additive Migration)  
**Working Directory**: `c:\projects\pos\.agents\teamwork\p3_m1_explorer_3`  
**Date**: 2026-11-01  
**Integrity Mode**: Development / Production Ready  

---

## 1. Executive Summary & Verification Context

Milestone M1 establishes the structural relational foundation for **Phase 3: Restaurant Staff MVP (Dine-in, Tables, Menus & Orders)**. It introduces 12 new multi-tenant Prisma models into `packages/db/prisma/schema.prisma`, expands the tenant model topology from 48 models to 60 models, creates the additive migration `202611010001_phase3_restaurant_staff_mvp`, applies it across the isolated container databases (`127.0.0.1:55439` and `127.0.0.1:55440`), and verifies full disaster recovery compatibility.

The verification harness and isolated container databases have been surveyed and tested live:
- `npm.cmd run typecheck`: **PASSED (Exit 0)**
- `npm.cmd test`: **PASSED (Exit 0)** (9 test files passed, 85 tests passed, 41 integration tests skipped)
- `node scripts/restro-env.mjs recovery-test`: **PASSED (Exit 0)** (8/8 tests passed)
- `node scripts/restro-restore-env.mjs rehearse`: **PASSED (Exit 0)** (41/41 checks passed)

This report provides the exact, sequential execution protocol for the Worker to implement M1 without trial-and-error, documents all verification commands and pass criteria, and details critical migration risks and mitigations.

---

## 2. Sequential Step-by-Step Execution Protocol for the Worker

The Worker must execute the following five steps in exact sequential order:

```
┌────────────────────────────────────────────────────────┐
│ Step 1: Edit packages/db/prisma/schema.prisma           │
│         - Add reverse relations to Business, Branch,   │
│           User, and Product                            │
│         - Append 12 new Phase 3 models                 │
│         - Preserve scalar RestaurantTable.currentSessionId
└──────────────────────────┬─────────────────────────────┘
                           │
                           ▼
┌────────────────────────────────────────────────────────┐
│ Step 2: Regenerate Prisma Client                       │
│         - Command: npm.cmd run prisma:generate         │
│         - Verifies schema syntax & builds @dynapos/db  │
└──────────────────────────┬─────────────────────────────┘
                           │
                           ▼
┌────────────────────────────────────────────────────────┐
│ Step 3: Create Migration SQL File                      │
│         - Path: packages/db/prisma/migrations/         │
│           202611010001_phase3_restaurant_staff_mvp/    │
│           migration.sql                                │
│         - Write additive DDL for 12 tables + indexes   │
└──────────────────────────┬─────────────────────────────┘
                           │
                           ▼
┌────────────────────────────────────────────────────────┐
│ Step 4: Apply Migration to Both Isolated Databases     │
│         - Primary (55439): node scripts/restro-env.mjs │
│           migrate                                      │
│         - Restore (55440): node scripts/restro-restore-│
│           env.mjs migrate                              │
└──────────────────────────┬─────────────────────────────┘
                           │
                           ▼
┌────────────────────────────────────────────────────────┐
│ Step 5: Update Test Assertion in recovery.integration  │
│         - File: tests/recovery.integration.test.ts:88  │
│         - Update expected tenant model count (48 -> 60)│
└────────────────────────────────────────────────────────┘
```

---

### Step 1: File Edits Required in `packages/db/prisma/schema.prisma`

#### A. Complementary Navigation Relations on Existing Models

To maintain bidirectional Prisma relations, add the following fields to existing models:

1. **`model Business`** (add after existing `outboxEvents OutboxEvent[]` around line 62):
   ```prisma
   floors                 Floor[]
   restaurantTables       RestaurantTable[]
   tableSessions          TableSession[]
   menus                  Menu[]
   menuSections           MenuSection[]
   menuItems              MenuItem[]
   modifierGroups         ModifierGroup[]
   modifierOptions        ModifierOption[]
   menuItemModifierGroups MenuItemModifierGroup[]
   restaurantOrders       RestaurantOrder[]
   orderRounds            OrderRound[]
   orderLines             OrderLine[]
   ```

2. **`model Branch`** (add after existing `stockMovements StockMovement[]` around line 112):
   ```prisma
   floors           Floor[]
   restaurantTables RestaurantTable[]
   tableSessions    TableSession[]
   menus            Menu[]
   restaurantOrders RestaurantOrder[]
   ```

3. **`model User`** (add after existing `stockMovements StockMovement[]` around line 156):
   ```prisma
   openedTableSessions     TableSession[]    @relation("SessionOpenedBy")
   closedTableSessions     TableSession[]    @relation("SessionClosedBy")
   createdRestaurantOrders RestaurantOrder[] @relation("OrderCreatedBy")
   submittedOrderRounds    OrderRound[]      @relation("RoundSubmittedBy")
   ```

4. **`model Product`** (add after existing `stockMovements StockMovement[]` around line 256):
   ```prisma
   menuItems      MenuItem[]
   ```

---

#### B. Append the 12 New Multi-Tenant Models to `schema.prisma`

Append the following complete block to the end of `packages/db/prisma/schema.prisma`:

```prisma
// ==============================================================================
// PHASE 3: RESTAURANT STAFF MVP MODELS
// ==============================================================================

model Floor {
  id          String   @id @default(uuid())
  businessId  String
  business    Business @relation(fields: [businessId], references: [id], onDelete: Cascade)
  branchId    String
  branch      Branch   @relation(fields: [branchId], references: [id], onDelete: Cascade)
  name        String   // e.g. "Main Dining Room", "Patio", "Rooftop Lounge", "Banquet"
  displayOrder Int     @default(0)
  isActive    Boolean  @default(true)
  metadata    Json?    // Layout dimensions: { gridWidth: 12, gridHeight: 8, backgroundUrl: null }
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  tables      RestaurantTable[]

  @@unique([businessId, id])
  @@unique([businessId, branchId, name])
  @@index([businessId, branchId, displayOrder])
}

model RestaurantTable {
  id               String   @id @default(uuid())
  businessId       String
  business         Business @relation(fields: [businessId], references: [id], onDelete: Cascade)
  branchId         String
  branch           Branch   @relation(fields: [branchId], references: [id], onDelete: Cascade)
  floorId          String
  floor            Floor    @relation(fields: [floorId], references: [id], onDelete: Cascade)
  tableNumber      String   // e.g. "T1", "T2", "B1", "PATIO-4"
  capacity         Int      @default(4)
  status           String   @default("AVAILABLE") // AVAILABLE, OCCUPIED, RESERVED, BILLED
  // NOTE: currentSessionId is an unconstrained scalar to avoid circular foreign key in backup-format.ts
  currentSessionId String?
  shape            String   @default("RECTANGLE") // RECTANGLE, ROUND, SQUARE
  posX             Int      @default(0)
  posY             Int      @default(0)
  width            Int      @default(1)
  height           Int      @default(1)
  isActive         Boolean  @default(true)
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt

  tableSessions    TableSession[]
  restaurantOrders RestaurantOrder[]

  @@unique([businessId, id])
  @@unique([businessId, branchId, tableNumber])
  @@index([businessId, branchId, floorId])
  @@index([businessId, status])
}

model TableSession {
  id            String    @id @default(uuid())
  businessId    String
  business      Business  @relation(fields: [businessId], references: [id], onDelete: Cascade)
  branchId      String
  branch        Branch    @relation(fields: [branchId], references: [id], onDelete: Cascade)
  tableId       String
  table         RestaurantTable @relation(fields: [tableId], references: [id], onDelete: Cascade)
  sessionNumber String    // Sequential daily identifier e.g. "SESS-20261101-0012"
  guestCount    Int       @default(1)
  status        String    @default("ACTIVE") // ACTIVE, BILLED, COMPLETED, CANCELLED
  openedAt      DateTime  @default(now())
  closedAt      DateTime?
  openedById    String?
  openedBy      User?     @relation("SessionOpenedBy", fields: [openedById], references: [id], onDelete: SetNull)
  closedById    String?
  closedBy      User?     @relation("SessionClosedBy", fields: [closedById], references: [id], onDelete: SetNull)
  version       Int       @default(1) // Optimistic Concurrency Control
  notes         String?
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  restaurantOrders RestaurantOrder[]

  @@unique([businessId, id])
  @@unique([businessId, branchId, sessionNumber])
  @@index([businessId, branchId, status])
  @@index([businessId, tableId, status])
}

model Menu {
  id          String   @id @default(uuid())
  businessId  String
  business    Business @relation(fields: [businessId], references: [id], onDelete: Cascade)
  branchId    String?  // Nullable to allow tenant-wide menus with branch overrides
  branch      Branch?  @relation(fields: [branchId], references: [id], onDelete: SetNull)
  name        String   // e.g. "All Day Dining", "Lunch Specials", "Bar & Cocktails"
  description String?
  isActive    Boolean  @default(true)
  availableFrom String? // Time string e.g. "11:00"
  availableTo   String? // Time string e.g. "23:00"
  displayOrder  Int     @default(0)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  sections    MenuSection[]

  @@unique([businessId, id])
  @@index([businessId, isActive, displayOrder])
}

model MenuSection {
  id           String   @id @default(uuid())
  businessId   String
  business     Business @relation(fields: [businessId], references: [id], onDelete: Cascade)
  menuId       String
  menu         Menu     @relation(fields: [menuId], references: [id], onDelete: Cascade)
  name         String   // e.g. "Appetizers", "Wood-fired Pizza", "Entrees", "Desserts"
  description  String?
  displayOrder Int      @default(0)
  isActive     Boolean  @default(true)
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  items        MenuItem[]

  @@unique([businessId, id])
  @@index([businessId, menuId, displayOrder])
}

model MenuItem {
  id           String   @id @default(uuid())
  businessId   String
  business     Business @relation(fields: [businessId], references: [id], onDelete: Cascade)
  sectionId    String
  section      MenuSection @relation(fields: [sectionId], references: [id], onDelete: Cascade)
  productId    String?  // Optional link to retail Product catalog for stock/cost tracking
  product      Product? @relation(fields: [productId], references: [id], onDelete: SetNull)
  name         String   // e.g. "Dry-Aged Ribeye 12oz"
  description  String?
  basePrice    Decimal  @db.Decimal(12, 2)
  taxRate      Decimal  @default(0) @db.Decimal(5, 2) // Percentage e.g. 13.00 for VAT
  imageUrl     String?
  isAvailable  Boolean  @default(true) // Quick 86'd toggle
  isKitchenItem Boolean @default(true) // Routes to food prep vs bar/counter
  prepTimeMinutes Int?
  displayOrder Int      @default(0)
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  modifierGroups MenuItemModifierGroup[]
  orderLines     OrderLine[]

  @@unique([businessId, id])
  @@index([businessId, sectionId, displayOrder])
  @@index([businessId, isAvailable])
}

model ModifierGroup {
  id             String   @id @default(uuid())
  businessId     String
  business       Business @relation(fields: [businessId], references: [id], onDelete: Cascade)
  name           String   // e.g. "Meat Temperature", "Milk Option", "Choice of Dressing"
  displayName    String?  // Customer-facing label e.g. "How would you like your steak cooked?"
  minSelections  Int      @default(0) // 0 = optional, 1+ = required
  maxSelections  Int      @default(1) // 1 = single choice, >1 = multi choice
  isActive       Boolean  @default(true)
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  options        ModifierOption[]
  menuItemLinks  MenuItemModifierGroup[]

  @@unique([businessId, id])
  @@index([businessId, isActive])
}

model ModifierOption {
  id              String        @id @default(uuid())
  businessId      String
  business        Business      @relation(fields: [businessId], references: [id], onDelete: Cascade)
  modifierGroupId String
  modifierGroup   ModifierGroup @relation(fields: [modifierGroupId], references: [id], onDelete: Cascade)
  name            String        // e.g. "Rare", "Medium Rare", "Oat Milk", "Half Portion"
  priceDelta      Decimal       @default(0) @db.Decimal(12, 2) // Supports positive, zero, and negative deltas
  isAvailable     Boolean       @default(true)
  displayOrder    Int           @default(0)
  createdAt       DateTime      @default(now())
  updatedAt       DateTime      @updatedAt

  @@unique([businessId, id])
  @@index([businessId, modifierGroupId, displayOrder])
}

model MenuItemModifierGroup {
  id              String        @id @default(uuid())
  businessId      String
  business        Business      @relation(fields: [businessId], references: [id], onDelete: Cascade)
  menuItemId      String
  menuItem        MenuItem      @relation(fields: [menuItemId], references: [id], onDelete: Cascade)
  modifierGroupId String
  modifierGroup   ModifierGroup @relation(fields: [modifierGroupId], references: [id], onDelete: Cascade)
  displayOrder    Int           @default(0)
  overrideMinSelections Int?
  overrideMaxSelections Int?
  createdAt       DateTime      @default(now())

  @@unique([businessId, id])
  @@unique([businessId, menuItemId, modifierGroupId])
  @@index([businessId, menuItemId])
  @@index([businessId, modifierGroupId])
}

model RestaurantOrder {
  id              String        @id @default(uuid())
  businessId      String
  business        Business      @relation(fields: [businessId], references: [id], onDelete: Cascade)
  branchId        String
  branch          Branch        @relation(fields: [branchId], references: [id], onDelete: Cascade)
  tableSessionId  String?
  tableSession    TableSession? @relation(fields: [tableSessionId], references: [id], onDelete: SetNull)
  tableId         String?
  table           RestaurantTable? @relation(fields: [tableId], references: [id], onDelete: SetNull)
  orderNumber     String        // Sequential identifier e.g. "RO-20261101-0042"
  orderType       String        @default("DINE_IN") // DINE_IN, TAKEAWAY, BAR_WALK_IN
  
  // Independent 3D Status Dimensions
  acceptanceStatus  String      @default("PENDING") // PENDING, ACCEPTED, REJECTED
  fulfillmentStatus String      @default("QUEUED")  // QUEUED, PREPARING, READY, SERVED, CANCELLED
  settlementStatus  String      @default("UNPAID")  // UNPAID, PARTIAL, PAID, REFUNDED
  
  // Aggregated Monies (Decimal 12, 2)
  subtotal        Decimal       @default(0) @db.Decimal(12, 2)
  discountTotal   Decimal       @default(0) @db.Decimal(12, 2)
  taxTotal        Decimal       @default(0) @db.Decimal(12, 2)
  totalAmount     Decimal       @default(0) @db.Decimal(12, 2)
  paidAmount      Decimal       @default(0) @db.Decimal(12, 2)
  
  version         Int           @default(1) // Optimistic Concurrency Control
  createdById     String?
  createdBy       User?         @relation("OrderCreatedBy", fields: [createdById], references: [id], onDelete: SetNull)
  notes           String?
  createdAt       DateTime      @default(now())
  updatedAt       DateTime      @updatedAt

  rounds          OrderRound[]
  orderLines      OrderLine[]

  @@unique([businessId, id])
  @@unique([businessId, branchId, orderNumber])
  @@index([businessId, branchId, settlementStatus])
  @@index([businessId, tableSessionId])
  @@index([businessId, tableId])
}

model OrderRound {
  id              String          @id @default(uuid())
  businessId      String
  business        Business        @relation(fields: [businessId], references: [id], onDelete: Cascade)
  orderId         String
  order           RestaurantOrder @relation(fields: [orderId], references: [id], onDelete: Cascade)
  roundNumber     Int             @default(1) // 1 = Drinks, 2 = Appetizers, 3 = Mains, etc.
  status          String          @default("SUBMITTED") // PENDING, SUBMITTED, PREPARING, COMPLETED, CANCELLED
  submittedAt     DateTime        @default(now())
  submittedById   String?
  submittedBy     User?           @relation("RoundSubmittedBy", fields: [submittedById], references: [id], onDelete: SetNull)
  notes           String?
  createdAt       DateTime        @default(now())
  updatedAt       DateTime        @updatedAt

  lines           OrderLine[]

  @@unique([businessId, id])
  @@unique([businessId, orderId, roundNumber])
  @@index([businessId, orderId, roundNumber])
}

model OrderLine {
  id                String          @id @default(uuid())
  businessId        String
  business          Business        @relation(fields: [businessId], references: [id], onDelete: Cascade)
  orderId           String
  order             RestaurantOrder @relation(fields: [orderId], references: [id], onDelete: Cascade)
  roundId           String
  round             OrderRound      @relation(fields: [roundId], references: [id], onDelete: Cascade)
  menuItemId        String?
  menuItem          MenuItem?       @relation(fields: [menuItemId], references: [id], onDelete: SetNull)
  
  // Immutable Snapshots
  itemName          String          // Snapshot of MenuItem.name at submission time
  basePrice         Decimal         @db.Decimal(12, 2) // Snapshot of MenuItem.basePrice
  quantity          Int             @default(1)
  appliedModifiers  Json            // Snapshot array: [{ modifierGroupId, groupName, optionId, optionName, priceDelta }]
  unitPrice         Decimal         @db.Decimal(12, 2) // basePrice + sum(appliedModifiers.priceDelta)
  taxRate           Decimal         @default(0) @db.Decimal(5, 2) // Snapshot of tax percentage
  taxAmount         Decimal         @default(0) @db.Decimal(12, 2)
  subtotal          Decimal         @db.Decimal(12, 2) // unitPrice * quantity
  total             Decimal         @db.Decimal(12, 2) // subtotal + taxAmount
  notes             String?         // Special kitchen requests e.g. "Dressing on the side, extra crispy"
  
  // Independent 3D Line Statuses
  acceptanceStatus  String          @default("PENDING") // PENDING, ACCEPTED, REJECTED
  fulfillmentStatus String          @default("QUEUED")  // QUEUED, PREPARING, READY, SERVED, CANCELLED
  settlementStatus  String          @default("UNPAID")  // UNPAID, PARTIAL, PAID, REFUNDED
  
  // Audit & Cancellation Provenance
  rejectionReason   String?         // Mandatory if acceptanceStatus == REJECTED
  voidReason        String?         // Mandatory if fulfillmentStatus == CANCELLED
  auditEventId      String?         // Link to AuditEvent table
  
  version           Int             @default(1)
  createdAt         DateTime        @default(now())
  updatedAt         DateTime        @updatedAt

  @@unique([businessId, id])
  @@index([businessId, orderId, roundId])
  @@index([businessId, fulfillmentStatus])
  @@index([businessId, settlementStatus])
}
```

---

### Step 2: Client Generation Command

Run from project root `c:\projects\pos`:
```powershell
npm.cmd run prisma:generate
```
*Note*: This runs `npm run generate --workspace=@dynapos/db`, invoking `npx prisma@6.19.3 generate` against `packages/db/prisma/schema.prisma` and updating `packages/db/client/`.

---

### Step 3: Migration File Location, Naming and SQL DDL

Create the directory and migration SQL file at:
`packages/db/prisma/migrations/202611010001_phase3_restaurant_staff_mvp/migration.sql`

#### Complete DDL Content for `migration.sql`:

```sql
-- Migration: 202611010001_phase3_restaurant_staff_mvp
-- Description: Additive migration creating 12 Phase 3 hospitality models (Floor, RestaurantTable, TableSession, Menu, MenuSection, MenuItem, ModifierGroup, ModifierOption, MenuItemModifierGroup, RestaurantOrder, OrderRound, OrderLine)

-- ==============================================================================
-- 1. CREATE 12 NEW PHASE 3 TABLES
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
-- 2. CREATE UNIQUE AND REGULAR INDICES
-- ==============================================================================

-- Indices for Floor
CREATE UNIQUE INDEX "Floor_businessId_id_key" ON "Floor"("businessId", "id");
CREATE UNIQUE INDEX "Floor_businessId_branchId_name_key" ON "Floor"("businessId", "branchId", "name");
CREATE INDEX "Floor_businessId_branchId_displayOrder_idx" ON "Floor"("businessId", "branchId", "displayOrder");

-- Indices for RestaurantTable
CREATE UNIQUE INDEX "RestaurantTable_businessId_id_key" ON "RestaurantTable"("businessId", "id");
CREATE UNIQUE INDEX "RestaurantTable_businessId_branchId_tableNumber_key" ON "RestaurantTable"("businessId", "branchId", "tableNumber");
CREATE INDEX "RestaurantTable_businessId_branchId_floorId_idx" ON "RestaurantTable"("businessId", "branchId", "floorId");
CREATE INDEX "RestaurantTable_businessId_status_idx" ON "RestaurantTable"("businessId", "status");

-- Indices for TableSession
CREATE UNIQUE INDEX "TableSession_businessId_id_key" ON "TableSession"("businessId", "id");
CREATE UNIQUE INDEX "TableSession_businessId_branchId_sessionNumber_key" ON "TableSession"("businessId", "branchId", "sessionNumber");
CREATE INDEX "TableSession_businessId_branchId_status_idx" ON "TableSession"("businessId", "branchId", "status");
CREATE INDEX "TableSession_businessId_tableId_status_idx" ON "TableSession"("businessId", "tableId", "status");

-- Indices for Menu
CREATE UNIQUE INDEX "Menu_businessId_id_key" ON "Menu"("businessId", "id");
CREATE INDEX "Menu_businessId_isActive_displayOrder_idx" ON "Menu"("businessId", "isActive", "displayOrder");

-- Indices for MenuSection
CREATE UNIQUE INDEX "MenuSection_businessId_id_key" ON "MenuSection"("businessId", "id");
CREATE INDEX "MenuSection_businessId_menuId_displayOrder_idx" ON "MenuSection"("businessId", "menuId", "displayOrder");

-- Indices for MenuItem
CREATE UNIQUE INDEX "MenuItem_businessId_id_key" ON "MenuItem"("businessId", "id");
CREATE INDEX "MenuItem_businessId_sectionId_displayOrder_idx" ON "MenuItem"("businessId", "sectionId", "displayOrder");
CREATE INDEX "MenuItem_businessId_isAvailable_idx" ON "MenuItem"("businessId", "isAvailable");

-- Indices for ModifierGroup
CREATE UNIQUE INDEX "ModifierGroup_businessId_id_key" ON "ModifierGroup"("businessId", "id");
CREATE INDEX "ModifierGroup_businessId_isActive_idx" ON "ModifierGroup"("businessId", "isActive");

-- Indices for ModifierOption
CREATE UNIQUE INDEX "ModifierOption_businessId_id_key" ON "ModifierOption"("businessId", "id");
CREATE INDEX "ModifierOption_businessId_modifierGroupId_displayOrder_idx" ON "ModifierOption"("businessId", "modifierGroupId", "displayOrder");

-- Indices for MenuItemModifierGroup
CREATE UNIQUE INDEX "MenuItemModifierGroup_businessId_id_key" ON "MenuItemModifierGroup"("businessId", "id");
CREATE UNIQUE INDEX "MenuItemModifierGroup_businessId_menuItemId_modifierGroupId_key" ON "MenuItemModifierGroup"("businessId", "menuItemId", "modifierGroupId");
CREATE INDEX "MenuItemModifierGroup_businessId_menuItemId_idx" ON "MenuItemModifierGroup"("businessId", "menuItemId");
CREATE INDEX "MenuItemModifierGroup_businessId_modifierGroupId_idx" ON "MenuItemModifierGroup"("businessId", "modifierGroupId");

-- Indices for RestaurantOrder
CREATE UNIQUE INDEX "RestaurantOrder_businessId_id_key" ON "RestaurantOrder"("businessId", "id");
CREATE UNIQUE INDEX "RestaurantOrder_businessId_branchId_orderNumber_key" ON "RestaurantOrder"("businessId", "branchId", "orderNumber");
CREATE INDEX "RestaurantOrder_businessId_branchId_settlementStatus_idx" ON "RestaurantOrder"("businessId", "branchId", "settlementStatus");
CREATE INDEX "RestaurantOrder_businessId_tableSessionId_idx" ON "RestaurantOrder"("businessId", "tableSessionId");
CREATE INDEX "RestaurantOrder_businessId_tableId_idx" ON "RestaurantOrder"("businessId", "tableId");

-- Indices for OrderRound
CREATE UNIQUE INDEX "OrderRound_businessId_id_key" ON "OrderRound"("businessId", "id");
CREATE UNIQUE INDEX "OrderRound_businessId_orderId_roundNumber_key" ON "OrderRound"("businessId", "orderId", "roundNumber");
CREATE INDEX "OrderRound_businessId_orderId_roundNumber_idx" ON "OrderRound"("businessId", "orderId", "roundNumber");

-- Indices for OrderLine
CREATE UNIQUE INDEX "OrderLine_businessId_id_key" ON "OrderLine"("businessId", "id");
CREATE INDEX "OrderLine_businessId_orderId_roundId_idx" ON "OrderLine"("businessId", "orderId", "roundId");
CREATE INDEX "OrderLine_businessId_fulfillmentStatus_idx" ON "OrderLine"("businessId", "fulfillmentStatus");
CREATE INDEX "OrderLine_businessId_settlementStatus_idx" ON "OrderLine"("businessId", "settlementStatus");

-- ==============================================================================
-- 3. CREATE FOREIGN KEY CONSTRAINTS
-- ==============================================================================

-- Foreign Keys for Floor
ALTER TABLE "Floor" ADD CONSTRAINT "Floor_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Floor" ADD CONSTRAINT "Floor_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Foreign Keys for RestaurantTable
ALTER TABLE "RestaurantTable" ADD CONSTRAINT "RestaurantTable_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RestaurantTable" ADD CONSTRAINT "RestaurantTable_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RestaurantTable" ADD CONSTRAINT "RestaurantTable_floorId_fkey" FOREIGN KEY ("floorId") REFERENCES "Floor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Foreign Keys for TableSession
ALTER TABLE "TableSession" ADD CONSTRAINT "TableSession_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TableSession" ADD CONSTRAINT "TableSession_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TableSession" ADD CONSTRAINT "TableSession_tableId_fkey" FOREIGN KEY ("tableId") REFERENCES "RestaurantTable"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TableSession" ADD CONSTRAINT "TableSession_openedById_fkey" FOREIGN KEY ("openedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TableSession" ADD CONSTRAINT "TableSession_closedById_fkey" FOREIGN KEY ("closedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Foreign Keys for Menu
ALTER TABLE "Menu" ADD CONSTRAINT "Menu_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Menu" ADD CONSTRAINT "Menu_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Foreign Keys for MenuSection
ALTER TABLE "MenuSection" ADD CONSTRAINT "MenuSection_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MenuSection" ADD CONSTRAINT "MenuSection_menuId_fkey" FOREIGN KEY ("menuId") REFERENCES "Menu"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Foreign Keys for MenuItem
ALTER TABLE "MenuItem" ADD CONSTRAINT "MenuItem_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MenuItem" ADD CONSTRAINT "MenuItem_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "MenuSection"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MenuItem" ADD CONSTRAINT "MenuItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Foreign Keys for ModifierGroup
ALTER TABLE "ModifierGroup" ADD CONSTRAINT "ModifierGroup_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Foreign Keys for ModifierOption
ALTER TABLE "ModifierOption" ADD CONSTRAINT "ModifierOption_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ModifierOption" ADD CONSTRAINT "ModifierOption_modifierGroupId_fkey" FOREIGN KEY ("modifierGroupId") REFERENCES "ModifierGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Foreign Keys for MenuItemModifierGroup
ALTER TABLE "MenuItemModifierGroup" ADD CONSTRAINT "MenuItemModifierGroup_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MenuItemModifierGroup" ADD CONSTRAINT "MenuItemModifierGroup_menuItemId_fkey" FOREIGN KEY ("menuItemId") REFERENCES "MenuItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MenuItemModifierGroup" ADD CONSTRAINT "MenuItemModifierGroup_modifierGroupId_fkey" FOREIGN KEY ("modifierGroupId") REFERENCES "ModifierGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Foreign Keys for RestaurantOrder
ALTER TABLE "RestaurantOrder" ADD CONSTRAINT "RestaurantOrder_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RestaurantOrder" ADD CONSTRAINT "RestaurantOrder_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RestaurantOrder" ADD CONSTRAINT "RestaurantOrder_tableSessionId_fkey" FOREIGN KEY ("tableSessionId") REFERENCES "TableSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "RestaurantOrder" ADD CONSTRAINT "RestaurantOrder_tableId_fkey" FOREIGN KEY ("tableId") REFERENCES "RestaurantTable"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "RestaurantOrder" ADD CONSTRAINT "RestaurantOrder_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Foreign Keys for OrderRound
ALTER TABLE "OrderRound" ADD CONSTRAINT "OrderRound_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OrderRound" ADD CONSTRAINT "OrderRound_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "RestaurantOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OrderRound" ADD CONSTRAINT "OrderRound_submittedById_fkey" FOREIGN KEY ("submittedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Foreign Keys for OrderLine
ALTER TABLE "OrderLine" ADD CONSTRAINT "OrderLine_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OrderLine" ADD CONSTRAINT "OrderLine_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "RestaurantOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OrderLine" ADD CONSTRAINT "OrderLine_roundId_fkey" FOREIGN KEY ("roundId") REFERENCES "OrderRound"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OrderLine" ADD CONSTRAINT "OrderLine_menuItemId_fkey" FOREIGN KEY ("menuItemId") REFERENCES "MenuItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
```

---

### Step 4: Applying Migration to Isolated Container Databases

The monorepo maintains two independent PostgreSQL databases running inside Docker containers:
1. Primary test/development container database: `127.0.0.1:55439/restro_test`
2. Disposable restore rehearsal database: `127.0.0.1:55440/restro_restore`

**CRITICAL REQUIREMENT**: The Worker must deploy the migration to **BOTH** instances.

1. **Deploy to primary test database (55439)**:
   ```powershell
   node scripts/restro-env.mjs migrate
   ```
   *Expected Output*:
   ```
   Recognized isolated migration history; applying pending migrations only.
   Applying migration `202611010001_phase3_restaurant_staff_mvp`
   The following migration have been applied:
     - 202611010001_phase3_restaurant_staff_mvp
   ```

2. **Deploy to disposable restore rehearsal database (55440)**:
   ```powershell
   node scripts/restro-restore-env.mjs migrate
   ```
   *Expected Output*:
   ```
   Applying migration `202611010001_phase3_restaurant_staff_mvp`
   The following migration have been applied:
     - 202611010001_phase3_restaurant_staff_mvp
   ```

*Why both are required*: `scripts/rehearse-recovery.ts` line 2 verifies:
`target migration history equals source (names and checksums)`
If the restore database is not migrated, rehearsal will refuse to execute, reporting a migration history discrepancy.

---

### Step 5: Test Assertion Update in `tests/recovery.integration.test.ts:88`

File: `tests/recovery.integration.test.ts`  
Lines: 87–88

```ts
// --- BEFORE ---
  it("R1 captures all 48 tenant models and authenticates encrypted archives without claiming rehearsal", async () => {
    expect(Object.keys(original.tables)).toHaveLength(48);

// --- AFTER ---
  it("R1 captures all 60 tenant models and authenticates encrypted archives without claiming rehearsal", async () => {
    expect(Object.keys(original.tables)).toHaveLength(60);
```

*Rationale*: Prior to Phase 3, there were 48 tenant models (excluding `BusinessRegistrationRequest`). The 12 new Phase 3 models bring the tenant model total to $48 + 12 = 60$.

---

## 3. Verification Commands & Pass Criteria for M1

Once Steps 1–5 are executed, the Worker must run the following verification pipeline in sequence:

| Step | Verification Command | Target / Scope | Expected Exit Code | Exact Pass Criteria |
|---|---|---|---|---|
| **V1** | `npm.cmd run typecheck` | Monorepo TypeScript check (`backend` & `frontend`) | `0` | Zero type errors; clean compilation of generated Prisma Client. |
| **V2** | `npm.cmd test` | Vitest test suite (`tests/`) | `0` | 9 test files passed, 85 passed tests, zero failures. `tests/recovery-format.test.ts` dynamically verifies 60 models. |
| **V3** | `node scripts/restro-env.mjs recovery-test` | Isolated PostgreSQL recovery regression (`55439`) | `0` | 8/8 tests pass, 0 skipped. Assertion R1 verifies all 60 tenant models captured and authenticated. |
| **V4** | `node scripts/restro-restore-env.mjs rehearse` | Disaster recovery rehearsal (`55439` -> `55440`) | `0` | 41/41 checks pass. Verifies all 60 models restored byte-for-byte with zero invariant drift. |
| **V5 (Optional)** | `node scripts/restro-env.mjs integration` | Core commerce checkout atomicity | `0` | 14/14 tests pass, zero regressions on existing retail checkout. |

---

## 4. Potential Migration Risks & Mitigation Matrix

| # | Identified Risk | Root Cause / Mechanism | Severity | Mitigation Strategy |
|---|---|---|---|---|
| **R1** | **Cyclical Relation Disaster in Backup Engine** | If `RestaurantTable` adds `@relation` on `currentSessionId` pointing to `TableSession`, while `TableSession` points to `RestaurantTable` via `tableId`, `backend/src/lib/backup-format.ts` topological sort throws `"Backup schema has unsupported dependency cycle"`. | **CRITICAL (Breaks Recovery)** | Maintain `RestaurantTable.currentSessionId` strictly as an unconstrained scalar `String?` without `@relation`. All session-to-table relations remain strictly directional. |
| **R2** | **Target Database Desynchronization in Rehearsal** | Applying migration only to `127.0.0.1:55439` leaves `127.0.0.1:55440` on the old migration history. `rehearse-recovery.ts` line 2 fails checksum matching and aborts. | **HIGH (Breaks Rehearse)** | Explicitly mandate running `node scripts/restro-restore-env.mjs migrate` immediately after `node scripts/restro-env.mjs migrate`. |
| **R3** | **Foreign Key Creation Order in PostgreSQL** | Creating table constraints pointing to tables that do not yet exist causes `relation "<Table>" does not exist`. | **HIGH (Migration Failure)** | Separate table creation (`CREATE TABLE`) into Section 1 and constraint creation (`ALTER TABLE ... ADD CONSTRAINT`) into Section 3 of `migration.sql`. |
| **R4** | **PostgreSQL Enum Lock Concurrency Hazard** | Using PostgreSQL native `CREATE TYPE ... AS ENUM` causes transactional locking issues during schema modifications and divergence with Prisma DMMF. | **MEDIUM** | Use `TEXT NOT NULL DEFAULT '...'` for all status and type fields, conforming to DynaPOS conventions across Phase 1 and Phase 2. |
| **R5** | **Non-Additive Table Locks on Production Tables** | Modifying existing high-traffic tables (`Sale`, `Payment`, `ProductStock`) can acquire `ACCESS EXCLUSIVE` locks. | **NONE / LOW** | M1 is **100% additive**. Existing tables are not altered in PostgreSQL; only 12 new tables are created. Zero lock contention on existing production tables. |
| **R6** | **Prisma Client Stale Generation** | Modifying `schema.prisma` without running client generation causes TS errors or Vitest caching mismatch. | **MEDIUM** | Worker must run `npm.cmd run prisma:generate` before running any test or migration command. |

---

## 5. Summary Handoff for Worker

Milestone M1 is completely de-risked and specified. The Worker has:
1. Exact file modifications for `packages/db/prisma/schema.prisma`.
2. Exact client generation command (`npm.cmd run prisma:generate`).
3. Complete, copy-paste ready DDL for `packages/db/prisma/migrations/202611010001_phase3_restaurant_staff_mvp/migration.sql`.
4. Exact dual-target migration commands (`scripts/restro-env.mjs migrate` and `scripts/restro-restore-env.mjs migrate`).
5. Precise test assertion change in `tests/recovery.integration.test.ts:88` (48 -> 60).
6. Exact verification commands with verified baseline pass criteria.
