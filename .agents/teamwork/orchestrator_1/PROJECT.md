# Project: RestroPOS — Phase 2: Financial & Inventory Core Hardening

## Architecture
- **Decimal Monetary Standard**: Exact `Decimal(12, 2)` representations across all 57 monetary fields in Prisma schema and database, eliminating floating-point binary drift in prices, totals, balances, and taxes.
- **Append-Only Event Ledgers**:
  - `PaymentAllocation`: Explicitly maps payment amounts to sales or purchases.
  - `PaymentReversal`: Audited reversal records capturing operator justification, replacing destructive hard deletion.
  - `Refund`: Explicit return/repayment disbursements tied to sales, customers, and payments.
  - `StockMovement`: Signed `Decimal(12, 4)` inventory ledger capturing every physical stock mutation (+ for stock in, - for stock out) with batch, unit, actor, and source event.
  - `OutboxEvent`: Transactional outbox committed atomically with state-mutating transactions for reliable asynchronous event dispatch.
- **Concurrency & Invariant Projections**:
  - Interactive transactions execute under PostgreSQL `Serializable` isolation level via `serializable()`, with automatic retry on Prisma conflict code `P2034` (PostgreSQL 40001).
  - Negative-stock limits are enforced under high-contention concurrent sales; serializable transactions guarantee that batch exhaustion rejects excess demand without over-selling.
  - Projections (`ProductStock.quantity`) are verified against ledger sums: $\text{ProductStock.quantity} \equiv \sum \text{StockMovement.quantity}$.
- **Frontend Architecture (Zero New Screens per R6)**:
  - Centralized minor-unit (cents) integer arithmetic via `frontend/src/lib/currency.ts`.
  - Non-destructive UX for payments, refunds, and voided invoices using existing modals and slide-overs adhering to `.agent/skill/uiuxskills.md`.

---

## Feature Inventory

Every feature identified in requirements and survey is assigned to a concrete milestone below:

| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | Decimal Schema Migration | Convert 57 monetary Float fields across 22 Prisma models to `@db.Decimal(12, 2)` | M1 | Survey (Planner) |
| 2 | New Financial & Inventory Models | Add `PaymentAllocation`, `PaymentReversal`, `Refund`, `StockMovement`, `OutboxEvent` to `schema.prisma` | M1 | Survey (Planner) |
| 3 | Non-Destructive Migration Script | Generate additive migration `202610310002_phase2_financial_inventory_core` | M1 | Survey (Planner) |
| 4 | Backup & Recovery Model Alignment | Update `backupModels` in `backup-format.ts` and `recovery.integration.test.ts` for 48 tenant models | M1 | Survey (Tester) |
| 5 | Decimal Math & Banking Rounding | Implement `lib/services/decimal-math.ts` for exact banking / half-even rounding | M2 | Survey (Planner) |
| 6 | Payment Allocation Service & API | Implement `PaymentAllocation` creation and invoice settlement tracking | M2 | Requirements R2 |
| 7 | Payment Reversal Service & API | Replace hard `DELETE /api/v1/payments/:id` with audited reversal endpoint `POST .../reverse` | M2 | Requirements R2 |
| 8 | Refund Service & Audit Workflow | Implement `Refund` recording for returns and overpayments | M2 | Requirements R2 |
| 9 | Finalized Invoice Immutability | Enforce rejection of physical deletion or modification of finalized/completed invoices | M2 | Requirements R2 |
| 10 | StockMovement Ledger Service | Implement `lib/services/stock-ledger-service.ts` to record signed movements atomically | M3 | Requirements R3 |
| 11 | Stock Mutation Integration | Route Sales, Purchases, Transfers, Opening, Adjustments, Returns through `stock-ledger-service` | M3 | Survey (Planner) |
| 12 | Stock Ledger Reconciliation | Ensure $\text{ProductStock.quantity} \equiv \sum \text{StockMovement.quantity}$ across all mutations | M3 | Requirements R3 |
| 13 | Concurrency & Negative-Stock Locks | Enforce configured negative-stock limits under serializable transactions | M3 | Requirements R5 |
| 14 | Stock Movements Query API | Update `/api/v1/inventory/stock-movements` to query authoritative `StockMovement` table | M3 | Requirements R3 |
| 15 | Transactional Outbox Service | Implement `lib/services/outbox-service.ts` to enqueue `OutboxEvent` atomically in tx | M4 | Requirements R4 |
| 16 | Outbox Event Emission | Emit outbox events for Sales, Payments, Reversals, Refunds, and StockMovements | M4 | Requirements R4 |
| 17 | Frontend Currency & Decimal Library | Implement `frontend/src/lib/currency.ts` with minor-unit integer arithmetic | M5 | Survey (Designer) |
| 18 | POS Checkout Ergonomics Adaptation | Replace `window.prompt` with inline staff reference; separate cash tendered from applied tender | M5 | Survey (Designer) |
| 19 | Audited Payment Reversal Modal | Replace payment deletion with Audited Reversal Modal in `payments/received` & `sent` | M5 | Survey (Designer) |
| 20 | Sales History Void Representation | Render voided/superseded invoices with strikethrough & Red badges; add audit drawer | M5 | Survey (Designer) |
| 21 | Customer Payment Idempotency | Update customer payment modal in `customers/page.tsx` to use `postCommerce` with idempotency | M5 | Survey (Designer) |
| 22 | Stock Movement Table Adaptation | Update `stock-movements-client.tsx` to surface signed quantity, batch, unit, actor, source | M5 | Requirements R6 |
| 23 | Adversarial Race Condition Tests | Implement `tests/concurrency.integration.test.ts` (RACE-01 to RACE-06) with PID witnessing | M6 | Survey (Tester) |
| 24 | Financial & Inventory Reconciliation Tests | Implement `tests/reconciliation.integration.test.ts` on isolated test container (`127.0.0.1:55439`) | M6 | Survey (Tester) |
| 25 | Documentation Updates | Update `docs/hospitality/phases/PHASE_2_FINANCIAL_INVENTORY_CORE.md` with schema & test results | M6 | Requirements R7 |

