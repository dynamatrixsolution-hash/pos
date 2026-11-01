# Phase 3: Restaurant Staff MVP — Architecture, Schema & Invariants Survey Report

**Author**: Planner (Architecture & Invariants Specialist)  
**Working Directory**: `c:\projects\pos\.agents\teamwork\planner_survey_2`  
**Milestone**: Phase 3 — Restaurant Staff MVP (Dine-in, Tables, Menus & Orders)  
**Date**: 2026-11-01  
**Integrity Mode**: Development / Production Ready  

---

## 1. Executive Summary & Architectural Overview

Phase 3 introduces the **Restaurant Staff MVP** into the DynaPOS hospitality architecture, building directly upon the hardened multi-tenant security foundation (Phase 1) and decimal financial/inventory core (Phase 2). 

Hospitality operations fundamentally diverge from traditional retail POS workflows:
1. **Physical Space & Dining Parties**: Transactions are bound to physical floor tables (`RestaurantTable`) and long-lived dining parties (`TableSession`) rather than transient retail cart checkouts.
2. **Multi-Round Incremental Ordering**: Diners order in waves (e.g., drinks first, then appetizers, mains, and desserts). Subsequent rounds must accumulate cleanly onto the existing order without duplicating, re-submitting, or overwriting prior items.
3. **Three-Dimensional Orthogonal Lifecycles**: Acceptance, kitchen fulfillment, and financial settlement exist in three completely independent state dimensions. **Most critically, paying for an order NEVER marks food served.**
4. **Hierarchical Menu Catalog & Decimal Pricing Deltas**: Menus contain sections, items, and configurable modifier groups with positive, zero, or negative price deltas (e.g. `+$1.50` for Oat Milk, `-$0.50` for Half Portion). Upon submission, all prices, modifiers, taxes, and notes must be snapshot immutably into `OrderLine` to insulate historical billing against catalog changes.
5. **Atomic Operations & Concurrency Control**: Table moves and table merges must execute atomically inside serializable database transactions without losing items or duplicating lines. Multi-terminal concurrency is governed by optimistic concurrency control (`version` fields) and fail-closed guards against settled or voided lines.
6. **Disaster Recovery & Backup Compatibility**: All new models must strictly satisfy `backup-format.ts`'s dependency topological sort, avoiding circular foreign keys (notably between `RestaurantTable` and `TableSession`) and preserving multi-tenant composite integrity (`businessId`).

---

## 2. Complete Relational Schema & Entity Specifications

The following 12 entities provide the complete persistence model for Phase 3 in `packages/db/prisma/schema.prisma`. All models enforce multi-tenant isolation via `businessId`, composite uniqueness `@@unique([businessId, id])`, exact Decimal precision for monetary amounts, and strict acyclic foreign keys.

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
  // NOTE: currentSessionId is a scalar logical ID to avoid circular foreign key in backup-format.ts
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

### Parent Entity Relation Updates in `schema.prisma`
To maintain bi-directional Prisma navigation, the existing core entities require complementary array relations:

1. **`Business`**:
   ```prisma
   floors                Floor[]
   restaurantTables      RestaurantTable[]
   tableSessions         TableSession[]
   menus                 Menu[]
   menuSections          MenuSection[]
   menuItems             MenuItem[]
   modifierGroups        ModifierGroup[]
   modifierOptions       ModifierOption[]
   menuItemModifierGroups MenuItemModifierGroup[]
   restaurantOrders      RestaurantOrder[]
   orderRounds           OrderRound[]
   orderLines            OrderLine[]
   ```
2. **`Branch`**:
   ```prisma
   floors           Floor[]
   restaurantTables RestaurantTable[]
   tableSessions    TableSession[]
   menus            Menu[]
   restaurantOrders RestaurantOrder[]
   ```
3. **`User`**:
   ```prisma
   openedTableSessions     TableSession[]    @relation("SessionOpenedBy")
   closedTableSessions     TableSession[]    @relation("SessionClosedBy")
   createdRestaurantOrders RestaurantOrder[] @relation("OrderCreatedBy")
   submittedOrderRounds    OrderRound[]      @relation("RoundSubmittedBy")
   ```

