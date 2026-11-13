/**
 * Nepali Cash Denominations and Reconciliation Engine
 * Currency: Nepalese Rupee (NPR / रु)
 */

export const NEPALI_DENOMINATIONS = [1000, 500, 100, 50, 20, 10, 5, 2, 1] as const;
export type NepaliDenomination = typeof NEPALI_DENOMINATIONS[number];

export interface DenominationRow {
  note: NepaliDenomination;
  count: number;
  amount: number;
}

export interface DenominationInput {
  note?: number;
  value?: number;
  denominationValue?: number;
  denomination_value?: number;
  denominationId?: string;
  denomination_id?: string;
  count?: number;
  quantity?: number;
  amount?: number;
  subtotal?: number;
}

export interface ValidatedDenominationResult {
  valid: boolean;
  error?: string;
  total: number;
  rows: DenominationRow[];
}

/**
 * Validates and calculates total cash sum from an input array or map of denominations.
 * Specification rules:
 * - Denomination entries cannot contain negative quantities.
 * - Only supported denominations can be selected.
 * - At least one denomination quantity must be greater than zero (when requireNonZeroTotal is true).
 * - Total = Σ (Denomination × Quantity)
 */
export function validateAndCalculateDenominations(
  input: unknown,
  options: {
    requireNonZeroTotal?: boolean;
    supportedValues?: readonly number[];
  } = {}
): ValidatedDenominationResult {
  const supported = new Set<number>(options.supportedValues ?? NEPALI_DENOMINATIONS);
  const requireNonZero = options.requireNonZeroTotal ?? true;

  if (!input || (typeof input !== "object" && !Array.isArray(input))) {
    return {
      valid: false,
      error: "Denomination breakdown is required.",
      total: 0,
      rows: [],
    };
  }

  const quantityByNote = new Map<number, number>();
  for (const val of supported) {
    quantityByNote.set(val, 0);
  }

  if (Array.isArray(input)) {
    if (input.length === 0) {
      return {
        valid: false,
        error: "At least one denomination entry is required.",
        total: 0,
        rows: [],
      };
    }

    for (const rawItem of input as DenominationInput[]) {
      if (!rawItem || typeof rawItem !== "object") {
        return {
          valid: false,
          error: "Invalid denomination entry format.",
          total: 0,
          rows: [],
        };
      }
      const rawNote =
        rawItem.note ??
        rawItem.value ??
        rawItem.denominationValue ??
        rawItem.denomination_value;
      const rawCount = rawItem.count ?? rawItem.quantity ?? 0;

      const noteNum = Number(rawNote);
      const countNum = Number(rawCount);

      if (!Number.isFinite(noteNum) || !supported.has(noteNum)) {
        return {
          valid: false,
          error: `Unsupported denomination value: ${rawNote}. Supported NPR values: ${Array.from(supported).join(", ")}.`,
          total: 0,
          rows: [],
        };
      }

      if (!Number.isFinite(countNum) || countNum < 0 || !Number.isInteger(countNum)) {
        return {
          valid: false,
          error: `Denomination quantity for NPR ${noteNum} must be a non-negative integer.`,
          total: 0,
          rows: [],
        };
      }

      quantityByNote.set(noteNum, (quantityByNote.get(noteNum) || 0) + countNum);
    }
  } else {
    const record = input as Record<string, unknown>;
    const keys = Object.keys(record);
    if (keys.length === 0) {
      return {
        valid: false,
        error: "Denomination breakdown cannot be empty.",
        total: 0,
        rows: [],
      };
    }
    for (const [k, v] of Object.entries(record)) {
      const noteNum = Number(k);
      const countNum = Number(v ?? 0);
      if (!Number.isFinite(noteNum) || !supported.has(noteNum)) {
        return {
          valid: false,
          error: `Unsupported denomination value: ${k}.`,
          total: 0,
          rows: [],
        };
      }
      if (!Number.isFinite(countNum) || countNum < 0 || !Number.isInteger(countNum)) {
        return {
          valid: false,
          error: `Denomination quantity for NPR ${noteNum} must be a non-negative integer.`,
          total: 0,
          rows: [],
        };
      }
      quantityByNote.set(noteNum, (quantityByNote.get(noteNum) || 0) + countNum);
    }
  }

  let total = 0;
  let hasPositiveQuantity = false;
  const rows: DenominationRow[] = [];

  const sortedDenominations = Array.from(supported).sort((a, b) => b - a);
  for (const note of sortedDenominations) {
    const count = quantityByNote.get(note) || 0;
    if (count > 0) hasPositiveQuantity = true;
    const amount = Number((note * count).toFixed(2));
    total = Number((total + amount).toFixed(2));
    rows.push({
      note: note as NepaliDenomination,
      count,
      amount,
    });
  }

  if (requireNonZero && (!hasPositiveQuantity || total <= 0)) {
    return {
      valid: false,
      error: "At least one denomination quantity must be greater than zero (total balance must be > 0).",
      total: 0,
      rows,
    };
  }

  return {
    valid: true,
    total,
    rows,
  };
}

