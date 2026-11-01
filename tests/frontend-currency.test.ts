import { describe, it, expect } from "vitest";
import {
  toCents,
  fromCents,
  parseMoney,
  formatMoney,
  addMoney,
  subMoney,
  mulMoney,
} from "../frontend/src/lib/currency";

describe("Frontend Currency Library: Minor-Unit Arithmetic & Safe Decimal Formatting", () => {
  describe("toCents & fromCents", () => {
    it("converts number, string, and null/undefined values to exact integer cents", () => {
      expect(toCents(12.34)).toBe(1234);
      expect(toCents("12.34")).toBe(1234);
      expect(toCents("0.10")).toBe(10);
      expect(toCents("0.01")).toBe(1);
      expect(toCents(0)).toBe(0);
      expect(toCents(null)).toBe(0);
      expect(toCents(undefined)).toBe(0);
      expect(toCents("")).toBe(0);
      expect(toCents("-15.50")).toBe(-1550);
    });

    it("formats cents back to exact 2-decimal string representation", () => {
      expect(fromCents(1234)).toBe("12.34");
      expect(fromCents(10)).toBe("0.10");
      expect(fromCents(1)).toBe("0.01");
      expect(fromCents(0)).toBe("0.00");
      expect(fromCents(-1550)).toBe("-15.50");
    });
  });

  describe("formatMoney", () => {
    it("safely formats numbers, decimal strings, and negative amounts with localized separators", () => {
      expect(formatMoney(1250.5)).toBe("Rs. 1,250.50");
      expect(formatMoney("1250.50")).toBe("Rs. 1,250.50");
      expect(formatMoney(0)).toBe("Rs. 0.00");
      expect(formatMoney(null)).toBe("Rs. 0.00");
      expect(formatMoney(undefined)).toBe("Rs. 0.00");
      expect(formatMoney(-500.25)).toBe("-Rs. 500.25");
      expect(formatMoney("9999999.99", "$")).toBe("$9,999,999.99");
    });
  });

  describe("addMoney, subMoney, mulMoney", () => {
    it("eliminates IEEE 754 floating drift (e.g. 0.1 + 0.2 === 0.30)", () => {
      expect(addMoney("0.10", "0.20")).toBe("0.30");
      expect(addMoney(0.1, 0.2)).toBe("0.30");
      expect(subMoney("1.00", "0.90")).toBe("0.10");
      expect(mulMoney("0.07", 100)).toBe("7.00");
      expect(mulMoney("12.50", 3)).toBe("37.50");
    });
  });
});

