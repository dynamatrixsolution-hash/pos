import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  transaction: vi.fn(),
  findUnique: vi.fn(),
  create: vi.fn(),
  dbFindUnique: vi.fn(),
}));

vi.mock("@/auth", () => ({ auth: async () => null }));
vi.mock("next/server", () => ({
  NextResponse: {
    json: (body: unknown, init?: { status?: number }) =>
      new Response(JSON.stringify(body), {
        status: init?.status ?? 200,
        headers: { "content-type": "application/json" },
      }),
  },
}));
vi.mock("@/lib/db", () => ({
  db: {
    $transaction: mocks.transaction,
    requestResult: {
      findUnique: mocks.dbFindUnique,
    },
  },
}));

import { requireRoles, ROLE_GROUPS, normalizeRole } from "../backend/src/lib/api-helper";
import { safeErrorMessage } from "../backend/src/lib/security";
import { runWithOptionalIdempotency } from "../backend/src/lib/commerce-transaction";

describe("Backend Security: RBAC, Error Sanitization & Optional Idempotency", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.transaction.mockImplementation(async (work) =>
      work({
        requestResult: {
          findUnique: mocks.findUnique,
          create: mocks.create,
        },
      })
    );
  });

  describe("normalizeRole & requireRoles", () => {
    it("normalizes casing and maps legacy ADMIN to OWNER", () => {
      expect(normalizeRole("admin")).toBe("OWNER");
      expect(normalizeRole("  Manager ")).toBe("MANAGER");
      expect(normalizeRole(null)).toBe("");
    });

    it("restricts KITCHEN strictly to KITCHEN_OPERATIONS", () => {
      expect(requireRoles({ role: "KITCHEN" }, ROLE_GROUPS.KITCHEN_OPERATIONS)).toBeNull();
      expect(requireRoles({ role: "KITCHEN" }, ROLE_GROUPS.RESTAURANT_SERVICE)?.status).toBe(403);
      expect(requireRoles({ role: "KITCHEN" }, ROLE_GROUPS.RESTAURANT_BILLING)?.status).toBe(403);
      expect(requireRoles({ role: "KITCHEN" }, ROLE_GROUPS.ADMIN_MANAGER)?.status).toBe(403);
      expect(requireRoles({ role: "KITCHEN" }, ROLE_GROUPS.HOTEL_FRONT_DESK)?.status).toBe(403);
      expect(requireRoles({ role: "KITCHEN" }, ROLE_GROUPS.SHIFT_OPERATORS)?.status).toBe(403);
      expect(requireRoles({ role: "KITCHEN" }, ROLE_GROUPS.OWNER_ONLY)?.status).toBe(403);
    });

    it("allows WAITER on service/desk routes but blocks billing, hotel front desk, shifts, and admin", () => {
      expect(requireRoles({ role: "WAITER" }, ROLE_GROUPS.RESTAURANT_SERVICE)).toBeNull();
      expect(requireRoles({ role: "WAITER" }, ROLE_GROUPS.HOTEL_SERVICE_DESK)).toBeNull();
      expect(requireRoles({ role: "WAITER" }, ROLE_GROUPS.RESTAURANT_BILLING)?.status).toBe(403);
      expect(requireRoles({ role: "WAITER" }, ROLE_GROUPS.ADMIN_MANAGER)?.status).toBe(403);
      expect(requireRoles({ role: "WAITER" }, ROLE_GROUPS.HOTEL_FRONT_DESK)?.status).toBe(403);
      expect(requireRoles({ role: "WAITER" }, ROLE_GROUPS.SHIFT_OPERATORS)?.status).toBe(403);
      expect(requireRoles({ role: "WAITER" }, ROLE_GROUPS.OWNER_ONLY)?.status).toBe(403);
    });

    it("restricts HOUSEKEEPING to housekeeping and service desk only", () => {
      expect(requireRoles({ role: "HOUSEKEEPING" }, ROLE_GROUPS.HOTEL_HOUSEKEEPING)).toBeNull();
      expect(requireRoles({ role: "HOUSEKEEPING" }, ROLE_GROUPS.HOTEL_SERVICE_DESK)).toBeNull();
      expect(requireRoles({ role: "HOUSEKEEPING" }, ROLE_GROUPS.HOTEL_FRONT_DESK)?.status).toBe(403);
      expect(requireRoles({ role: "HOUSEKEEPING" }, ROLE_GROUPS.RESTAURANT_SERVICE)?.status).toBe(403);
      expect(requireRoles({ role: "HOUSEKEEPING" }, ROLE_GROUPS.ADMIN_MANAGER)?.status).toBe(403);
    });

    it("allows FRONT_DESK on hotel front-desk & shifts, and blocks admin/owner/restaurant billing", () => {
      expect(requireRoles({ role: "FRONT_DESK" }, ROLE_GROUPS.HOTEL_FRONT_DESK)).toBeNull();
      expect(requireRoles({ role: "FRONT_DESK" }, ROLE_GROUPS.SHIFT_OPERATORS)).toBeNull();
      expect(requireRoles({ role: "FRONT_DESK" }, ROLE_GROUPS.ADMIN_MANAGER)?.status).toBe(403);
      expect(requireRoles({ role: "FRONT_DESK" }, ROLE_GROUPS.OWNER_ONLY)?.status).toBe(403);
      expect(requireRoles({ role: "FRONT_DESK" }, ROLE_GROUPS.RESTAURANT_BILLING)?.status).toBe(403);
    });

    it("allows CASHIER on billing/service/front-desk/shifts but blocks ADMIN_MANAGER and OWNER_ONLY", () => {
      expect(requireRoles({ role: "CASHIER" }, ROLE_GROUPS.RESTAURANT_BILLING)).toBeNull();
      expect(requireRoles({ role: "CASHIER" }, ROLE_GROUPS.RESTAURANT_SERVICE)).toBeNull();
      expect(requireRoles({ role: "CASHIER" }, ROLE_GROUPS.HOTEL_FRONT_DESK)).toBeNull();
      expect(requireRoles({ role: "CASHIER" }, ROLE_GROUPS.SHIFT_OPERATORS)).toBeNull();
      expect(requireRoles({ role: "CASHIER" }, ROLE_GROUPS.ADMIN_MANAGER)?.status).toBe(403);
      expect(requireRoles({ role: "CASHIER" }, ROLE_GROUPS.OWNER_ONLY)?.status).toBe(403);
    });

    it("treats legacy ADMIN identically to OWNER while blocking SUPER_ADMIN_ONLY", () => {
      expect(requireRoles({ role: "OWNER" }, ROLE_GROUPS.OWNER_ONLY)).toBeNull();
      expect(requireRoles({ role: "ADMIN" }, ROLE_GROUPS.OWNER_ONLY)).toBeNull();
      expect(requireRoles({ role: "ADMIN" }, ROLE_GROUPS.ADMIN_MANAGER)).toBeNull();
      expect(requireRoles({ role: "OWNER" }, ROLE_GROUPS.SUPER_ADMIN_ONLY)?.status).toBe(403);
      expect(requireRoles({ role: "ADMIN" }, ROLE_GROUPS.SUPER_ADMIN_ONLY)?.status).toBe(403);
      expect(requireRoles({ role: "SUPER_ADMIN" }, ROLE_GROUPS.SUPER_ADMIN_ONLY)).toBeNull();
    });
  });

  describe("safeErrorMessage", () => {
    it("formats known Prisma constraint errors safely", () => {
      expect(safeErrorMessage({ code: "P2002", meta: { target: ["email"] } }, "Fallback")).toContain("already exists");
      expect(safeErrorMessage({ code: "P2003" }, "Fallback")).toContain("related records");
      expect(safeErrorMessage({ code: "P2025" }, "Fallback")).toContain("could not be found");
    });

    it("masks unknown Prisma codes, SQL, runtime exceptions, and stack traces", () => {
      expect(safeErrorMessage({ code: "P2021", message: "The table `public.Foo` does not exist" }, "Safe fallback")).toBe("Safe fallback");
      expect(safeErrorMessage(new Error("SELECT * FROM users WHERE id = 1"), "Safe fallback")).toBe("Safe fallback");
      expect(safeErrorMessage(new Error("Invalid `prisma.user.findUnique()` invocation"), "Safe fallback")).toBe("Safe fallback");
      expect(safeErrorMessage(new Error("TypeError: Cannot read properties of undefined (reading 'id')"), "Safe fallback")).toBe("Safe fallback");
      expect(safeErrorMessage(new Error("boom\n    at handler (route.ts:10:5)"), "Safe fallback")).toBe("Safe fallback");
    });

    it("preserves clean domain/user-facing messages", () => {
      expect(safeErrorMessage(new Error("Please select a room"), "Fallback")).toBe("Please select a room");
      expect(safeErrorMessage(new Error("Cannot delete an active floor"), "Fallback")).toBe("Cannot delete an active floor");
    });
  });

  describe("runWithOptionalIdempotency", () => {
    const ctx = { businessId: "biz-1", branchId: "br-1", userId: "usr-1", role: "CASHIER" };
    const makeReq = (key?: string) =>
      new Request("http://localhost/test", {
        method: "POST",
        headers: key ? { "Idempotency-Key": key } : {},
      });

    it("executes directly without touching requestResult when header is omitted", async () => {
      const work = vi.fn().mockResolvedValue({ ok: true });
      const res = await runWithOptionalIdempotency(makeReq(), ctx, "OP", { a: 1 }, work);
      expect(res).toEqual({ result: { ok: true }, replayed: false });
      expect(work).toHaveBeenCalledTimes(1);
      expect(mocks.findUnique).not.toHaveBeenCalled();
      expect(mocks.create).not.toHaveBeenCalled();
    });

    it("rejects malformed short Idempotency-Key with 400", async () => {
      await expect(
        runWithOptionalIdempotency(makeReq("short"), ctx, "OP", {}, vi.fn())
      ).rejects.toMatchObject({ status: 400 });
    });

    it("persists and replays committed response without re-running work, and rejects mismatched payload with 409", async () => {
      const work = vi.fn().mockResolvedValue({ invoice: "INV-1" });
      const key = "pos_stl_0123456789abcdef";

      const first = await runWithOptionalIdempotency(makeReq(key), ctx, "OP", { total: 100 }, work);
      expect(first).toEqual({ result: { invoice: "INV-1" }, replayed: false });
      expect(work).toHaveBeenCalledTimes(1);

      const savedRecord = mocks.create.mock.calls[0][0].data;
      mocks.findUnique.mockResolvedValue(savedRecord);

      const second = await runWithOptionalIdempotency(makeReq(key), ctx, "OP", { total: 100 }, work);
      expect(second).toEqual({ result: { invoice: "INV-1" }, replayed: true });
      expect(work).toHaveBeenCalledTimes(1);

      await expect(
        runWithOptionalIdempotency(makeReq(key), ctx, "OP", { total: 200 }, work)
      ).rejects.toMatchObject({ status: 409 });
    });

    it("recovers cleanly on concurrent P2002 race by replaying the winning record", async () => {
      const work = vi.fn().mockResolvedValue({ id: "ord-1" });
      const key = "pos_ord_0123456789abcdef";

      mocks.create.mockRejectedValueOnce({ code: "P2002" });
      // Capture what requestHash was passed to create so dbFindUnique returns matching hash
      mocks.dbFindUnique.mockImplementation(async () => ({
        requestHash: mocks.create.mock.calls[0][0].data.requestHash,
        response: { id: "ord-1" },
      }));

      const res = await runWithOptionalIdempotency(makeReq(key), ctx, "OP", { items: [1] }, work);
      expect(res).toEqual({ result: { id: "ord-1" }, replayed: true });
    });
  });
});
