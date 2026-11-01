# Milestone 1: Core Schema & Decimal Migration — Analysis & Implementation Report

**Author**: M1 Explorer 1 (Schema & Migration Specialist)  
**Working Directory**: `c:\projects\pos\.agents\teamwork\m1_explorer_1\`  
**Milestone**: Milestone 1 (Core Schema & Decimal Migration)  
**Date**: 2026-10-31  

---

## 1. Observation

Direct investigation of `packages/db/prisma/schema.prisma`, previous migrations in `packages/db/prisma/migrations/`, `backend/src/lib/backup-format.ts`, and test verification suites yielded the following empirical facts:

### 1.1 Complete Field Audit of `packages/db/prisma/schema.prisma` (67 Total Float Fields)

An exhaustive line-by-line inspection and AST scan of `packages/db/prisma/schema.prisma` (956 lines) identified **67 total `Float` fields**:
- **57 Monetary Fields across 22 Models** that represent currency values (prices, totals, payments, ledger debits/credits/balances, taxes, discounts, and fees):
  1. `Product` (line 225): `costPrice Float @default(0)`
  2. `Product` (line 226): `sellingPrice Float @default(0)`
  3. `Product` (line 227): `wholesalePrice Float @default(0)`
  4. `Batch` (line 270): `costPrice Float?`
  5. `Batch` (line 271): `sellingPrice Float?`
  6. `Customer` (line 293): `creditLimit Float @default(0)`
  7. `Customer` (line 294): `balance Float @default(0)`
  8. `CustomerLedger` (line 312): `debit Float @default(0)`
  9. `CustomerLedger` (line 313): `credit Float @default(0)`
  10. `CustomerLedger` (line 314): `balance Float @default(0)`
  11. `Supplier` (line 328): `balance Float @default(0)`
  12. `SupplierLedger` (line 350): `debit Float @default(0)`
  13. `SupplierLedger` (line 351): `credit Float @default(0)`
  14. `SupplierLedger` (line 352): `balance Float @default(0)`
  15. `Sale` (line 369): `subtotal Float @default(0)`
  16. `Sale` (line 370): `discount Float @default(0)`
  17. `Sale` (line 371): `tax Float @default(0)`
  18. `Sale` (line 372): `total Float @default(0)`
  19. `Sale` (line 373): `paidAmount Float @default(0)`
  20. `Sale` (line 395): `vatRefundAmount Float @default(0)`
  21. `SaleItem` (line 422): `costPrice Float @default(0)`
  22. `SaleItem` (line 423): `price Float @default(0)`
  23. `SaleItem` (line 424): `discount Float @default(0)`
  24. `SaleItem` (line 425): `tax Float @default(0)`
  25. `SaleItem` (line 426): `total Float @default(0)`
  26. `Purchase` (line 442): `subtotal Float @default(0)`
  27. `Purchase` (line 443): `discount Float @default(0)`
  28. `Purchase` (line 444): `tax Float @default(0)`
  29. `Purchase` (line 445): `total Float @default(0)`
  30. `Purchase` (line 446): `paidAmount Float @default(0)`
  31. `PurchaseItem` (line 470): `price Float @default(0)`
  32. `PurchaseItem` (line 471): `total Float @default(0)`
  33. `Payment` (line 490): `amount Float`
  34. `SaleReturn` (line 523): `refundAmount Float @default(0)`
  35. `SaleReturnItem` (line 537): `price Float`
  36. `SaleReturnItem` (line 538): `total Float`
  37. `PurchaseReturn` (line 548): `refundAmount Float @default(0)`
  38. `PurchaseReturnItem` (line 562): `price Float`
  39. `PurchaseReturnItem` (line 563): `total Float`
  40. `Expense` (line 590): `amount Float`
  41. `Income` (line 624): `amount Float`
  42. `OpeningStock` (line 717): `purchaseRate Float @default(0)`
  43. `OpeningStock` (line 718): `sellingPrice Float @default(0)`
  44. `OpeningStock` (line 719): `mrp Float @default(0)`
  45. `OpeningStock` (line 720): `totalValue Float @default(0)`
  46. `CreditNote` (line 820): `subtotal Float @default(0)`
  47. `CreditNote` (line 821): `discount Float @default(0)`
  48. `CreditNote` (line 822): `tax Float @default(0)`
  49: `CreditNote` (line 823): `total Float @default(0)`
  50. `CreditNoteItem` (line 844): `price Float`
  51. `CreditNoteItem` (line 845): `total Float`
  52. `DebitNote` (line 858): `subtotal Float @default(0)`
  53. `DebitNote` (line 859): `discount Float @default(0)`
  54. `DebitNote` (line 860): `tax Float @default(0)`
  55. `DebitNote` (line 861): `total Float @default(0)`
  56. `DebitNoteItem` (line 882): `price Float`
  57. `DebitNoteItem` (line 883): `total Float`

- **10 Inventory Quantity Fields across 9 Models** (non-monetary physical item quantities):
  1. `ProductStock` (line 255): `quantity Float @default(0)`
  2. `Batch` (line 269): `quantity Float @default(0)`
  3. `SaleItem` (line 421): `quantity Float @default(1)`
  4. `PurchaseItem` (line 469): `quantity Float @default(1)`
  5. `SaleReturnItem` (line 536): `quantity Float`
  6. `PurchaseReturnItem` (line 561): `quantity Float`
  7. `StockTransferItem` (line 664): `quantity Float`
  8. `OpeningStock` (line 713): `quantity Float @default(0)`
  9. `CreditNoteItem` (line 843): `quantity Float`
  10. `DebitNoteItem` (line 881): `quantity Float`

### 1.2 Verification of Existing Migrations and Relational Architecture

Inspection of `packages/db/prisma/migrations/`:
- `202610300001_retail_baseline/migration.sql`: Established tables with `DOUBLE PRECISION` monetary columns.
- `202610310001_phase1_security_foundation/migration.sql`: Implemented relational tenant isolation by establishing composite unique indices `(businessId, id)` on all tenant tables and composite foreign keys:
  - `Payment(businessId, saleId) -> Sale(businessId, id)`
  - `Payment(businessId, purchaseId) -> Purchase(businessId, id)`
  - `Payment(businessId, branchId) -> Branch(businessId, id)`
- `scripts/restro-env.mjs`: Manages isolated environment at `127.0.0.1:55439`. The command `node scripts/restro-env.mjs migrate` directly invokes `prisma migrate deploy` against the running PostgreSQL container.

### 1.3 Backup Format Integration (`backend/src/lib/backup-format.ts`)

Inspection of `backend/src/lib/backup-format.ts`:
- Lines 12-19 compute `backupModels` dynamically using topological dependency ordering from `Prisma.dmmf.datamodel.models`.
- In `validateSnapshot` (lines 60-66):
  ```ts
  const valid = field.type === "String" ? typeof value === "string" : field.type === "Boolean" ? typeof value === "boolean" :
    field.type === "Float" ? typeof value === "number" && Number.isFinite(value) :
    field.type === "Int" ? typeof value === "number" && Number.isInteger(value) && value >= -2147483648 && value <= 2147483647 :
    field.type === "DateTime" ? typeof value === "string" && Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value :
    field.type === "Json" ? value !== undefined : false;
  ```
  `field.type === "Decimal"` is currently missing from `validateSnapshot`. Introducing `Decimal` to `schema.prisma` will fail snapshot validation during recovery tests unless `field.type === "Decimal"` is explicitly supported in `backup-format.ts`.
- In `tests/recovery.integration.test.ts` (lines 53-54):
  Synthetic row generator expects `field.type === "Float" ? 125.25 : ...`. It must also support `field.type === "Decimal" ? 125.25 : ...` or `new Prisma.Decimal("125.25")`.

### 1.4 Baseline Test Execution Status

- `npm run typecheck`: Passed with exit code 0 across both backend and frontend.
- `npm test`: Passed with exit code 0 (30 unit tests passed, 36 database integration tests skipped as designed when run without container harness).
- `node scripts/restro-env.mjs integration`: Passed with exit code 0 (14 integration tests passed against `127.0.0.1:55439`).
- `node scripts/restro-env.mjs recovery-test`: Passed with exit code 0 (8 recovery tests passed).

---

## 2. Logic Chain

```
[Observation 1.1] 57 monetary fields are typed as Float in schema.prisma.
       │
       ▼
