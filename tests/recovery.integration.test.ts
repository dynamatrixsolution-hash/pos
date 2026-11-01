import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { randomBytes, randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { isolatedDatabaseUrl } from "../scripts/database-verification.mjs";

const target = process.env.TEST_DATABASE_URL;
if (!target && process.env.RESTRO_REQUIRE_DATABASE_TESTS === "true") throw new Error("Recovery verification requires isolated PostgreSQL");
if (target) { isolatedDatabaseUrl(target); process.env.DATABASE_URL = target; process.env.DIRECT_URL = target; }
const identity = vi.hoisted(() => ({ user: {} as Record<string, unknown> }));
vi.mock("@/auth", () => ({ auth: async () => ({ user: identity.user }) }));

describe.skipIf(!target)("PostgreSQL tenant recovery", () => {
  let db: import("@dynapos/db").PrismaClient;
  let Store: typeof import("../backend/src/lib/backup-service").TenantBackupStore;
  let format: typeof import("../backend/src/lib/backup-format");
  let store: InstanceType<typeof Store>;
  const businessId = randomUUID(), sentinel = randomUUID(), key = randomBytes(32).toString("hex");
  const directory = path.resolve("scratch", `recovery-test-${randomUUID()}`);
  const ids: Record<string, string> = {};
  let original: import("../backend/src/lib/backup-format").TenantSnapshot;
  let filename: string;
  type Delegate = { createMany(args: { data: Record<string, unknown>[] }): Promise<unknown>; deleteMany(args: { where: Record<string, unknown> }): Promise<unknown> };
  function model(client: unknown, name: string) { return (client as Record<string, Delegate>)[name[0].toLowerCase() + name.slice(1)]; }
  async function removeFixture() {
    await db.$transaction(async tx => {
      // Only generated fixture identities; never truncate or wipe shared tables.
      await tx.auditLog.deleteMany({ where: { businessId } });
      for (const entity of [...format.backupModels].reverse()) await model(tx, entity.name).deleteMany({ where: { id: ids[entity.name] } });
    });
  }
  beforeAll(async () => {
    const { PrismaClient, Prisma } = await import("@dynapos/db");
    db = new PrismaClient({ datasourceUrl: target, log: [] });
    await db.$connect();
    ({ TenantBackupStore: Store } = await import("../backend/src/lib/backup-service"));
    format = await import("../backend/src/lib/backup-format");
    store = new Store(db, directory, key);
    await db.business.create({ data: { id: sentinel, slug: sentinel, name: "Unrelated recovery sentinel" } });
    for (const entity of format.backupModels) ids[entity.name] = entity.name === "Business" ? businessId : randomUUID();
    // One persisted record in EVERY tenant model, including historical and optional links.
    await db.$transaction(async tx => {
      for (const entity of format.backupModels) {
        const row: Record<string, unknown> = { id: ids[entity.name] };
        for (const field of entity.fields.filter(field => field.kind !== "object" && field.name !== "id")) {
          const relation = entity.fields.find(parent => parent.relationFromFields?.includes(field.name));
          if (relation) row[field.name] = ids[relation.type];
          else if (field.name === "businessId") row[field.name] = businessId;
          else if (field.name === "productId") row[field.name] = ids.Product;
          else if (field.name === "branchId") row[field.name] = ids.Branch;
          else if (field.type === "Json") row[field.name] = field.isRequired ? { response: "synthetic", financialTotal: 125.25 } : Prisma.DbNull;
          else if (field.name === "deletedAt" && ["Customer", "Product"].includes(entity.name)) row[field.name] = new Date("2025-01-02T03:04:05.000Z");
          else if (!field.isRequired || field.hasDefaultValue) continue;
          else row[field.name] = field.type === "DateTime" ? new Date("2025-01-02T03:04:05.000Z") : (field.type === "Float" || field.type === "Decimal") ? 125.25 : field.type === "Int" ? 3 : field.type === "Boolean" ? true : `${entity.name}-${field.name}-${businessId}`;
        }
        if (entity.name === "Business") row.settings = Prisma.JsonNull;
        if (entity.name === "Sale") Object.assign(row, { total: 125.25, paidAmount: 25.25, paymentStatus: "PARTIAL" });
        if (entity.name === "Payment") Object.assign(row, { amount: 25.25, method: "CASH" });
        if (entity.name === "Customer") row.balance = 100;
        if (entity.name === "CustomerLedger") Object.assign(row, { debit: 100, balance: 100 });
        if (entity.name === "Supplier") row.balance = 75.5;
        if (entity.name === "SupplierLedger") Object.assign(row, { credit: 75.5, balance: 75.5 });
        if (["ProductStock", "Batch"].includes(entity.name)) row.quantity = 7.5;
        if (entity.name === "PaymentAllocation") Object.assign(row, { amount: 25.25, saleId: ids.Sale, purchaseId: null });
        if (entity.name === "PaymentReversal") Object.assign(row, { reason: "Synthetic payment reversal" });
        if (entity.name === "Refund") Object.assign(row, { amount: 25.25, reason: "Synthetic customer return", method: "CASH", status: "COMPLETED" });
        if (entity.name === "StockMovement") Object.assign(row, { quantity: 7.5, sourceType: "SALE", sourceId: ids.Sale, unit: "pcs" });
        if (entity.name === "OutboxEvent") Object.assign(row, { aggregateType: "Sale", aggregateId: ids.Sale, eventType: "SALE_COMPLETED", payload: { response: "synthetic", financialTotal: 125.25 }, status: "PENDING" });
        if (entity.name === "Reservation") Object.assign(row, {
          checkInDate: new Date("2025-01-02T14:00:00.000Z"),
          checkOutDate: new Date("2025-01-05T11:00:00.000Z"),
          totalAmount: 300,
          depositAmount: 100,
        });
        if (entity.name === "Stay") Object.assign(row, {
          checkInTime: new Date("2025-01-02T14:00:00.000Z"),
          expectedCheckOut: new Date("2025-01-05T11:00:00.000Z"),
          ratePerNight: 100,
          totalAmount: 300,
          paidAmount: 100,
        });
        if (entity.name === "RoomAllocation") Object.assign(row, {
          startDate: new Date("2025-01-02T14:00:00.000Z"),
          endDate: new Date("2025-01-05T11:00:00.000Z"),
          maintenanceTicketId: null,
        });
        if (entity.name === "MaintenanceTicket") Object.assign(row, {
          startDate: new Date("2025-01-10T10:00:00.000Z"),
          endDate: new Date("2025-01-12T18:00:00.000Z"),
        });
        await model(tx, entity.name).createMany({ data: [row] });
      }
    });
    original = await store.capture(businessId);
    filename = (await store.executeBackup(businessId)).filename;
  }, 30000);
  afterAll(async () => {
    if (db) {
      if (format && Object.keys(ids).length) await removeFixture();
      expect(await db.business.findUnique({ where: { id: sentinel } })).not.toBeNull();
      await db.business.deleteMany({ where: { id: sentinel } });
      await db.$disconnect();
    }
    // Delete only test-created files, never recursively remove a computed directory.
    for (const file of await fs.readdir(directory).catch(() => [])) await fs.unlink(path.join(directory, file));
    await fs.rmdir(directory).catch(() => undefined);
  });

  it("R1 captures all tenant models and authenticates encrypted archives without claiming rehearsal", async () => {
    expect(Object.keys(original.tables)).toHaveLength(format.backupModels.length);
    for (const rows of Object.values(original.tables)) expect(rows).toHaveLength(1);
    const bytes = await fs.readFile(path.join(directory, filename));
    expect(bytes.toString()).not.toContain("synthetic");
    expect(bytes.toString()).not.toContain("passwordHash");
    const loaded = await store.load(businessId, filename);
    expect(loaded.tables).toEqual(original.tables);
    expect(await store.listBackups(businessId)).toEqual([expect.objectContaining({ filename, verified: false, integrityVerified: true, recoveryStatus: "NOT_REHEARSED" })]);
  });

  it("R2 rejects live overwrite, path traversal, foreign tenant, wrong key and tampered archives without writes", async () => {
    await expect(store.restoreMissingTenant(businessId, filename)).rejects.toMatchObject({ status: 409 });
    await expect(store.load(businessId, "../outside.json")).rejects.toThrow("Invalid archive filename");
    await expect(store.load(sentinel, filename)).rejects.toThrow("tenant or schema mismatch");
    await expect(new Store(db, directory, randomBytes(32).toString("hex")).load(businessId, filename)).rejects.toThrow("authentication");
    const bad = `backup-${randomUUID()}.pbackup`;
    const envelope = JSON.parse(await fs.readFile(path.join(directory, filename), "utf8"));
    envelope.counts.Sale++;
    await fs.writeFile(path.join(directory, bad), JSON.stringify(envelope));
    await expect(store.restoreMissingTenant(businessId, bad)).rejects.toThrow("authentication");
    expect((await store.capture(businessId)).tables).toEqual(original.tables);
  });

  it("R3 rejects incomplete manifests, duplicate IDs and foreign references before database writes", async () => {
    const incomplete = structuredClone(original); delete incomplete.tables.Payment;
    expect(() => format.sealSnapshot(incomplete, Buffer.from(key, "hex"))).toThrow("manifest");
    const duplicate = structuredClone(original); duplicate.tables.Payment.push(duplicate.tables.Payment[0]);
    expect(() => format.validateSnapshot(duplicate, businessId)).toThrow("identity");
    const foreign = structuredClone(original); foreign.tables.Payment[0].branchId = randomUUID();
    expect(() => format.validateSnapshot(foreign, businessId)).toThrow("reference");
    expect((await store.capture(businessId)).tables).toEqual(original.tables);
  });

  it("R4 late audit failure rolls back every recovered table, including orphan-capable idempotency rows", async () => {
    await removeFixture();
    const trigger = `recovery_${businessId.replaceAll("-", "")}`;
    // Identifiers and predicate consist only of test-generated UUID characters.
    await db.$executeRawUnsafe(`CREATE FUNCTION "${trigger}"() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW."businessId" = '${businessId}' AND NEW.action = 'BACKUP_RESTORE' THEN RAISE EXCEPTION 'synthetic recovery audit failure'; END IF; RETURN NEW; END $$`);
    await db.$executeRawUnsafe(`CREATE TRIGGER "${trigger}" BEFORE INSERT ON "AuditLog" FOR EACH ROW EXECUTE FUNCTION "${trigger}"()`);
    try {
      await expect(store.restoreMissingTenant(businessId, filename)).rejects.toThrow("no data committed");
      for (const entity of format.backupModels) {
        const rows = await db.$queryRawUnsafe<{ count: bigint }[]>(`SELECT count(*) AS count FROM "${entity.name}" WHERE id = $1`, ids[entity.name]);
        expect(rows[0].count, entity.name).toBe(0n);
      }
    } finally {
      await db.$executeRawUnsafe(`DROP TRIGGER "${trigger}" ON "AuditLog"`);
      await db.$executeRawUnsafe(`DROP FUNCTION "${trigger}"()`);
    }
  });

  it("R5 recovers balances, payments, stock, batches, all history, IDs and SQL-vs-JSON nulls exactly", async () => {
    await store.restoreMissingTenant(businessId, filename);
    const restored = await store.capture(businessId);
    const recoveryAudit = restored.tables.AuditLog.filter(row => row.action === "BACKUP_RESTORE");
    expect(recoveryAudit).toHaveLength(1);
    restored.tables.AuditLog = restored.tables.AuditLog.filter(row => row.id === ids.AuditLog);
    for (const row of recoveryAudit) delete restored.jsonDatabaseNulls.AuditLog[row.id as string];
    expect(restored.tables).toEqual(original.tables);
    expect(restored.jsonDatabaseNulls).toEqual(original.jsonDatabaseNulls);
    expect(await db.business.findUnique({ where: { id: sentinel } })).not.toBeNull();
    await expect(store.restoreMissingTenant(businessId, filename)).rejects.toMatchObject({ status: 409 });
    expect(await db.payment.count({ where: { businessId } })).toBe(1);
  });

  it("R6 concurrent committed financial changes cannot tear the repeatable-read snapshot", async () => {
    const { PrismaClient } = await import("@dynapos/db");
    const writer = new PrismaClient({ datasourceUrl: target, log: [] });
    let release!: () => void, started!: () => void;
    const wait = new Promise<void>(resolve => { release = resolve; });
    const ready = new Promise<void>(resolve => { started = resolve; });
    let readerPid = 0, writerPid = 0;
    const reader = db.$extends({ query: { business: { async findMany({ args, query }) {
      const result = await query(args); started(); await wait; return result;
    } } } });
    // Observe the first snapshot SELECT and pause while a different PostgreSQL connection commits.
    const observed = reader.$extends({ query: { $allOperations: async ({ args, query }) => query(args) } });
    const capture = new Store(observed as unknown as typeof db, directory, key).capture(businessId);
    try {
      await ready;
      await writer.$transaction(async tx => {
        [{ pid: writerPid }] = await tx.$queryRaw<{ pid: number }[]>`SELECT pg_backend_pid() AS pid`;
        const activity = await tx.$queryRaw<{ pid: number }[]>`SELECT pid FROM pg_stat_activity WHERE datname = current_database() AND pid <> pg_backend_pid() AND state = 'idle in transaction' AND query LIKE '%Business%'`;
        expect(activity.length).toBeGreaterThan(0); readerPid = activity[0].pid;
        await tx.sale.update({ where: { id: ids.Sale }, data: { paidAmount: 125.25, paymentStatus: "PAID" } });
        await tx.payment.update({ where: { id: ids.Payment }, data: { amount: 125.25 } });
        await tx.customer.update({ where: { id: ids.Customer }, data: { balance: 0 } });
        await tx.customerLedger.update({ where: { id: ids.CustomerLedger }, data: { balance: 0 } });
      });
    } finally { release(); await writer.$disconnect(); }
    const snapshot = await capture;
    expect(readerPid).not.toBe(writerPid);
    expect(snapshot.tables.Sale).toEqual(original.tables.Sale);
    expect(snapshot.tables.Payment).toEqual(original.tables.Payment);
    expect(snapshot.tables.Customer).toEqual(original.tables.Customer);
    expect(snapshot.tables.CustomerLedger).toEqual(original.tables.CustomerLedger);
    expect(Number((await db.sale.findUniqueOrThrow({ where: { id: ids.Sale } })).paidAmount)).toBe(125.25);
    expect(Number((await db.payment.findUniqueOrThrow({ where: { id: ids.Payment } })).amount)).toBe(125.25);
    expect(Number((await db.customer.findUniqueOrThrow({ where: { id: ids.Customer } })).balance)).toBe(0);
  }, 15000);

  it("R7 backup HTTP boundary uses current database authority and refuses legacy restore without effects", async () => {
    const route = await import("../backend/src/app/api/v1/settings/backup/route");
    const restore = () => route.POST(new Request("http://localhost/api/v1/settings/backup", { method: "POST", body: JSON.stringify({ action: "restore", filename }) }));
    expect((await restore()).status).toBe(401);
    identity.user = { id: ids.User, businessId, role: "OWNER" };
    await db.user.update({ where: { id: ids.User }, data: { role: "MANAGER" } });
    expect((await route.GET()).status).toBe(403);
    expect((await restore()).status).toBe(403);
    await db.user.update({ where: { id: ids.User }, data: { role: "OWNER" } });
    const before = await store.capture(businessId);
    const response = await restore();
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: expect.stringContaining("Live overwrite restore is disabled") });
    expect((await store.capture(businessId)).tables).toEqual(before.tables);
    await db.user.update({ where: { id: ids.User }, data: { isActive: false } });
    expect((await route.GET()).status).toBe(401);
    const { db: routeDb } = await import("@dynapos/db");
    await routeDb.$disconnect();
  });

  it("R8 captures a deterministic, sorted SQL-null manifest even with many null-JSON rows", async () => {
    const { Prisma } = await import("@dynapos/db");
    const extra = Array.from({ length: 8 }, () => randomUUID());
    await db.auditLog.createMany({ data: extra.map(id => ({ id, businessId, action: "SYNTHETIC_ORDER_CHECK", module: "BACKUP", role: "OWNER", oldValue: Prisma.DbNull, newValue: Prisma.DbNull })) });
    // Rewrite a few rows so heap order differs from primary-key order.
    await db.auditLog.updateMany({ where: { id: { in: extra.slice(0, 4) } }, data: { details: "rewritten" } });
    const first = await store.capture(businessId), second = await store.capture(businessId);
    const keys = Object.keys(first.jsonDatabaseNulls.AuditLog);
    expect(keys.length).toBeGreaterThanOrEqual(8);
    expect(keys).toEqual([...keys].sort());
    expect(JSON.stringify(second.jsonDatabaseNulls)).toBe(JSON.stringify(first.jsonDatabaseNulls));
    expect(JSON.stringify(second.tables)).toBe(JSON.stringify(first.tables));
  });
});
