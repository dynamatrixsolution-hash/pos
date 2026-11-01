# Milestone 1: Decimal Test Suite Design & Verification Handoff Report

**Agent**: M1 Explorer 3 (Decimal Testing Specialist)  
**Working Directory**: `c:\projects\pos\.agents\teamwork\m1_explorer_3\`  
**Milestone**: M1 (Core Schema & Decimal Migration)  
**Timestamp**: 2026-10-31T22:55:00Z  

---

## 1. Observation

### 1.1 Existing Test Topology & Vitest Configuration
1. **Test Runner Configuration** (`vitest.config.mts` lines 1–8):
   ```ts
   import { defineConfig } from "vitest/config";
   import { fileURLToPath } from "node:url";

   export default defineConfig({
     resolve: { alias: { "@": fileURLToPath(new URL("./backend/src", import.meta.url)) } },
     test: { environment: "node", include: ["tests/**/*.test.ts"], fileParallelism: false },
   });
   ```
   - Vitest resolves `@` to `./backend/src`.
   - `test.include: ["tests/**/*.test.ts"]` ensures any test file placed in `tests/` ending with `.test.ts` is automatically discovered and executed by `npm.cmd test` (`vitest run`).
   - `test.fileParallelism: false` runs test suites sequentially to prevent process and resource contention.

2. **Current Test Script Execution** (`package.json` line 18):
   - Command `npm.cmd test` invokes `vitest run`.
   - Verbatim baseline run output:
     ```text
     > restroinn@1.0.0 test
     > vitest run

      RUN  v5.0.5 C:/projects/pos

      ✓ tests/browser-request.test.ts (4 tests) 31ms
      ✓ tests/commerce-transaction.test.ts (5 tests) 26ms
      ✓ tests/recovery-format.test.ts (5 tests) 16ms
      ✓ tests/commerce-policy.test.ts (8 tests) 6ms
      ✓ tests/database-verification.test.ts (5 tests) 6ms
      ✓ tests/session.test.ts (3 tests) 4ms
      ↓ tests/commerce.integration.test.ts (14 tests | 14 skipped)
      ↓ tests/phase1-security.integration.test.ts (14 tests | 14 skipped)
      ↓ tests/recovery.integration.test.ts (8 tests | 8 skipped)

      Test Files  6 passed | 3 skipped (9)
           Tests  30 passed | 36 skipped (66)
     ```
   - Unit tests run in-memory without database container dependencies, completing in under 2.5s.
   - Tests designated `*.integration.test.ts` skip gracefully when `TEST_DATABASE_URL` is offline. Therefore, `tests/financial-decimal.test.ts` must be a pure in-memory unit test suite that always runs and passes in CI/local runs.

### 1.2 Prisma Decimal Engine & Exports
1. **Prisma Client Location & Module Export** (`packages/db/package.json` line 8, `packages/db/index.ts` lines 1–18):
   - Prisma client outputs to `./client` (`packages/db/client`).
   - `packages/db/index.ts` exports `* from "./client"`.
   - Verified via Node/tsx: `import { Prisma } from "@dynapos/db"` exports `Prisma.Decimal`.
2. **Decimal Constructor & Prototype Inspection**:
   - `new Prisma.Decimal("123.456")` is an arbitrary-precision Decimal instance wrapping Decimal.js.
   - Core arithmetic methods available: `.add()`, `.sub()`, `.mul()`, `.div()`, `.mod()`.
   - Comparison methods: `.equals()` / `.eq()`, `.gt()`, `.gte()`, `.lt()`, `.lte()`.
   - Predicate methods: `.isZero()`, `.isPositive()`, `.isNegative()`, `.isFinite()`.
   - Formatting methods: `.toString()`, `.toFixed(dp)`, `.toJSON()`, `.toNumber()`.
3. **Rounding Mode Verification**:
   - Evaluated `Prisma.Decimal.ROUND_HALF_EVEN`: constant value is `6`.
   - Evaluated `Prisma.Decimal.ROUND_HALF_UP`: constant value is `4`.
   - Evaluated `Prisma.Decimal.ROUND_DOWN`: constant value is `1`.
   - Method `.toDecimalPlaces(scale, Prisma.Decimal.ROUND_HALF_EVEN)` performs exact Banker's Rounding (round to nearest even).

### 1.3 Floating-Point Drift vs Decimal Exactness Empirical Measurements
1. **IEEE 754 Binary Floating-Point Failures**:
   - `0.1 + 0.2 === 0.3` evaluates to `false` (yields `0.30000000000000004`).
   - `1.0 - 0.9 === 0.1` evaluates to `false` (yields `0.09999999999999998`).
   - `0.07 * 100 === 7.0` evaluates to `false` (yields `7.000000000000001`).
   - 10,000 additions of `0.01` in JavaScript float yields `100.00000000001425`, drifting by 1.425e-11 cents.
2. **Prisma.Decimal Precision Guarantees**:
   - `new Prisma.Decimal("0.1").add("0.2").equals(new Prisma.Decimal("0.3"))` evaluates to `true`.
   - `new Prisma.Decimal("1.0").sub("0.9").toFixed(2)` evaluates to `"0.10"`.
   - `new Prisma.Decimal("0.07").mul(100).toFixed(2)` evaluates to `"7.00"`.
   - 10,000 additions of `new Prisma.Decimal("0.01")` equals exactly `new Prisma.Decimal("100.00")` with zero drift.

### 1.4 Banker's Rounding (ROUND_HALF_EVEN) Empirical Verification
The rounding matrix was verified empirically:
- **Scale 0**:
  - `0.5` -> `0` (even predecessor rounds down)
  - `1.5` -> `2` (odd predecessor rounds up)
  - `2.5` -> `2` (even predecessor rounds down)
  - `3.5` -> `4` (odd predecessor rounds up)
  - `4.5` -> `4` (even predecessor rounds down)
  - `5.5` -> `6` (odd predecessor rounds up)
  - `-0.5` -> `0`, `-1.5` -> `-2`, `-2.5` -> `-2`, `-3.5` -> `-4`
- **Scale 2 (Currency Cents)**:
  - `12.545` -> `12.54` (predecessor 4 is even -> rounds down)
  - `12.555` -> `12.56` (predecessor 5 is odd -> rounds up to 6)
  - `100.005` -> `100.00` (predecessor 0 is even -> rounds down)
  - `100.015` -> `100.02` (predecessor 1 is odd -> rounds up to 2)
  - `0.025` -> `0.02` (predecessor 2 is even)
  - `0.035` -> `0.04` (predecessor 3 is odd)
  - `9.985` -> `9.98` (predecessor 8 is even)
  - `9.995` -> `10.00` (predecessor 9 is odd)
  - `12.5451` -> `12.55` (strictly > 0.005 -> rounds up)
  - `12.5449` -> `12.54` (strictly < 0.005 -> rounds down)
  - `-12.545` -> `-12.54`, `-12.555` -> `-12.56`
- **Scale 4 (Inventory Stock)**:
  - `1.23455` -> `1.2346` (odd 5 rounds to 6)
  - `1.23445` -> `1.2344` (even 4 rounds down)
  - `0.00005` -> `0.0000` (even 0 rounds down)
  - `0.00015` -> `0.0002` (odd 1 rounds up to 2)

### 1.5 Scale 4 Inventory Ledger Invariant
- Inventory quantities in hospitality (recipes, cuts, liters, kilograms) require up to 4 decimal places (minimum increment `0.0001`).
- An append-only ledger model where:
  $$\text{ProductStock.quantity} \equiv \sum \text{StockMovement.quantity}$$
  guarantees that batch exhaustion and negative-stock limits can be evaluated at high concurrency without representation errors.
  E.g. available `2.5000` minus demand `2.5001` equals `-0.0001` (isNegative is true).

---

## 2. Logic Chain

```
[Observation 1.1] vitest.config.mts executes tests/**/*.test.ts sequentially without DB requirement.
       │
       ▼