---

## 3. Floor & Dining Table Management Mechanics

### 3.1 Occupancy State Machine

Tables move through four distinct occupancy states:

```
                  ┌───────────────┐
      ┌───────────│   AVAILABLE   │◄──────────────┐
      │           └──────┬────────┘               │
      │                  │ Open Session           │
      │ Reserve Table    ▼                        │ Session Complete
      │           ┌───────────────┐               │ & Table Vacated
      │           │   OCCUPIED    │               │
      │           └──────┬────────┘               │
      ▼                  │ Generate Bill          │
┌───────────┐            ▼                        │
│ RESERVED  │     ┌───────────────┐               │
└───────────┘     │    BILLED     │───────────────┘
                  └───────────────┘
```

| State | Definition | Permitted Actions |
|---|---|---|
| `AVAILABLE` | Clean and ready for new guests. No active session exists. | Open Session, Place Reservation. |
| `OCCUPIED` | Guests are seated. Active `TableSession` attached. | Add Rounds, Add Lines, Move Table, Merge Table, Request Bill. |
| `RESERVED` | Held for anticipated arrival. | Check-in Reservation (transitions to `OCCUPIED`), Cancel Reservation. |
| `BILLED` | Bill printed or presented. Guests settling payment. | Settle Payment (transitions session to `COMPLETED`, table to `AVAILABLE`), Add More Items (reverts table to `OCCUPIED`). |

### 3.2 Atomic Table Move Algorithm

When guests move from Table A to Table B (e.g. from an outdoor table into an indoor table due to rain):

**Preconditions**:
- `sourceTable`: `status === "OCCUPIED"`, contains active `TableSession` $S$.
- `targetTable`: `status === "AVAILABLE"` (or same tenant/branch authorized target).

**Atomic Execution Protocol** (within `commerceTransaction` / `serializable` transaction):
```ts
export async function moveTable(
  businessId: string,
  branchId: string,
  sourceTableId: string,
  targetTableId: string,
  userId: string,
  reason: string
) {
  return await serializable(async (tx) => {
    // 1. Fetch source and target tables under row lock
    const sourceTable = await tx.restaurantTable.findUnique({
      where: { id: sourceTableId },
      include: {
        tableSessions: { where: { status: "ACTIVE" }, take: 1 }
      }
    });
    if (!sourceTable || sourceTable.businessId !== businessId || sourceTable.branchId !== branchId) {
      throw new CommerceError("Source table not found", 404);
    }
    const session = sourceTable.tableSessions[0];
    if (!session) {
      throw new CommerceError("No active session on source table", 400);
    }

    const targetTable = await tx.restaurantTable.findUnique({
      where: { id: targetTableId }
    });
    if (!targetTable || targetTable.businessId !== businessId || targetTable.branchId !== branchId) {
      throw new CommerceError("Target table not found", 404);
    }
    if (targetTable.status !== "AVAILABLE") {
      throw new CommerceError(`Target table ${targetTable.tableNumber} is not available (status: ${targetTable.status})`, 409);
    }

    // 2. Repoint session to target table and increment OCC version
    await tx.tableSession.update({
      where: { id: session.id },
      data: {
        tableId: targetTable.id,
        version: { increment: 1 }
      }
    });

    // 3. Update orders linked to table
    await tx.restaurantOrder.updateMany({
      where: { tableSessionId: session.id },
      data: { tableId: targetTable.id }
    });

    // 4. Update source table status to AVAILABLE
    await tx.restaurantTable.update({
      where: { id: sourceTable.id },
      data: {
        status: "AVAILABLE",
        currentSessionId: null
      }
    });

    // 5. Update target table status to OCCUPIED
    await tx.restaurantTable.update({
      where: { id: targetTable.id },
      data: {
        status: "OCCUPIED",
        currentSessionId: session.id
      }
    });

    // 6. Record immutable AuditEvent
    await createAuditEvent({
      businessId,
      branchId,
      userId,
      action: "TABLE_MOVED",
      entity: "TableSession",
      entityId: session.id,
      entityVersion: session.version + 1,
      oldValue: { tableId: sourceTable.id, tableNumber: sourceTable.tableNumber },
      newValue: { tableId: targetTable.id, tableNumber: targetTable.tableNumber },
      metadata: { sourceTableId, targetTableId },
      reason
    }, tx);

    return { success: true, sessionId: session.id, newTableNumber: targetTable.tableNumber };
  });
}
```
**Invariant Proof**:
- **Zero Duplication**: Orders, rounds, and lines are never recreated. They remain tied to `session.id`.
- **Zero Loss**: All open rounds and unserved items remain intact.
- **Rollback Guarantee**: If any step fails or conflict occurs, the entire transaction aborts.

