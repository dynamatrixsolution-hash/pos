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
      const count = Math.max(0, Math.floor(Number(item.count) || 0));
      const amount = item.note * count;
      total += amount;
      rows.push({
        note: item.note,
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

/**
 * Formats a shift timestamp into clear date, time, and combined strings.
 */
export function formatShiftDateTime(dateInput: string | Date | null | undefined): {
  date: string;
  time: string;
  full: string;
} {
  if (!dateInput) {
    return { date: "-", time: "-", full: "-" };
  }
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) {
    return { date: "-", time: "-", full: "-" };
  }
  const date = d.toLocaleDateString("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
  });
  const time = d.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });
  return { date, time, full: `${date}, ${time}` };
}

/**
 * Formats the elapsed duration between shift open and close (or now if still open).
 */
export function formatShiftDuration(
  startInput: string | Date | null | undefined,
  endInput?: string | Date | null
): string {
  if (!startInput) return "-";
  const start = new Date(startInput).getTime();
  const end = endInput ? new Date(endInput).getTime() : Date.now();
  if (isNaN(start) || isNaN(end) || end < start) return "-";

  const totalMinutes = Math.floor((end - start) / 60000);
  if (totalMinutes < 1) return "< 1m";

  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const mins = totalMinutes % 60;

  if (days > 0) {
    return `${days}d ${hours}h ${mins}m`;
  }
  if (hours > 0) {
    return `${hours}h ${mins}m`;
  }
  return `${mins}m`;
}

