# Phase 2 Frontend Survey: Financial & Inventory Core Hardening
**Author:** Designer (UI/UX Specialist Explorer)  
**Target:** Phase 2 Financial & Inventory Core Hardening (`PHASE_2_FINANCIAL_INVENTORY_CORE.md`, `IMPLEMENTATION_PLAN.md`, `ORIGINAL_REQUEST.md`)  
**Design Reference:** `.agent/skill/uiuxskills.md` ("Refined Hospitality Ergonomics")  
**Handoff File Path:** `c:\projects\pos\.agents\teamwork\designer_survey_1\handoff.md`

---

## 1. Observation

Direct code inspections across frontend components, hooks, modals, forms, and backend API contracts revealed the following concrete evidence:

### 1.1 Ubiquitous Ad-Hoc Float Formatting and Missing Centralized Currency Utility
- Over **142 instances** of `.toFixed(2)` and direct floating-point operations exist in the frontend codebase (found via grep in `frontend/src`).
- There is **no centralized currency or Decimal utility** in `frontend/src/lib/`. The only utility function found was an ad-hoc local helper in `frontend/src/app/dashboard/super-admin/revenue/page.tsx:75` (`formatCurrency = (amount: number, currencyCode = "NPR") => ...`).
- Direct floating-point arithmetic is performed inline throughout core POS calculations:
  - `frontend/src/app/dashboard/pos/page.tsx:402`:
    ```ts
    const roundOff = parseFloat((Math.round(total) - total).toFixed(2));
    const grandTotal = Math.round(total);
    ```
  - `frontend/src/app/dashboard/pos/page.tsx:385, 388`:
    ```ts
    tax = (subtotal - rawOverallDiscount - couponDiscount) * (vatPercentage / (100 + vatPercentage));
    tax = Math.max(0, subtotal - rawOverallDiscount - couponDiscount) * (vatPercentage / 100);
    ```
  - `frontend/src/components/pos/thermal-receipt.tsx:107, 119`:
    ```ts
    const roundOff = data.roundOff ?? parseFloat((Math.round(total) - total).toFixed(2));
    const lineTotal = ((item.price - (item.discount || 0)) * item.quantity).toFixed(2);
    ```

### 1.2 Serialization Hazard: Prisma Decimal to JSON
- In `packages/db/prisma/schema.prisma`, monetary fields are currently defined as `Float` (e.g., `Product.costPrice Float`, `Sale.total Float`, `Payment.amount Float`).
- In Phase 2, these are migrated to explicit `Decimal` (`@db.Decimal(12, 2)` or `@db.Decimal(14, 4)`).
- When Prisma serializes `Decimal` instances via `JSON.stringify()` / `NextResponse.json()`, `Decimal.prototype.toJSON()` returns a **string** (`"125.50"` or `"0.00"`), **not a number**.
- Currently, frontend components expect numbers:
  - `frontend/src/app/dashboard/sales/page.tsx:196`: `{currencySymbol}{sale.total.toFixed(2)}`
  - If `sale.total` is `"125.50"`, calling `sale.total.toFixed(2)` throws a fatal runtime exception: `TypeError: sale.total.toFixed is not a function`.
  - In addition, naive string arithmetic such as `subtotal + tax` in JavaScript will perform string concatenation (e.g., `"100.00" + "13.00" = "100.0013.00"`).

### 1.3 POS Checkout Ergonomic Stopgap (`window.prompt`)
- In `frontend/src/app/dashboard/pos/page.tsx:1131-1133`:
  ```ts
  const hasNonCash = splitPaymentsList.some(p => p.method !== "CASH" && p.method !== "CREDIT") || (splitType !== "METHOD" && !["CASH", "CREDIT"].includes(singlePaymentMethod));
  const paymentReference = hasNonCash ? window.prompt("Staff-recorded payment reference (not provider verified):") : null;
  if (hasNonCash && !paymentReference?.trim()) { setSubmitError("A non-cash payment reference is required"); return; }
  ```
- This triggers a blocking native browser alert box (`window.prompt`), which violates the design principles in `.agent/skill/uiuxskills.md` (unresponsive, poor ergonomics, jarring styling).