### 3.3 Atomic Table Merge Algorithm

When two dining parties merge (e.g. Table A joins Table B), or a party expands across multiple physical tables:

**Preconditions**:
- `sourceSession` ($S_{src}$) on Table A (`OCCUPIED`).
- `targetSession` ($S_{tgt}$) on Table B (`OCCUPIED`).

**Atomic Execution Protocol**:
```ts
export async function mergeTableSessions(
  businessId: string,
  branchId: string,
  sourceSessionId: string,
  targetSessionId: string,
  userId: string,
  reason: string
) {
  return await serializable(async (tx) => {
    // 1. Lock both sessions
    const src = await tx.tableSession.findUnique({
      where: { id: sourceSessionId },
      include: { table: true, restaurantOrders: true }
    });
    const tgt = await tx.tableSession.findUnique({
      where: { id: targetSessionId },
      include: { table: true, restaurantOrders: true }
    });

    if (!src || src.businessId !== businessId || src.status !== "ACTIVE") {
      throw new CommerceError("Source session is not active", 400);
    }
    if (!tgt || tgt.businessId !== businessId || tgt.status !== "ACTIVE") {
      throw new CommerceError("Target session is not active", 400);
    }

    // 2. Transfer all orders from source session to target session
    await tx.restaurantOrder.updateMany({
      where: { tableSessionId: src.id },
      data: {
        tableSessionId: tgt.id,
        tableId: tgt.tableId
      }
    });

    // 3. Update target session: combine guest counts, append notes, increment version
    await tx.tableSession.update({
      where: { id: tgt.id },
      data: {
        guestCount: tgt.guestCount + src.guestCount,
        notes: [tgt.notes, `Merged with ${src.table.tableNumber}: ${src.notes || ""}`].filter(Boolean).join(" | "),
        version: { increment: 1 }
      }
    });

    // 4. Mark source session as COMPLETED (merged away)
    await tx.tableSession.update({
      where: { id: src.id },
      data: {
        status: "COMPLETED",
        closedAt: new Date(),
        closedById: userId,
        notes: `Merged into ${tgt.table.tableNumber} (Session ${tgt.id})`,
        version: { increment: 1 }
      }
    });

    // 5. Release source table
    await tx.restaurantTable.update({
      where: { id: src.tableId },
      data: {
        status: "AVAILABLE",
        currentSessionId: null
      }
    });

    // 6. Record AuditEvent
    await createAuditEvent({
      businessId,
      branchId,
      userId,
      action: "TABLE_SESSIONS_MERGED",
      entity: "TableSession",
      entityId: tgt.id,
      entityVersion: tgt.version + 1,
      oldValue: { sourceSessionId: src.id, sourceTable: src.table.tableNumber },
      newValue: { targetSessionId: tgt.id, targetTable: tgt.table.tableNumber },
      metadata: { sourceSessionId: src.id, targetSessionId: tgt.id },
      reason
    }, tx);

    return { success: true, targetSessionId: tgt.id };
  });
}
```

---

## 4. Restaurant Menu & Modifier Catalog

### 4.1 Catalog Hierarchy & Multi-Choice Rules

