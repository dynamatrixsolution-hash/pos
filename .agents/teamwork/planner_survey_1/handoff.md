# Phase 2: Financial & Inventory Core Hardening — Architecture & Invariants Survey Report

**Author**: Planner (Architecture & Invariants Specialist)  
**Working Directory**: `c:\projects\pos\.agents\teamwork\planner_survey_1`  
**Milestone**: Phase 2 — Financial & Inventory Core Hardening Survey  
**Date**: 2026-10-31  

---

## 1. Observation

### 1.1 Scope & Codebase Direct Observations

Direct investigation of the repository, Prisma schemas, database migrations, backend API routes, and test suites yielded the following empirical facts:

1. **Prisma Schema Float Field Inventory** (`packages/db/prisma/schema.prisma`):
   A full AST parse and line inspection of `packages/db/prisma/schema.prisma` (956 lines) revealed **67 total `Float` fields**:
   - **57 Monetary Fields across 22 models** (prices, totals, payments, balances, discounts, taxes, ledger lines, fees, refunds):
     - `Product` (lines 225-227): `costPrice` (Float, default 0), `sellingPrice` (Float, default 0), `wholesalePrice` (Float, default 0)
     - `Batch` (lines 270-271): `costPrice` (Float?), `sellingPrice` (Float?)
     - `Customer` (lines 293-294): `creditLimit` (Float, default 0), `balance` (Float, default 0)
     - `CustomerLedger` (lines 312-314): `debit` (Float, default 0), `credit` (Float, default 0), `balance` (Float, default 0)
     - `Supplier` (line 328): `balance` (Float, default 0)
     - `SupplierLedger` (lines 350-352): `debit` (Float, default 0), `credit` (Float, default 0), `balance` (Float, default 0)
     - `Sale` (lines 369-373, 395): `subtotal` (Float, default 0), `discount` (Float, default 0), `tax` (Float, default 0), `total` (Float, default 0), `paidAmount` (Float, default 0), `vatRefundAmount` (Float, default 0)
     - `SaleItem` (lines 422-426): `costPrice` (Float, default 0), `price` (Float, default 0), `discount` (Float, default 0), `tax` (Float, default 0), `total` (Float, default 0)
     - `Purchase` (lines 442-446): `subtotal` (Float, default 0), `discount` (Float, default 0), `tax` (Float, default 0), `total` (Float, default 0), `paidAmount` (Float, default 0)
     - `PurchaseItem` (lines 470-471): `price` (Float, default 0), `total` (Float, default 0)
     - `Payment` (line 490): `amount` (Float)
     - `SaleReturn` (line 523): `refundAmount` (Float, default 0)
     - `SaleReturnItem` (lines 537-538): `price` (Float), `total` (Float)
     - `PurchaseReturn` (line 548): `refundAmount` (Float, default 0)
     - `PurchaseReturnItem` (lines 562-563): `price` (Float), `total` (Float)
     - `Expense` (line 590): `amount` (Float)
     - `Income` (line 624): `amount` (Float)
     - `OpeningStock` (lines 717-720): `purchaseRate` (Float, default 0), `sellingPrice` (Float, default 0), `mrp` (Float, default 0), `totalValue` (Float, default 0)
     - `CreditNote` (lines 820-823): `subtotal` (Float, default 0), `discount` (Float, default 0), `tax` (Float, default 0), `total` (Float, default 0)
     - `CreditNoteItem` (lines 844-845): `price` (Float), `total` (Float)
     - `DebitNote` (lines 858-861): `subtotal` (Float, default 0), `discount` (Float, default 0), `tax` (Float, default 0), `total` (Float, default 0)
     - `DebitNoteItem` (lines 882-883): `price` (Float), `total` (Float)
   - **10 Inventory Quantity Fields across 9 models**:
     - `ProductStock.quantity` (line 255): `Float @default(0)`
     - `Batch.quantity` (line 269): `Float @default(0)`
     - `SaleItem.quantity` (line 421): `Float @default(1)`
     - `PurchaseItem.quantity` (line 469): `Float @default(1)`
     - `SaleReturnItem.quantity` (line 536): `Float`
     - `PurchaseReturnItem.quantity` (line 561): `Float`
     - `StockTransferItem.quantity` (line 664): `Float`
     - `OpeningStock.quantity` (line 713): `Float @default(0)`
     - `CreditNoteItem.quantity` (line 843): `Float`
     - `DebitNoteItem.quantity` (line 881): `Float`

