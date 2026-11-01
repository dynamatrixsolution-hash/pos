# Milestone M1: Core Schema Additions & Additive Migration Specification Report

**Author**: M1 Explorer 1 (Prisma Schema & Migration Specialist)  
**Date**: 2026-11-01  
**Working Directory**: `c:\projects\pos\.agents\teamwork\p3_m1_explorer_1`  
**Target Milestone**: M1 (Core Schema Additions & Additive Migration)  
**Status**: Specification Complete / Implementation Ready  

---

## 1. Executive Summary & Specification Sources

This report provides the authoritative schema design, relational field invariants, multi-tenant composite integrity rules, and exact PostgreSQL DDL migration script for the 12 Phase 3 restaurant hospitality models in DynaPOS.

### Authoritative Specification Sources Consulted:
1. **User Requirements**: `.agents/teamwork/ORIGINAL_REQUEST.md` (Phase 3: Restaurant Staff MVP)
2. **Scope & Interface Contracts**: `.agents/teamwork/orchestrator_2/PROJECT.md`
3. **Architectural Survey Reference**: `.agents/teamwork/planner_survey_2/planner_survey_report.md`
4. **Specification Document**: `docs/hospitality/phases/PHASE_3_RESTAURANT_MVP.md`
5. **Existing Codebase Schema**: `packages/db/prisma/schema.prisma` (1087 lines, 48 tenant models)
6. **Existing Migration Precedents**:
   - `packages/db/prisma/migrations/202610310001_phase1_security_foundation/migration.sql`
   - `packages/db/prisma/migrations/202610310002_phase2_financial_inventory_core/migration.sql`
7. **Disaster Recovery Engine & Tests**:
   - `backend/src/lib/backup-format.ts` (Topological DAG sorter & single-column relation validation)
   - `tests/recovery.integration.test.ts` (Dynamic synthetic model generation & 48 -> 60 model verification)

---

## 2. Features Discovered

| # | Category | Feature | Description | Inputs | Outputs | Error Behavior | Discovered Via |
|---|----------|---------|-------------|--------|---------|----------------|----------------|
| 1 | Layout & Tables | `Floor` Entity | Represents physical dining areas (e.g. Main Dining Room, Patio, Rooftop) with metadata grid dimensions | `businessId`, `branchId`, `name`, `displayOrder`, `metadata` | `Floor` record | Rejects duplicate `(businessId, branchId, name)` | `PHASE_3_RESTAURANT_MVP.md`, Survey |
| 2 | Layout & Tables | `RestaurantTable` Entity | Dining table entity with seating capacity, physical shape, and occupancy status (`AVAILABLE`, `OCCUPIED`, `RESERVED`, `BILLED`) | `businessId`, `branchId`, `floorId`, `tableNumber`, `capacity`, `shape`, `posX`, `posY` | `RestaurantTable` record | Rejects duplicate `(businessId, branchId, tableNumber)` | `PHASE_3_RESTAURANT_MVP.md`, Survey |
| 3 | Layout & Tables | Scalar `currentSessionId` | Logical pointer on `RestaurantTable` referencing active `TableSession` without explicit `@relation` | `currentSessionId: String?` | Scalar string or null | Preserves acyclic topological DAG for disaster recovery | `PROJECT.md`, `backup-format.ts` |
| 4 | Layout & Tables | `TableSession` Entity | Active dining party session tracking guest count, open/close timestamps, actor provenance, and OCC versioning | `businessId`, `branchId`, `tableId`, `sessionNumber`, `guestCount`, `notes`, `openedById` | `TableSession` record | Rejects duplicate `(businessId, branchId, sessionNumber)` | `PHASE_3_RESTAURANT_MVP.md`, Survey |
| 5 | Menu Catalog | `Menu` Entity | Catalog container supporting tenant-wide menus and branch-specific menus with operating hours | `businessId`, `branchId?`, `name`, `availableFrom?`, `availableTo?`, `displayOrder` | `Menu` record | Cascades delete to sections | `PHASE_3_RESTAURANT_MVP.md`, Survey |
| 6 | Menu Catalog | `MenuSection` Entity | Categorical grouping within a menu (e.g. Appetizers, Wood-fired Pizza, Entrees, Drinks) | `businessId`, `menuId`, `name`, `displayOrder` | `MenuSection` record | Cascades delete to items | `PHASE_3_RESTAURANT_MVP.md`, Survey |
| 7 | Menu Catalog | `MenuItem` Entity | Food/beverage catalog item with `basePrice`, tax rate, kitchen routing flag, and optional retail `Product` link | `businessId`, `sectionId`, `name`, `basePrice`, `taxRate`, `isKitchenItem`, `productId?` | `MenuItem` record | Enforces `Decimal(12, 2)` monetary precision | `PHASE_3_RESTAURANT_MVP.md`, Survey |
| 8 | Menu Catalog | `ModifierGroup` Entity | Customization rule group (e.g. Steak Doneness, Milk Options) with min/max selection bounds | `businessId`, `name`, `displayName?`, `minSelections`, `maxSelections` | `ModifierGroup` record | Cascades delete to options & join links | `PHASE_3_RESTAURANT_MVP.md`, Survey |
| 9 | Menu Catalog | `ModifierOption` Entity | Concrete modifier choice with signed `priceDelta` (supports positive, zero, or negative monetary deltas) | `businessId`, `modifierGroupId`, `name`, `priceDelta`, `displayOrder` | `ModifierOption` record | Enforces signed `Decimal(12, 2)` price deltas | `PHASE_3_RESTAURANT_MVP.md`, Survey |
| 10 | Menu Catalog | `MenuItemModifierGroup` Entity | Join table associating `MenuItem` with `ModifierGroup` with optional per-item min/max selection overrides | `businessId`, `menuItemId`, `modifierGroupId`, `overrideMinSelections?`, `overrideMaxSelections?` | `MenuItemModifierGroup` record | Rejects duplicate `(businessId, menuItemId, modifierGroupId)` | `PHASE_3_RESTAURANT_MVP.md`, Survey |
| 11 | Orders & Lifecycles | `RestaurantOrder` Entity | Order header supporting multi-round accumulation, decoupled 3D status dimensions, and OCC versioning | `businessId`, `branchId`, `orderNumber`, `tableSessionId?`, `tableId?`, `orderType` | `RestaurantOrder` record | Rejects duplicate `(businessId, branchId, orderNumber)` | `PHASE_3_RESTAURANT_MVP.md`, Survey |
| 12 | Orders & Lifecycles | `OrderRound` Entity | Batch/wave of kitchen lines submitted together (e.g. Round 1 drinks, Round 2 starters, Round 3 mains) | `businessId`, `orderId`, `roundNumber`, `notes?`, `submittedById?` | `OrderRound` record | Rejects duplicate `(businessId, orderId, roundNumber)` | `PHASE_3_RESTAURANT_MVP.md`, Survey |
| 13 | Orders & Lifecycles | `OrderLine` Entity | Line item snapshotting base price, applied modifier deltas JSON, tax, and notes immutably upon order submission | `businessId`, `orderId`, `roundId`, `menuItemId?`, `itemName`, `basePrice`, `appliedModifiers`, `unitPrice`, `taxAmount`, `subtotal`, `total` | `OrderLine` record | Immutable financial accounting; isolated 3D status tracking | `PHASE_3_RESTAURANT_MVP.md`, Survey |
| 14 | Invariants & Auditing | 3D Decoupled Status | Independent Acceptance, Fulfillment, and Settlement state machines on orders and lines | `acceptanceStatus`, `fulfillmentStatus`, `settlementStatus` | Decoupled enum/string states | Paying for an order NEVER marks food served | `PHASE_3_RESTAURANT_MVP.md`, Survey |
| 15 | Invariants & Auditing | Mandatory Audit Provenance | Required staff reasoning for line rejections (`rejectionReason`) and line voids (`voidReason`) | `reason: string`, `actorId: string` | Stored reason + `auditEventId` | Voids/rejections fail closed if reason is omitted | `PHASE_3_RESTAURANT_MVP.md`, Survey |
| 16 | Multi-Tenancy | Composite Tenant Isolation | Composite uniqueness and foreign key constraints enforcing tenant isolation at DB engine level | `businessId` on all 12 models; composite keys `(businessId, id)` | Database-level foreign key enforcement | Blocks cross-tenant foreign key references | `schema.prisma`, Phase 1/Phase 2 migrations |