```
Menu ("Dinner Menu")
 └── MenuSection ("Entrees")
      └── MenuItem ("Ribeye Steak", basePrice: 28.00)
           ├── MenuItemModifierGroup (min: 1, max: 1) ──► ModifierGroup ("Meat Temperature")
           │                                                ├── ModifierOption ("Rare", delta: 0.00)
           │                                                ├── ModifierOption ("Medium Rare", delta: 0.00)
           │                                                └── ModifierOption ("Well Done", delta: 0.00)
           └── MenuItemModifierGroup (min: 0, max: 3) ──► ModifierGroup ("Add-ons & Sides")
                                                            ├── ModifierOption ("Truffle Butter", delta: +3.50)
                                                            ├── ModifierOption ("Grilled Prawns", delta: +8.00)
                                                            └── ModifierOption ("Half Portion Fries", delta: -1.50)
```

**Selection Constraints**:
- **Required Single Choice** (`minSelections: 1, maxSelections: 1`): Rendered as radio buttons. The ordering staff cannot submit the item without selecting exactly 1 option.
- **Optional Multi Choice** (`minSelections: 0, maxSelections: N`): Rendered as checkboxes. Staff can select between 0 and N options.
- **Mandatory Minimums** (`minSelections: M, maxSelections: N`): Staff must choose at least M options before submission.

### 4.2 Decimal Pricing Deltas & Calculations

All pricing deltas use banker's rounding to 2 decimal places (`roundHalfEven` from `backend/src/lib/services/decimal-math.ts`).

1. **Unit Price Formula**:
   $$\text{unitPrice} = \max\left(0, \text{basePrice} + \sum_{i=1}^k \text{priceDelta}_i\right)$$
   *Example*:
   - Base Price: `$18.00`
   - Option 1 (Oat Milk): `+$1.50`
   - Option 2 (Half Size): `-$0.50`
   - Unit Price = `$18.00 + $1.50 - $0.50 = $19.00`.
   - Invariant: A combination of negative deltas can never produce a negative unit price ($\text{unitPrice} \ge 0$).

2. **Line Subtotal & Tax Calculation**:
   $$\text{subtotal} = \text{roundHalfEven}(\text{unitPrice} \times \text{quantity}, 2)$$
   $$\text{taxAmount} = \text{roundHalfEven}\left(\text{subtotal} \times \frac{\text{taxRate}}{100}, 2\right)$$
   $$\text{total} = \text{subtotal} + \text{taxAmount}$$

### 4.3 Immutable Snapshotting into `OrderLine`

When staff submit an order round, `OrderLine` records an **immutable snapshot**:
- `itemName`: Exact name string at submission (e.g. `"Dry-Aged Ribeye 12oz"`).
- `basePrice`: Base price at submission (`28.00`).
- `appliedModifiers`: Stored as a complete JSON structure:
  ```json
  [
    {
      "groupId": "mod-grp-temp",
      "groupName": "Meat Temperature",
      "optionId": "opt-med-rare",
      "optionName": "Medium Rare",
      "priceDelta": "0.00"
    },
    {
      "groupId": "mod-grp-addons",
      "groupName": "Add-ons & Sides",
      "optionId": "opt-truffle",
      "optionName": "Truffle Butter",
      "priceDelta": "3.50"
    }
  ]
  ```
- `unitPrice`, `taxRate`, `taxAmount`, `subtotal`, `total`: All snapshotted.
- **Rationale**: If a manager later raises the price of the Ribeye to `$32.00` or renames the Truffle Butter modifier, the existing order line and printed receipt remain exactly `$31.50`.

---

## 5. Multi-Round Orders & Three-Dimensional Status Lifecycles

### 5.1 Multi-Round Architecture & Round Accumulation

A dining experience is non-linear. Parties order drinks first, then starters, then mains, followed by desserts:

```
RestaurantOrder (RO-0042)
 ├── OrderRound 1 (Submitted 19:05) ──► [Negroni, Sparkling Water, Garlic Bread]
 ├── OrderRound 2 (Submitted 19:25) ──► [Calamari, Caesar Salad]
 └── OrderRound 3 (Submitted 19:50) ──► [Ribeye Steak, Grilled Salmon, Pinot Noir]
```