---

## Milestones

| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| **M1** | Core Schema & Decimal Migration | Prisma schema 57 monetary fields -> Decimal(12, 2); 5 new models; migration generation; backup-format update; unit tests | none | PLANNED |
| **M2** | Payment Lifecycle & Financial Ledger Models | Decimal math service; PaymentAllocation, PaymentReversal, Refund services & routes; payment immutability (no hard delete) | M1 | PLANNED |
| **M3** | Append-Only StockMovement Ledger & Concurrency | StockMovement service; mutation integration across sales/purchases/adjustments/transfers; negative-stock concurrency locks | M1, M2 | PLANNED |
| **M4** | Transactional Outbox Implementation | OutboxService; atomic event dispatch in domain transactions; status and retry management | M1, M2, M3 | PLANNED |
| **M5** | Frontend Component & Form Adaptation | `frontend/src/lib/currency.ts`; POS checkout inline reference; payment reversal modals; sales void drawer; stock movement table | M1, M2, M3 | PLANNED |
| **M6** | Adversarial Hardening, Reconciliation & Docs | `tests/concurrency.integration.test.ts`; `tests/reconciliation.integration.test.ts`; container run (127.0.0.1:55439); typecheck & docs | M1, M2, M3, M4, M5 | PLANNED |

---

## Interface Contracts

### 1. `backend/src/lib/services/decimal-math.ts`
```ts
export function toDecimal(val: number | string | Prisma.Decimal): Prisma.Decimal;
export function money(val: number | string | Prisma.Decimal): Prisma.Decimal;
export function roundHalfEven(val: Prisma.Decimal, scale?: number): Prisma.Decimal;
export function addMoney(a: Prisma.Decimal, b: Prisma.Decimal): Prisma.Decimal;
export function subMoney(a: Prisma.Decimal, b: Prisma.Decimal): Prisma.Decimal;
export function mulMoney(amount: Prisma.Decimal, factor: number | Prisma.Decimal): Prisma.Decimal;
```

### 2. `backend/src/lib/services/payment-ledger-service.ts`
```ts
export interface CreateAllocationParams {
  businessId: string;
  paymentId: string;
  saleId?: string;
  purchaseId?: string;
  amount: Prisma.Decimal;
  allocatedById?: string;
}

export interface ReversePaymentParams {
  businessId: string;
  paymentId: string;
  reason: string;
  reversedById?: string;
}

export async function allocatePayment(tx: Prisma.TransactionClient, params: CreateAllocationParams): Promise<PaymentAllocation>;
export async function reversePayment(tx: Prisma.TransactionClient, params: ReversePaymentParams): Promise<PaymentReversal>;
export async function createRefund(tx: Prisma.TransactionClient, params: CreateRefundParams): Promise<Refund>;
```