### 1.4 Hard Deletions and Missing Audited Reversals in Payments
- In `frontend/src/app/dashboard/payments/received/page.tsx:274-283` and `sent/page.tsx:274-283`:
  ```ts
  const handleDeletePayment = async (id: string) => {
    if (!confirm("Are you sure you want to reverse (cancel) this payment? This will update the customer ledger and restore their debt balance!")) {
      return;
    }
    const res = await fetch(`/api/v1/payments/${id}`, { method: "DELETE" });
  ...
  ```
- Line 676 renders a red trash can button (`Trash2`).
- Backend requirement R2 explicitly states: *"Introduce PaymentAllocation, PaymentReversal, and Refund models. Disallow hard deletion of payments and finalized invoices, requiring audited adjustments and explicit offset records."*
- Backend API (`backend/src/app/api/v1/sales/[id]/cancel/route.ts:57` and `correct/route.ts:75`) already returns `HTTP 409 Conflict` when trying to delete or correct paid/settled records without reconciled workflows. The frontend currently has no UI for `PaymentAllocation`, `PaymentReversal`, or `Refund`.

### 1.5 Missing Status & Audit Representations in Sales History
- In `frontend/src/app/dashboard/sales/page.tsx:185-233`, the sales table only renders:
  `Invoice #`, `Date/Time`, `Customer`, `Total Invoice`, `Paid Amount`, `Method`, `Payment Status`, `Cashier`, `Receipt`.
- Invoices that have been cancelled (`isActive: false` or `cancellationReason`), corrected (`correctedInvoiceId`), or refunded via credit notes are completely indistinguishable from normal completed sales.
- There is no indication of voided invoices, no strikethrough, no display of cancellation reasons, and no view to inspect line items, payment allocations, or credit notes.

### 1.6 Missing Idempotency in Customer Directory Payments
- In `frontend/src/app/dashboard/customers/page.tsx:147-158`:
  ```ts
  const res = await fetch("/api/v1/payments", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      type: "RECEIVED",
      customerId: selectedCustomer.id,
      amount: receiveAmount,
      method: receiveMethod,
      reference: receiveRef,
      remarks: receiveRemarks,
    }),
  });
  ```
- Notice that `postCommerce` is NOT imported or called. No `Idempotency-Key` header is provided. Because `backend/src/app/api/v1/payments/route.ts:266` routes through `commerceTransaction(request, context, "PAYMENT", ...)`, this endpoint rejects requests missing an idempotency key with `HTTP 428 Precondition Required`.

### 1.7 Zod Validation Rigidities
- `frontend/src/app/dashboard/products/page.tsx:51-52`:
  ```ts
  costPrice: z.number().min(1, "Cost price must be at least 1"),
  sellingPrice: z.number().min(1, "Selling price must be at least 1"),
  ```
  This arbitrarily rejects items priced below 1 (e.g., Rs. 0.50 pieces or promotional zero-cost items).
- Forms pass raw input strings into `parseFloat()` or `z.number()`, which breaks when input fields are cleared to `""` unless coercion or explicit transformation is configured.

---

## 2. Logic Chain

1. **Premise 1 (Backend Contract)**: Phase 2 migrates Prisma `Float` schema fields to explicit `Decimal` and serializes amounts as strings in JSON payloads. Hard deletions are disabled; payments and finalized invoices require explicit `PaymentAllocation`, `PaymentReversal`, and `Refund` audit records.
2. **Premise 2 (Frontend Current State)**: The frontend currently treats all monetary amounts as native JavaScript IEEE-754 numbers, frequently invoking `.toFixed(2)` directly on API response fields. It lacks a centralized currency formatting/parsing library, uses `window.prompt` for payment references, attempts `DELETE` requests for payment reversals, and lacks UI states for voided/superseded invoices.
3. **Inference 1 (Crash Risk on Decimal Migration)**: As soon as the backend migrates monetary fields to `Decimal`, existing client views will attempt `val.toFixed(2)` on string properties, throwing uncaught `TypeError` crashes across tables, summaries, and receipt printing.
4. **Inference 2 (Precision Drift)**: Client-side mathematical operations in the POS cart (`pos/page.tsx`), cashbook reconstruction (`reports/accounting/page.tsx`), and thermal receipts (`thermal-receipt.tsx`) currently accumulate standard binary floating-point roundoff errors (e.g. `0.1 + 0.2 !== 0.3`).
5. **Inference 3 (Ergonomic Compliance with R6 & uiuxskills.md)**: Requirement R6 strictly commands: *"Adapt existing frontend components and forms to support Decimal migration and new payment APIs without introducing new dedicated UI screens."*
   Therefore, payment allocations, reversals, credit notes, and void representations must be surfaced **within existing dialogs, tables, and slide-overs**:
   - In `pos/page.tsx`: Replace `window.prompt` with a high-density inline reference input inside the checkout modal.
   - In `payments/received/page.tsx` & `sent/page.tsx`: Replace `DELETE` / `confirm()` with an "Audited Reversal" modal requiring reason and operator confirmation; render allocation badges (`Allocated to POS-1002`).
   - In `sales/page.tsx`: Render voided invoices with strikethrough styling and Red status badges (`#FAEAEC`, `#B33432`, `#E9B6B7`); provide an expandable row or slide-over drawer to view allocations, refunds, and line items.
   - In `stock-movements-client.tsx`: Adapt movement lines to show signed quantities, batches, and actors per R3.