**Round Accumulation Invariant**:
- When Round 2 is submitted, Round 1 items, modifiers, kitchen statuses, and notes are **never deleted, modified, or re-sent**.
- Round 2 creates a new `OrderRound` row (`roundNumber = 2`) with its own child `OrderLine` rows.
- The parent `RestaurantOrder` atomically updates its monetary aggregates (`subtotal`, `taxTotal`, `totalAmount`) by summing all non-cancelled order lines across all rounds.

### 5.2 The Three Independent Status Dimensions (3D Lifecycle)

Order lines and orders exist simultaneously in three independent dimensions:

```
┌────────────────────────────────────────────────────────────────────────┐
│                        THREE-DIMENSIONAL MODEL                         │
├────────────────────────────────────────────────────────────────────────┤
│ 1. Acceptance Dimension:                                               │
│    PENDING ──────────────► ACCEPTED ──────────────► REJECTED           │
│                                                                        │
│ 2. Fulfillment Dimension:                                              │
│    QUEUED ────► PREPARING ────► READY ────► SERVED ────► CANCELLED     │
│                                                                        │
│ 3. Settlement Dimension:                                               │
│    UNPAID ───────────────► PARTIAL ───────────────► PAID ────► REFUNDED│
└────────────────────────────────────────────────────────────────────────┘
```

#### The Cardinal Invariant: Paying for an Order NEVER Marks Food Served

In hospitality, **settlement is decoupled from kitchen fulfillment**:
- Fast-casual / Bar walk-ins: The guest pays at the counter **before** the food is prepared. The order is `PAID` while fulfillment is `QUEUED` or `PREPARING`.
- Fine dining: Guests frequently settle the check (`PAID`) while their dessert or after-dinner digestif is still being prepared (`PREPARING`) or plated (`READY`).
- Under no circumstance does a payment transition change an item's fulfillment state to `SERVED`.
- Transitioning to `SERVED` requires an explicit staff action (e.g., waiter or food runner marking the ticket/line served).

#### 3D State Compatibility Matrix

| Acceptance | Fulfillment | Settlement | Real-World Scenario | Valid? |
|---|---|---|---|:---:|
| `PENDING` | `QUEUED` | `UNPAID` | Waiter just submitted Round 1; kitchen hasn't opened ticket. | ✅ |
| `ACCEPTED` | `PREPARING` | `UNPAID` | Chef cooking steaks; table has not yet requested the bill. | ✅ |
| `ACCEPTED` | `PREPARING` | `PAID` | Guest paid bill at counter or upfront; food is still on the grill. | ✅ |
| `ACCEPTED` | `READY` | `PARTIAL` | Split payment started; food waiting at the pass. | ✅ |
| `ACCEPTED` | `SERVED` | `UNPAID` | Traditional dine-in: food eaten, table has not yet paid. | ✅ |
| `ACCEPTED` | `SERVED` | `PAID` | Meal served and bill fully settled. Normal completed cycle. | ✅ |
| `REJECTED` | `CANCELLED` | `UNPAID` | Kitchen 86'd item; waiter notified, item voided before prep. | ✅ |
| `ACCEPTED` | `SERVED` | `REFUNDED` | Food was served, but customer complained of quality; manager refunded. | ✅ |

### 5.3 Mandatory Audit Trail on Rejections & Voids

Any transition to `REJECTED` (Acceptance) or `CANCELLED` (Fulfillment / Void) **strictly requires**:
1. Non-empty staff justification (`rejectionReason` or `voidReason`).
2. Verification that the line has not already been settled (stale write protection).
3. Creation of an append-only `AuditEvent` within the same transaction:
   ```ts
   await createAuditEvent({
     businessId,
     branchId,
     userId,
     action: "ORDER_LINE_VOIDED",
     entity: "OrderLine",
     entityId: line.id,
     entityVersion: line.version + 1,
     oldValue: { fulfillmentStatus: line.fulfillmentStatus, subtotal: line.subtotal },
     newValue: { fulfillmentStatus: "CANCELLED" },
     reason: voidReason,
     metadata: { orderId: line.orderId, roundId: line.roundId }
   }, tx);
   ```

---

## 6. Split-Billing Architecture & Financial Reconciliation