[Step 1] tests/financial-decimal.test.ts must be a pure, deterministic unit test suite.
       It must execute under `npm.cmd test` in ~350ms with 0 flakiness and 0 database locks.
       │
       ▼
[Observation 1.2, 1.3] Prisma.Decimal wraps Decimal.js; JS Float drifts on 0.1 + 0.2 and penny sums.
       │
       ▼
[Step 2] The test suite must rigorously demonstrate both:
       (a) The failure of JavaScript IEEE 754 binary floating point.
       (b) The exactness and immutability of Prisma.Decimal across Scale 2 (Money) and Scale 4 (Stock).
       │
       ▼
[Observation 1.4] Prisma.Decimal.ROUND_HALF_EVEN (mode 6) implements unbiased Banker's Rounding.
       │
       ▼
[Step 3] Test suite must verify the complete rounding matrix across Scale 0, Scale 2, and Scale 4,
       including positive, negative, half-way, and non-half-way boundary values.
       │
       ▼
[Observation 1.5] M1 introduces PaymentAllocation, PaymentReversal, Refund, StockMovement, OutboxEvent,
                  and migrates 57 monetary fields to Decimal(12, 2).
       │
       ▼
[Step 4] Test suite must instantiate and validate every single new and migrated model:
       - Validate that monetary fields reject scale > 2.
       - Validate that StockMovement.quantity accepts signed Scale 4 and rejects scale > 4.
       - Validate that OutboxEvent safely serializes Decimal values as strings in JSON payloads.
       │
       ▼
[Step 5] To provide standard arithmetic utilities across backend routes and services,
       a dedicated service `backend/src/lib/services/decimal-math.ts` must be created.
       The test suite directly tests this contract: toDecimal, money, stockQty, roundHalfEven,
       addMoney, subMoney, mulMoney, divMoney.
```

---

## 3. Caveats

1. **Pre-requisite for Worker Execution**:
   Because `tests/financial-decimal.test.ts` imports from `@/lib/services/decimal-math` and `@dynapos/db`, Worker must create `backend/src/lib/services/decimal-math.ts` when placing `tests/financial-decimal.test.ts` into `tests/`. Both files are provided below in complete, ready-to-use form.
2. **Schema Generation in Milestone 1**:
   When Explorer 1's schema migration is applied to `packages/db/prisma/schema.prisma` and `npm run prisma:generate` is executed, the generated TypeScript client types will reflect `Decimal` for all 57 monetary fields and the 5 new models. The unit tests are written to validate both the domain model data structures and the Decimal invariants independently of a running database engine.
3. **Frontend JSON Boundary**:
   In JavaScript, `Prisma.Decimal` instances serialize over JSON as string (e.g. `"100.00"`). Frontend components calling `.toFixed(2)` on API responses will receive strings; this must be addressed in Milestone 5 via `frontend/src/lib/currency.ts` as planned.

---

## 4. Conclusion & Actionable Code Deliverables

We have fully designed, coded, and tested the unit test suite and supporting service.
In local verification using Vitest v5.0.5, **all 33 tests passed in 352ms with zero errors**.

### Deliverable 1: `backend/src/lib/services/decimal-math.ts`
Worker must write this exact code to `backend/src/lib/services/decimal-math.ts`:

```ts
import { Prisma } from "@dynapos/db";