---

## 3. Caveats

1. **No External Payment Gateway Integrations in Scope**: The current scope covers staff-recorded payment collections (`STAFF_RECORDED`) and explicit manual allocations/reversals. Real third-party provider webhooks (e.g., Fonepay/eSewa merchant callback verification) remain out of Phase 2 scope per `IMPLEMENTATION_PLAN.md:26`.
2. **Offline Mode Excluded**: Per `IMPLEMENTATION_PLAN.md:157`, offline financial state mutations are deferred until online idempotency and reconciliation are hardened.
3. **Database Schema Read-Only**: This survey does not modify Prisma schema or frontend source files directly, but specifies exact file boundaries, helper code, and schema adaptations for the implementation phase.

---

## 4. Conclusion & Actionable Survey Findings

### 4.1 Target 1: Comprehensive Monetary Fields Catalog
The following table documents every frontend screen, component, and modal handling monetary fields:

| Area / File | Component / Form | Monetary Fields Handled | Operations / Calculations |
|---|---|---|---|
| **POS Billing** (`frontend/src/app/dashboard/pos/page.tsx`) | Product Catalog Grid, Cart Sidebar, Checkout Modal | `costPrice`, `sellingPrice`, `price`, `discount`, `tax`, `subtotal`, `total`, `paidAmount`, `amountTendered`, `roundOff`, `grandTotal`, `creditLimit`, `balance` | Cart line discount, tax inclusive/exclusive calculation, tax split (VAT/CGST/SGST), tender vs grandTotal, change return, multi-method split, multi-person split |
| **Thermal Receipt** (`frontend/src/components/pos/thermal-receipt.tsx`) | `generateThermalReceiptHtml` | `price`, `discount`, `taxRate`, `lineTotal`, `subtotal`, `taxableValue`, `tax`, `total`, `roundOff`, `roundedTotal` | Line subtotal calculation, tax breakdown formatting, round-off representation, thermal string generation |
| **Payment Received** (`frontend/src/app/dashboard/payments/received/page.tsx`) | Payment Table, Add Payment Modal, Edit Payment Modal | `amount`, `customer.balance` | Parsing input amount, customer debt display, export calculation (Excel/PDF), payment reversal |
| **Payment Sent** (`frontend/src/app/dashboard/payments/sent/page.tsx`) | Payment Table, Add Payment Modal, Edit Payment Modal | `amount`, `supplier.balance` | Parsing input amount, supplier debt display, export calculation (Excel/PDF), payment reversal |
| **Sales History** (`frontend/src/app/dashboard/sales/page.tsx`) | Sales Log Table | `subtotal`, `tax`, `total`, `paidAmount` | Formats invoice totals and paid amounts, thermal reprint payload mapping |
| **Inbound Purchases** (`frontend/src/app/dashboard/purchases/page.tsx`) | Purchase Table, Inbound Purchase Modal | `costPrice`, `price`, `quantity`, `discount`, `tax`, `subtotal`, `total`, `paidAmount` | Line total (`qty * price`), purchase subtotal, net total calculation, payment status derivation |
| **Products** (`frontend/src/app/dashboard/products/page.tsx`) | Product Table, Upsert Product Modal | `costPrice`, `sellingPrice`, `wholesalePrice` | Price inputs, profit margin calculations |
| **Expenses & Income** (`frontend/src/app/dashboard/expenses/page.tsx`) | Expense/Income Tables, Summary Cards, Add Modal | `amount`, `total`, `today`, `thisMonth` | Summation of expenses/incomes by period, currency display |
| **Customers** (`frontend/src/app/dashboard/customers/page.tsx`) | Customer Table, Ledger Statement, Receive Payment Modal | `creditLimit`, `balance`, `debit`, `credit`, `receiveAmount` | Running balance statement, remaining credit calculation (`creditLimit - balance`) |
| **Suppliers** (`frontend/src/app/dashboard/suppliers/page.tsx`) | Supplier Table, Ledger Statement | `balance`, `debit`, `credit` | Running balance statement |
| **Inventory Stock Valuation** (`frontend/src/app/dashboard/inventory/current-stock/`, `batch-stock/`, `stock-value/`) | Stock Tables, Metrics Cards | `costPrice`, `sellingPrice`, `value`, `totalValue` | Stock value (`quantity * costPrice`), cumulative asset value |
| **Accounting & Daily Reports** (`frontend/src/app/dashboard/reports/accounting/`, `daily/`) | Reports Tables, Reconstructed Cashbooks | `sales`, `purchases`, `expenses`, `profit`, `debit`, `credit` | Cashbook debit/credit reconstruction, daily cash vs card/digital collections |
| **Super Admin Revenue** (`frontend/src/app/dashboard/super-admin/revenue/page.tsx`) | Revenue Cards, Payments Table, Invoices Table | `amount`, `totalRevenueSum`, `totalPendingSum`, `totalFailedSum` | Aggregate tenant revenue and subscription payments |

