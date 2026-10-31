import { expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ auth: vi.fn(), findUnique: vi.fn() }));
vi.mock("@/auth", () => ({ auth: mocks.auth }));
vi.mock("@/lib/db", () => ({ db: { user: { findUnique: mocks.findUnique } } }));
import { getSessionContext } from "../backend/src/lib/api-helper";
import { authConfig } from "../backend/src/auth.config";

it("ignores client role/branch updates in JWT callback", async () => {
  const token = { id: "u", role: "CASHIER", branchId: "a1" };
  const original = structuredClone(token);
  const result = await Reflect.apply(authConfig.callbacks.jwt, undefined, [{ token, trigger: "update", session: { role: "OWNER", branchId: "b1" } }]);
  expect(result).toEqual(original);
});
it("resolves current database authority instead of privileged stale claims", async () => {
  mocks.auth.mockResolvedValue({ user: { id: "u", businessId: "a", branchId: "b1", role: "OWNER" } });
  mocks.findUnique.mockResolvedValue({ id: "u", businessId: "a", branchId: "a1", role: "CASHIER", isActive: true, deletedAt: null, business: { deletedAt: null } });
  expect(await getSessionContext()).toEqual({ userId: "u", businessId: "a", branchId: "a1", role: "CASHIER" });
});
it("revokes inactive users", async () => {
  mocks.findUnique.mockResolvedValue({ id: "u", businessId: "a", isActive: false });
  expect(await getSessionContext()).toBeNull();
});
