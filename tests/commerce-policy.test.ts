import { describe, it, expect } from "vitest";
import { assertBranch, reconcilePayment } from "../backend/src/lib/commerce-policy";

const staff = { businessId: "a", branchId: "a1", userId: "u", role: "CASHIER" };
const branch = { id: "a1", businessId: "a", isActive: true, deletedAt: null };
describe("commerce authority and manual reconciliation", () => {
  it("rejects another tenant even for an owner", () => {
    expect(() => assertBranch({ ...staff, role: "OWNER" }, { ...branch, businessId: "b" })).toThrow("Branch access denied");
  });
  it("rejects unassigned and missing staff branches", () => {
    expect(() => assertBranch(staff, { ...branch, id: "a2" })).toThrow();
    expect(() => assertBranch({ ...staff, branchId: null }, branch)).toThrow();
  });
  it("rejects inactive branches and unknown roles", () => {
    expect(() => assertBranch(staff, { ...branch, isActive: false })).toThrow();
    expect(() => assertBranch({ ...staff, role: "UNKNOWN" }, branch)).toThrow();
  });
  it("derives paid status from collected money and excludes credit", () => {
    expect(reconcilePayment({ paidAmount: 40, paymentMethod: "CASH", splitPayments: [{ method: "CASH", amount: 40 }, { method: "CREDIT", amount: 60 }] }, 100, staff))
      .toEqual({ paidAmount: 40, paymentStatus: "PARTIAL", payments: [{ method: "CASH", amount: 40 }] });
  });
  it("cannot declare provider verification or reconcile inconsistent splits", () => {
    expect(() => reconcilePayment({ paidAmount: 100, paymentMethod: "CARD", paymentReference: "client-success", paymentSource: "PROVIDER_VERIFIED" }, 100, staff)).toThrow();
    expect(() => reconcilePayment({ paidAmount: 100, paymentMethod: "CASH", splitPayments: [{ method: "CASH", amount: 1 }] }, 100, staff)).toThrow();
  });
  it("requires reference for manually recorded non-cash funds", () => {
    expect(() => reconcilePayment({ paidAmount: 100, paymentMethod: "ESEWA" }, 100, staff)).toThrow();
    expect(reconcilePayment({ paidAmount: 100, paymentMethod: "CARD", paymentSource: "STAFF_RECORDED", paymentReference: "terminal-123" }, 100, staff).paymentStatus).toBe("PAID");
  });
  it("records applied cash and excludes change", () => {
    expect(reconcilePayment({ paidAmount: 120, paymentMethod: "CASH" }, 100, staff).paidAmount).toBe(100);
  });
  it("settles decimal sums without a floating point partial-payment remainder", () => {
    const result = reconcilePayment({ paidAmount: 0.3, paymentMethod: "CASH", splitPayments: [{ method: "CASH", amount: 0.1 }, { method: "CASH", amount: 0.2 }] }, 0.3, staff);
    expect(result.paidAmount).toBe(0.3);
    expect(result.paymentStatus).toBe("PAID");
  });
});