Phase 3 requires flexible split-billing to accommodate modern dining parties without accounting discrepancies.

### 6.1 Split by Equal Shares (Penny-Perfect Allocation)

When $N$ guests divide a total bill $T$:
- Base share: $\lfloor T / N \rfloor_2$
- Remainder pennies: $R = \left(T - N \times \lfloor T / N \rfloor_2\right) \times 100$
- The first $R$ guests pay $\lfloor T / N \rfloor_2 + 0.01$, and the remaining guests pay $\lfloor T / N \rfloor_2$.
- Invariant: $\sum_{i=1}^N \text{share}_i \equiv T$ with zero rounding drift.

*Example*: Total bill `$100.00`, split 3 ways:
- Share 1: `$33.34`
- Share 2: `$33.33`
- Share 3: `$33.33`
- Sum = `$100.00` exactly.

### 6.2 Split by Item

Guests claim specific `OrderLine` items:
- Guest 1: Burger (`$15.00`) + Pint (`$7.00`) + Tax (`$2.86`) = `$24.86`
- Guest 2: Steak (`$35.00`) + Wine (`$12.00`) + Tax (`$6.11`) = `$53.11`
- Each settled split generates a `Payment` record and a `PaymentAllocation` (Phase 2 model) linked to the `RestaurantOrder`.
- The order's `paidAmount` increases incrementally. Once $\text{paidAmount} \ge \text{totalAmount}$, `settlementStatus` transitions from `PARTIAL` to `PAID`.

---

## 7. Concurrency, Tenant Isolation & Backup Compatibility

### 7.1 Multi-Tenant Isolation & Composite Key Architecture

In strict adherence to the project's security architecture:
1. Every query, mutation, and relation filter includes `businessId`.
2. Tables use composite uniqueness `@@unique([businessId, id])` to guarantee cross-tenant data can never be accessed even under primary key collision or tampering.
3. Branch-scoped resources enforce unique identifiers per branch (`@@unique([businessId, branchId, tableNumber])`, `@@unique([businessId, branchId, sessionNumber])`).

### 7.2 Optimistic Concurrency Control (OCC) & Stale Write Guards

When multiple waiter terminals or handheld POS devices interact with the same table or order:
- `TableSession`, `RestaurantOrder`, and `OrderLine` include integer `version` fields.
- Mutations check `version`:
  ```ts
  const updated = await tx.restaurantOrder.updateMany({
    where: {
      id: orderId,
      businessId,
      version: clientExpectedVersion
    },
    data: {
      totalAmount: newTotal,
      version: { increment: 1 }
    }
  });
  if (updated.count === 0) {
    throw new CommerceError("Order was modified concurrently by another terminal; please refresh", 409);
  }
  ```
- **Fail-Closed Stale Writes**: If a line item has already been settled (`settlementStatus === "PAID"`) or cancelled/voided (`acceptanceStatus === "REJECTED"` or `fulfillmentStatus === "CANCELLED"`), any subsequent modification attempt is immediately rejected with HTTP `409 Conflict`.

### 7.3 Disaster Recovery Topology & `backup-format.ts` Compatibility

In `backend/src/lib/backup-format.ts`, the backup engine validates database schema integrity by computing an acyclic topological sort of all Prisma models:
```ts
const pending = [...models];
while (pending.length) {
  const index = pending.findIndex(model => 
    model.fields.filter(field => field.relationFromFields?.length)
      .every(field => backupModels.some(parent => parent.name === field.type))
  );
  if (index < 0) throw new Error("Backup schema has unsupported dependency cycle");
  backupModels.push(pending.splice(index, 1)[0]);
}
```