2. **Existing Money & Rounding Policies** (`backend/src/lib/commerce-policy.ts`):
   - Lines 32-36 state:
     ```ts
     // Existing retail currencies use two fractional digits. Decimal schema migration is still pending.
     export function money(value: number) {
       if (!Number.isFinite(value) || !Number.isSafeInteger(Math.round(value * 100))) throw new CommerceError("Amount exceeds supported precision");
       return Math.round((value + Number.EPSILON) * 100) / 100;
     }
     ```
   - In `reconcilePayment` (lines 48-69):
     - Line 51: rejects fractional cents: `if (tenders.some(p => Math.abs(p.amount - money(p.amount)) > 0.00000001)) throw new CommerceError("Payment amounts support at most two decimal places");`
     - Line 52: `CREDIT` method is filtered out from collected cash tenders: `const collected = tenders.filter(p => p.method !== "CREDIT");`
     - Line 60-61: cash overpayment does not inflate revenue: applied funds are capped at remaining invoice total, change is separated.

3. **Missing Core Entities in Prisma Schema**:
   The following models do NOT exist anywhere in `packages/db/prisma/schema.prisma`:
   - `PaymentAllocation` (missing)
   - `PaymentReversal` (missing)
   - `Refund` (missing)
   - `StockMovement` (missing)
   - `OutboxEvent` (missing)

4. **Existing Payment Deletion & Reversal Behavior** (`backend/src/app/api/v1/payments/[id]/route.ts`):
   - Lines 288: Invoice-linked payments are blocked from deletion:
     ```ts
     if (payment.saleId || payment.purchaseId) throw new CommerceError("Invoice-linked payments require an allocated reversal workflow", 409);
     ```
   - Lines 347-349: Standalone payments are **physically hard-deleted**:
     ```ts
     await tx.payment.delete({
       where: { id: payment.id },
     });
     ```
   - This violates financial audit immutability by erasing historical payment row IDs and receipt numbers.

5. **Existing Stock Mutation Points & Lack of Authoritative Movement Ledger**:
   - `backend/src/app/api/v1/sales/route.ts` (lines 301-304, 330-333): directly decrements `ProductStock.quantity` and `Batch.quantity`. No movement ledger line is written.
   - `backend/src/app/api/v1/purchases/route.ts` (lines 184-197, 215-223): directly increments `ProductStock.quantity` and `Batch.quantity`. No movement ledger line is written.
   - `backend/src/app/api/v1/inventory/adjust/route.ts` (lines 65-79): directly overwrites or adds to `ProductStock.quantity`. Batch tracking is not updated, and no movement ledger line is written.
   - `backend/src/app/api/v1/inventory/opening/route.ts` (lines 243-255): increments `ProductStock.quantity` upon approval. No movement ledger line is written.
   - `backend/src/app/api/v1/inventory/transfer/[id]/route.ts` (lines 56-78, 101-137): directly shifts stock between branches and batches. No movement ledger line is written.
   - `backend/src/app/api/v1/credit-notes/route.ts` (lines 111-116): increments `ProductStock.quantity`. Batch is untouched, and no movement ledger line is written.
   - `backend/src/app/api/v1/inventory/stock-movements/route.ts` (lines 85-120): synthesizes an ad-hoc in-memory response by unioning `Sale`, `Purchase`, and `StockTransfer` queries. It completely misses inventory adjustments, opening stocks, cancellations, returns, and credit notes.

