import { beforeAll, afterAll, beforeEach, afterEach, describe, it, expect, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { authConfig } from "../backend/src/auth.config";
import { isolatedDatabaseUrl } from "../scripts/database-verification.mjs";

// Refuse arbitrary database targets before importing Prisma or routes.
const target = process.env.TEST_DATABASE_URL;
if (!target && process.env.RESTRO_REQUIRE_DATABASE_TESTS === "true") throw new Error("Dedicated database verification requires TEST_DATABASE_URL");
if (target) {
  isolatedDatabaseUrl(target);
  process.env.DATABASE_URL = target;
  process.env.DIRECT_URL = target;
}
const identity = vi.hoisted(() => ({ user: {} as Record<string, unknown> }));
vi.mock("@/auth", () => ({ auth: async () => ({ user: identity.user }) }));
vi.mock("@/lib/cbms-service", () => ({ CbmsService: { submitInvoice: vi.fn() } }));

describe.skipIf(!target)("real PostgreSQL checkout atomicity", () => {
  let db: typeof import("@dynapos/db").db;
  let checkout: typeof import("../backend/src/app/api/v1/sales/route").POST;
  let pay: typeof import("../backend/src/app/api/v1/payments/route").POST;
  let connected = false;
  let restoreTransactionObserver: (() => void) | undefined;
  let transactionPids: number[] = [];
  const sentinelBusiness = randomUUID();
  const businessId = randomUUID(), branchId = randomUUID(), otherBranchId = randomUUID(), otherBusiness = randomUUID(), foreignBranch = randomUUID(), userId = randomUUID(), productId = randomUUID(), customerId = randomUUID();
  beforeAll(async () => {
    ({ db } = await import("@dynapos/db"));
    await db.$connect();
    connected = true;
    checkout = (await import("../backend/src/app/api/v1/sales/route")).POST;
    pay = (await import("../backend/src/app/api/v1/payments/route")).POST;
    await db.business.create({ data: { id: businessId, name: "Synthetic test business", slug: businessId, settings: { enableVat: false, preventNegativeStock: true } } });
    await db.business.create({ data: { id: otherBusiness, name: "Synthetic foreign tenant", slug: otherBusiness } });
    await db.business.create({ data: { id: sentinelBusiness, name: "Unrelated development sentinel", slug: sentinelBusiness } });
    await db.branch.createMany({ data: [
      { id: branchId, businessId, name: "Assigned" }, { id: otherBranchId, businessId, name: "Unassigned" }, { id: foreignBranch, businessId: otherBusiness, name: "Foreign" },
    ] });
    await db.user.create({ data: { id: userId, businessId, branchId, email: `${userId}@example.invalid`, name: "Synthetic cashier", passwordHash: "not-a-login", role: "CASHIER" } });
    await db.product.create({ data: { id: productId, businessId, name: "Synthetic product", sellingPrice: 100 } });
    await db.customer.create({ data: { id: customerId, businessId, branchId, name: "Synthetic customer", creditLimit: 1000 } });
    identity.user = { id: userId, businessId, role: "OWNER", branchId: foreignBranch };
  });
  beforeEach(async () => {
    await db.requestResult.deleteMany({ where: { businessId } });
    await db.sale.deleteMany({ where: { businessId } });
    await db.auditLog.deleteMany({ where: { businessId } });
    await db.customerLedger.deleteMany({ where: { customerId } });
    await db.openingStock.deleteMany({ where: { businessId } });
    await db.batch.deleteMany({ where: { productId } });
    await db.customer.update({ where: { id: customerId }, data: { balance: 0 } });
    await db.user.update({ where: { id: userId }, data: { role: "CASHIER", isActive: true, deletedAt: null } });
    await db.business.update({ where: { id: businessId }, data: { settings: { enableVat: false, preventNegativeStock: true } } });
    await db.productStock.upsert({ where: { productId_branchId: { productId, branchId } }, create: { productId, branchId, quantity: 1 }, update: { quantity: 1 } });
    if (process.env.RESTRO_OBSERVE_RACES === "true") {
      transactionPids = [];
      const realTransaction = db.$transaction.bind(db);
      // Observe, do not replace, real interactive PostgreSQL transactions. Preserve
      // the caller's isolation/retry options and all business writes/rollbacks.
      const observer = vi.spyOn(db, "$transaction").mockImplementation((work, options) => {
        if (typeof work !== "function") throw new Error("Race observer requires interactive transactions");
        return realTransaction(async tx => {
          const [connection] = await tx.$queryRaw<{ pid: number }[]>`SELECT pg_backend_pid() AS pid`;
          transactionPids.push(connection.pid);
          await tx.$executeRaw`SELECT pg_sleep(0.025)`;
          return work(tx);
        }, options);
      });
      restoreTransactionObserver = () => observer.mockRestore();
    }
  });
  afterEach(context => {
    try {
      if (restoreTransactionObserver) {
        const distinct = [...new Set(transactionPids)];
        expect(distinct.length).toBeGreaterThanOrEqual(2);
        console.log(`RACE_CONNECTIONS ${JSON.stringify({ test: context.task.name, attempts: transactionPids.length, pids: distinct })}`);
      }
    } finally {
      restoreTransactionObserver?.();
      restoreTransactionObserver = undefined;
    }
  });
  afterAll(async () => {
    if (connected) {
      await db.requestResult.deleteMany({ where: { businessId } });
      await db.business.deleteMany({ where: { id: { in: [businessId, otherBusiness] } } });
      // Prove fixture cleanup does not wipe unrelated businesses, then remove only our sentinel.
      expect(await db.business.findUnique({ where: { id: sentinelBusiness } })).not.toBeNull();
      await db.business.delete({ where: { id: sentinelBusiness } });
    }
    await db?.$disconnect();
  });
  const body = (extra = {}) => ({ branchId, items: [{ productId, quantity: 1, price: 100 }], subtotal: 100, total: 100, paidAmount: 100, paymentStatus: "PAID", paymentMethod: "CASH", ...extra });
  const req = (value: unknown, key = randomUUID()) => new Request("http://localhost/api/v1/sales", { method: "POST", headers: { "Content-Type": "application/json", "Idempotency-Key": key }, body: JSON.stringify(value) });
  const stock = async () => (await db.productStock.findUniqueOrThrow({ where: { productId_branchId: { productId, branchId } } })).quantity;
  it("rejects cross-tenant and unassigned branches using current DB identity", async () => {
    expect((await checkout(req(body({ branchId: foreignBranch })))).status).toBe(403);
    expect((await checkout(req(body({ branchId: otherBranchId })))).status).toBe(403);
    expect(await stock()).toBe(1);
  });
  it("rejects provider claims and derives unpaid status instead of trusting PAID", async () => {
    expect((await checkout(req(body({ paymentSource: "PROVIDER_VERIFIED" })))).status).toBe(400);
    const response = await checkout(req(body({ paidAmount: 0, customerId })));
    expect(response.status).toBe(201);
    expect((await response.json()).paymentStatus).toBe("UNPAID");
    expect(await db.payment.count({ where: { businessId } })).toBe(0);
  });
  it("replays a concurrent duplicate without duplicating any effects", async () => {
    const key = randomUUID();
    const partial = body({ customerId, paidAmount: 40 });
    const responses = await Promise.all([checkout(req(partial, key)), checkout(req(partial, key))]);
    expect(responses.map(r => r.status)).toEqual([201, 201]);
    expect((await responses[0].json()).id).toBe((await responses[1].json()).id);
    expect(await db.sale.count({ where: { businessId } })).toBe(1);
    expect(await db.payment.count({ where: { businessId } })).toBe(1);
    expect(await stock()).toBe(0);
    expect((await db.sale.findFirstOrThrow({ where: { businessId } })).paidAmount).toBe(40);
    expect((await db.payment.findFirstOrThrow({ where: { businessId } })).amount).toBe(40);
    expect((await db.customer.findUniqueOrThrow({ where: { id: customerId } })).balance).toBe(60);
    expect(await db.customerLedger.count({ where: { customerId } })).toBe(1);
    expect((await db.customerLedger.findFirstOrThrow({ where: { customerId } })).debit).toBe(60);
    expect(await db.requestResult.count({ where: { businessId } })).toBe(1);
    expect((await checkout(req(body({ customerId, paidAmount: 39 }), key))).status).toBe(409);
  });
  it("sells the last unit once when negative stock is forbidden", async () => {
    const responses = await Promise.all([checkout(req(body())), checkout(req(body()))]);
    expect(responses.map(r => r.status).sort()).toEqual([201, 400]);
    expect(await stock()).toBe(0);
    expect(await db.sale.count({ where: { businessId } })).toBe(1);
    expect(await db.payment.count({ where: { businessId } })).toBe(1);
    expect((await db.payment.aggregate({ where: { businessId }, _sum: { amount: true } }))._sum.amount).toBe(100);
    expect((await db.customer.findUniqueOrThrow({ where: { id: customerId } })).balance).toBe(0);
    expect(await db.customerLedger.count({ where: { customerId } })).toBe(0);
    expect(await db.requestResult.count({ where: { businessId } })).toBe(1);
  });
  it("preserves every decrement when configured to allow negative stock", async () => {
    await db.business.update({ where: { id: businessId }, data: { settings: { enableVat: false, allowNegativeStock: true } } });
    const responses = await Promise.all([checkout(req(body())), checkout(req(body()))]);
    expect(responses.map(r => r.status)).toEqual([201, 201]);
    expect(await stock()).toBe(-1);
    expect(await db.sale.count({ where: { businessId } })).toBe(2);
    expect(await db.payment.count({ where: { businessId } })).toBe(2);
    expect((await db.payment.aggregate({ where: { businessId }, _sum: { amount: true } }))._sum.amount).toBe(200);
    expect((await db.customer.findUniqueOrThrow({ where: { id: customerId } })).balance).toBe(0);
    expect(await db.customerLedger.count({ where: { customerId } })).toBe(0);
    expect(await db.requestResult.count({ where: { businessId } })).toBe(2);
  });
  it("rolls back stock, invoice sequence and effects when a later item fails", async () => {
    const sequenceBefore = await db.fiscalYearInvoiceSequence.findMany({ where: { businessId } });
    const response = await checkout(req(body({ items: [{ productId, quantity: 1 }, { productId: randomUUID(), quantity: 1 }] })));
    expect(response.status).toBe(400);
    expect(await stock()).toBe(1);
    expect(await db.sale.count({ where: { businessId } })).toBe(0);
    expect(await db.payment.count({ where: { businessId } })).toBe(0);
    expect(await db.requestResult.count({ where: { businessId } })).toBe(0);
    expect(await db.fiscalYearInvoiceSequence.findMany({ where: { businessId } })).toEqual(sequenceBefore);
  });
  it("authorizes manual payments and replays them without duplicate settlement", async () => {
    const saleResponse = await checkout(req(body({ paidAmount: 0, customerId })));
    const sale = await saleResponse.json();
    const payment = { type: "RECEIVED", branchId, saleId: sale.id, amount: 100, method: "CASH" };
    expect((await pay(req(payment))).status).toBe(403);
    await db.user.update({ where: { id: userId }, data: { role: "MANAGER" } });
    const key = randomUUID();
    const responses = await Promise.all([pay(req(payment, key)), pay(req(payment, key))]);
    expect(responses.map(r => r.status)).toEqual([201, 201]);
    expect(await db.payment.count({ where: { businessId } })).toBe(1);
    expect((await db.sale.findUniqueOrThrow({ where: { id: sale.id } })).paymentStatus).toBe("PAID");
    expect((await db.sale.findUniqueOrThrow({ where: { id: sale.id } })).paidAmount).toBe(100);
    expect((await db.customer.findUniqueOrThrow({ where: { id: customerId } })).balance).toBe(0);
    expect(await stock()).toBe(0);
    expect(await db.sale.count({ where: { businessId } })).toBe(1);
    expect((await db.payment.findFirstOrThrow({ where: { businessId } })).amount).toBe(100);
    expect(await db.customerLedger.count({ where: { customerId } })).toBe(2);
    expect((await db.customerLedger.aggregate({ where: { customerId }, _sum: { debit: true, credit: true } }))._sum).toEqual({ debit: 100, credit: 100 });
    expect(await db.requestResult.count({ where: { businessId } })).toBe(2);
  });
  it("uses independent overlapping PostgreSQL transactions", async () => {
    const pids = await Promise.all([0, 1].map(() => db.$transaction(async tx => {
      const result = await tx.$queryRaw<{ pid: number }[]>`SELECT pg_backend_pid() AS pid`;
      await tx.$executeRaw`SELECT pg_sleep(0.05)`;
      return result[0].pid;
    })));
    expect(new Set(pids).size).toBe(2);
  });
  it("ignores forged role/branch updates and revokes stale, inactive and deleted staff", async () => {
    const token = { id: userId, businessId, role: "CASHIER", branchId };
    const original = structuredClone(token);
    const updated = await Reflect.apply(authConfig.callbacks.jwt, undefined, [{ token, trigger: "update", session: { role: "OWNER", branchId: foreignBranch } }]);
    expect(updated).toEqual(original);
    expect((await checkout(req(body({ branchId: foreignBranch })))).status).toBe(403);
    await db.user.update({ where: { id: userId }, data: { isActive: false } });
    expect((await checkout(req(body()))).status).toBe(401);
    await db.user.update({ where: { id: userId }, data: { isActive: true, deletedAt: new Date() } });
    expect((await checkout(req(body()))).status).toBe(401);
    expect(await db.sale.count({ where: { businessId } })).toBe(0);
  });
  it("rejects negative amounts and mismatched splits without stock or accounting effects", async () => {
    expect((await checkout(req(body({ customerId, paidAmount: -1 })))).status).toBe(400);
    expect((await checkout(req(body({ splitPayments: [{ method: "CASH", amount: 1 }] })))).status).toBe(400);
    expect(await stock()).toBe(1);
    expect(await db.sale.count({ where: { businessId } })).toBe(0);
    expect(await db.payment.count({ where: { businessId } })).toBe(0);
    expect(await db.customerLedger.count({ where: { customerId } })).toBe(0);
    expect((await db.customer.findUniqueOrThrow({ where: { id: customerId } })).balance).toBe(0);
    expect(await db.auditLog.count({ where: { businessId } })).toBe(0);
    expect(await db.requestResult.count({ where: { businessId } })).toBe(0);
  });
  it("keeps a claimed provider-success reference strictly staff-recorded", async () => {
    const response = await checkout(req(body({ paymentMethod: "CARD", paymentReference: "PROVIDER_VERIFIED:client-success", verified: true, paymentStatus: "UNPAID" })));
    expect(response.status).toBe(201);
    const sale = await response.json();
    expect(sale.paymentStatus).toBe("PAID");
    const payment = await db.payment.findFirstOrThrow({ where: { saleId: sale.id } });
    expect(payment.source).toBe("STAFF_RECORDED");
    expect(payment.reference).toBe("PROVIDER_VERIFIED:client-success");
  });
  it("rolls back sale, payment, ledger, stock and audit when database audit insertion fails", async () => {
    const suffix = randomUUID().replaceAll("-", "");
    const name = `restro_audit_failure_${suffix}`;
    const sequenceBefore = await db.fiscalYearInvoiceSequence.findMany({ where: { businessId } });
    // Generated identifiers/UUID only; condition affects this fixture business exclusively.
    await db.$executeRawUnsafe(`CREATE FUNCTION "${name}"() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW."businessId" = '${businessId}' THEN RAISE EXCEPTION 'synthetic audit insertion failure'; END IF; RETURN NEW; END $$`);
    await db.$executeRawUnsafe(`CREATE TRIGGER "${name}" BEFORE INSERT ON "AuditLog" FOR EACH ROW EXECUTE FUNCTION "${name}"()`);
    try {
      const response = await checkout(req(body({ customerId, paidAmount: 40 })));
      expect(response.status).toBe(400);
      expect(await stock()).toBe(1);
      expect(await db.sale.count({ where: { businessId } })).toBe(0);
      expect(await db.payment.count({ where: { businessId } })).toBe(0);
      expect(await db.customerLedger.count({ where: { customerId } })).toBe(0);
      expect((await db.customer.findUniqueOrThrow({ where: { id: customerId } })).balance).toBe(0);
      expect(await db.auditLog.count({ where: { businessId } })).toBe(0);
      expect(await db.requestResult.count({ where: { businessId } })).toBe(0);
      expect(await db.fiscalYearInvoiceSequence.findMany({ where: { businessId } })).toEqual(sequenceBefore);
    } finally {
      await db.$executeRawUnsafe(`DROP TRIGGER IF EXISTS "${name}" ON "AuditLog"`);
      await db.$executeRawUnsafe(`DROP FUNCTION IF EXISTS "${name}"()`);
    }
  });
  it("posts concurrent and repeated opening-stock approvals exactly once", async () => {
    await db.user.update({ where: { id: userId }, data: { role: "MANAGER" } });
    const entry = await db.openingStock.create({ data: { businessId, branchId, productId, quantity: 3, unitType: "pcs", enteredById: userId, batchNumber: "synthetic-opening" } });
    const { PATCH } = await import("../backend/src/app/api/v1/inventory/opening/[id]/route");
    const approve = () => PATCH(req({ status: "APPROVED" }), { params: Promise.resolve({ id: entry.id }) });
    const responses = await Promise.all([approve(), approve()]);
    expect(responses.some(response => response.status === 200)).toBe(true);
    expect(responses.every(response => [200, 400].includes(response.status))).toBe(true);
    expect((await approve()).status).toBe(400);
    const { approveOpeningStockTransaction } = await import("../backend/src/app/api/v1/inventory/opening/route");
    // Concurrent service-level retries must also remain harmless after API approval.
    await Promise.all([approveOpeningStockTransaction(entry.id, businessId, userId), approveOpeningStockTransaction(entry.id, businessId, userId)]);
    expect(await stock()).toBe(4);
    expect((await db.batch.findFirstOrThrow({ where: { productId, batchNumber: "synthetic-opening" } })).quantity).toBe(3);
    expect((await db.openingStock.findUniqueOrThrow({ where: { id: entry.id } })).appliedAt).not.toBeNull();
    expect(await db.openingStock.count({ where: { businessId } })).toBe(1);
    expect(await db.batch.count({ where: { productId } })).toBe(1);
    expect(await db.productStock.count({ where: { productId, branchId } })).toBe(1);
    expect((await db.customer.findUniqueOrThrow({ where: { id: customerId } })).balance).toBe(0);
    expect(await db.customerLedger.count({ where: { customerId } })).toBe(0);
  });
  it("rejects paid cancellation, settled correction and linked payment reversal without partial effects", async () => {
    const saleResponse = await checkout(req(body()));
    const sale = await saleResponse.json();
    const payment = await db.payment.findFirstOrThrow({ where: { saleId: sale.id } });
    await db.user.update({ where: { id: userId }, data: { role: "MANAGER" } });
    const { POST: cancel } = await import("../backend/src/app/api/v1/sales/[id]/cancel/route");
    const { POST: correct } = await import("../backend/src/app/api/v1/sales/[id]/correct/route");
    const { DELETE: reverse } = await import("../backend/src/app/api/v1/payments/[id]/route");
    const params = { params: Promise.resolve({ id: sale.id }) };
    const auditBefore = await db.auditLog.count({ where: { businessId } });
    const financialSnapshot = async () => ({
      sale: await db.sale.findUniqueOrThrow({ where: { id: sale.id } }),
      payment: await db.payment.findUniqueOrThrow({ where: { id: payment.id } }),
      stock: await db.productStock.findUniqueOrThrow({ where: { productId_branchId: { productId, branchId } } }),
      customer: await db.customer.findUniqueOrThrow({ where: { id: customerId } }),
      ledgers: await db.customerLedger.findMany({ where: { customerId }, orderBy: { id: "asc" } }),
      audit: await db.auditLog.findMany({ where: { businessId }, orderBy: { id: "asc" } }),
      requests: await db.requestResult.findMany({ where: { businessId }, orderBy: { id: "asc" } }),
    });
    const beforeRejections = await financialSnapshot();
    // Continue to the no-effect assertions even if a future status regression occurs.
    expect.soft((await cancel(req({ reason: "synthetic cancellation" }), params)).status).toBe(409);
    expect.soft((await correct(req({ reason: "synthetic correction", items: [{ productId, quantity: 1, price: 100 }] }), params)).status).toBe(409);
    expect.soft((await reverse(req({}), { params: Promise.resolve({ id: payment.id }) })).status).toBe(409);
    expect(await stock()).toBe(0);
    expect(await db.sale.count({ where: { businessId } })).toBe(1);
    expect((await db.sale.findUniqueOrThrow({ where: { id: sale.id } })).isActive).toBe(true);
    expect(await db.payment.count({ where: { businessId } })).toBe(1);
    expect(await db.auditLog.count({ where: { businessId } })).toBe(auditBefore);
    expect(await financialSnapshot()).toEqual(beforeRejections);
  });
});