[Step 1] In PostgreSQL, Float corresponds to DOUBLE PRECISION (IEEE 754 floating point).
       Floating point values suffer from precision drift (e.g., 0.1 + 0.2 = 0.30000000000000004),
       which causes accounting and tax compliance failures (CBMS/IRD).
       Therefore, all 57 monetary fields must be migrated to DECIMAL(12, 2) in PostgreSQL and Prisma.
       │
       ▼
[Observation 1.2] Existing data may contain IEEE 754 binary representation artifacts.
       │
       ▼
[Step 2] A direct cast `column::numeric(12, 2)` or `column::decimal(12, 2)` can encounter
       unexpected rounding or truncation issues if precision drift pushed values beyond 2 decimal places.
       Therefore, the SQL migration must use `ROUND("column"::numeric, 2)` inside `USING` clauses.
       Furthermore, explicit `ALTER COLUMN ... SET DEFAULT 0` guarantees default constraints are exact Decimals.
       │
       ▼
[Observation 1.2] Relational tenant isolation was established in Phase 1 with (businessId, id) composite keys.
       │
       ▼
[Step 3] The 5 new models (PaymentAllocation, PaymentReversal, Refund, StockMovement, OutboxEvent)
       must adhere to this exact security invariant:
       - Every tenant model must define `@@unique([businessId, id])`.
       - Single-column foreign keys satisfy Prisma relations.
       - Composite foreign keys enforce tenant isolation at PostgreSQL engine level.
       │
       ▼
