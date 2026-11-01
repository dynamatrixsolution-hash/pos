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

describe("Challenger Adversarial Stress Harness: Decimal Math & Rounding", () => {
  // =========================================================================
  // 1. Empirical Verification: IEEE 754 Floating Point Drift Elimination
  // =========================================================================
  describe("1. IEEE 754 Floating-Point Drift Elimination", () => {
    it("empirically demonstrates native JS float drift vs Decimal precision on classic cases", () => {
      // 0.1 + 0.2
      const jsAdd1 = 0.1 + 0.2;
      expect(jsAdd1 === 0.3).toBe(false);
      expect(jsAdd1).toBe(0.30000000000000004);

      const decAdd1 = addMoney(toDecimal("0.1"), toDecimal("0.2"));
      expect(decAdd1.toFixed(2)).toBe("0.30");
      expect(decAdd1.toString()).toBe("0.3");
      expect(decAdd1.equals(new Prisma.Decimal("0.30"))).toBe(true);

      // 0.1 + 0.7
      const jsAdd2 = 0.1 + 0.7;
      expect(jsAdd2 === 0.8).toBe(false);
      expect(jsAdd2).toBe(0.7999999999999999);

      const decAdd2 = addMoney(toDecimal("0.1"), toDecimal("0.7"));
      expect(decAdd2.toFixed(2)).toBe("0.80");

      // 0.2 + 0.4
      const jsAdd3 = 0.2 + 0.4;
      expect(jsAdd3 === 0.6).toBe(false);
      expect(jsAdd3).toBe(0.6000000000000001);

      const decAdd3 = addMoney(toDecimal("0.2"), toDecimal("0.4"));
      expect(decAdd3.toFixed(2)).toBe("0.60");

      // 1.0 - 0.9
      const jsSub = 1.0 - 0.9;
      expect(jsSub === 0.1).toBe(false);
      expect(jsSub).toBe(0.09999999999999998);

      const decSub = subMoney(toDecimal("1.0"), toDecimal("0.9"));
      expect(decSub.toFixed(2)).toBe("0.10");

      // 0.07 * 100
      const jsMul = 0.07 * 100;
      expect(jsMul === 7.0).toBe(false);
      expect(jsMul).toBe(7.000000000000001);

      const decMul = mulMoney(toDecimal("0.07"), 100);
      expect(decMul.toFixed(2)).toBe("7.00");
    });

    it("survives high-volume stress accumulation (10,000 penny increments) with 0 drift", () => {
      let decAccumulator = new Prisma.Decimal("0.00");
      let floatAccumulator = 0;
      const pennyDec = new Prisma.Decimal("0.01");

      for (let i = 0; i < 10000; i++) {
        decAccumulator = decAccumulator.add(pennyDec);
        floatAccumulator += 0.01;
      }

      // Native float accumulates massive drift
      expect(floatAccumulator === 100.0).toBe(false);
      // Decimal accumulator remains mathematically exact: 100.00
      expect(decAccumulator.toFixed(2)).toBe("100.00");
      expect(decAccumulator.equals(new Prisma.Decimal("100.00"))).toBe(true);
    });

    it("verifies financial split payments zero-remainder balance invariant", () => {
      const bill = money("250.00");
      const splits = [
        money("83.33"),
        money("83.33"),
        money("83.34"),
      ];

      const sum = splits.reduce((acc, p) => addMoney(acc, p), money("0.00"));
      expect(sum.equals(bill)).toBe(true);
      expect(subMoney(bill, sum).isZero()).toBe(true);
      expect(subMoney(bill, sum).toFixed(2)).toBe("0.00");
    });
  });

  // =========================================================================
  // 2. Empirical Verification: Standardized Banker's Rounding (ROUND_HALF_EVEN)
  // =========================================================================
  describe("2. Banker's Rounding (Half-Even) Matrix Stress Tests", () => {
    it("verifies Scale 0 half-way rounding on integers (0.5 to 9.5)", () => {
      const halfWayScale0: [string, string][] = [
        ["0.5", "0"],   // 0 is even
        ["1.5", "2"],   // 1 is odd -> 2
        ["2.5", "2"],   // 2 is even
        ["3.5", "4"],   // 3 is odd -> 4
        ["4.5", "4"],   // 4 is even
        ["5.5", "6"],   // 5 is odd -> 6
        ["6.5", "6"],   // 6 is even
        ["7.5", "8"],   // 7 is odd -> 8
        ["8.5", "8"],   // 8 is even
        ["9.5", "10"],  // 9 is odd -> 10
      ];

      for (const [input, expected] of halfWayScale0) {
        const res = roundHalfEven(new Prisma.Decimal(input), 0);
        expect(res.toString()).toBe(expected);
      }
    });

    it("verifies Scale 0 symmetric negative half-way rounding (-0.5 to -9.5)", () => {
      const halfWayNegScale0: [string, string][] = [
        ["-0.5", "0"],   // rounds to 0
        ["-1.5", "-2"],
        ["-2.5", "-2"],
        ["-3.5", "-4"],
        ["-4.5", "-4"],
        ["-5.5", "-6"],
        ["-6.5", "-6"],
        ["-7.5", "-8"],
        ["-8.5", "-8"],
        ["-9.5", "-10"],
      ];

      for (const [input, expected] of halfWayNegScale0) {
        const res = roundHalfEven(new Prisma.Decimal(input), 0);
        expect(res.toString()).toBe(expected);
      }
    });

    it("verifies Scale 2 half-way rounding across all precursor digits (0 to 9)", () => {
      const testCases: [string, string][] = [
        ["12.305", "12.30"], // predecessor 0 (even) -> 12.30
        ["12.315", "12.32"], // predecessor 1 (odd)  -> 12.32
        ["12.325", "12.32"], // predecessor 2 (even) -> 12.32
        ["12.335", "12.34"], // predecessor 3 (odd)  -> 12.34
        ["12.345", "12.34"], // predecessor 4 (even) -> 12.34 (Task spec example)
        ["12.355", "12.36"], // predecessor 5 (odd)  -> 12.36 (Task spec example)
        ["12.365", "12.36"], // predecessor 6 (even) -> 12.36
        ["12.375", "12.38"], // predecessor 7 (odd)  -> 12.38
        ["12.385", "12.38"], // predecessor 8 (even) -> 12.38
        ["12.395", "12.40"], // predecessor 9 (odd)  -> 12.40
      ];

      for (const [input, expected] of testCases) {
        const res = money(input);
        expect(res.toFixed(2)).toBe(expected);
      }
    });

    it("verifies Scale 2 negative half-way rounding across precursor digits", () => {
      const testCases: [string, string][] = [
        ["-12.305", "-12.30"],
        ["-12.315", "-12.32"],
        ["-12.325", "-12.32"],
        ["-12.335", "-12.34"],
        ["-12.345", "-12.34"],
        ["-12.355", "-12.36"],
        ["-12.365", "-12.36"],
        ["-12.375", "-12.38"],
        ["-12.385", "-12.38"],
        ["-12.395", "-12.40"],
      ];

      for (const [input, expected] of testCases) {
        const res = money(input);
        expect(res.toFixed(2)).toBe(expected);
      }
    });

    it("verifies non-half-way proximity rounding (nearest neighbor rule, not even)", () => {
      // For values strictly greater than half-way: always rounds up
      expect(money("12.345000000001").toFixed(2)).toBe("12.35");
      expect(money("12.3451").toFixed(2)).toBe("12.35");
      expect(money("12.355000000001").toFixed(2)).toBe("12.36");

      // For values strictly less than half-way: always rounds down
      expect(money("12.344999999999").toFixed(2)).toBe("12.34");
      expect(money("12.3449").toFixed(2)).toBe("12.34");
      expect(money("12.354999999999").toFixed(2)).toBe("12.35");
      expect(money("12.3549").toFixed(2)).toBe("12.35");
    });

    it("verifies Scale 4 half-way rounding for stock quantities", () => {
      expect(stockQty("1.23455").toFixed(4)).toBe("1.2346"); // 5 is odd -> 6
      expect(stockQty("1.23445").toFixed(4)).toBe("1.2344"); // 4 is even -> 4
      expect(stockQty("-1.23455").toFixed(4)).toBe("-1.2346");
      expect(stockQty("-1.23445").toFixed(4)).toBe("-1.2344");
      expect(stockQty("0.00005").toFixed(4)).toBe("0.0000");
      expect(stockQty("0.00015").toFixed(4)).toBe("0.0002");
    });
  });

  // =========================================================================
  // 3. Empirical Verification: Division by Zero & Non-Finite Number Rejection
  // =========================================================================
  describe("3. Division by Zero Protection & Non-Finite Number Rejection", () => {
    it("rejects division by numeric zero, string zero, and Decimal zero", () => {
      const amount = money("100.00");

      expect(() => divMoney(amount, 0)).toThrow(DecimalMathError);
      expect(() => divMoney(amount, 0)).toThrow(/Division by zero/);

      expect(() => divMoney(amount, -0)).toThrow(DecimalMathError);
      expect(() => divMoney(amount, -0)).toThrow(/Division by zero/);

      expect(() => divMoney(amount, "0")).toThrow(DecimalMathError);
      expect(() => divMoney(amount, "0.00")).toThrow(DecimalMathError);

      expect(() => divMoney(amount, new Prisma.Decimal("0"))).toThrow(DecimalMathError);
      expect(() => divMoney(amount, new Prisma.Decimal("0.0000"))).toThrow(DecimalMathError);
    });

    it("rejects non-finite JavaScript numbers (NaN, +Infinity, -Infinity)", () => {
      expect(() => toDecimal(NaN)).toThrow(DecimalMathError);
      expect(() => toDecimal(NaN)).toThrow(/Numeric value must be finite/);

      expect(() => toDecimal(Infinity)).toThrow(DecimalMathError);
      expect(() => toDecimal(Infinity)).toThrow(/Numeric value must be finite/);

      expect(() => toDecimal(-Infinity)).toThrow(DecimalMathError);
      expect(() => toDecimal(-Infinity)).toThrow(/Numeric value must be finite/);
    });

    it("rejects invalid, whitespace-only, or non-finite string inputs", () => {
      expect(() => toDecimal("")).toThrow(DecimalMathError);
      expect(() => toDecimal("   ")).toThrow(DecimalMathError);
      expect(() => toDecimal("\t\n")).toThrow(DecimalMathError);
      expect(() => toDecimal("abc")).toThrow(DecimalMathError);
      expect(() => toDecimal("12.34.56")).toThrow(DecimalMathError);
      expect(() => toDecimal("$100")).toThrow(DecimalMathError);
      expect(() => toDecimal("NaN")).toThrow(DecimalMathError);
      expect(() => toDecimal("Infinity")).toThrow(DecimalMathError);
      expect(() => toDecimal("-Infinity")).toThrow(DecimalMathError);
    });

    it("rejects unsupported types (null, undefined, boolean, object, array)", () => {
      expect(() => toDecimal(null as any)).toThrow(DecimalMathError);
      expect(() => toDecimal(undefined as any)).toThrow(DecimalMathError);
      expect(() => toDecimal(true as any)).toThrow(DecimalMathError);
      expect(() => toDecimal({} as any)).toThrow(DecimalMathError);
      expect(() => toDecimal([] as any)).toThrow(DecimalMathError);
    });

    it("validates scale bounds in roundHalfEven (0 <= scale <= 10, integer only)", () => {
      const d = new Prisma.Decimal("10.5");
      expect(() => roundHalfEven(d, -1)).toThrow(DecimalMathError);
      expect(() => roundHalfEven(d, 11)).toThrow(DecimalMathError);
      expect(() => roundHalfEven(d, 1.5)).toThrow(DecimalMathError);
      expect(() => roundHalfEven(d, NaN)).toThrow(DecimalMathError);
    });
  });

  // =========================================================================
  // 4. Empirical Verification: Negative Values & Arithmetic Invariants
  // =========================================================================
  describe("4. Negative Values & Arithmetic Invariants", () => {
    it("handles signed monetary arithmetic with full precision", () => {
      const posA = money("100.50");
      const posB = money("25.25");
      const negA = money("-100.50");
      const negB = money("-25.25");

      // Addition
      expect(addMoney(negA, negB).toFixed(2)).toBe("-125.75");
      expect(addMoney(negA, posB).toFixed(2)).toBe("-75.25");
      expect(addMoney(posA, negB).toFixed(2)).toBe("75.25");

      // Subtraction
      expect(subMoney(negA, posB).toFixed(2)).toBe("-125.75");
      expect(subMoney(posA, negB).toFixed(2)).toBe("125.75");
      expect(subMoney(negA, negB).toFixed(2)).toBe("-75.25");

      // Multiplication
      expect(mulMoney(negA, 2).toFixed(2)).toBe("-201.00");
      expect(mulMoney(posA, -2).toFixed(2)).toBe("-201.00");
      expect(mulMoney(negA, -2).toFixed(2)).toBe("201.00");

      // Division
      expect(divMoney(negA, 2).toFixed(2)).toBe("-50.25");
      expect(divMoney(posA, -2).toFixed(2)).toBe("-50.25");
      expect(divMoney(negA, -2).toFixed(2)).toBe("50.25");
    });

    it("confirms arithmetic laws: commutativity and associativity on money operations", () => {
      const a = money("49.99");
      const b = money("12.50");
      const c = money("3.45");

      // Commutativity: a + b === b + a
      expect(addMoney(a, b).equals(addMoney(b, a))).toBe(true);

      // Associativity: (a + b) + c === a + (b + c)
      const ab_c = addMoney(addMoney(a, b), c);
      const a_bc = addMoney(a, addMoney(b, c));
      expect(ab_c.equals(a_bc)).toBe(true);

      // Identity: a + 0 === a
      expect(addMoney(a, money("0")).equals(a)).toBe(true);
      expect(subMoney(a, money("0")).equals(a)).toBe(true);
      expect(subMoney(a, a).isZero()).toBe(true);
    });
  });

  // =========================================================================
  // 5. Empirical Verification: Database Scale Conformance (Decimal 12,2)
  // =========================================================================
  describe("5. PostgreSQL Decimal(12,2) Maximum Range Conformance", () => {
    it("handles maximum 12-digit monetary amounts (up to 9,999,999,999.99)", () => {
      const maxDbValue = money("9999999999.99");
      expect(maxDbValue.toFixed(2)).toBe("9999999999.99");

      // Subtraction from max
      const sub = subMoney(maxDbValue, money("1000000000.00"));
      expect(sub.toFixed(2)).toBe("8999999999.99");

      // Exact multiplication with fractional factor
      const half = mulMoney(maxDbValue, new Prisma.Decimal("0.5"));
      // 9999999999.99 * 0.5 = 4999999999.995 -> 4999999999.00 or 5000000000.00?
      // Predecessor is 9 (odd) -> rounds up to 5000000000.00
      expect(half.toFixed(2)).toBe("5000000000.00");
    });

    it("parses strings with valid leading/trailing whitespace correctly", () => {
      expect(toDecimal("  123.45 \n").toFixed(2)).toBe("123.45");
      expect(money("\t -99.90 \r\n").toFixed(2)).toBe("-99.90");
    });
  });
});
