export class CommerceError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}

export interface CommerceContext {
  userId: string;
  businessId: string;
  branchId: string | null;
  role: string;
}

export function requireStaff(context: CommerceContext, managerOnly = false) {
  const roles = managerOnly ? ["OWNER", "MANAGER", "SUPER_ADMIN"] : ["OWNER", "MANAGER", "CASHIER", "SUPER_ADMIN"];
  if (!roles.includes(context.role)) throw new CommerceError("Forbidden", 403);
}

export function assertBranch(context: CommerceContext, branch: { id: string; businessId: string; isActive: boolean; deletedAt: Date | null } | null) {
  requireStaff(context);
  if (!branch || branch.businessId !== context.businessId || !branch.isActive || branch.deletedAt) {
    throw new CommerceError("Branch access denied", 403);
  }
  if (!["OWNER", "SUPER_ADMIN"].includes(context.role) && context.branchId !== branch.id) {
    throw new CommerceError("Branch access denied", 403);
  }
  return branch.id;
}

export function settlementStatus(total: number, paid: number) {
  return paid >= total ? "PAID" : paid > 0 ? "PARTIAL" : "UNPAID";
}

// Existing retail currencies use two fractional digits. Decimal schema migration is still pending.
export function money(value: number) {
  if (!Number.isFinite(value) || !Number.isSafeInteger(Math.round(value * 100))) throw new CommerceError("Amount exceeds supported precision");
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/** Manual staff declarations are never provider verification. No provider adapter exists yet. */
export function reconcilePayment(input: {
  paidAmount: number; paymentMethod: string; paymentSource?: string;
  paymentReference?: string | null; splitPayments?: { method: string; amount: number }[];
}, total: number, context: CommerceContext) {
  requireStaff(context);
  if (!Number.isFinite(total) || total < 0) throw new CommerceError("Invalid total");
  if (input.paymentSource && input.paymentSource !== "STAFF_RECORDED") {
    throw new CommerceError("Provider verification cannot be supplied by a client", 403);
  }
  total = money(total);
  const tenders = input.splitPayments?.length ? input.splitPayments : [{ method: input.paymentMethod, amount: input.paidAmount }];
  if (tenders.some(p => !Number.isFinite(p.amount) || p.amount < 0)) throw new CommerceError("Invalid payment amount");
  if (tenders.some(p => Math.abs(p.amount - money(p.amount)) > 0.00000001)) throw new CommerceError("Payment amounts support at most two decimal places");
  const collected = tenders.filter(p => p.method !== "CREDIT");
  if (collected.some(p => p.method !== "CASH" && p.amount > 0) && !input.paymentReference?.trim()) {
    throw new CommerceError("A staff-recorded non-cash payment requires a reference");
  }
  const paid = money(collected.reduce((sum, p) => sum + money(p.amount), 0));
  if (input.splitPayments?.length && Math.abs(paid - input.paidAmount) > 0.005) {
    throw new CommerceError("Split collections do not match paidAmount");
  }
  // Cash tender may exceed the invoice: only applied funds are recorded, change is not revenue.
  if (paid > total + 0.005 && collected.some(p => p.method !== "CASH")) throw new CommerceError("Non-cash overpayment is not supported");
  let remaining = total;
  const payments = collected.map(p => {
    const amount = money(Math.min(money(p.amount), remaining));
    remaining = money(remaining - amount);
    return { method: p.method, amount };
  }).filter(p => p.amount > 0);
  const paidAmount = money(payments.reduce((sum, p) => sum + p.amount, 0));
  return { paidAmount, paymentStatus: settlementStatus(total, paidAmount), payments };
}