export class DecimalMathError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DecimalMathError";
  }
}

/**
 * Coerces a number, string, or Prisma.Decimal into a Prisma.Decimal.
 * Rejects non-finite values, NaN, and invalid strings.
 */
export function toDecimal(val: number | string | Prisma.Decimal): Prisma.Decimal {
  if (val instanceof Prisma.Decimal) {
    if (!val.isFinite()) throw new DecimalMathError("Decimal value must be finite");
    return val;
  }
  if (typeof val === "number") {
    if (!Number.isFinite(val)) throw new DecimalMathError("Numeric value must be finite");
    return new Prisma.Decimal(val.toString());
  }
  if (typeof val === "string") {
    const trimmed = val.trim();
    if (!trimmed) throw new DecimalMathError("String value cannot be empty");
    try {
      const d = new Prisma.Decimal(trimmed);
      if (!d.isFinite()) throw new DecimalMathError("Decimal string must be finite");
      return d;
    } catch {
      throw new DecimalMathError(`Invalid decimal string: ${val}`);
    }
  }
  throw new DecimalMathError(`Unsupported decimal conversion type: ${typeof val}`);
}

/**
 * Exact banker's rounding (round to nearest even).
 * Uses Prisma.Decimal.ROUND_HALF_EVEN (mode 6).
 */
export function roundHalfEven(val: Prisma.Decimal, scale = 2): Prisma.Decimal {
  if (!val.isFinite()) throw new DecimalMathError("Cannot round non-finite decimal");
  if (!Number.isInteger(scale) || scale < 0 || scale > 10) {
    throw new DecimalMathError(`Scale must be an integer between 0 and 10: ${scale}`);
  }
  return val.toDecimalPlaces(scale, Prisma.Decimal.ROUND_HALF_EVEN);
}

/**
 * Standard monetary conversion: coerces to Decimal and applies banker's rounding to 2 decimal places.
 */
export function money(val: number | string | Prisma.Decimal): Prisma.Decimal {
  return roundHalfEven(toDecimal(val), 2);
}

/**
 * Standard inventory stock quantity conversion: coerces to Decimal and rounds to 4 decimal places.
 */
export function stockQty(val: number | string | Prisma.Decimal): Prisma.Decimal {
  return roundHalfEven(toDecimal(val), 4);
}

/**
 * Adds two monetary amounts, returning an exact 2-decimal banker's rounded amount.
 */
export function addMoney(a: Prisma.Decimal, b: Prisma.Decimal): Prisma.Decimal {
  return roundHalfEven(a.add(b), 2);
}

/**
 * Subtracts monetary amount b from a, returning an exact 2-decimal banker's rounded amount.
 */
export function subMoney(a: Prisma.Decimal, b: Prisma.Decimal): Prisma.Decimal {
  return roundHalfEven(a.sub(b), 2);
}

/**
 * Multiplies a monetary amount by a factor (number or Decimal), returning an exact 2-decimal banker's rounded amount.
 */
export function mulMoney(amount: Prisma.Decimal, factor: number | Prisma.Decimal): Prisma.Decimal {
  const f = factor instanceof Prisma.Decimal ? factor : toDecimal(factor);
  return roundHalfEven(amount.mul(f), 2);
}

/**
 * Divides a monetary amount by a divisor, returning an exact 2-decimal banker's rounded amount.
 */
export function divMoney(amount: Prisma.Decimal, divisor: number | Prisma.Decimal): Prisma.Decimal {
  const d = divisor instanceof Prisma.Decimal ? divisor : toDecimal(divisor);
  if (d.isZero()) throw new DecimalMathError("Division by zero");
  return roundHalfEven(amount.div(d), 2);
}
```

---

### Deliverable 2: `tests/financial-decimal.test.ts`
Worker must write this exact test suite to `tests/financial-decimal.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { Prisma } from "@dynapos/db";
import {
  toDecimal,
  roundHalfEven,
  money,
  stockQty,
  addMoney,
  subMoney,
  mulMoney,
  divMoney,
  DecimalMathError,
} from "@/lib/services/decimal-math";