---

### 4.2 Target 2: Decimal Formatting, Parsing, and Display Architecture
To prevent `TypeError: .toFixed is not a function` and floating-point precision drift, the frontend requires a dedicated, zero-dependency currency helper module.

#### Recommended Module: `frontend/src/lib/currency.ts`
```ts
/**
 * RestroInn Precision Currency & Decimal Utility
 * Adheres to 2-decimal fiat currencies (NPR, USD) using scaled integer arithmetic.
 * Immune to IEEE-754 floating-point drift and safely handles Decimal string/number/null inputs.
 */

export type MonetaryValue = string | number | { toString(): string } | null | undefined;

/**
 * Normalizes any incoming monetary value (string from Prisma Decimal, number, or object)
 * into an integer representation of minor units (cents / paisa).
 */
export function toCents(val: MonetaryValue): number {
  if (val === null || val === undefined || val === "") return 0;
  if (typeof val === "number") {
    if (!Number.isFinite(val)) return 0;
    return Math.round((val + Number.EPSILON) * 100);
  }
  const str = typeof val === "string" ? val.trim() : val.toString().trim();
  const cleaned = str.replace(/[^0-9.-]/g, "");
  const num = parseFloat(cleaned);
  if (isNaN(num) || !Number.isFinite(num)) return 0;
  return Math.round((num + Number.EPSILON) * 100);
}

/**
 * Converts integer minor units back to a standardized 2-decimal string.
 */
export function fromCents(cents: number): string {
  const isNegative = cents < 0;
  const abs = Math.abs(cents);
  const dollars = Math.floor(abs / 100);
  const remainder = abs % 100;
  const formatted = `${dollars}.${remainder.toString().padStart(2, "0")}`;
  return isNegative ? `-${formatted}` : formatted;
}

/**
 * Returns a standardized numeric value with 2 decimal places (safe for calculations).
 */
export function parseMoney(val: MonetaryValue): number {
  return toCents(val) / 100;
}

/**
 * Formats a monetary value for display with currency symbol and localized thousands separators.
 * Example: formatMoney(1250.5, "Rs. ") -> "Rs. 1,250.50"
 */
export function formatMoney(val: MonetaryValue, symbol: string = "Rs. "): string {
  const cents = toCents(val);
  const isNegative = cents < 0;
  const abs = Math.abs(cents);
  const whole = Math.floor(abs / 100);
  const decimal = (abs % 100).toString().padStart(2, "0");
  const wholeFormatted = whole.toLocaleString("en-US");
  const prefix = isNegative ? `-${symbol}` : symbol;
  return `${prefix}${wholeFormatted}.${decimal}`;
}

/**
 * Exact addition of two monetary values without float drift.
 */
export function addMoney(a: MonetaryValue, b: MonetaryValue): string {
  return fromCents(toCents(a) + toCents(b));
}

/**
 * Exact subtraction of two monetary values.
 */
export function subMoney(a: MonetaryValue, b: MonetaryValue): string {
  return fromCents(toCents(a) - toCents(b));
}

/**
 * Exact multiplication of money by a quantity or factor.
 */
export function mulMoney(amount: MonetaryValue, factor: number): string {
  const cents = toCents(amount);
  return fromCents(Math.round(cents * factor));
}

/**
 * Calculate tax or discount percentage with standardized half-up rounding.
 */
export function percentMoney(amount: MonetaryValue, percentage: number): string {
  const cents = toCents(amount);
  return fromCents(Math.round((cents * percentage) / 100));
}
```