[Observation 1.1 & R3] Inventory quantities require up to 4 decimal places for hospitality portions/recipes.
       │
       ▼
[Step 4] While prices and ledger amounts strictly require DECIMAL(12, 2),
       `StockMovement.quantity` must be `DECIMAL(12, 4)` signed to accurately track physical inventory.
       To prevent double consumption, `@@unique([businessId, eventKey])` provides idempotency dedup.
       │
       ▼
[Observation 1.3] `backend/src/lib/backup-format.ts` validates field types in snapshots using DMMF `field.type`.
       │
       ▼
[Step 5] If Prisma DMMF outputs `field.type === "Decimal"`, `validateSnapshot` will reject rows as invalid
       unless `field.type === "Decimal"` is accepted. The worker must align `backup-format.ts` and `recovery.integration.test.ts`.
```

---

## 3. Caveats

1. **Prisma Decimal vs TypeScript Math**:
   When Prisma Client is generated with `Decimal`, fields return instances of `Decimal.js` rather than native JavaScript `number`.
   Any existing code in `backend/src/app/api/v1/` that performs direct arithmetic operations (such as `+`, `-`, `*`, `/`) on monetary fields from Prisma query results (e.g. `reports/route.ts`, `inventory/stock-value/route.ts`) must wrap values in `Number(...)` or utilize the upcoming `decimal-math.ts` service (Milestone 2) to prevent TypeScript compilation errors.
2. **Nullable Batch Prices vs Mandatory Defaults**:
   In `Batch`, `costPrice` and `sellingPrice` are optional (`Float?`), whereas in `Product` they have `@default(0)`. The SQL migration and Prisma schema must preserve nullability on `Batch` while enforcing `@default(0)` on `Product`.
3. **Quantity Fields in Existing Models**:
   The 10 existing quantity fields (`ProductStock.quantity`, `Batch.quantity`, etc.) remain `Float` in this milestone. Reconciling `ProductStock.quantity` with $\sum \text{StockMovement.quantity}$ in Milestone 3 must convert values safely using exact decimal arithmetic.
4. **Historical Payment Allocation & Stock Baseline Backfill**:
   To prevent orphaned records and ensure $\text{ProductStock.quantity} \equiv \sum \text{StockMovement.quantity}$ holds immediately after migration, the SQL migration script includes non-destructive `INSERT INTO ... SELECT` backfill statements for existing invoice-linked payments and active stock balances.

---

## 4. Conclusion & Implementation Plan

### 4.1 Schema Modifications (`packages/db/prisma/schema.prisma`)

#### 4.1.1 Update 57 Monetary Fields to `Decimal @db.Decimal(12, 2)`
In `packages/db/prisma/schema.prisma`, update the 57 fields identified in Section 1.1. Example definitions:
```prisma
// Product (lines 225-227)
costPrice      Decimal @default(0) @db.Decimal(12, 2)
sellingPrice   Decimal @default(0) @db.Decimal(12, 2)
wholesalePrice Decimal @default(0) @db.Decimal(12, 2)