6. **Concurrency Controls & Serialization Architecture**:
   - `backend/src/lib/commerce-transaction.ts` (lines 19-28):
     ```ts
     export async function serializable<T>(work: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
       for (let attempt = 0; ; attempt++) {
         try {
           return await db.$transaction(work, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, maxWait: 10000, timeout: 30000 });
         } catch (error) {
           if ((error as { code?: string }).code !== "P2034") throw error;
           if (attempt >= 3) throw new CommerceError("Concurrent update; retry with the same Idempotency-Key", 409);
         }
       }
     }
     ```
   - Line 39: Coarse lock serializing same-tenant checkout commands:
     ```ts
     await tx.business.update({ where: { id: context.businessId }, data: { updatedAt: new Date() } });
     ```
   - Negative-stock check in `sales/route.ts` (lines 295-298):
     ```ts
     const allowNegativeStock = settings.allowNegativeStock !== false && settings.preventNegativeStock !== true;
     if (!allowNegativeStock && stock.quantity < item.quantity) {
       throw new Error(`Insufficient stock for product "${product.name}". Available: ${stock.quantity}, Requested: ${item.quantity}`);
     }
     ```
   - Neither `ProductStock` nor `Batch` tables have a database-level `CHECK (quantity >= 0)` constraint, as the business allows configurable negative stock per tenant settings. Under serializable transactions, concurrent sales against the same product row serialize: transaction A decrements, transaction B re-reads the decremented balance during retry, and fails if `!allowNegativeStock`.

7. **Frontend Serialization Risks**:
   - Searching `frontend/src` for `.toFixed(2)` returns over 160 occurrences on properties like `sellingPrice`, `total`, `paidAmount`, `amount`, `balance`.
   - In Prisma Client, fields typed as `Decimal` serialize in JSON as strings (e.g. `"100.00"`). Calling `"100.00".toFixed(2)` in JavaScript immediately throws:
     `TypeError: p.sellingPrice.toFixed is not a function`.
   - Frontend components currently assume monetary fields arrive over JSON as `number`.

8. **Test Suite Baseline Status**:
   - `npm test`: Exits 0, passing 30 unit tests across 6 suites (8 tests skipped awaiting dedicated PostgreSQL container).
   - `npm run typecheck`: Exits 0 with zero compilation errors across both `backend` and `frontend`.

---

## 2. Logic Chain

```
[Observation 1.1] 57 Float fields store monetary values in schema.prisma.
       │
       ▼
[Step 1] Floating-point math introduces binary representation drift (e.g. 0.1 + 0.2 = 0.30000000000000004).
       Invoicing, tax compliance (IRD), and audit ledgers require exact scale and rounding.
       Therefore, all 57 monetary fields must migrate to @db.Decimal(12, 2) in PostgreSQL.
       │
       ▼
[Observation 1.4] Standalone payments are hard-deleted in `payments/[id]/route.ts`.
[Observation 1.3] PaymentAllocation, PaymentReversal, Refund models do not exist.
       │
       ▼
[Step 2] Hard deletion destroys accounting provenance, breaking financial auditability.
       To maintain immutable ledgers:
       - Hard delete must be replaced by creating an explicit `PaymentReversal` record.
       - A payment receipt can be applied across multiple invoices via `PaymentAllocation`.
       - Customer returns and overpayment repayments must be recorded via formal `Refund` records.
       │
       ▼
[Observation 1.5] Stock deduction occurs across 6 distinct API endpoints via direct table updates,
                  while `inventory/stock-movements/route.ts` is an ad-hoc query missing adjustments.
       │
       ▼
[Step 3] When mutations update only `ProductStock` directly without an event log,
       historical inventory tracking and reconciliation are impossible.
       Therefore, an append-only `StockMovement` ledger is required.
       Every stock change (Sale, Purchase, Transfer, Adjustment, Return, Opening) must append a signed entry.
       `ProductStock.quantity` becomes an atomic projection equal to SUM(StockMovement.quantity).
       │
       ▼
[Observation 1.6] Transactions run under Serializable isolation with P2034 retry loop and idempotency locks.
       │
       ▼
[Step 4] High-concurrency sales on identical batches are protected by PostgreSQL serializable dependency checks.
       When `preventNegativeStock: true`, transaction B's retry reads transaction A's committed decrement
       and rejects if available < requested.
       However, to decouple external notifications (KDS, thermal printers, tax sync) from database locks,
       an `OutboxEvent` table must be committed atomically within the domain transaction.
       │
       ▼
[Observation 1.7] Frontend expects `number` for monetary fields and calls `.toFixed(2)`.
       │
       ▼
[Step 5] If Prisma returns `Decimal` serialized as `string`, frontend forms and components will crash.
       Therefore, an API serialization strategy (or backward-compatible client formatting helper)
       must ensure monetary values are parsed safely without requiring new UI screens (R6).
```