---

### 4.3 Target 3: Payment Dialogs, PaymentAllocation, PaymentReversal, and Void Representation

#### A. POS Checkout Modal: Clean Staff Payment Reference
- **Current Defect**: `pos/page.tsx:1132` invokes `window.prompt()`.
- **Clean UI Solution**:
  - In `pos/page.tsx`, directly below the Single Payment method pills or Split Payment grid, embed an inline **Staff Reference Input Card** that is conditionally revealed whenever a non-cash payment method is selected:
    ```tsx
    {hasNonCash && (
      <div className="bg-secondary/40 border border-border rounded-xl p-3 space-y-1.5 animate-in fade-in duration-150">
        <label className="flex items-center justify-between text-[10px] font-black uppercase tracking-wider text-muted-foreground">
          <span>Staff-Recorded Reference *</span>
          <span className="text-[9px] font-medium text-amber-700 dark:text-amber-400">Non-cash audit requirement</span>
        </label>
        <input
          type="text"
          placeholder="e.g. Bank approval code, Fonepay TxnID, Cheque #"
          value={staffPaymentRef}
          onChange={(e) => setStaffPaymentRef(e.target.value)}
          className="w-full px-3 py-1.5 bg-card border border-border rounded-lg text-xs font-semibold text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
        />
      </div>
    )}
    ```
  - **Tender vs Revenue Separation**:
    - Tendered cash input `<input type="number" ... />` is compared against `grandTotal`.
    - If `amountTendered > grandTotal`, display a prominent Forest badge:  
      `<span className="badge-status-ready">Exact Change to Return: {formatMoney(amountTendered - grandTotal)}</span>`
    - In the submission payload, `splitPayments` / `paidAmount` sends only the applied invoice total, preventing revenue inflation while recording the exact cash tendered in metadata.

#### B. Payments Received & Sent: Surfacing `PaymentAllocation` and `PaymentReversal`
- **Current Defect**: `payments/received/page.tsx` and `sent/page.tsx` execute `DELETE /api/v1/payments/${id}` and lack allocation details.
- **Clean UI Solution**:
  1. **Table Column Additions**:
     - Replace generic status with two distinct columns:
       - **Allocation Target**: Badges indicating where the payment is applied:
         - Linked Invoice: `<span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-[#EDF4F9] text-[#315F85] border border-[#B8D2E6]">Inv: {p.sale?.invoiceNumber}</span>`
         - Account Deposit: `<span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-secondary text-foreground">Customer Balance</span>`
       - **Settlement Status**:
         - Normal / Settled: Forest badge (`Settled`)
         - Reversed / Voided: Red badge with strikethrough amount (`Reversed`)
  2. **Audited Reversal Modal (Replacing Trash2 DELETE)**:
     - When clicking the action button (icon changed from `Trash2` to `RotateCcw` / "Reverse Payment"):
     - Open an in-place modal: **"Audited Payment Reversal"**
       - Surfaces: Payment receipt #, date, amount, customer/supplier name, and original invoice link.
       - Requires: Operational Reversal Reason (`min(5)` characters), e.g. "Cashier entry mistake", "Check returned NSF", "Settlement reallocated".
       - Dispatches: `POST /api/v1/payments/${id}/reverse` (with `postCommerce` idempotency key) instead of destructive `DELETE`.

