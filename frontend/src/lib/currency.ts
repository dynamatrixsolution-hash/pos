/**
 * Frontend Currency & Decimal Handling Utility
 * Uses scaled integer (cents) math to eliminate JavaScript floating-point drift in UI calculations.
 * Accepts strings, numbers, and serialized Decimal objects safely.
 */

export type MonetaryValue = string | number | { toString(): string } | null | undefined;

/**
 * Coerces any monetary representation to an integer count of minor units (cents / paisa).
 */
export function toCents(val: MonetaryValue): number {
  if (val === null || val === undefined) return 0;
  if (typeof val === "number") {
    if (!Number.isFinite(val)) return 0;
    return Math.round(val * 100);
  }
  const str = typeof val === "string" ? val.trim() : val.toString().trim();
  if (!str) return 0;
  const num = parseFloat(str);
  if (!Number.isFinite(num)) return 0;
  return Math.round(num * 100);
}

/**
 * Converts integer cents back to a fixed 2-decimal string (e.g., 1050 -> "10.50").
 */
export function fromCents(cents: number): string {
  if (!Number.isFinite(cents)) return "0.00";
  const abs = Math.abs(cents);
  const dollars = Math.floor(abs / 100);
  const remainder = abs % 100;
  const sign = cents < 0 ? "-" : "";
  return `${sign}${dollars}.${remainder.toString().padStart(2, "0")}`;
}

/**
 * Safely parses any monetary input to a standard JavaScript float for input fields.
 */
export function parseMoney(val: MonetaryValue): number {
  return toCents(val) / 100;
}

/**
 * Formats any monetary input to standard localized currency string (e.g. "Rs. 1,250.00" or "$1,250.00").
 */
export function formatMoney(val: MonetaryValue, symbol = "Rs. "): string {
  const cents = toCents(val);
  const isNegative = cents < 0;
  const absCents = Math.abs(cents);
  const dollars = Math.floor(absCents / 100);
  const remainder = absCents % 100;

  // Add thousand separators to dollars
  const formattedDollars = dollars.toLocaleString("en-US");
  const formattedCents = remainder.toString().padStart(2, "0");

  const sign = isNegative ? "-" : "";
  return `${sign}${symbol}${formattedDollars}.${formattedCents}`;
}

/**
 * Formats any monetary input to standard Nepalese Rupee string (e.g. "Rs. 1,250.00").
 */
export function formatNPR(val: MonetaryValue): string {
  return formatMoney(val, "Rs. ");
}

/**
 * Adds two monetary amounts with zero floating-point binary drift.
 */
export function addMoney(a: MonetaryValue, b: MonetaryValue): string {
  return fromCents(toCents(a) + toCents(b));
}

/**
 * Subtracts monetary amount b from a with zero floating-point binary drift.
 */
export function subMoney(a: MonetaryValue, b: MonetaryValue): string {
  return fromCents(toCents(a) - toCents(b));
}

/**
 * Multiplies a monetary amount by a numeric factor with standard rounding.
 */
export function mulMoney(amount: MonetaryValue, factor: number): string {
  if (!Number.isFinite(factor)) return "0.00";
  const cents = toCents(amount);
  return fromCents(Math.round(cents * factor));
}

