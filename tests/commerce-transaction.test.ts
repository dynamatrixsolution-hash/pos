import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ transaction: vi.fn(), update: vi.fn(), find: vi.fn(), create: vi.fn() }));
vi.mock("@/lib/db", () => ({ db: { $transaction: mocks.transaction } }));
import { commerceTransaction } from "../backend/src/lib/commerce-transaction";
const context = { businessId: "b", branchId: "br", userId: "u", role: "CASHIER" };
const request = (key?: string) => new Request("http://localhost", { headers: key ? { "Idempotency-Key": key } : {} });
beforeEach(() => {
  vi.resetAllMocks();
  mocks.transaction.mockImplementation(async work => work({ business: { update: mocks.update }, branch: { findUnique: async () => ({ id: "br", businessId: "b", isActive: true, deletedAt: null }) }, requestResult: { findUnique: mocks.find, create: mocks.create } }));
});
it("rejects requests without durable identity before starting a transaction", async () => {
  await expect(commerceTransaction(request(), context, "CHECKOUT", {}, vi.fn())).rejects.toMatchObject({ status: 428 });
  expect(mocks.transaction).not.toHaveBeenCalled();
});
it("replays committed results without rerunning business effects", async () => {
  const work = vi.fn().mockResolvedValue({ id: "sale" });
  const req = request("stable-request-123456");
  await commerceTransaction(req, context, "CHECKOUT", { total: 10 }, work);
  const record = mocks.create.mock.calls[0][0].data;
  mocks.find.mockResolvedValue(record);
  expect(await commerceTransaction(req, context, "CHECKOUT", { total: 10 }, work)).toEqual({ id: "sale" });
  expect(work).toHaveBeenCalledTimes(1);
  await expect(commerceTransaction(req, context, "CHECKOUT", { total: 11 }, work)).rejects.toMatchObject({ status: 409 });
});
it("does not record success if business effects fail; requests serializable rollback boundary", async () => {
  const work = vi.fn().mockRejectedValue(new Error("audit unavailable"));
  await expect(commerceTransaction(request("failure-request-123456"), context, "CHECKOUT", {}, work)).rejects.toThrow("audit unavailable");
  expect(mocks.create).not.toHaveBeenCalled();
  expect(mocks.transaction.mock.calls[0][1]).toMatchObject({ isolationLevel: "Serializable" });
});
it("retries serialization conflicts with a bounded transaction retry", async () => {
  mocks.transaction.mockRejectedValueOnce({ code: "P2034" });
  const work = vi.fn().mockResolvedValue({ id: "sale" });
  await expect(commerceTransaction(request("retry-request-123456"), context, "CHECKOUT", {}, work)).resolves.toEqual({ id: "sale" });
  expect(mocks.transaction).toHaveBeenCalledTimes(2);
  expect(work).toHaveBeenCalledTimes(1);
});
it("returns a conflict after exhausting serialization retries", async () => {
  mocks.transaction.mockRejectedValue({ code: "P2034" });
  await expect(commerceTransaction(request("bounded-retry-123456"), context, "CHECKOUT", {}, vi.fn())).rejects.toMatchObject({ status: 409 });
  expect(mocks.transaction).toHaveBeenCalledTimes(4);
});