---

## 3. Edge Cases & Invariant Analysis

| # | Feature | Input | Observed / Specified Behavior |
|---|---------|-------|-------------------------------|
| 1 | Disaster Recovery DAG | Cyclic foreign key between `RestaurantTable` and `TableSession` | `RestaurantTable.currentSessionId` MUST be a scalar `String?` without an `@relation` in Prisma. If defined as `@relation`, `backend/src/lib/backup-format.ts` throws `"Backup schema has unsupported dependency cycle"` during topological sort. |
| 2 | Backup Model Count | Model manifest verification in recovery tests | `tests/recovery.integration.test.ts:88` asserts `expect(Object.keys(original.tables)).toHaveLength(48)`. With 12 new Phase 3 models, the total tenant model count increases from 48 to 60. |
| 3 | Single-Column Relation Contract in Prisma | Prisma `@relation(fields: [...], references: [...])` | `backup-format.ts:83` asserts `field.relationFromFields!.length === 1 && field.relationToFields?.[0] === "id"`. All Prisma relation declarations in `schema.prisma` MUST reference single fields (`[fieldId] -> [id]`). Composite multi-tenant FKs are enforced via `@@unique([businessId, id])` in Prisma and native composite foreign keys in PostgreSQL DDL. |
| 4 | Negative Modifier Price Deltas | Modifier option reducing price (e.g. "No Cheese" `-$0.50`, "Half Portion" `-$3.00`) | `ModifierOption.priceDelta` is a signed `Decimal(12, 2)`. Order submission line calculation must support negative additions without underflow, ensuring `unitPrice = MAX(0, basePrice + sum(deltas))`. |
| 5 | Multi-Round Line Preservation | Submitting Round 2 after Round 1 is in `PREPARING` | Round 2 creates a new `OrderRound(roundNumber=2)` and new `OrderLine` records pointing to `orderId`. Round 1 lines, rounds, and items remain completely untouched and immutable. |
| 6 | 3D Status Decoupling | Order settlement transitions to `PAID` while fulfillment is `PREPARING` | Settlement status becomes `PAID`. Fulfillment status remains `PREPARING`. Transitioning settlement NEVER alters fulfillment status. |
| 7 | Optimistic Concurrency on Line Mutations | Two terminals attempting to void or update the same `OrderLine` | Checked via `version: Int @default(1)`. If terminal A updates line version to 2, terminal B writing with version 1 fails closed with `409 Conflict`. |
| 8 | Void Audit Immutability | Kitchen cancels a line after round submission | `OrderLine.fulfillmentStatus` transitions to `CANCELLED`, `voidReason` is recorded with mandatory non-empty text, and `auditEventId` is linked to an immutable `AuditEvent`. Historical pricing and lines are never deleted (`DELETE` prohibited). |

