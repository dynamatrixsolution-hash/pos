import { beforeEach, afterEach, expect, it, vi } from "vitest";
import { postCommerce } from "../frontend/src/lib/idempotent-request";
const requests: RequestInit[] = [];
beforeEach(() => {
  const values = new Map<string, string>();
  vi.stubGlobal("localStorage", { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value), removeItem: (key: string) => values.delete(key) });
  requests.length = 0;
});
afterEach(() => vi.unstubAllGlobals());
const key = (index: number) => (requests[index].headers as Record<string, string>)["Idempotency-Key"];
it("retains identity after a lost response, then releases it after confirmed success", async () => {
  vi.stubGlobal("fetch", vi.fn(async (_url, init) => {
    requests.push(init);
    if (requests.length === 1) throw new Error("connection lost after commit");
    return Response.json({ id: "sale" }, { status: 201 });
  }));
  await expect(postCommerce("/api/v1/sales", { total: 100 }, "cashier-a")).rejects.toThrow();
  await postCommerce("/api/v1/sales", { total: 100 }, "cashier-a");
  expect(key(0)).toBe(key(1));
  await postCommerce("/api/v1/sales", { total: 100 }, "cashier-a");
  expect(key(2)).not.toBe(key(0));
});
it("isolates actors and refuses edited payloads while a prior outcome is unresolved", async () => {
  vi.stubGlobal("fetch", vi.fn(async (_url, init) => { requests.push(init); return Response.json({ error: "retry" }, { status: 409 }); }));
  await postCommerce("/api/v1/sales", { total: 100 }, "cashier-a");
  await postCommerce("/api/v1/sales", { total: 100 }, "cashier-b");
  await expect(postCommerce("/api/v1/sales", { total: 101 }, "cashier-a")).rejects.toThrow("unresolved");
  expect(new Set(requests.map((_, i) => key(i))).size).toBe(2);
});
it("retains identity when response JSON is truncated", async () => {
  vi.stubGlobal("fetch", vi.fn(async (_url, init) => { requests.push(init); return new Response("{", { status: 201 }); }));
  await expect(postCommerce("/api/v1/sales", {}, "cashier-a")).rejects.toThrow();
  await expect(postCommerce("/api/v1/sales", {}, "cashier-a")).rejects.toThrow();
  expect(key(0)).toBe(key(1));
});
it("allows corrected validation errors as a new intentional attempt", async () => {
  vi.stubGlobal("fetch", vi.fn(async (_url, init) => { requests.push(init); return Response.json({ error: "invalid" }, { status: 400 }); }));
  await postCommerce("/api/v1/sales", { total: -1 }, "cashier-a");
  await postCommerce("/api/v1/sales", { total: 100 }, "cashier-a");
  expect(key(0)).not.toBe(key(1));
});