---

## 3. Caveats

1. **Quantities vs Monetary Precision**:
   The prompt specifically mandates migrating monetary fields to `Decimal(12, 2)`. While monetary amounts strictly require scale 2 (cents/paisa), inventory quantities (e.g., in hospitality, weight-based or recipe-based ingredients like 0.250 kg or 1.75 liters) require up to 4 decimal places. To maintain inventory fidelity without truncation, `StockMovement.quantity` must be `Decimal(12, 4)`. Existing `ProductStock.quantity` can either migrate to `Decimal(12, 4)` or remain `Float` in this phase with explicit conversion during ledger reconciliation. Migrating `ProductStock.quantity` to `Decimal(12, 4)` is strongly recommended to eliminate floating point rounding in stock totals.
2. **Prisma Client Decimal Syntax**:
   In TypeScript, `Prisma.Decimal` instances do not support standard arithmetic operators (`+`, `-`, `*`, `/`). Backend business logic (like `reconcilePayment` and checkout total calculations) must use Decimal methods (`.add()`, `.sub()`, `.mul()`, `.div()`) or a centralized `Money` utility.
3. **Database Container Requirement for Integration Races**:
   Full verification of PostgreSQL serializable race behavior and GiST exclusions requires running the isolated test container on loopback port `127.0.0.1:55439` (managed via `scripts/restro-env.mjs db`). Unit tests run in-memory, but database race tests must execute against the real engine.

---

## 4. Conclusion & Technical Recommendations

### 4.1 Exhaustive Model & Field Migration Specification

#### 4.1.1 Monetary Fields to `Decimal(12, 2)` (57 Fields across 22 Models)

All 57 fields below must be converted in `packages/db/prisma/schema.prisma` from `Float` to `Decimal @db.Decimal(12, 2)`:

| Model | Field Name | Existing Type | Proposed Prisma Type | Description |
|---|---|---|---|---|
| `Product` | `costPrice` | Float | `Decimal @default(0) @db.Decimal(12, 2)` | Product purchase cost |
| `Product` | `sellingPrice` | Float | `Decimal @default(0) @db.Decimal(12, 2)` | Retail selling price |
| `Product` | `wholesalePrice` | Float | `Decimal @default(0) @db.Decimal(12, 2)` | Wholesale selling price |
| `Batch` | `costPrice` | Float? | `Decimal? @db.Decimal(12, 2)` | Batch purchase cost |
| `Batch` | `sellingPrice` | Float? | `Decimal? @db.Decimal(12, 2)` | Batch selling price override |
| `Customer` | `creditLimit` | Float | `Decimal @default(0) @db.Decimal(12, 2)` | Customer credit ceiling |
| `Customer` | `balance` | Float | `Decimal @default(0) @db.Decimal(12, 2)` | Total debt owed by customer |
| `CustomerLedger` | `debit` | Float | `Decimal @default(0) @db.Decimal(12, 2)` | Receivable increase |
| `CustomerLedger` | `credit` | Float | `Decimal @default(0) @db.Decimal(12, 2)` | Receivable reduction |
| `CustomerLedger` | `balance` | Float | `Decimal @default(0) @db.Decimal(12, 2)` | Running customer balance |
| `Supplier` | `balance` | Float | `Decimal @default(0) @db.Decimal(12, 2)` | Debt owed to supplier |
| `SupplierLedger` | `debit` | Float | `Decimal @default(0) @db.Decimal(12, 2)` | Payable reduction |
| `SupplierLedger` | `credit` | Float | `Decimal @default(0) @db.Decimal(12, 2)` | Payable increase |
| `SupplierLedger` | `balance` | Float | `Decimal @default(0) @db.Decimal(12, 2)` | Running supplier balance |
| `Sale` | `subtotal` | Float | `Decimal @default(0) @db.Decimal(12, 2)` | Pre-discount invoice sum |
| `Sale` | `discount` | Float | `Decimal @default(0) @db.Decimal(12, 2)` | Total invoice discount |
| `Sale` | `tax` | Float | `Decimal @default(0) @db.Decimal(12, 2)` | Total VAT/tax amount |
| `Sale` | `total` | Float | `Decimal @default(0) @db.Decimal(12, 2)` | Grand total payable |
| `Sale` | `paidAmount` | Float | `Decimal @default(0) @db.Decimal(12, 2)` | Total tender settled |
| `Sale` | `vatRefundAmount` | Float | `Decimal @default(0) @db.Decimal(12, 2)` | Electronic payment VAT rebate |
| `SaleItem` | `costPrice` | Float | `Decimal @default(0) @db.Decimal(12, 2)` | Snapshotted unit cost |
| `SaleItem` | `price` | Float | `Decimal @default(0) @db.Decimal(12, 2)` | Unit price after item discount |
| `SaleItem` | `discount` | Float | `Decimal @default(0) @db.Decimal(12, 2)` | Unit discount |
| `SaleItem` | `tax` | Float | `Decimal @default(0) @db.Decimal(12, 2)` | Line VAT amount |
| `SaleItem` | `total` | Float | `Decimal @default(0) @db.Decimal(12, 2)` | Final line total |
| `Purchase` | `subtotal` | Float | `Decimal @default(0) @db.Decimal(12, 2)` | Order subtotal |
| `Purchase` | `discount` | Float | `Decimal @default(0) @db.Decimal(12, 2)` | Order discount |
| `Purchase` | `tax` | Float | `Decimal @default(0) @db.Decimal(12, 2)` | Order tax |
| `Purchase` | `total` | Float | `Decimal @default(0) @db.Decimal(12, 2)` | Order total |
| `Purchase` | `paidAmount` | Float | `Decimal @default(0) @db.Decimal(12, 2)` | Settled payment on PO |
| `PurchaseItem` | `price` | Float | `Decimal @default(0) @db.Decimal(12, 2)` | Unit buying price |
| `PurchaseItem` | `total` | Float | `Decimal @default(0) @db.Decimal(12, 2)` | Line buying total |
| `Payment` | `amount` | Float | `Decimal @db.Decimal(12, 2)` | Tendered/paid amount |
| `SaleReturn` | `refundAmount` | Float | `Decimal @default(0) @db.Decimal(12, 2)` | Cash refund issued on return |
| `SaleReturnItem` | `price` | Float | `Decimal @db.Decimal(12, 2)` | Return unit price |
| `SaleReturnItem` | `total` | Float | `Decimal @db.Decimal(12, 2)` | Return line total |
| `PurchaseReturn` | `refundAmount` | Float | `Decimal @default(0) @db.Decimal(12, 2)` | Supplier refund received |
| `PurchaseReturnItem` | `price` | Float | `Decimal @db.Decimal(12, 2)` | Unit return credit |
| `PurchaseReturnItem` | `total` | Float | `Decimal @db.Decimal(12, 2)` | Total return credit |
| `Expense` | `amount` | Float | `Decimal @db.Decimal(12, 2)` | Operating expense amount |
| `Income` | `amount` | Float | `Decimal @db.Decimal(12, 2)` | Other income amount |
| `OpeningStock` | `purchaseRate` | Float | `Decimal @default(0) @db.Decimal(12, 2)` | Unit opening cost |
| `OpeningStock` | `sellingPrice` | Float | `Decimal @default(0) @db.Decimal(12, 2)` | Opening retail price |
| `OpeningStock` | `mrp` | Float | `Decimal @default(0) @db.Decimal(12, 2)` | Maximum retail price |
| `OpeningStock` | `totalValue` | Float | `Decimal @default(0) @db.Decimal(12, 2)` | Opening inventory value |
| `CreditNote` | `subtotal` | Float | `Decimal @default(0) @db.Decimal(12, 2)` | Credit note subtotal |
| `CreditNote` | `discount` | Float | `Decimal @default(0) @db.Decimal(12, 2)` | Credit note discount |
| `CreditNote` | `tax` | Float | `Decimal @default(0) @db.Decimal(12, 2)` | Credit note tax offset |
| `CreditNote` | `total` | Float | `Decimal @default(0) @db.Decimal(12, 2)` | Total credit amount |
| `CreditNoteItem` | `price` | Float | `Decimal @db.Decimal(12, 2)` | Item unit price |
| `CreditNoteItem` | `total` | Float | `Decimal @db.Decimal(12, 2)` | Item line credit |
| `DebitNote` | `subtotal` | Float | `Decimal @default(0) @db.Decimal(12, 2)` | Debit note subtotal |
| `DebitNote` | `discount` | Float | `Decimal @default(0) @db.Decimal(12, 2)` | Debit note discount |
| `DebitNote` | `tax` | Float | `Decimal @default(0) @db.Decimal(12, 2)` | Debit note tax adjustment |
| `DebitNote` | `total` | Float | `Decimal @default(0) @db.Decimal(12, 2)` | Total debit amount |
| `DebitNoteItem` | `price` | Float | `Decimal @db.Decimal(12, 2)` | Item unit price |
| `DebitNoteItem` | `total` | Float | `Decimal @db.Decimal(12, 2)` | Item line debit |