---

## 4. Model-by-Model Specifications

### 4.1 `Floor`
- **Purpose**: Physical dining zones (e.g., Ground Floor, Rooftop Terrace, Banquet Hall).
- **Primary Key**: `id: String @id @default(uuid())`
- **Tenant Isolation**: `businessId: String`, `@@unique([businessId, id])`
- **Scope Uniqueness**: `@@unique([businessId, branchId, name])`
- **Indexes**: `@@index([businessId, branchId, displayOrder])`
- **Fields**:
  - `id`: String (UUID)
  - `businessId`: String (references Business.id, cascade)
  - `branchId`: String (references Branch.id, cascade)
  - `name`: String
  - `displayOrder`: Int (default 0)
  - `isActive`: Boolean (default true)
  - `metadata`: Json? (grid dimensions e.g. `{ gridWidth: 12, gridHeight: 8 }`)
  - `createdAt`: DateTime (default now)
  - `updatedAt`: DateTime (updatedAt)
- **Relations**:
  - `tables`: `RestaurantTable[]`

### 4.2 `RestaurantTable`
- **Purpose**: Table entities with occupancy status, layout coordinates, and seating capacity.
- **Primary Key**: `id: String @id @default(uuid())`
- **Tenant Isolation**: `businessId: String`, `@@unique([businessId, id])`
- **Scope Uniqueness**: `@@unique([businessId, branchId, tableNumber])`
- **Indexes**: `@@index([businessId, branchId, floorId])`, `@@index([businessId, status])`
- **Fields**:
  - `id`: String (UUID)
  - `businessId`: String (references Business.id, cascade)
  - `branchId`: String (references Branch.id, cascade)
  - `floorId`: String (references Floor.id, cascade)
  - `tableNumber`: String (e.g., "T1", "T2", "PATIO-4")
  - `capacity`: Int (default 4)
  - `status`: String (default "AVAILABLE" — `AVAILABLE`, `OCCUPIED`, `RESERVED`, `BILLED`)
  - `currentSessionId`: String? (**Scalar logical ID without `@relation`** to eliminate relation cycles in `backup-format.ts`)
  - `shape`: String (default "RECTANGLE" — `RECTANGLE`, `ROUND`, `SQUARE`)
  - `posX`: Int (default 0)
  - `posY`: Int (default 0)
  - `width`: Int (default 1)
  - `height`: Int (default 1)
  - `isActive`: Boolean (default true)
  - `createdAt`: DateTime (default now)
  - `updatedAt`: DateTime (updatedAt)
- **Relations**:
  - `floor`: `Floor`
  - `tableSessions`: `TableSession[]`
  - `restaurantOrders`: `RestaurantOrder[]`

### 4.3 `TableSession`
- **Purpose**: Active dining session accumulating multiple orders and rounds for a dining party.
- **Primary Key**: `id: String @id @default(uuid())`
- **Tenant Isolation**: `businessId: String`, `@@unique([businessId, id])`
- **Scope Uniqueness**: `@@unique([businessId, branchId, sessionNumber])`
- **Indexes**: `@@index([businessId, branchId, status])`, `@@index([businessId, tableId, status])`
- **Fields**:
  - `id`: String (UUID)
  - `businessId`: String (references Business.id, cascade)
  - `branchId`: String (references Branch.id, cascade)
  - `tableId`: String (references RestaurantTable.id, cascade)
  - `sessionNumber`: String (e.g. "SESS-20261101-0012")
  - `guestCount`: Int (default 1)
  - `status`: String (default "ACTIVE" — `ACTIVE`, `BILLED`, `COMPLETED`, `CANCELLED`)
  - `openedAt`: DateTime (default now)
  - `closedAt`: DateTime?
  - `openedById`: String? (references User.id, set null)
  - `closedById`: String? (references User.id, set null)
  - `version`: Int (default 1, OCC)
  - `notes`: String?
  - `createdAt`: DateTime (default now)
  - `updatedAt`: DateTime (updatedAt)
- **Relations**:
  - `table`: `RestaurantTable`
  - `openedBy`: `User?` (`@relation("SessionOpenedBy")`)
  - `closedBy`: `User?` (`@relation("SessionClosedBy")`)
  - `restaurantOrders`: `RestaurantOrder[]`

### 4.4 `Menu`
- **Purpose**: Restaurant menu container with operating hours.
- **Primary Key**: `id: String @id @default(uuid())`
- **Tenant Isolation**: `businessId: String`, `@@unique([businessId, id])`
- **Indexes**: `@@index([businessId, isActive, displayOrder])`, `@@index([businessId, branchId])`
- **Fields**:
  - `id`: String (UUID)
  - `businessId`: String (references Business.id, cascade)
  - `branchId`: String? (references Branch.id, set null; allows tenant-wide menus with branch overrides)
  - `name`: String (e.g. "All Day Dining", "Bar & Drinks")
  - `description`: String?
  - `isActive`: Boolean (default true)
  - `availableFrom`: String? (e.g. "11:00")
  - `availableTo`: String? (e.g. "23:00")
  - `displayOrder`: Int (default 0)
  - `createdAt`: DateTime (default now)
  - `updatedAt`: DateTime (updatedAt)