// Batch (lines 270-271)
costPrice      Decimal? @db.Decimal(12, 2)
sellingPrice   Decimal? @db.Decimal(12, 2)

// Customer (lines 293-294)
creditLimit    Decimal @default(0) @db.Decimal(12, 2)
balance        Decimal @default(0) @db.Decimal(12, 2)

// CustomerLedger (lines 312-314)
debit          Decimal @default(0) @db.Decimal(12, 2)
credit         Decimal @default(0) @db.Decimal(12, 2)
balance        Decimal @default(0) @db.Decimal(12, 2)

// Supplier (line 328)
balance        Decimal @default(0) @db.Decimal(12, 2)

// SupplierLedger (lines 350-352)
debit          Decimal @default(0) @db.Decimal(12, 2)
credit         Decimal @default(0) @db.Decimal(12, 2)
balance        Decimal @default(0) @db.Decimal(12, 2)

// Sale (lines 369-373, 395)
subtotal        Decimal @default(0) @db.Decimal(12, 2)
discount        Decimal @default(0) @db.Decimal(12, 2)
tax             Decimal @default(0) @db.Decimal(12, 2)
total           Decimal @default(0) @db.Decimal(12, 2)
paidAmount      Decimal @default(0) @db.Decimal(12, 2)
vatRefundAmount Decimal @default(0) @db.Decimal(12, 2)

// SaleItem (lines 422-426)
costPrice Decimal @default(0) @db.Decimal(12, 2)
price     Decimal @default(0) @db.Decimal(12, 2)
discount  Decimal @default(0) @db.Decimal(12, 2)
tax       Decimal @default(0) @db.Decimal(12, 2)
total     Decimal @default(0) @db.Decimal(12, 2)

// Purchase (lines 442-446)
subtotal   Decimal @default(0) @db.Decimal(12, 2)
discount   Decimal @default(0) @db.Decimal(12, 2)
tax        Decimal @default(0) @db.Decimal(12, 2)
total      Decimal @default(0) @db.Decimal(12, 2)
paidAmount Decimal @default(0) @db.Decimal(12, 2)

// PurchaseItem (lines 470-471)
price Decimal @default(0) @db.Decimal(12, 2)
total Decimal @default(0) @db.Decimal(12, 2)

// Payment (line 490)
amount Decimal @db.Decimal(12, 2)

// SaleReturn & SaleReturnItem (lines 523, 537-538)
refundAmount Decimal @default(0) @db.Decimal(12, 2)
price        Decimal @db.Decimal(12, 2)
total        Decimal @db.Decimal(12, 2)

// PurchaseReturn & PurchaseReturnItem (lines 548, 562-563)
refundAmount Decimal @default(0) @db.Decimal(12, 2)
price        Decimal @db.Decimal(12, 2)
total        Decimal @db.Decimal(12, 2)