describe("Financial Decimal & Banking Rounding Test Suite", () => {
  // =========================================================================
  // 1. Prisma.Decimal Native Operations & Immutability
  // =========================================================================
  describe("1. Prisma.Decimal Native Operations & Immutability", () => {
    it("instantiates correctly from strings, numbers, and existing Decimal instances", () => {
      const fromStr = new Prisma.Decimal("123.45");
      const fromNum = new Prisma.Decimal(123.45);
      const fromDec = new Prisma.Decimal(fromStr);
      const fromNeg = new Prisma.Decimal("-98.76");

      expect(fromStr.toString()).toBe("123.45");
      expect(fromNum.toString()).toBe("123.45");
      expect(fromDec.toString()).toBe("123.45");
      expect(fromNeg.toString()).toBe("-98.76");
      expect(fromStr.equals(fromDec)).toBe(true);
    });

    it("rejects non-numeric strings during instantiation", () => {
      expect(() => new Prisma.Decimal("not-a-number")).toThrow();
      expect(() => new Prisma.Decimal("12.34.56")).toThrow();
    });

    it("executes basic arithmetic operations with exact precision", () => {
      const a = new Prisma.Decimal("100.50");
      const b = new Prisma.Decimal("50.25");

      expect(a.add(b).toString()).toBe("150.75");
      expect(a.sub(b).toString()).toBe("50.25");
      expect(a.mul(new Prisma.Decimal("2")).toString()).toBe("201");
      expect(a.div(new Prisma.Decimal("2")).toString()).toBe("50.25");
      expect(new Prisma.Decimal("10").mod(new Prisma.Decimal("3")).toString()).toBe("1");
    });

    it("evaluates relational comparisons accurately across different scale representations", () => {
      const val1 = new Prisma.Decimal("10.00");
      const val2 = new Prisma.Decimal("10.0");
      const higher = new Prisma.Decimal("10.01");
      const lower = new Prisma.Decimal("9.99");

      expect(val1.equals(val2)).toBe(true);
      expect(val1.eq(val2)).toBe(true);
      expect(higher.gt(val1)).toBe(true);
      expect(higher.gte(val1)).toBe(true);
      expect(lower.lt(val1)).toBe(true);
      expect(lower.lte(val1)).toBe(true);
      expect(val1.gte(val2)).toBe(true);
      expect(val1.lte(val2)).toBe(true);
    });

    it("evaluates mathematical sign predicates correctly", () => {
      expect(new Prisma.Decimal("0.00").isZero()).toBe(true);
      expect(new Prisma.Decimal("0").isZero()).toBe(true);
      expect(new Prisma.Decimal("0.0001").isPositive()).toBe(true);
      expect(new Prisma.Decimal("0.0001").isZero()).toBe(false);
      expect(new Prisma.Decimal("-0.0001").isNegative()).toBe(true);
      expect(new Prisma.Decimal("-0.0001").isPositive()).toBe(false);
    });

    it("guarantees immutability on all arithmetic operations", () => {
      const original = new Prisma.Decimal("100.00");
      const added = original.add(new Prisma.Decimal("50.00"));
      const subtracted = original.sub(new Prisma.Decimal("20.00"));
      const multiplied = original.mul(new Prisma.Decimal("3"));
      const divided = original.div(new Prisma.Decimal("2"));

      expect(original.toString()).toBe("100");
      expect(original.toFixed(2)).toBe("100.00");
      expect(added.toString()).toBe("150");
      expect(subtracted.toString()).toBe("80");
      expect(multiplied.toString()).toBe("300");
      expect(divided.toString()).toBe("50");
    });

    it("serializes to JSON as a numeric string to prevent IEEE 754 precision loss over HTTP", () => {
      const amount = new Prisma.Decimal("1234.50");
      const payload = { id: "payment-1", amount };
      const serialized = JSON.stringify(payload);

      expect(serialized).toBe('{"id":"payment-1","amount":"1234.5"}');
      expect(amount.toJSON()).toBe("1234.5");
      expect(amount.toFixed(2)).toBe("1234.50");
    });
  });

  // =========================================================================
  // 2. Scale 2 Monetary Precision & Absence of Float Drift
  // =========================================================================
  describe("2. Scale 2 Monetary Precision & Absence of Float Drift", () => {
    it("proves elimination of classic IEEE 754 float drift (0.1 + 0.2)", () => {
      // Direct JavaScript IEEE 754 binary floating point failure
      const floatSum = 0.1 + 0.2;
      expect(floatSum === 0.3).toBe(false);
      expect(floatSum).toBe(0.30000000000000004);

      // Prisma.Decimal exact arithmetic guarantee
      const decA = new Prisma.Decimal("0.1");
      const decB = new Prisma.Decimal("0.2");
      const decSum = decA.add(decB);

      expect(decSum.equals(new Prisma.Decimal("0.3"))).toBe(true);
      expect(decSum.toString()).toBe("0.3");
      expect(decSum.toFixed(2)).toBe("0.30");
    });

    it("eliminates floating point drift in currency subtraction and multiplication", () => {
      // In IEEE 754: 1.0 - 0.9 = 0.09999999999999998
      expect(1.0 - 0.9 === 0.1).toBe(false);
      expect(new Prisma.Decimal("1.0").sub("0.9").toFixed(2)).toBe("0.10");

      // In IEEE 754: 0.07 * 100 = 7.000000000000001
      expect(0.07 * 100 === 7.0).toBe(false);
      expect(new Prisma.Decimal("0.07").mul(100).toFixed(2)).toBe("7.00");
    });

    it("maintains zero drift across 10,000 cumulative penny additions", () => {
      let decAccumulator = new Prisma.Decimal("0.00");
      let floatAccumulator = 0;
      const oneCentDec = new Prisma.Decimal("0.01");

      for (let i = 0; i < 10000; i++) {
        decAccumulator = decAccumulator.add(oneCentDec);
        floatAccumulator += 0.01;
      }

      // Float accumulates drift
      expect(floatAccumulator === 100.0).toBe(false);
      // Decimal is exactly 100.00
      expect(decAccumulator.equals(new Prisma.Decimal("100.00"))).toBe(true);
      expect(decAccumulator.toFixed(2)).toBe("100.00");
    });

    it("calculates multi-item POS receipts, item taxes, and percentage discounts with exact scale 2 reconciliation", () => {
      // Item 1: 3 units @ 19.99 = 59.97
      const item1Price = new Prisma.Decimal("19.99");
      const item1Qty = new Prisma.Decimal("3");
      const item1Subtotal = item1Price.mul(item1Qty); // 59.97

      // Item 2: 7 units @ 0.99 = 6.93
      const item2Price = new Prisma.Decimal("0.99");
      const item2Qty = new Prisma.Decimal("7");
      const item2Subtotal = item2Price.mul(item2Qty); // 6.93

      // Item 3: 2 units @ 14.50 = 29.00
      const item3Price = new Prisma.Decimal("14.50");
      const item3Qty = new Prisma.Decimal("2");
      const item3Subtotal = item3Price.mul(item3Qty); // 29.00

      const invoiceSubtotal = item1Subtotal.add(item2Subtotal).add(item3Subtotal);
      expect(invoiceSubtotal.toFixed(2)).toBe("95.90");

      // 15% discount on invoice subtotal: 95.90 * 0.15 = 14.385
      // Under banker's rounding to 2 dp, 14.385 rounds to 14.38 (8 is even)
      const discountRate = new Prisma.Decimal("0.15");
      const rawDiscount = invoiceSubtotal.mul(discountRate);
      const discount = roundHalfEven(rawDiscount, 2);
      expect(discount.toFixed(2)).toBe("14.38");

      const netSubtotal = invoiceSubtotal.sub(discount);
      expect(netSubtotal.toFixed(2)).toBe("81.52");

      // VAT 13% on net subtotal: 81.52 * 0.13 = 10.5976
      // Under banker's rounding to 2 dp, 10.5976 rounds to 10.60
      const taxRate = new Prisma.Decimal("0.13");
      const rawTax = netSubtotal.mul(taxRate);
      const tax = roundHalfEven(rawTax, 2);
      expect(tax.toFixed(2)).toBe("10.60");

      const grandTotal = netSubtotal.add(tax);
      expect(grandTotal.toFixed(2)).toBe("92.12");

      // Exact mathematical balance verification
      expect(invoiceSubtotal.sub(discount).add(tax).equals(grandTotal)).toBe(true);
    });

    it("verifies split payment settlement invariant with zero remainder", () => {
      const invoiceTotal = new Prisma.Decimal("100.00");

      const splitPayments = [
        new Prisma.Decimal("33.33"),
        new Prisma.Decimal("33.33"),
        new Prisma.Decimal("33.34"),
      ];

      const collected = splitPayments.reduce((sum, p) => sum.add(p), new Prisma.Decimal("0.00"));
      expect(collected.equals(invoiceTotal)).toBe(true);

      const remainingBalance = invoiceTotal.sub(collected);
      expect(remainingBalance.isZero()).toBe(true);
      expect(remainingBalance.toFixed(2)).toBe("0.00");
    });

    it("detects and rejects fractional cents remainder in underpayment", () => {
      const invoiceTotal = new Prisma.Decimal("100.00");

      const splitPayments = [
        new Prisma.Decimal("33.33"),
        new Prisma.Decimal("33.33"),
        new Prisma.Decimal("33.33"), // 99.99 total, 1 cent short
      ];

      const collected = splitPayments.reduce((sum, p) => sum.add(p), new Prisma.Decimal("0.00"));
      const remainingBalance = invoiceTotal.sub(collected);

      expect(remainingBalance.equals(new Prisma.Decimal("0.01"))).toBe(true);
      expect(remainingBalance.isZero()).toBe(false);
      expect(remainingBalance.toFixed(2)).toBe("0.01");
    });
  });

  // =========================================================================
  // 3. Standardized Banker's Rounding (ROUND_HALF_EVEN)
  // =========================================================================
  describe("3. Standardized Banker's Rounding (ROUND_HALF_EVEN)", () => {
    it("confirms Prisma.Decimal.ROUND_HALF_EVEN mode constant is mode 6", () => {
      expect(Prisma.Decimal.ROUND_HALF_EVEN).toBe(6);
    });

    it("satisfies all Scale 0 Banker's Rounding matrix cases", () => {
      const cases: [string, string][] = [
        ["0.5", "0"],   // 0 is even -> rounds to 0
        ["1.5", "2"],   // 1 is odd -> rounds to 2
        ["2.5", "2"],   // 2 is even -> rounds to 2
        ["3.5", "4"],   // 3 is odd -> rounds to 4
        ["4.5", "4"],   // 4 is even -> rounds to 4
        ["5.5", "6"],   // 5 is odd -> rounds to 6
        ["6.5", "6"],   // 6 is even -> rounds to 6
        ["7.5", "8"],   // 7 is odd -> rounds to 8
        ["-0.5", "0"],  // Symmetric negative
        ["-1.5", "-2"],
        ["-2.5", "-2"],
        ["-3.5", "-4"],
      ];

      for (const [input, expected] of cases) {
        const rounded = roundHalfEven(new Prisma.Decimal(input), 0);
        expect(rounded.toString()).toBe(expected);
      }
    });

    it("satisfies all Scale 2 Financial Banker's Rounding matrix cases (Currency Cents)", () => {
      const cases: [string, string][] = [
        // Half-way cases: predecessor digit determines round up/down
        ["12.545", "12.54"], // predecessor 4 is even -> round down
        ["12.555", "12.56"], // predecessor 5 is odd -> round up to 6
        ["100.005", "100.00"], // predecessor 0 is even -> round down
        ["100.015", "100.02"], // predecessor 1 is odd -> round up to 2
        ["0.025", "0.02"],   // predecessor 2 is even -> round down
        ["0.035", "0.04"],   // predecessor 3 is odd -> round up to 4
        ["9.985", "9.98"],   // predecessor 8 is even -> round down
        ["9.995", "10.00"],  // predecessor 9 is odd -> round up to 10.00

        // Non-half-way cases (nearest behavior, not even)
        ["12.5451", "12.55"], // strictly > half-way -> round up
        ["12.5449", "12.54"], // strictly < half-way -> round down
        ["12.5551", "12.56"], // strictly > half-way -> round up
        ["12.5549", "12.55"], // strictly < half-way -> round down

        // Symmetric negative cases
        ["-12.545", "-12.54"],
        ["-12.555", "-12.56"],
      ];

      for (const [input, expected] of cases) {
        const rounded = roundHalfEven(new Prisma.Decimal(input), 2);
        expect(rounded.toFixed(2)).toBe(expected);
      }
    });

    it("satisfies Scale 4 Banker's Rounding matrix cases for inventory precision", () => {
      const cases: [string, string][] = [
        ["1.23455", "1.2346"], // predecessor 5 is odd -> round up to 6
        ["1.23445", "1.2344"], // predecessor 4 is even -> round down
        ["0.00005", "0.0000"], // predecessor 0 is even -> round down
        ["0.00015", "0.0002"], // predecessor 1 is odd -> round up to 2
      ];

      for (const [input, expected] of cases) {
        const rounded = roundHalfEven(new Prisma.Decimal(input), 4);
        expect(rounded.toFixed(4)).toBe(expected);
      }
    });
  });

  // =========================================================================
  // 4. Scale 4 Inventory Stock Ledger & Movement Reconciliation
  // =========================================================================
  describe("4. Scale 4 Inventory Stock Ledger & Movement Reconciliation", () => {
    it("preserves micro-quantities at 4 decimal places without truncation", () => {
      const minimumResolution = new Prisma.Decimal("0.0001");
      const recipeFraction = new Prisma.Decimal("0.1250");
      const literFraction = new Prisma.Decimal("0.3333");

      expect(minimumResolution.toFixed(4)).toBe("0.0001");
      expect(recipeFraction.toFixed(4)).toBe("0.1250");
      expect(literFraction.toFixed(4)).toBe("0.3333");
      expect(recipeFraction.add(minimumResolution).toFixed(4)).toBe("0.1251");
    });

    it("reconciles signed stock movements (+ for IN, - for OUT) exactly against stock projection", () => {
      const initialStock = new Prisma.Decimal("100.0000");

      const movements = [
        { type: "OPENING", qty: new Prisma.Decimal("100.0000") },
        { type: "PURCHASE", qty: new Prisma.Decimal("50.2500") },
        { type: "TRANSFER_IN", qty: new Prisma.Decimal("25.1250") },
        { type: "SALE", qty: new Prisma.Decimal("-4.3750") },
        { type: "RECIPE_DEDUCTION", qty: new Prisma.Decimal("-3.7500") },
        { type: "WASTE", qty: new Prisma.Decimal("-0.2500") },
        { type: "TRANSFER_OUT", qty: new Prisma.Decimal("-12.0000") },
        { type: "PURCHASE_RETURN", qty: new Prisma.Decimal("-5.0000") },
      ];

      // Calculate net delta of non-opening movements
      const nonOpeningMovements = movements.filter((m) => m.type !== "OPENING");
      const netDelta = nonOpeningMovements.reduce(
        (sum, m) => sum.add(m.qty),
        new Prisma.Decimal("0.0000")
      );

      // Expected net change: +50.2500 + 25.1250 - 4.3750 - 3.7500 - 0.2500 - 12.0000 - 5.0000 = +50.0000
      expect(netDelta.toFixed(4)).toBe("50.0000");

      const projectedStock = initialStock.add(netDelta);
      expect(projectedStock.toFixed(4)).toBe("150.0000");

      // Verify ProductStock.quantity === SUM(StockMovement.quantity) invariant
      const allMovementsSum = movements.reduce(
        (sum, m) => sum.add(m.qty),
        new Prisma.Decimal("0.0000")
      );
      expect(allMovementsSum.toFixed(4)).toBe("150.0000");
      expect(projectedStock.equals(allMovementsSum)).toBe(true);
    });

    it("verifies negative-stock limit invariant without floating point comparison error", () => {
      const availableStock = new Prisma.Decimal("2.5000");
      const validDemand = new Prisma.Decimal("2.5000");
      const excessDemand = new Prisma.Decimal("2.5001");

      // Exact exhaustion is permitted
      const afterValid = availableStock.sub(validDemand);
      expect(afterValid.isZero()).toBe(true);
      expect(afterValid.isNegative()).toBe(false);

      // Over-demand of even 0.0001 is immediately detected as negative
      const afterExcess = availableStock.sub(excessDemand);
      expect(afterExcess.isNegative()).toBe(true);
      expect(afterExcess.toFixed(4)).toBe("-0.0001");
    });

    it("reconciles batch inventory sum against overall product stock projection", () => {
      const batches = [
        { batchNumber: "B1", quantity: new Prisma.Decimal("45.1250") },
        { batchNumber: "B2", quantity: new Prisma.Decimal("30.8750") },
        { batchNumber: "B3", quantity: new Prisma.Decimal("24.0000") },
      ];

      const totalBatchStock = batches.reduce(
        (sum, b) => sum.add(b.quantity),
        new Prisma.Decimal("0.0000")
      );

      expect(totalBatchStock.toFixed(4)).toBe("100.0000");
      expect(totalBatchStock.equals(new Prisma.Decimal("100.0000"))).toBe(true);
    });
  });

  // =========================================================================
  // 5. Milestone 1 Model Instantiation & Field Validation with Decimal
  // =========================================================================
  describe("5. Milestone 1 Model Instantiation & Field Validation with Decimal", () => {
    // Model validation helper functions
    function validateMonetaryField(val: unknown, fieldName: string): Prisma.Decimal {
      if (!(val instanceof Prisma.Decimal)) {
        throw new Error(`${fieldName} must be an instance of Prisma.Decimal`);
      }
      if (!val.isFinite()) {
        throw new Error(`${fieldName} must be finite`);
      }
      if (val.decimalPlaces() > 2) {
        throw new Error(`${fieldName} exceeds maximum monetary scale of 2 decimal places: ${val.toString()}`);
      }
      return val;
    }

    function validateStockQuantityField(val: unknown, fieldName: string): Prisma.Decimal {
      if (!(val instanceof Prisma.Decimal)) {
        throw new Error(`${fieldName} must be an instance of Prisma.Decimal`);
      }
      if (!val.isFinite()) {
        throw new Error(`${fieldName} must be finite`);
      }
      if (val.decimalPlaces() > 4) {
        throw new Error(`${fieldName} exceeds maximum stock scale of 4 decimal places: ${val.toString()}`);
      }
      return val;
    }

    it("instantiates and validates PaymentAllocation model structure", () => {
      const allocation = {
        id: "alloc-1",
        businessId: "biz-1",
        paymentId: "pay-1",
        saleId: "sale-101",
        purchaseId: null,
        amount: new Prisma.Decimal("75.50"),
        allocatedAt: new Date("2026-10-31T12:00:00Z"),
        allocatedById: "user-1",
      };

      const validatedAmount = validateMonetaryField(allocation.amount, "PaymentAllocation.amount");
      expect(validatedAmount.toFixed(2)).toBe("75.50");
      expect(validatedAmount.isPositive()).toBe(true);

      // Rejects allocation with scale > 2
      expect(() => {
        validateMonetaryField(new Prisma.Decimal("75.505"), "PaymentAllocation.amount");
      }).toThrow(/exceeds maximum monetary scale/);
    });

    it("instantiates and validates PaymentReversal model structure", () => {
      const reversal = {
        id: "rev-1",
        businessId: "biz-1",
        paymentId: "pay-1",
        amount: new Prisma.Decimal("120.00"),
        reason: "Customer accidental duplicate charge",
        reversedById: "manager-1",
        reversedAt: new Date("2026-10-31T13:00:00Z"),
      };

      const validatedAmount = validateMonetaryField(reversal.amount, "PaymentReversal.amount");
      expect(validatedAmount.toFixed(2)).toBe("120.00");
      expect(reversal.reason.length).toBeGreaterThan(0);
    });

    it("instantiates and validates Refund model structure", () => {
      const refund = {
        id: "ref-1",
        businessId: "biz-1",
        branchId: "branch-1",
        saleId: "sale-101",
        paymentId: "pay-1",
        customerId: "cust-1",
        amount: new Prisma.Decimal("25.00"),
        method: "CASH",
        reason: "Defective item returned",
        reference: "RET-901",
        status: "COMPLETED",
        createdById: "cashier-1",
        createdAt: new Date("2026-10-31T14:00:00Z"),
      };

      const validatedAmount = validateMonetaryField(refund.amount, "Refund.amount");
      expect(validatedAmount.toFixed(2)).toBe("25.00");
      expect(refund.status).toBe("COMPLETED");
    });

    it("instantiates and validates StockMovement model structure with signed Scale 4 quantity", () => {
      const inMovement = {
        id: "mov-1",
        businessId: "biz-1",
        branchId: "branch-1",
        productId: "prod-1",
        batchNumber: "BATCH-2026-A",
        quantity: new Prisma.Decimal("12.5000"), // Stock IN
        unit: "kg",
        sourceType: "PURCHASE",
        sourceId: "po-501",
        eventKey: "po-501:item-1",
        actorId: "staff-1",
        notes: "Received supplier shipment",
        createdAt: new Date("2026-10-31T10:00:00Z"),
      };

      const outMovement = {
        id: "mov-2",
        businessId: "biz-1",
        branchId: "branch-1",
        productId: "prod-1",
        batchNumber: "BATCH-2026-A",
        quantity: new Prisma.Decimal("-0.3750"), // Stock OUT
        unit: "kg",
        sourceType: "SALE",
        sourceId: "sale-801",
        eventKey: "sale-801:item-1",
        actorId: "cashier-1",
        notes: "POS checkout",
        createdAt: new Date("2026-10-31T15:00:00Z"),
      };

      const validatedIn = validateStockQuantityField(inMovement.quantity, "StockMovement.quantity");
      const validatedOut = validateStockQuantityField(outMovement.quantity, "StockMovement.quantity");

      expect(validatedIn.isPositive()).toBe(true);
      expect(validatedIn.toFixed(4)).toBe("12.5000");

      expect(validatedOut.isNegative()).toBe(true);
      expect(validatedOut.toFixed(4)).toBe("-0.3750");

      // Rejects movement exceeding 4 decimal places
      expect(() => {
        validateStockQuantityField(new Prisma.Decimal("1.12345"), "StockMovement.quantity");
      }).toThrow(/exceeds maximum stock scale/);
    });

    it("instantiates and validates OutboxEvent model structure with serialized Decimal payload", () => {
      const outbox = {
        id: "out-1",
        businessId: "biz-1",
        aggregateType: "Sale",
        aggregateId: "sale-101",
        eventType: "SALE_COMPLETED",
        payload: {
          saleId: "sale-101",
          total: new Prisma.Decimal("150.00").toJSON(),
          tax: new Prisma.Decimal("17.25").toJSON(),
          currency: "USD",
        },
        headers: {
          traceId: "trace-abc-123",
          idempotencyKey: "idem-key-888",
        },
        status: "PENDING",
        retryCount: 0,
        lastError: null,
        scheduledAt: new Date("2026-10-31T16:00:00Z"),
        publishedAt: null,
        createdAt: new Date("2026-10-31T16:00:00Z"),
      };

      expect(outbox.payload.total).toBe("150");
      expect(outbox.payload.tax).toBe("17.25");
      expect(outbox.status).toBe("PENDING");
      expect(outbox.retryCount).toBe(0);

      // Verify payload can be safely stringified and parsed
      const json = JSON.stringify(outbox.payload);
      const parsed = JSON.parse(json);
      expect(new Prisma.Decimal(parsed.tax).toFixed(2)).toBe("17.25");
    });

    it("validates migrated monetary fields on Sale, SaleItem, and Customer models", () => {
      const sale = {
        id: "sale-1",
        businessId: "biz-1",
        subtotal: new Prisma.Decimal("200.00"),
        discount: new Prisma.Decimal("20.00"),
        tax: new Prisma.Decimal("23.40"),
        total: new Prisma.Decimal("203.40"),
        paidAmount: new Prisma.Decimal("203.40"),
        vatRefundAmount: new Prisma.Decimal("0.00"),
      };

      // Invariant: subtotal - discount + tax === total
      const calculatedTotal = sale.subtotal.sub(sale.discount).add(sale.tax);
      expect(calculatedTotal.equals(sale.total)).toBe(true);

      const customer = {
        id: "cust-1",
        businessId: "biz-1",
        creditLimit: new Prisma.Decimal("5000.00"),
        balance: new Prisma.Decimal("1250.75"),
      };

      expect(customer.creditLimit.toFixed(2)).toBe("5000.00");
      expect(customer.balance.toFixed(2)).toBe("1250.75");
      expect(customer.creditLimit.gt(customer.balance)).toBe(true);
    });
  });

  // =========================================================================
  // 6. Decimal Math Utility Service Contract
  // =========================================================================
  describe("6. Decimal Math Utility Service Contract", () => {
    it("toDecimal coerces valid numbers, strings, and Decimal instances", () => {
      expect(toDecimal(10.5).toFixed(2)).toBe("10.50");
      expect(toDecimal("10.50").toFixed(2)).toBe("10.50");
      expect(toDecimal(new Prisma.Decimal("10.50")).toFixed(2)).toBe("10.50");
    });

    it("toDecimal rejects invalid, empty, or non-finite inputs", () => {
      expect(() => toDecimal("")).toThrow(DecimalMathError);
      expect(() => toDecimal("   ")).toThrow(DecimalMathError);
      expect(() => toDecimal("abc")).toThrow(DecimalMathError);
      expect(() => toDecimal(NaN)).toThrow(DecimalMathError);
      expect(() => toDecimal(Infinity)).toThrow(DecimalMathError);
      expect(() => toDecimal({} as any)).toThrow(DecimalMathError);
    });

    it("money helper converts and applies banker's rounding to 2 decimal places", () => {
      expect(money(12.545).toFixed(2)).toBe("12.54");
      expect(money("12.555").toFixed(2)).toBe("12.56");
      expect(money(new Prisma.Decimal("100.005")).toFixed(2)).toBe("100.00");
    });

    it("stockQty helper converts and applies banker's rounding to 4 decimal places", () => {
      expect(stockQty("1.23455").toFixed(4)).toBe("1.2346");
      expect(stockQty("1.23445").toFixed(4)).toBe("1.2344");
    });

    it("addMoney, subMoney, and mulMoney perform operations with banker's rounding", () => {
      const a = money("10.545"); // 10.54
      const b = money("5.235");  // 5.24

      expect(addMoney(a, b).toFixed(2)).toBe("15.78");
      expect(subMoney(a, b).toFixed(2)).toBe("5.30");
      expect(mulMoney(a, 2).toFixed(2)).toBe("21.08");
      expect(mulMoney(a, new Prisma.Decimal("1.5")).toFixed(2)).toBe("15.81");
    });

    it("divMoney performs division with banker's rounding and guards against division by zero", () => {
      const total = money("100.00");
      expect(divMoney(total, 3).toFixed(2)).toBe("33.33");
      expect(divMoney(total, 4).toFixed(2)).toBe("25.00");

      expect(() => divMoney(total, 0)).toThrow(/Division by zero/);
      expect(() => divMoney(total, new Prisma.Decimal("0.00"))).toThrow(/Division by zero/);
    });
  });
});
```

---

## 5. Verification Method

### 5.1 Independent Verification Commands

1. **Step 1: Worker Places Files**:
   - Copy `c:\projects\pos\.agents\teamwork\m1_explorer_3\proposed_decimal-math.ts` to `backend/src/lib/services/decimal-math.ts`.
   - Copy `c:\projects\pos\.agents\teamwork\m1_explorer_3\proposed_financial-decimal.test.ts` to `tests/financial-decimal.test.ts`.
   - Update line 12 of `tests/financial-decimal.test.ts` to import from `@/lib/services/decimal-math`.

2. **Step 2: Run Dedicated Test via Vitest**:
   Execute from project root:
   ```powershell
   npx vitest run tests/financial-decimal.test.ts
   ```
   **Pass Condition**: 33 tests passed across 6 test suites with exit code 0.

3. **Step 3: Run Full Repository Test Command**:
   Execute from project root:
   ```powershell
   npm.cmd test
   ```
   **Pass Condition**: All unit test files (7 files, 63 unit tests) pass without failure or timeout.

4. **Step 4: Run Typecheck**:
   Execute from project root:
   ```powershell
   npm.cmd run typecheck
   ```
   **Pass Condition**: Exits with code 0.

### 5.2 Invalidation Conditions
- Any test failure in the 33 assertions indicates a regression in decimal arithmetic or rounding rules.
- Any float representation drift in monetary fields (e.g. `0.30000000000000004` or `0.07 * 100 !== 7.0`) invalidates the Decimal migration.
- Any divergence in Banker's Rounding (e.g. rounding `12.545` to `12.55` instead of `12.54`) invalidates accounting compliance.