- **Relations**:
  - `branch`: `Branch?`
  - `sections`: `MenuSection[]`

### 4.5 `MenuSection`
- **Purpose**: Section within a menu.
- **Primary Key**: `id: String @id @default(uuid())`
- **Tenant Isolation**: `businessId: String`, `@@unique([businessId, id])`
- **Indexes**: `@@index([businessId, menuId, displayOrder])`
- **Fields**:
  - `id`: String (UUID)
  - `businessId`: String (references Business.id, cascade)
  - `menuId`: String (references Menu.id, cascade)
  - `name`: String (e.g. "Appetizers", "Main Courses")
  - `description`: String?
  - `displayOrder`: Int (default 0)
  - `isActive`: Boolean (default true)
  - `createdAt`: DateTime (default now)
  - `updatedAt`: DateTime (updatedAt)
- **Relations**:
  - `menu`: `Menu`
  - `items`: `MenuItem[]`

### 4.6 `MenuItem`
- **Purpose**: Food/beverage item in a menu section with base pricing and modifiers.
- **Primary Key**: `id: String @id @default(uuid())`
- **Tenant Isolation**: `businessId: String`, `@@unique([businessId, id])`
- **Indexes**: `@@index([businessId, sectionId, displayOrder])`, `@@index([businessId, isAvailable])`, `@@index([businessId, productId])`
- **Fields**:
  - `id`: String (UUID)
  - `businessId`: String (references Business.id, cascade)
  - `sectionId`: String (references MenuSection.id, cascade)
  - `productId`: String? (references Product.id, set null; optional retail inventory link)
  - `name`: String (e.g. "Ribeye Steak 12oz")
  - `description`: String?
  - `basePrice`: Decimal (`@db.Decimal(12, 2)`)
  - `taxRate`: Decimal (`@default(0) @db.Decimal(5, 2)`)
  - `imageUrl`: String?
  - `isAvailable`: Boolean (default true, 86 toggle)
  - `isKitchenItem`: Boolean (default true, food prep vs bar/counter)
  - `prepTimeMinutes`: Int?
  - `displayOrder`: Int (default 0)
  - `createdAt`: DateTime (default now)
  - `updatedAt`: DateTime (updatedAt)
- **Relations**:
  - `section`: `MenuSection`
  - `product`: `Product?`
  - `modifierGroups`: `MenuItemModifierGroup[]`
  - `orderLines`: `OrderLine[]`

### 4.7 `ModifierGroup`
- **Purpose**: Configurable group of choices (e.g. Temperature, Dressings, Sides).
- **Primary Key**: `id: String @id @default(uuid())`
- **Tenant Isolation**: `businessId: String`, `@@unique([businessId, id])`
- **Indexes**: `@@index([businessId, isActive])`
- **Fields**:
  - `id`: String (UUID)
  - `businessId`: String (references Business.id, cascade)
  - `name`: String (e.g. "Cooking Temperature")
  - `displayName`: String? (e.g. "How would you like your steak cooked?")
  - `minSelections`: Int (default 0; 0 = optional, 1+ = required)
  - `maxSelections`: Int (default 1; 1 = single choice, >1 = multiple choices)
  - `isActive`: Boolean (default true)
  - `createdAt`: DateTime (default now)
  - `updatedAt`: DateTime (updatedAt)
- **Relations**:
  - `options`: `ModifierOption[]`
  - `menuItemLinks`: `MenuItemModifierGroup[]`

### 4.8 `ModifierOption`
- **Purpose**: Concrete choice within a modifier group with signed monetary delta.
- **Primary Key**: `id: String @id @default(uuid())`
- **Tenant Isolation**: `businessId: String`, `@@unique([businessId, id])`
- **Indexes**: `@@index([businessId, modifierGroupId, displayOrder])`
- **Fields**:
  - `id`: String (UUID)
  - `businessId`: String (references Business.id, cascade)
  - `modifierGroupId`: String (references ModifierGroup.id, cascade)
  - `name`: String (e.g. "Medium Rare", "Oat Milk")
  - `priceDelta`: Decimal (`@default(0) @db.Decimal(12, 2)`)
  - `isAvailable`: Boolean (default true)
  - `displayOrder`: Int (default 0)
  - `createdAt`: DateTime (default now)
  - `updatedAt`: DateTime (updatedAt)
- **Relations**:
  - `modifierGroup`: `ModifierGroup`

### 4.9 `MenuItemModifierGroup`
- **Purpose**: Join table linking `MenuItem` to `ModifierGroup` with per-item min/max overrides.
- **Primary Key**: `id: String @id @default(uuid())`
- **Tenant Isolation**: `businessId: String`, `@@unique([businessId, id])`
- **Scope Uniqueness**: `@@unique([businessId, menuItemId, modifierGroupId])`
- **Indexes**: `@@index([businessId, menuItemId])`, `@@index([businessId, modifierGroupId])`
- **Fields**:
  - `id`: String (UUID)
  - `businessId`: String (references Business.id, cascade)
  - `menuItemId`: String (references MenuItem.id, cascade)
  - `modifierGroupId`: String (references ModifierGroup.id, cascade)
  - `displayOrder`: Int (default 0)
  - `overrideMinSelections`: Int?
  - `overrideMaxSelections`: Int?
  - `createdAt`: DateTime (default now)
- **Relations**:
  - `menuItem`: `MenuItem`
  - `modifierGroup`: `ModifierGroup`