// Expense (line 590) & Income (line 624)
amount Decimal @db.Decimal(12, 2)

// OpeningStock (lines 717-720)
purchaseRate Decimal @default(0) @db.Decimal(12, 2)
sellingPrice Decimal @default(0) @db.Decimal(12, 2)
mrp          Decimal @default(0) @db.Decimal(12, 2)
totalValue   Decimal @default(0) @db.Decimal(12, 2)

// CreditNote & CreditNoteItem (lines 820-823, 844-845)
subtotal Decimal @default(0) @db.Decimal(12, 2)
discount Decimal @default(0) @db.Decimal(12, 2)
tax      Decimal @default(0) @db.Decimal(12, 2)
total    Decimal @default(0) @db.Decimal(12, 2)
price    Decimal @db.Decimal(12, 2)
total    Decimal @db.Decimal(12, 2)

// DebitNote & DebitNoteItem (lines 858-861, 882-883)
subtotal Decimal @default(0) @db.Decimal(12, 2)
discount Decimal @default(0) @db.Decimal(12, 2)
tax      Decimal @default(0) @db.Decimal(12, 2)
total    Decimal @default(0) @db.Decimal(12, 2)
price    Decimal @db.Decimal(12, 2)
total    Decimal @db.Decimal(12, 2)
```

#### 4.1.2 Reverse Relations on Existing Models
Add reverse relation fields to existing models:
- **`Business`**:
  ```prisma
  paymentAllocations PaymentAllocation[]
  paymentReversals   PaymentReversal[]
  refunds            Refund[]
  stockMovements     StockMovement[]
  outboxEvents       OutboxEvent[]
  ```
- **`Branch`**:
  ```prisma
  refunds        Refund[]
  stockMovements StockMovement[]
  ```
- **`User`**:
  ```prisma
  paymentAllocations PaymentAllocation[]
  paymentReversals   PaymentReversal[]
  refunds            Refund[]
  stockMovements     StockMovement[]
  ```
- **`Product`**:
  ```prisma
  stockMovements StockMovement[]
  ```
- **`Payment`**:
  ```prisma
  allocations PaymentAllocation[]
  reversal    PaymentReversal?
  refunds     Refund[]
  ```
- **`Sale`**:
  ```prisma
  paymentAllocations PaymentAllocation[]
  refunds            Refund[]
  ```
- **`Purchase`**:
  ```prisma
  paymentAllocations PaymentAllocation[]
  ```
- **`Customer`**:
  ```prisma
  refunds Refund[]
  ```

#### 4.1.3 The 5 New Models
Append the following models to `packages/db/prisma/schema.prisma`:
```prisma
model PaymentAllocation {
  id            String    @id @default(uuid())
  businessId    String
  business      Business  @relation(fields: [businessId], references: [id], onDelete: Cascade)
  paymentId     String
  payment       Payment   @relation(fields: [paymentId], references: [id], onDelete: Cascade)
  saleId        String?
  sale          Sale?     @relation(fields: [saleId], references: [id], onDelete: Cascade)
  purchaseId    String?
  purchase      Purchase? @relation(fields: [purchaseId], references: [id], onDelete: Cascade)
  amount        Decimal   @db.Decimal(12, 2)
  allocatedAt   DateTime  @default(now())
  allocatedById String?
  allocatedBy   User?     @relation(fields: [allocatedById], references: [id], onDelete: SetNull)

  @@unique([businessId, id])
  @@index([businessId, paymentId])
  @@index([businessId, saleId])
  @@index([businessId, purchaseId])
}

model PaymentReversal {
  id           String    @id @default(uuid())
  businessId   String
  business     Business  @relation(fields: [businessId], references: [id], onDelete: Cascade)
  paymentId    String    @unique
  payment      Payment   @relation(fields: [paymentId], references: [id], onDelete: Cascade)
  reason       String
  reversedById String?
  reversedBy   User?     @relation(fields: [reversedById], references: [id], onDelete: SetNull)
  reversedAt   DateTime  @default(now())

  @@unique([businessId, id])
  @@index([businessId, paymentId])
}