/**
 * Calculates total cash sum from a map of note quantities
 * Formula: Total = Σ (Denomination × Quantity)
 */
export function calculateDenominationTotal(
  counts: Record<number, number> | DenominationRow[]
): { total: number; rows: DenominationRow[] } {
  let total = 0;
  const rows: DenominationRow[] = [];

  if (Array.isArray(counts)) {
    for (const item of counts) {
      const noteVal = Number((item as any).note ?? (item as any).denominationValue ?? (item as any).value) as NepaliDenomination;
      const count = Math.max(0, Math.floor(Number((item as any).count ?? (item as any).quantity) || 0));
      const amount = noteVal * count;
      total += amount;
      rows.push({
        note: noteVal,
        count,
        amount,
      });
    }
  } else {
    for (const note of NEPALI_DENOMINATIONS) {
      const count = Math.max(0, Math.floor(Number(counts[note]) || 0));
      const amount = note * count;
      total += amount;
      rows.push({
        note,
        count,
        amount,
      });
    }
  }

  return { total, rows };
}

/**
 * Calculates Expected Cash at drawer closing:
 * ExpectedCash = OpeningBalance + CashSales + CashIn - CashRefunds - CashOut
 * (Never clamped to 0 so negative discrepancies are never hidden)
 */
export function calculateExpectedCash(params: {
  openingBalance: number;
  cashSales: number;
  cashRefunds?: number;
  cashIn?: number;
  cashOut?: number;
}): number {
  const opening = Number(params.openingBalance) || 0;
  const sales = Number(params.cashSales) || 0;
  const refunds = Number(params.cashRefunds) || 0;
  const cIn = Number(params.cashIn) || 0;
  const cOut = Number(params.cashOut) || 0;

  return Number((opening + sales + cIn - refunds - cOut).toFixed(2));
}

/**
 * Calculates cash variance:
 * Difference = Actual Cash Counted - Expected Cash
 */
export function calculateCashDifference(
  actualCash: number,
  expectedCash: number
): {
  difference: number;
  status: "BALANCED" | "SHORTAGE" | "EXCESS";
  label: string;
} {
  const diff = Number((actualCash - expectedCash).toFixed(2));

  if (Math.abs(diff) < 0.01) {
    return {
      difference: 0,
      status: "BALANCED",
      label: "Balanced",
    };
  }

  if (diff < 0) {
    return {
      difference: diff,
      status: "SHORTAGE",
      label: `Shortage of NPR ${Math.abs(diff).toLocaleString()}`,
    };
  }

  return {
    difference: diff,
    status: "EXCESS",
    label: `Excess of NPR ${diff.toLocaleString()}`,
  };
}

/**
 * Formats currency in Nepali standard NPR notation
 */
export function formatNPR(amount: number | string | null | undefined): string {
  if (amount === null || amount === undefined || isNaN(Number(amount))) {
    return "NPR 0.00";
  }
  return `NPR ${Number(amount).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