### 4.10 `RestaurantOrder`
- **Purpose**: Restaurant order header linked to a session, table, or bar walk-in.
- **Primary Key**: `id: String @id @default(uuid())`
- **Tenant Isolation**: `businessId: String`, `@@unique([businessId, id])`
- **Scope Uniqueness**: `@@unique([businessId, branchId, orderNumber])`
- **Indexes**:
  - `@@index([businessId, branchId, settlementStatus])`
  - `@@index([businessId, tableSessionId])`
  - `@@index([businessId, tableId])`
  - `@@index([businessId, acceptanceStatus])`
  - `@@index([businessId, fulfillmentStatus])`
- **Fields**:
  - `id`: String (UUID)
  - `businessId`: String (references Business.id, cascade)
  - `branchId`: String (references Branch.id, cascade)
  - `tableSessionId`: String? (references TableSession.id, set null)
  - `tableId`: String? (references RestaurantTable.id, set null)
  - `orderNumber`: String (e.g. "RO-20261101-0042")
  - `orderType`: String (default "DINE_IN" — `DINE_IN`, `TAKEAWAY`, `BAR_WALK_IN`)
  - `acceptanceStatus`: String (default "PENDING" — `PENDING`, `ACCEPTED`, `REJECTED`)
  - `fulfillmentStatus`: String (default "QUEUED" — `QUEUED`, `PREPARING`, `READY`, `SERVED`, `CANCELLED`)
  - `settlementStatus`: String (default "UNPAID" — `UNPAID`, `PARTIAL`, `PAID`, `REFUNDED`)
  - `subtotal`: Decimal (`@default(0) @db.Decimal(12, 2)`)
  - `discountTotal`: Decimal (`@default(0) @db.Decimal(12, 2)`)
  - `taxTotal`: Decimal (`@default(0) @db.Decimal(12, 2)`)
  - `totalAmount`: Decimal (`@default(0) @db.Decimal(12, 2)`)
  - `paidAmount`: Decimal (`@default(0) @db.Decimal(12, 2)`)
  - `version`: Int (default 1, OCC)
  - `createdById`: String? (references User.id, set null)
  - `notes`: String?
  - `createdAt`: DateTime (default now)
  - `updatedAt`: DateTime (updatedAt)
- **Relations**:
  - `branch`: `Branch`
  - `tableSession`: `TableSession?`
  - `table`: `RestaurantTable?`
  - `createdBy`: `User?` (`@relation("OrderCreatedBy")`)
  - `rounds`: `OrderRound[]`
  - `orderLines`: `OrderLine[]`

### 4.11 `OrderRound`
- **Purpose**: Kitchen wave of items submitted together (Round 1 drinks, Round 2 starters, Round 3 mains).
- **Primary Key**: `id: String @id @default(uuid())`
- **Tenant Isolation**: `businessId: String`, `@@unique([businessId, id])`
- **Scope Uniqueness**: `@@unique([businessId, orderId, roundNumber])`
- **Indexes**: `@@index([businessId, orderId, roundNumber])`
- **Fields**:
  - `id`: String (UUID)
  - `businessId`: String (references Business.id, cascade)
  - `orderId`: String (references RestaurantOrder.id, cascade)
  - `roundNumber`: Int (default 1)
  - `status`: String (default "SUBMITTED" — `PENDING`, `SUBMITTED`, `PREPARING`, `COMPLETED`, `CANCELLED`)
  - `submittedAt`: DateTime (default now)
  - `submittedById`: String? (references User.id, set null)
  - `notes`: String?
  - `createdAt`: DateTime (default now)
  - `updatedAt`: DateTime (updatedAt)
- **Relations**:
  - `order`: `RestaurantOrder`
  - `submittedBy`: `User?` (`@relation("RoundSubmittedBy")`)
  - `lines`: `OrderLine[]`

### 4.12 `OrderLine`
- **Purpose**: Individual item line with immutable pricing/modifier snapshots and 3D status tracking.
- **Primary Key**: `id: String @id @default(uuid())`
- **Tenant Isolation**: `businessId: String`, `@@unique([businessId, id])`
- **Indexes**:
  - `@@index([businessId, orderId, roundId])`
  - `@@index([businessId, fulfillmentStatus])`
  - `@@index([businessId, settlementStatus])`
  - `@@index([businessId, menuItemId])`
- **Fields**:
  - `id`: String (UUID)
  - `businessId`: String (references Business.id, cascade)
  - `orderId`: String (references RestaurantOrder.id, cascade)
  - `roundId`: String (references OrderRound.id, cascade)
  - `menuItemId`: String? (references MenuItem.id, set null)
  - `itemName`: String (immutable snapshot)
  - `basePrice`: Decimal (`@db.Decimal(12, 2)`, immutable snapshot)
  - `quantity`: Int (default 1)
  - `appliedModifiers`: Json (immutable snapshot array: `[{ modifierGroupId, groupName, optionId, optionName, priceDelta }]`)
  - `unitPrice`: Decimal (`@db.Decimal(12, 2)`, basePrice + modifier deltas)
  - `taxRate`: Decimal (`@default(0) @db.Decimal(5, 2)`)
  - `taxAmount`: Decimal (`@default(0) @db.Decimal(12, 2)`)
  - `subtotal`: Decimal (`@db.Decimal(12, 2)`, unitPrice * quantity)
  - `total`: Decimal (`@db.Decimal(12, 2)`, subtotal + taxAmount)
  - `notes`: String?
  - `acceptanceStatus`: String (default "PENDING" — `PENDING`, `ACCEPTED`, `REJECTED`)
  - `fulfillmentStatus`: String (default "QUEUED" — `QUEUED`, `PREPARING`, `READY`, `SERVED`, `CANCELLED`)
  - `settlementStatus`: String (default "UNPAID" — `UNPAID`, `PARTIAL`, `PAID`, `REFUNDED`)
  - `rejectionReason`: String? (Mandatory if acceptanceStatus == REJECTED)
  - `voidReason`: String? (Mandatory if fulfillmentStatus == CANCELLED)
  - `auditEventId`: String? (References AuditEvent)
  - `version`: Int (default 1, OCC)
  - `createdAt`: DateTime (default now)
  - `updatedAt`: DateTime (updatedAt)