model Refund {
  id          String    @id @default(uuid())
  businessId  String
  business    Business  @relation(fields: [businessId], references: [id], onDelete: Cascade)
  branchId    String
  branch      Branch    @relation(fields: [branchId], references: [id], onDelete: Cascade)
  saleId      String?
  sale        Sale?     @relation(fields: [saleId], references: [id], onDelete: SetNull)
  paymentId   String?
  payment     Payment?  @relation(fields: [paymentId], references: [id], onDelete: SetNull)
  customerId  String?
  customer    Customer? @relation(fields: [customerId], references: [id], onDelete: SetNull)
  amount      Decimal   @db.Decimal(12, 2)
  method      String    @default("CASH")
  reason      String
  reference   String?
  status      String    @default("COMPLETED")
  createdById String?
  createdBy   User?     @relation(fields: [createdById], references: [id], onDelete: SetNull)
  createdAt   DateTime  @default(now())

  @@unique([businessId, id])
  @@index([businessId, branchId])
  @@index([businessId, saleId])
  @@index([businessId, paymentId])
  @@index([businessId, customerId])
}

model StockMovement {
  id          String    @id @default(uuid())
  businessId  String
  business    Business  @relation(fields: [businessId], references: [id], onDelete: Cascade)
  branchId    String
  branch      Branch    @relation(fields: [branchId], references: [id], onDelete: Cascade)
  productId   String
  product     Product   @relation(fields: [productId], references: [id], onDelete: Cascade)
  batchNumber String?
  quantity    Decimal   @db.Decimal(12, 4)
  unit        String    @default("pcs")
  sourceType  String
  sourceId    String
  eventKey    String?
  actorId     String?
  actor       User?     @relation(fields: [actorId], references: [id], onDelete: SetNull)
  notes       String?
  createdAt   DateTime  @default(now())

  @@unique([businessId, id])
  @@unique([businessId, eventKey])
  @@index([businessId, branchId, productId, createdAt])
  @@index([businessId, productId, batchNumber])
  @@index([businessId, sourceType, sourceId])
}