**Critical Schema Invariant Discovered**:
- If `RestaurantTable` has a foreign key to `TableSession` (e.g. `currentSession TableSession? @relation(...)`), AND `TableSession` has a foreign key to `RestaurantTable` (`table RestaurantTable @relation(...)`), a **dependency cycle** is created!
- `backup-format.ts` would immediately crash with: `Backup schema has unsupported dependency cycle`.
- **Architectural Solution**:
  * `TableSession` holds the authoritative foreign key `tableId` referencing `RestaurantTable.id`.
  * `RestaurantTable` has `tableSessions TableSession[]` (reverse relation without `relationFromFields`).
  * `RestaurantTable.currentSessionId` is maintained as a scalar `String?` field (without `@relation`) or active session is queried via `tableSessions(where: { status: "ACTIVE" })`.
  * This preserves a strictly directed acyclic graph (DAG):
    $$\text{Business} \to \text{Branch} \to \text{Floor} \to \text{RestaurantTable} \to \text{TableSession} \to \text{RestaurantOrder} \to \text{OrderRound} \to \text{OrderLine}$$
- All foreign keys satisfy `relationFromFields.length === 1 && relationToFields[0] === "id"` as required by `backup-format.ts` line 83.

---

## 8. Scope Boundaries & Phase Separation

To prevent scope creep and maintain velocity, Phase 3 strictly observes the following boundaries:

| Feature / Domain Area | Phase 3 (Restaurant MVP) | Deferred to Phase 4 (Production Kitchen) | Deferred to Phase 5-7 (Hotel & QR) |
|---|:---:|:---:|:---:|
| Floors & Dining Tables | ✅ Complete | — | — |
| Table Sessions & Occupancy | ✅ Complete | — | — |
| Atomic Table Move & Merge | ✅ Complete | — | — |
| Menu, Sections, Items | ✅ Complete | — | — |
| Modifiers & Price Deltas | ✅ Complete | — | — |
| Immutable Line Snapshotting | ✅ Complete | — | — |
| Multi-Round Ordering | ✅ Complete | — | — |
| 3D Orthogonal Lifecycles | ✅ Complete | — | — |
| Split-Billing Sheet | ✅ Complete | — | — |
| Kitchen Station Routing | ❌ Deferred | ✅ Phase 4 (`KitchenStation`, `StationRoute`) | — |
| Physical ESC/POS Thermal Printing | ❌ Deferred | ✅ Phase 4 (`PrintJob`, ticket queues) | — |
| KDS Real-Time WebSocket/SSE | ❌ Deferred | ✅ Phase 4 (`KitchenTicket`, KDS screen) | — |
| Recipe Ingredient Consumption | ❌ Deferred | ✅ Phase 4 (`RecipeVersion`, `ConsumptionPosting`) | — |
| Hotel Room Posting / Folios | ❌ Deferred | — | ✅ Phase 5 & 6 (`Room`, `GuestFolio`) |
| Guest Self-Ordering QR Codes | ❌ Deferred | — | ✅ Phase 7 (`GuestSession`, `QrLocation`) |

---

## 9. Verification & Exit Criteria

Phase 3 implementation will be certified production-ready upon passing the following verification gates:

1. **Schema & Migration**: Additive migration executes cleanly on isolated PostgreSQL (127.0.0.1:55439) with 0 destructive baseline changes.
2. **Typecheck**: `npm.cmd run typecheck` exits 0 with zero errors across `backend` and `frontend`.
3. **Automated Unit & Integration Tests**:
   - `npm.cmd test` passes with zero regressions.
   - `node scripts/restro-env.mjs recovery-test` passes, proving `backup-format.ts` handles the new restaurant models and schema hash seamlessly.
   - `node scripts/restro-restore-env.mjs rehearse` passes isolated synthetic restore.
4. **Adversarial Invariant Tests**:
   - Independent 3D lifecycle test: Marking order `PAID` leaves line fulfillment status strictly unchanged (`READY` remains `READY`).
   - Round accumulation test: Submitting Round 2 preserves Round 1 lines, modifiers, and statuses.
   - Atomic table move test: Transferring session $S$ from Table A to Table B transfers all orders with zero line duplication.
   - Stale write test: Attempting to modify or void a settled or cancelled line fails closed with 409.
   - Penny-perfect split billing test: Equal shares split across 3, 7, and 11 diners sums exactly to total without penny drift.
5. **Production Builds**: `node scripts/restro-env.mjs backend-build` and `node scripts/restro-env.mjs frontend-build` both exit 0.