---

### 4.2 Exact Schema Requirements for New Models

```prisma
// ==========================================
// 1. PAYMENT ALLOCATION
// ==========================================
model PaymentAllocation {
  id           String    @id @default(uuid())
  businessId   String
  business     Business  @relation(fields: [businessId], references: [id], onDelete: Cascade)
  paymentId    String
  payment      Payment   @relation(fields: [paymentId], references: [id], onDelete: Cascade)
  saleId       String?
  sale         Sale?     @relation(fields: [saleId], references: [id], onDelete: Cascade)
  purchaseId   String?
  purchase     Purchase? @relation(fields: [purchaseId], references: [id], onDelete: Cascade)
  amount       Decimal   @db.Decimal(12, 2)
  allocatedAt  DateTime  @default(now())
  allocatedById String?
  allocatedBy   User?    @relation(fields: [allocatedById], references: [id], onDelete: SetNull)

  @@unique([businessId, id])
  @@index([businessId, paymentId])
  @@index([businessId, saleId])
  @@index([businessId, purchaseId])
}

// ==========================================
// 2. PAYMENT REVERSAL
// ==========================================
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

// ==========================================
// 3. REFUND
// ==========================================
model Refund {
  id           String    @id @default(uuid())
  businessId   String
  business     Business  @relation(fields: [businessId], references: [id], onDelete: Cascade)
  branchId     String
  branch       Branch    @relation(fields: [branchId], references: [id], onDelete: Cascade)
  saleId       String?
  sale         Sale?     @relation(fields: [saleId], references: [id], onDelete: SetNull)
  paymentId    String?
  payment      Payment?  @relation(fields: [paymentId], references: [id], onDelete: SetNull)
  customerId   String?
  customer     Customer? @relation(fields: [customerId], references: [id], onDelete: SetNull)
  amount       Decimal   @db.Decimal(12, 2)
  method       String    @default("CASH") // CASH, CARD, BANK_TRANSFER, etc.
  reason       String
  reference    String?
  status       String    @default("COMPLETED") // COMPLETED, PENDING, FAILED
  createdById  String?
  createdBy    User?     @relation(fields: [createdById], references: [id], onDelete: SetNull)
  createdAt    DateTime  @default(now())

  @@unique([businessId, id])
  @@index([businessId, branchId])
  @@index([businessId, saleId])
  @@index([businessId, customerId])
}

// ==========================================
// 4. STOCK MOVEMENT (APPEND-ONLY LEDGER)
// ==========================================
model StockMovement {
  id           String    @id @default(uuid())
  businessId   String
  business     Business  @relation(fields: [businessId], references: [id], onDelete: Cascade)
  branchId     String
  branch       Branch    @relation(fields: [branchId], references: [id], onDelete: Cascade)
  productId    String
  product      Product   @relation(fields: [productId], references: [id], onDelete: Cascade)
  batchNumber  String?
  quantity     Decimal   @db.Decimal(12, 4) // Signed quantity (+ for stock-in, - for stock-out)
  unit         String    @default("pcs")
  sourceType   String    // SALE, PURCHASE, ADJUSTMENT, TRANSFER_IN, TRANSFER_OUT, OPENING, SALE_RETURN, PURCHASE_RETURN, CANCELLATION
  sourceId     String    // Target record ID (sale.id, purchase.id, transfer.id, etc.)
  eventKey     String?   // Idempotency / dedup key (e.g. saleId:saleItemId)
  actorId      String?
  actor        User?     @relation(fields: [actorId], references: [id], onDelete: SetNull)
  notes        String?
  createdAt    DateTime  @default(now())

  @@unique([businessId, id])
  @@unique([businessId, sourceType, sourceId, productId, batchNumber])
  @@index([businessId, branchId, productId, createdAt])
  @@index([businessId, productId, batchNumber])
}

// ==========================================
// 5. TRANSACTIONAL OUTBOX
// ==========================================
model OutboxEvent {
  id            String    @id @default(uuid())
  businessId    String
  business      Business  @relation(fields: [businessId], references: [id], onDelete: Cascade)
  aggregateType String    // Sale, Payment, StockMovement, KitchenTicket, Folio
  aggregateId   String
  eventType     String    // SALE_COMPLETED, PAYMENT_RECEIVED, STOCK_MUTATED, etc.
  payload       Json
  headers       Json?     // traceId, idempotencyKey, actorId
  status        String    @default("PENDING") // PENDING, PROCESSING, PUBLISHED, FAILED
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

### 4.3 Invariants for Financial Immutability & Concurrency

1. **Financial Immutability**:
   - **No Hard Deletes**: Hard `DELETE` on `Payment`, `Sale`, and `Purchase` is strictly prohibited. The existing `DELETE /api/v1/payments/:id` route will be replaced by an explicit reversal operation (`POST /api/v1/payments/:id/reverse`), creating a `PaymentReversal` entry and appending offsetting adjustment rows in customer/supplier ledgers.
   - **Finalized Invoices**: Invoices marked `COMPLETED` cannot be edited (`PUT` denied). Any discrepancy requires audited offset records: `CreditNote`, `DebitNote`, or `Refund`.
   - **Reversal Reconciliation**: Reversing a payment atomically updates invoice `paidAmount` and transitions `paymentStatus` (e.g. `PAID` -> `PARTIAL` or `UNPAID`).

2. **Concurrency & Stock Isolation**:
   - **Serializable Transactions**: All state-mutating financial and inventory commands execute via the existing `serializable` helper with automatic backoff retry on Prisma conflict code `P2034` (PostgreSQL 40001).
   - **Negative Stock Enforcement**: When `preventNegativeStock: true`, transaction serialization ensures concurrent checkouts cannot double-spend inventory. On serialization retry, the second checkout re-evaluates `stock.quantity` and rejects with a 400 error if stock is insufficient.
   - **Ledger Projection Invariant**:
     $$\text{ProductStock.quantity} = \sum_{\text{movements}} \text{StockMovement.quantity} \quad (\text{for matching productId and branchId})$$
     Every API endpoint that modifies stock must write to `StockMovement` inside the exact same database transaction as the projection update.

---

### 4.4 Decomposition, Dependencies & Migration Strategy

#### 4.4.1 Module Decomposition
1. **`lib/services/decimal-math.ts`**: Pure helper converting values to `Prisma.Decimal`, handling standard banking / half-even rounding, and computing line discounts and VAT safely.
2. **`lib/services/stock-ledger-service.ts`**: Encapsulates all inventory changes (`recordMovement`, `reconcileProjections`). Every route handler (Checkout, Purchase, Transfer, Opening, Adjustment, Return) calls this service instead of issuing direct `productStock.update` calls.
3. **`lib/services/payment-ledger-service.ts`**: Manages `PaymentAllocation`, `PaymentReversal`, and `Refund` creation, ensuring that total allocations never exceed payment amounts and invoice totals.
4. **`lib/services/outbox-service.ts`**: Provides `enqueueOutboxEvent(tx, ...)` to write domain events transactionally.

#### 4.4.2 Non-Destructive Database Migration Plan
- **Migration `202610310002_phase2_financial_inventory_core`**:
  - Run `ALTER TABLE ... ALTER COLUMN ... TYPE DECIMAL(12, 2) USING ...::numeric(12, 2)` for all 57 monetary fields.
  - Create the 5 new models (`PaymentAllocation`, `PaymentReversal`, `Refund`, `StockMovement`, `OutboxEvent`) with composite `(businessId, id)` unique constraints.
  - Backfill historical `StockMovement` rows from active `ProductStock` / `OpeningStock` balances to establish a baseline.
  - Backfill historical `PaymentAllocation` rows for existing `Payment` rows that reference `saleId` or `purchaseId`.

#### 4.4.3 Frontend Compatibility Contract (R6)
- Provide a lightweight formatting and parsing adapter in frontend shared components (e.g., `formatMoney(val: number | string | Prisma.Decimal)`).
- Ensure existing POS checkout, payments received/sent, product catalog, customer balance views, and thermal print receipts consume Decimal string representations without calling `.toFixed(2)` on raw strings.

---

## 5. Verification Method

### 5.1 Independent Verification Commands

1. **Typecheck Verification**:
   ```powershell
   npm run typecheck
   ```
   *Expected result*: Exit code 0, verifying clean TypeScript compilation across `backend` and `frontend`.

2. **Unit Test Suite**:
   ```powershell
   npm test
   ```
   *Expected result*: Exit code 0, all 30 unit tests pass.

3. **Database Migration Deployment & Schema Inspection**:
   ```powershell
   node scripts/restro-env.mjs migrate
   ```
   *Expected result*: Applies `202610310002_phase2_financial_inventory_core` onto the isolated database target.

4. **Adversarial & Reconciliation Integration Tests**:
   ```powershell
   node scripts/restro-env.mjs integration
   ```
   *Expected result*: Runs the full expanded integration suite on `127.0.0.1:55439`, asserting:
   - Concurrent sales cannot breach configured stock limits.
   - Payment reversals create immutable audit records without row deletion.
   - Sum of `StockMovement` lines matches `ProductStock.quantity`.
   - Sum of `PaymentAllocation` lines matches `Sale.paidAmount`.

### 5.2 Invalidation Conditions
- Any occurrence of hard `DELETE FROM "Payment"` or `DELETE FROM "Sale"`.
- Any monetary field in `schema.prisma` remaining typed as `Float`.
- Any stock mutation path that updates `ProductStock` without emitting a corresponding `StockMovement` entry.
- Any crash on frontend POS or customer pages due to calling `.toFixed` on Decimal strings.