model OutboxEvent {
  id            String    @id @default(uuid())
  businessId    String
  business      Business  @relation(fields: [businessId], references: [id], onDelete: Cascade)
  aggregateType String
  aggregateId   String
  eventType     String
  payload       Json
  headers       Json?
  status        String    @default("PENDING")
  retryCount    Int       @default(0)
  lastError     String?
  scheduledAt   DateTime  @default(now())
  publishedAt   DateTime?
  createdAt     DateTime  @default(now())

  @@unique([businessId, id])
  @@index([status, scheduledAt])
  @@index([businessId, aggregateType, aggregateId])
}
```

---

### 4.2 Exact Non-Destructive SQL Migration Script

Target Path: `packages/db/prisma/migrations/202610310002_phase2_financial_inventory_core/migration.sql`

```sql
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
```

---

### 4.3 Detailed Command Sequence for Implementation Worker

The implementing agent should execute the following sequence step by step:

1. **Step 1: Apply Schema Updates**
   - Edit `packages/db/prisma/schema.prisma` to update all 57 monetary fields to `Decimal @db.Decimal(12, 2)` (with `@default(0)` where appropriate).
   - Add reverse relations to `Business`, `Branch`, `User`, `Product`, `Payment`, `Sale`, `Purchase`, and `Customer`.
   - Append the 5 new models: `PaymentAllocation`, `PaymentReversal`, `Refund`, `StockMovement`, `OutboxEvent`.

2. **Step 2: Create Migration File**
   - Create directory `packages/db/prisma/migrations/202610310002_phase2_financial_inventory_core`.
   - Write the exact SQL script from Section 4.2 to `packages/db/prisma/migrations/202610310002_phase2_financial_inventory_core/migration.sql`.

3. **Step 3: Regenerate Prisma Client**
   ```powershell
   npm run prisma:generate
   ```
   *Rationale*: Updates TypeScript declarations and DMMF definitions in `packages/db/client/`.

4. **Step 4: Update Backup & Recovery Serialization**
   - In `backend/src/lib/backup-format.ts`, update `validateSnapshot`:
     ```ts
     field.type === "Decimal" ? (typeof value === "string" && !isNaN(Number(value))) || (typeof value === "number" && Number.isFinite(value)) :
     ```
   - In `tests/recovery.integration.test.ts`, update synthetic field generator to handle `Decimal`:
     ```ts
     else row[field.name] = field.type === "DateTime" ? new Date("2025-01-02T03:04:05.000Z") : field.type === "Float" ? 125.25 : field.type === "Decimal" ? 125.25 : field.type === "Int" ? 3 : field.type === "Boolean" ? true : `${entity.name}-${field.name}-${businessId}`;
     ```

5. **Step 5: Apply Database Migration**
   ```powershell
   node scripts/restro-env.mjs migrate
   ```
   *Rationale*: Applies the migration to the running PostgreSQL container on port `55439` and records the migration in `_prisma_migrations`.

6. **Step 6: Handle TypeScript Decimal Arithmetic in Backend Routes**
   - In any route where monetary query results are subjected to binary operators (`*`, `/`, `-`, `+`), wrap with `Number(...)` or invoke `.toNumber()`:
     - `backend/src/app/api/v1/sales/route.ts` (basePrice calculation)
     - `backend/src/app/api/v1/sales/[id]/correct/route.ts`
     - `backend/src/app/api/v1/reports/route.ts`
     - `backend/src/app/api/v1/inventory/stock-value/route.ts`
     - `backend/src/app/api/v1/inventory/damage-expiry/route.ts`
     - `backend/src/app/api/v1/inventory/batch-stock/route.ts`
     - `backend/src/app/api/v1/inventory/current-stock/route.ts`
     - `backend/src/app/api/v1/inventory/route.ts`

7. **Step 7: Verify Typecheck & Test Suites**
   - Run typecheck:
     ```powershell
     npm run typecheck
     ```
   - Run unit tests:
     ```powershell
     npm test
     ```
   - Run integration tests:
     ```powershell
     node scripts/restro-env.mjs integration
     ```
   - Run recovery tests:
     ```powershell
     node scripts/restro-env.mjs recovery-test
     ```

---

## 5. Verification Method

### 5.1 Verification Commands
1. **Schema & Migration Deployment**:
   ```powershell
   node scripts/restro-env.mjs migrate
   ```
   *Expected Result*: Migration `202610310002_phase2_financial_inventory_core` applied successfully with 0 errors.

2. **TypeScript Compilation Check**:
   ```powershell
   npm run typecheck
   ```
   *Expected Result*: Exits 0 with zero compilation errors in `backend` and `frontend`.

3. **Unit Test Suite**:
   ```powershell
   npm test
   ```
   *Expected Result*: Exits 0, all unit test suites passing.

4. **Isolated Database Integration Verification**:
   ```powershell
   node scripts/restro-env.mjs integration
   ```
   *Expected Result*: Exits 0, all 14 integration tests passing on `127.0.0.1:55439`.

5. **Recovery & Backup Verification**:
   ```powershell
   node scripts/restro-env.mjs recovery-test
   ```
   *Expected Result*: Exits 0, all 8 recovery integration tests passing.

### 5.2 Invalidation Conditions
- Any monetary field in `packages/db/prisma/schema.prisma` remaining as `Float`.
- Any loss of fractional precision or truncation during `ALTER COLUMN ... TYPE DECIMAL(12, 2)`.
- Missing reverse relations causing `prisma generate` to fail with validation errors.
- Any failure in `npm run typecheck` or `node scripts/restro-env.mjs integration`.