### 3. `backend/src/lib/services/stock-ledger-service.ts`
```ts
export interface RecordMovementParams {
  businessId: string;
  branchId: string;
  productId: string;
  batchNumber?: string | null;
  quantity: Prisma.Decimal; // Signed: positive for stock-in, negative for stock-out
  unit?: string;
  sourceType: "SALE" | "PURCHASE" | "ADJUSTMENT" | "TRANSFER_IN" | "TRANSFER_OUT" | "OPENING" | "SALE_RETURN" | "PURCHASE_RETURN" | "CANCELLATION";
  sourceId: string;
  eventKey?: string;
  actorId?: string;
  notes?: string;
}

export async function recordStockMovement(tx: Prisma.TransactionClient, params: RecordMovementParams): Promise<StockMovement>;
export async function assertStockAvailable(tx: Prisma.TransactionClient, businessId: string, branchId: string, productId: string, batchNumber: string | null | undefined, requestedQty: Prisma.Decimal, allowNegativeStock: boolean): Promise<void>;
```

### 4. `backend/src/lib/services/outbox-service.ts`
```ts
export interface EnqueueOutboxParams {
  businessId: string;
  aggregateType: string;
  aggregateId: string;
  eventType: string;
  payload: Record<string, unknown>;
  headers?: Record<string, unknown>;
}

export async function enqueueOutboxEvent(tx: Prisma.TransactionClient, params: EnqueueOutboxParams): Promise<OutboxEvent>;
```

### 5. `frontend/src/lib/currency.ts`
```ts
export type MonetaryValue = string | number | { toString(): string } | null | undefined;
export function toCents(val: MonetaryValue): number;
export function fromCents(cents: number): string;
export function parseMoney(val: MonetaryValue): number;
export function formatMoney(val: MonetaryValue, symbol?: string): string;
export function addMoney(a: MonetaryValue, b: MonetaryValue): string;
export function subMoney(a: MonetaryValue, b: MonetaryValue): string;
export function mulMoney(amount: MonetaryValue, factor: number): string;
```

---

## Code Layout

- **Prisma Schema**: `packages/db/prisma/schema.prisma`
- **Migrations**: `packages/db/prisma/migrations/202610310002_phase2_financial_inventory_core/migration.sql`
- **Backend Services**:
  - `backend/src/lib/services/decimal-math.ts`
  - `backend/src/lib/services/payment-ledger-service.ts`
  - `backend/src/lib/services/stock-ledger-service.ts`
  - `backend/src/lib/services/outbox-service.ts`
- **Backend Routes**:
  - `backend/src/app/api/v1/sales/route.ts`
  - `backend/src/app/api/v1/sales/[id]/route.ts`
  - `backend/src/app/api/v1/payments/route.ts`
  - `backend/src/app/api/v1/payments/[id]/route.ts`
  - `backend/src/app/api/v1/payments/[id]/reverse/route.ts`
  - `backend/src/app/api/v1/inventory/stock-movements/route.ts`
  - `backend/src/app/api/v1/inventory/adjust/route.ts`
  - `backend/src/app/api/v1/inventory/opening/route.ts`
  - `backend/src/app/api/v1/inventory/transfer/[id]/route.ts`
- **Backup/Recovery**:
  - `backend/src/lib/backup-format.ts`
- **Frontend Code**:
  - `frontend/src/lib/currency.ts`
  - `frontend/src/app/dashboard/pos/page.tsx`
  - `frontend/src/components/pos/thermal-receipt.tsx`
  - `frontend/src/app/dashboard/payments/received/page.tsx`
  - `frontend/src/app/dashboard/payments/sent/page.tsx`
  - `frontend/src/app/dashboard/sales/page.tsx`
  - `frontend/src/app/dashboard/customers/page.tsx`
  - `frontend/src/app/dashboard/inventory/stock-movements/stock-movements-client.tsx`
- **Test Suites**:
  - `tests/financial-decimal.test.ts`
  - `tests/concurrency.integration.test.ts`
  - `tests/reconciliation.integration.test.ts`
  - `tests/recovery.integration.test.ts`