- **Relations**:
  - `order`: `RestaurantOrder`
  - `round`: `OrderRound`
  - `menuItem`: `MenuItem?`

---

## 5. Exact Prisma Schema Blocks to Append

### 5.1 Updates to Existing Models in `packages/db/prisma/schema.prisma`

#### In `model Business`:
Add the following 12 relation arrays:
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

#### In `model Branch`:
Add the following 5 relation arrays:
```prisma
  floors           Floor[]
  restaurantTables RestaurantTable[]
  tableSessions    TableSession[]
  menus            Menu[]
  restaurantOrders RestaurantOrder[]
```

#### In `model User`:
Add the following 4 named relations:
```prisma
  openedTableSessions     TableSession[]    @relation("SessionOpenedBy")
  closedTableSessions     TableSession[]    @relation("SessionClosedBy")
  createdRestaurantOrders RestaurantOrder[] @relation("OrderCreatedBy")
  submittedOrderRounds    OrderRound[]      @relation("RoundSubmittedBy")
```

#### In `model Product`:
Add the following relation array:
```prisma
  menuItems               MenuItem[]
```

---

### 5.2 The 12 New Model Blocks to Append to `packages/db/prisma/schema.prisma`

```prisma
// ==============================================================================
// PHASE 3: RESTAURANT STAFF MVP MODELS
// ==============================================================================

model Floor {
  id           String            @id @default(uuid())
  businessId   String
  business     Business          @relation(fields: [businessId], references: [id], onDelete: Cascade)
  branchId     String
  branch       Branch            @relation(fields: [branchId], references: [id], onDelete: Cascade)
  name         String
  displayOrder Int               @default(0)
  isActive     Boolean           @default(true)
  metadata     Json?
  createdAt    DateTime          @default(now())
  updatedAt    DateTime          @updatedAt

  tables       RestaurantTable[]

  @@unique([businessId, id])
  @@unique([businessId, branchId, name])
  @@index([businessId, branchId, displayOrder])
}

model RestaurantTable {
  id               String            @id @default(uuid())
  businessId       String
  business         Business          @relation(fields: [businessId], references: [id], onDelete: Cascade)
  branchId         String
  branch           Branch            @relation(fields: [branchId], references: [id], onDelete: Cascade)
  floorId          String
  floor            Floor             @relation(fields: [floorId], references: [id], onDelete: Cascade)
  tableNumber      String
  capacity         Int               @default(4)
  status           String            @default("AVAILABLE") // AVAILABLE, OCCUPIED, RESERVED, BILLED
  currentSessionId String?           // Scalar logical ID without @relation to preserve DAG acyclicity
  shape            String            @default("RECTANGLE") // RECTANGLE, ROUND, SQUARE
  posX             Int               @default(0)
  posY             Int               @default(0)
  width            Int               @default(1)
  height           Int               @default(1)
  isActive         Boolean           @default(true)
  createdAt        DateTime          @default(now())
  updatedAt        DateTime          @updatedAt

  tableSessions    TableSession[]
  restaurantOrders RestaurantOrder[]

  @@unique([businessId, id])
  @@unique([businessId, branchId, tableNumber])
  @@index([businessId, branchId, floorId])
  @@index([businessId, status])
}

model TableSession {
  id            String            @id @default(uuid())
  businessId    String
  business      Business          @relation(fields: [businessId], references: [id], onDelete: Cascade)
  branchId      String
  branch        Branch            @relation(fields: [branchId], references: [id], onDelete: Cascade)
  tableId       String
  table         RestaurantTable   @relation(fields: [tableId], references: [id], onDelete: Cascade)
  sessionNumber String
  guestCount    Int               @default(1)
  status        String            @default("ACTIVE") // ACTIVE, BILLED, COMPLETED, CANCELLED
  openedAt      DateTime          @default(now())
  closedAt      DateTime?
  openedById    String?
  openedBy      User?             @relation("SessionOpenedBy", fields: [openedById], references: [id], onDelete: SetNull)
  closedById    String?
  closedBy      User?             @relation("SessionClosedBy", fields: [closedById], references: [id], onDelete: SetNull)
  version       Int               @default(1) // Optimistic Concurrency Control
  notes         String?
  createdAt     DateTime          @default(now())
  updatedAt     DateTime          @updatedAt

  restaurantOrders RestaurantOrder[]

  @@unique([businessId, id])
  @@unique([businessId, branchId, sessionNumber])
  @@index([businessId, branchId, status])
  @@index([businessId, tableId, status])
}

model Menu {
  id            String            @id @default(uuid())
  businessId    String
  business      Business          @relation(fields: [businessId], references: [id], onDelete: Cascade)
  branchId      String?
  branch        Branch?           @relation(fields: [branchId], references: [id], onDelete: SetNull)
  name          String
  description   String?
  isActive      Boolean           @default(true)
  availableFrom String?
  availableTo   String?
  displayOrder  Int               @default(0)
  createdAt     DateTime          @default(now())
  updatedAt     DateTime          @updatedAt

  sections      MenuSection[]

  @@unique([businessId, id])
  @@index([businessId, isActive, displayOrder])
  @@index([businessId, branchId])
}

model MenuSection {
  id           String            @id @default(uuid())
  businessId   String
  business     Business          @relation(fields: [businessId], references: [id], onDelete: Cascade)
  menuId       String
  menu         Menu              @relation(fields: [menuId], references: [id], onDelete: Cascade)
  name         String
  description  String?
  displayOrder Int               @default(0)
  isActive     Boolean           @default(true)
  createdAt    DateTime          @default(now())
  updatedAt    DateTime          @updatedAt

  items        MenuItem[]

  @@unique([businessId, id])
  @@index([businessId, menuId, displayOrder])
}

model MenuItem {
  id              String                  @id @default(uuid())
  businessId      String
  business        Business                @relation(fields: [businessId], references: [id], onDelete: Cascade)
  sectionId       String
  section         MenuSection             @relation(fields: [sectionId], references: [id], onDelete: Cascade)
  productId       String?
  product         Product?                @relation(fields: [productId], references: [id], onDelete: SetNull)
  name            String
  description     String?
  basePrice       Decimal                 @db.Decimal(12, 2)
  taxRate         Decimal                 @default(0) @db.Decimal(5, 2)
  imageUrl        String?
  isAvailable     Boolean                 @default(true)
  isKitchenItem   Boolean                 @default(true)
  prepTimeMinutes Int?
  displayOrder    Int                     @default(0)
  createdAt       DateTime                @default(now())
  updatedAt       DateTime                @updatedAt

  modifierGroups  MenuItemModifierGroup[]
  orderLines      OrderLine[]

  @@unique([businessId, id])
  @@index([businessId, sectionId, displayOrder])
  @@index([businessId, isAvailable])
  @@index([businessId, productId])
}

model ModifierGroup {
  id            String                  @id @default(uuid())
  businessId    String
  business      Business                @relation(fields: [businessId], references: [id], onDelete: Cascade)
  name          String
  displayName   String?
  minSelections Int                     @default(0)
  maxSelections Int                     @default(1)
  isActive      Boolean                 @default(true)
  createdAt     DateTime                @default(now())
  updatedAt     DateTime                @updatedAt

  options       ModifierOption[]
  menuItemLinks MenuItemModifierGroup[]

  @@unique([businessId, id])
  @@index([businessId, isActive])
}

model ModifierOption {
  id              String        @id @default(uuid())
  businessId      String
  business        Business      @relation(fields: [businessId], references: [id], onDelete: Cascade)
  modifierGroupId String
  modifierGroup   ModifierGroup @relation(fields: [modifierGroupId], references: [id], onDelete: Cascade)
  name            String
  priceDelta      Decimal       @default(0) @db.Decimal(12, 2)
  isAvailable     Boolean       @default(true)
  displayOrder    Int           @default(0)
  createdAt       DateTime      @default(now())
  updatedAt       DateTime      @updatedAt

  @@unique([businessId, id])
  @@index([businessId, modifierGroupId, displayOrder])
}

model MenuItemModifierGroup {
  id                    String        @id @default(uuid())
  businessId            String
  business              Business      @relation(fields: [businessId], references: [id], onDelete: Cascade)
  menuItemId            String
  menuItem              MenuItem      @relation(fields: [menuItemId], references: [id], onDelete: Cascade)
  modifierGroupId       String
  modifierGroup         ModifierGroup @relation(fields: [modifierGroupId], references: [id], onDelete: Cascade)
  displayOrder          Int           @default(0)
  overrideMinSelections Int?
  overrideMaxSelections Int?
  createdAt             DateTime      @default(now())

  @@unique([businessId, id])
  @@unique([businessId, menuItemId, modifierGroupId])
  @@index([businessId, menuItemId])
  @@index([businessId, modifierGroupId])
}

model RestaurantOrder {
  id                String            @id @default(uuid())
  businessId        String
  business          Business          @relation(fields: [businessId], references: [id], onDelete: Cascade)
  branchId          String
  branch            Branch            @relation(fields: [branchId], references: [id], onDelete: Cascade)
  tableSessionId    String?
  tableSession      TableSession?     @relation(fields: [tableSessionId], references: [id], onDelete: SetNull)
  tableId           String?
  table             RestaurantTable?  @relation(fields: [tableId], references: [id], onDelete: SetNull)
  orderNumber       String
  orderType         String            @default("DINE_IN") // DINE_IN, TAKEAWAY, BAR_WALK_IN
  
  // Independent 3D Status Dimensions
  acceptanceStatus  String            @default("PENDING") // PENDING, ACCEPTED, REJECTED
  fulfillmentStatus String            @default("QUEUED")  // QUEUED, PREPARING, READY, SERVED, CANCELLED
  settlementStatus  String            @default("UNPAID")  // UNPAID, PARTIAL, PAID, REFUNDED
  
  // Aggregated Monies (Decimal 12, 2)
  subtotal          Decimal           @default(0) @db.Decimal(12, 2)
  discountTotal     Decimal           @default(0) @db.Decimal(12, 2)
  taxTotal          Decimal           @default(0) @db.Decimal(12, 2)
  totalAmount       Decimal           @default(0) @db.Decimal(12, 2)
  paidAmount        Decimal           @default(0) @db.Decimal(12, 2)
  
  version           Int               @default(1) // Optimistic Concurrency Control
  createdById       String?
  createdBy         User?             @relation("OrderCreatedBy", fields: [createdById], references: [id], onDelete: SetNull)
  notes             String?
  createdAt         DateTime          @default(now())
  updatedAt         DateTime          @updatedAt

  rounds            OrderRound[]
  orderLines        OrderLine[]

  @@unique([businessId, id])
  @@unique([businessId, branchId, orderNumber])
  @@index([businessId, branchId, settlementStatus])
  @@index([businessId, tableSessionId])
  @@index([businessId, tableId])
  @@index([businessId, acceptanceStatus])
  @@index([businessId, fulfillmentStatus])
}

model OrderRound {
  id            String          @id @default(uuid())
  businessId    String
  business      Business        @relation(fields: [businessId], references: [id], onDelete: Cascade)
  orderId       String
  order         RestaurantOrder @relation(fields: [orderId], references: [id], onDelete: Cascade)
  roundNumber   Int             @default(1)
  status        String          @default("SUBMITTED") // PENDING, SUBMITTED, PREPARING, COMPLETED, CANCELLED
  submittedAt   DateTime        @default(now())
  submittedById String?
  submittedBy   User?           @relation("RoundSubmittedBy", fields: [submittedById], references: [id], onDelete: SetNull)
  notes         String?
  createdAt     DateTime        @default(now())
  updatedAt     DateTime        @updatedAt

  lines         OrderLine[]

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
  itemName          String
  basePrice         Decimal         @db.Decimal(12, 2)
  quantity          Int             @default(1)
  appliedModifiers  Json            // Snapshot array: [{ modifierGroupId, groupName, optionId, optionName, priceDelta }]
  unitPrice         Decimal         @db.Decimal(12, 2)
  taxRate           Decimal         @default(0) @db.Decimal(5, 2)
  taxAmount         Decimal         @default(0) @db.Decimal(12, 2)
  subtotal          Decimal         @db.Decimal(12, 2)
  total             Decimal         @db.Decimal(12, 2)
  notes             String?
  
  // Independent 3D Line Statuses
  acceptanceStatus  String          @default("PENDING") // PENDING, ACCEPTED, REJECTED
  fulfillmentStatus String          @default("QUEUED")  // QUEUED, PREPARING, READY, SERVED, CANCELLED
  settlementStatus  String          @default("UNPAID")  // UNPAID, PARTIAL, PAID, REFUNDED
  
  // Audit & Cancellation Provenance
  rejectionReason   String?
  voidReason        String?
  auditEventId      String?
  
  version           Int             @default(1) // Optimistic Concurrency Control
  createdAt         DateTime        @default(now())
  updatedAt         DateTime        @updatedAt

  @@unique([businessId, id])
  @@index([businessId, orderId, roundId])
  @@index([businessId, fulfillmentStatus])
  @@index([businessId, settlementStatus])
  @@index([businessId, menuItemId])
}
```

