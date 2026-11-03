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
export function toDecimal(val: number | string | Prisma.Decimal | any): Prisma.Decimal {
  if (val === null || val === undefined) {
    throw new DecimalMathError("Decimal value cannot be null or undefined");
  }
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
  if (typeof val === "object") {
    if (typeof val.toString === "function") {
      try {
        const d = new Prisma.Decimal(val.toString());
        if (!d.isFinite()) throw new DecimalMathError("Decimal object must be finite");
        return d;
      } catch {
        throw new DecimalMathError(`Invalid decimal representation: ${val}`);
      }
    }
  }
  throw new DecimalMathError(`Unsupported decimal conversion type: ${typeof val}`);
}

/**
 * Exact banker's rounding (round to nearest even).
 * Uses Prisma.Decimal.ROUND_HALF_EVEN (mode 6).
 */
export function roundHalfEven(val: Prisma.Decimal | any, scale = 2): Prisma.Decimal {
  const dec = val instanceof Prisma.Decimal ? val : toDecimal(val);
  if (!dec.isFinite()) throw new DecimalMathError("Cannot round non-finite decimal");
  if (!Number.isInteger(scale) || scale < 0 || scale > 10) {
    throw new DecimalMathError(`Scale must be an integer between 0 and 10: ${scale}`);
  }
  return dec.toDecimalPlaces(scale, Prisma.Decimal.ROUND_HALF_EVEN);
}

/**
 * Standard monetary conversion: coerces to Decimal and applies banker's rounding to 2 decimal places.
 */
export function money(val: number | string | Prisma.Decimal | any): Prisma.Decimal {
  return roundHalfEven(toDecimal(val), 2);
}

/**
 * Standard inventory stock quantity conversion: coerces to Decimal and rounds to 4 decimal places.
 */
export function stockQty(val: number | string | Prisma.Decimal | any): Prisma.Decimal {
  return roundHalfEven(toDecimal(val), 4);
}

/**
 * Adds two monetary amounts, returning an exact 2-decimal banker's rounded amount.
 */
export function addMoney(a: Prisma.Decimal | any, b: Prisma.Decimal | any): Prisma.Decimal {
  const decA = a instanceof Prisma.Decimal ? a : toDecimal(a);
  const decB = b instanceof Prisma.Decimal ? b : toDecimal(b);
  return roundHalfEven(decA.add(decB), 2);
}

/**
 * Subtracts monetary amount b from a, returning an exact 2-decimal banker's rounded amount.
 */
export function subMoney(a: Prisma.Decimal | any, b: Prisma.Decimal | any): Prisma.Decimal {
  const decA = a instanceof Prisma.Decimal ? a : toDecimal(a);
  const decB = b instanceof Prisma.Decimal ? b : toDecimal(b);
  return roundHalfEven(decA.sub(decB), 2);
}

/**
 * Multiplies a monetary amount by a factor (number or Decimal), returning an exact 2-decimal banker's rounded amount.
 */
export function mulMoney(amount: Prisma.Decimal | any, factor: number | Prisma.Decimal | any): Prisma.Decimal {
  const decAmount = amount instanceof Prisma.Decimal ? amount : toDecimal(amount);
  const f = factor instanceof Prisma.Decimal ? factor : toDecimal(factor);
  return roundHalfEven(decAmount.mul(f), 2);
}

/**
 * Divides a monetary amount by a divisor, returning an exact 2-decimal banker's rounded amount.
 */
export function divMoney(amount: Prisma.Decimal | any, divisor: number | Prisma.Decimal | any): Prisma.Decimal {
  const decAmount = amount instanceof Prisma.Decimal ? amount : toDecimal(amount);
  const d = divisor instanceof Prisma.Decimal ? divisor : toDecimal(divisor);
  if (d.isZero()) throw new DecimalMathError("Division by zero");
  return roundHalfEven(decAmount.div(d), 2);
}