#### C. Sales Log History: Soft-Delete/Voided Representation & Financial Audit Drawer
- **Current Defect**: `sales/page.tsx` shows cancelled and active sales identically.
- **Clean UI Solution (Matching `uiuxskills.md`)**:
  1. **Voided & Superseded Row Styling**:
     - If `sale.isActive === false`:
       - Invoice # rendered in strikethrough with a muted tone: `<span className="line-through text-muted-foreground">{sale.invoiceNumber}</span>`
       - Status badge rendered in Red:
         ```tsx
         <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[#FAEAEC] text-[#B33432] border border-[#E9B6B7]">
           <AlertCircle className="h-3 w-3" />
           {sale.correctedInvoiceId ? "Superseded" : "Voided"}
         </span>
         ```
       - Hover tooltip or subtitle showing: `Cancelled by {sale.cancelledBy} on {date}. Reason: "{sale.cancellationReason}"`.
  2. **Invoice Financial Audit & Allocations Modal / Slide-Over**:
     - Add a "Details / Audit" icon button on each row.
     - Clicking opens a slide-over drawer showing:
       - **Line Items Breakdown**: Product, unit price, quantity, tax, discount, line total.
       - **Payment Allocations Ledger**: Table of receipts allocated to this invoice (Receipt #, Method, Amount, Date, Recorded By).
       - **Refunds & Credit Notes**: Explicit links to `CreditNote` (Note #, Reason, Amount refunded, Restocked items).
       - **Manager Actions**:
         - If active & settled: "Issue Credit Note / Refund" button.
         - If active & unpaid: "Void Invoice" button with required justification.

---

### 4.4 Target 4: Frontend Validation Rules, Currency Masks & Form Submission Payloads

1. **Fix Zod Number Validation**:
   - In `products/page.tsx`: Change `z.number().min(1)` to `z.coerce.number().min(0, "Cost price cannot be negative")`.
   - In `purchases/page.tsx`: Use `z.coerce.number().nonnegative()`.
   - In `expenses/page.tsx`: Use `z.coerce.number().positive("Amount must be greater than zero")`.
   - In `customers/page.tsx`: Use `z.coerce.number().nonnegative()`.
2. **Standardize Currency Input Masking**:
   - For all currency input fields, avoid raw unformatted float states. Use an `onBlur` normalizer:
     ```tsx
     <input
       type="number"
       step="0.01"
       min="0"
       value={val}
       onChange={(e) => setVal(e.target.value)}
       onBlur={() => setVal(parseMoney(val).toFixed(2))}
       className="w-full px-3 py-2 bg-card border border-border rounded-xl text-xs font-semibold text-foreground focus:ring-1 focus:ring-primary"
     />
     ```
3. **Payload Sanitization Before Submission**:
   - Ensure all submitted monetary amounts in JSON payloads are passed as numbers rounded strictly to 2 decimal places (or Decimal strings accepted by the backend):
     ```ts
     const sanitizedPayload = {
       ...data,
       amount: parseMoney(data.amount),
     };
     ```
4. **Fix Idempotency in Customer & Supplier Payments**:
   - Update `customers/page.tsx:147` to use `postCommerce("/api/v1/payments", payload, `${session?.user?.email}:${selectedCustomer.id}`)`.

---

### 4.5 Target 5: File Boundaries, Components to Update, and Risk Mitigations

#### Exact File Update Scope:

1. **New Utility File**:
   - `frontend/src/lib/currency.ts` — Centralized zero-dependency precision currency operations and formatting.
2. **Components & Pages to Update**:
   - `frontend/src/app/dashboard/pos/page.tsx`:
     - Adopt `formatMoney` and `parseMoney`.
     - Replace `window.prompt` with inline staff reference input.
     - Safeguard multi-person split math against 1-cent rounding drift.
   - `frontend/src/components/pos/thermal-receipt.tsx`:
     - Adopt `formatMoney` across receipt headers, item rows, round-off, and grand totals.
   - `frontend/src/app/dashboard/payments/received/page.tsx` & `sent/page.tsx`:
     - Replace `DELETE` / `confirm()` with Audited Reversal Modal.
     - Add PaymentAllocation badge column.
   - `frontend/src/app/dashboard/sales/page.tsx`:
     - Render soft-delete/voided invoice representations (strikethrough, Red badge, cancellation notice).
     - Add expandable financial audit slide-over for allocations and credit notes.
   - `frontend/src/app/dashboard/customers/page.tsx`:
     - Adopt `postCommerce` for payment submission.
     - Adopt `formatMoney` for balances, ceilings, and ledger statements.
   - `frontend/src/app/dashboard/suppliers/page.tsx`:
     - Adopt `formatMoney` for supplier debt and ledger statements.
   - `frontend/src/app/dashboard/purchases/page.tsx`:
     - Fix zod schemas with `z.coerce.number()` and adopt `formatMoney`.
   - `frontend/src/app/dashboard/products/page.tsx`:
     - Fix `min(1)` schema limitation to `min(0)`.
   - `frontend/src/app/dashboard/expenses/page.tsx`:
     - Adopt `formatMoney` on summary cards and expense lists.
   - `frontend/src/app/dashboard/inventory/stock-movements/stock-movements-client.tsx`:
     - Surface signed quantity (`+` / `-`), unit, batch, actor, and source event per R3.
   - `frontend/src/app/dashboard/reports/accounting/page.tsx` & `daily/page.tsx`:
     - Filter out inactive/cancelled sales (`s.isActive !== false`) from revenue totals; account for credit notes and reversals.

#### Key Risks and Mitigations:

| Risk | Impact | Mitigation Strategy |
|---|---|---|
| **Prisma Decimal Serialization Type Error** | Frontend crashes with `val.toFixed is not a function` when backend returns strings. | Deploy `frontend/src/lib/currency.ts` first; ensure `toCents` and `formatMoney` safely handle strings, numbers, or Decimal objects before any page displays them. |
| **Silent Float Drift in Multi-split Payments** | Sum of split payments deviates from invoice total by `0.01`, causing 400 Bad Request on backend. | In `pos/page.tsx`, compute remaining split balance using `subMoney(grandTotal, totalPaidInSplits)` in integer cents, guaranteeing exact balance. |
| **428 Precondition Required on Payments** | Direct `fetch()` calls fail on hardened API routes requiring idempotency. | Ensure all state-mutating commands (sales checkout, manual payments, credit notes, reversals) route exclusively through `postCommerce()`. |
| **Accidental Hard Deletion of Financial Records** | Auditor cannot trace refunded or voided transactions. | Remove `DELETE` button completely from payment UI; replace with audited `POST /api/v1/payments/${id}/reverse` modal requiring operator reason. |
| **Over-Padding & UI Clutter** | Cashier screen becomes bloated, pushing checkout buttons off-screen. | Strictly adhere to `.agent/skill/uiuxskills.md` guidelines (`p-3.5 sm:p-4`, flat borders `#D8CEC1`, zero decorative gimmickry, sticky bottom checkout budget). |

---

## 5. Verification Method

To independently verify these findings and confirm the frontend is hardened against Decimal migration:

1. **Static Analysis & Typecheck**:
   ```powershell
   npm.cmd run typecheck
   ```
   *Expected Result*: Exit code 0 across both frontend and backend packages.
2. **Monetary String Handling Unit Test**:
   - Verify that `formatMoney("125.50")`, `formatMoney(125.5)`, `formatMoney(null)`, and `formatMoney(undefined)` all execute without throwing errors and produce standard currency strings.
3. **POS Checkout Test**:
   - Open `/dashboard/pos`. Add products with prices containing fractional decimals.
   - Select Split Payment (e.g., Cash + FonePay). Verify that the inline Staff Reference input is revealed and that no `window.prompt()` is invoked.
   - Verify that cash change is cleanly separated from applied payment tender.
4. **Sales History Audit State Test**:
   - Open `/dashboard/sales`. Inspect a cancelled or corrected invoice.
   - Verify that voided invoices render with strikethrough invoice numbers and Red `#FAEAEC` badges per `uiuxskills.md`.
   - Verify that clicking "Audit / Details" reveals line items, allocated payment receipts, and credit notes without navigating to a new screen.
5. **Payment Reversal Workflow Test**:
   - Open `/dashboard/payments/received`. Verify that the red trash can `DELETE` action is replaced with an audited reversal dialog that prompts for an operational justification.