---

## 6. Exact PostgreSQL DDL Migration Script

The file will be located at:
`packages/db/prisma/migrations/202611010001_phase3_restaurant_staff_mvp/migration.sql`

```sql
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
```

---

## 7. Disaster Recovery & Migration Verification

### 7.1 Disaster Recovery Topological Sort (`backend/src/lib/backup-format.ts`)
The backup engine executes a topological sort over all non-excluded Prisma models to determine snapshot capture and restoration order.
Dependencies across the 12 models are strictly acyclic:
1. `Floor` -> (`Business`, `Branch`)
2. `RestaurantTable` -> (`Business`, `Branch`, `Floor`)
3. `TableSession` -> (`Business`, `Branch`, `RestaurantTable`, `User`)
4. `Menu` -> (`Business`, `Branch`)
5. `MenuSection` -> (`Business`, `Menu`)
6. `MenuItem` -> (`Business`, `MenuSection`, `Product`)
7. `ModifierGroup` -> (`Business`)
8. `ModifierOption` -> (`Business`, `ModifierGroup`)
9. `MenuItemModifierGroup` -> (`Business`, `MenuItem`, `ModifierGroup`)
10. `RestaurantOrder` -> (`Business`, `Branch`, `TableSession`, `RestaurantTable`, `User`)
11. `OrderRound` -> (`Business`, `RestaurantOrder`, `User`)
12. `OrderLine` -> (`Business`, `RestaurantOrder`, `OrderRound`, `MenuItem`)

Because `RestaurantTable.currentSessionId` is maintained as a scalar `String?` without an explicit Prisma `@relation`, no cycle is formed between `RestaurantTable` and `TableSession`.

### 7.2 Model Count Assertion (`tests/recovery.integration.test.ts:88`)
- Current schema contains **48** tenant models.
- Phase 3 appends **12** hospitality models.
- Implementers must update line 88 of `tests/recovery.integration.test.ts`:
  ```ts
  // Old:
  expect(Object.keys(original.tables)).toHaveLength(48);
  // New:
  expect(Object.keys(original.tables)).toHaveLength(60);
  ```

---

## 8. Conclusion & Handoff Summary
All schema structures, relational invariants, precision requirements, and SQL migration statements are completely formulated, cross-verified, and ready for deployment by the M1 Worker and Reviewer agents.
