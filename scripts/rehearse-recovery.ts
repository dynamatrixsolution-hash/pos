/**
 * Recovery rehearsal: SYNTHETIC data only.
 *
 *   source  = existing restro development/test database (127.0.0.1:55439/restro_test), read-only for backup;
 *             synthetic fixtures are inserted and removed by generated ID only.
 *   target  = disposable PostgreSQL (127.0.0.1:55440/restro_restore): separate container, volume,
 *             role, credentials and cluster.
 *
 * Launch through `node scripts/restro-restore-env.mjs rehearse`; the launcher validates both targets.
 */
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { performance } from "node:perf_hooks";
import { isolatedDatabaseUrl, restoreTargetUrl } from "./database-verification.mjs";

type Row = Record<string, unknown>;
type Check = { name: string; ok: boolean; detail: string };
const checks: Check[] = [];
const timings: Record<string, number> = {};
function check(name: string, ok: boolean, detail = "") {
  checks.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
}
async function timed<T>(label: string, work: () => Promise<T>): Promise<T> {
  const start = performance.now();
  try { return await work(); } finally { timings[label] = Math.round(performance.now() - start); }
}

async function main() {
  const sourceUrl = isolatedDatabaseUrl(process.env.DATABASE_URL);
  const targetUrl = restoreTargetUrl(process.env.RESTORE_TARGET_DATABASE_URL, sourceUrl);
  if (process.env.DIRECT_URL !== sourceUrl || process.env.TEST_DATABASE_URL !== sourceUrl) throw new Error("Rehearsal requires the consistent restro source environment");

  const { PrismaClient, Prisma } = await import("@dynapos/db");
  const { TenantBackupStore } = await import("../backend/src/lib/backup-service");
  const format = await import("../backend/src/lib/backup-format");
  const source = new PrismaClient({ datasourceUrl: sourceUrl, log: [] });
  const target = new PrismaClient({ datasourceUrl: targetUrl, log: [] });
  const rehearsalStart = performance.now();
  const directory = path.resolve("scratch", `rehearsal-${randomUUID()}`);
  const key = randomBytes(32).toString("hex");
  type Client = InstanceType<typeof PrismaClient>;
  type Delegate = { createMany(args: { data: Row[] }): Promise<unknown>; deleteMany(args: { where: Row }): Promise<unknown> };
  const model = (client: unknown, name: string) => (client as Record<string, Delegate>)[name[0].toLowerCase() + name.slice(1)];
  const tableNames = [...format.backupModels.map(entity => entity.name), "BusinessRegistrationRequest"];
  const ident = (name: string) => { if (!/^[A-Za-z][A-Za-z0-9_]*$/.test(name)) throw new Error("unsafe identifier"); return `"${name}"`; };

  // ---- Whole-database content fingerprint: row count + md5 of every row, per table. --------------
  type Fingerprint = Record<string, string>;
  async function fingerprint(client: Client): Promise<Fingerprint> {
    const result: Fingerprint = {};
    for (const name of tableNames) {
      const [row] = await client.$queryRawUnsafe<{ n: number; h: string }[]>(`SELECT count(*)::int AS n, coalesce(md5(string_agg(t::text, '|' ORDER BY t."id")), '') AS h FROM ${ident(name)} t`);
      result[name] = `${row.n}:${row.h}`;
    }
    return result;
  }
  const same = (a: Fingerprint, b: Fingerprint) => JSON.stringify(a) === JSON.stringify(b);
  const diff = (a: Fingerprint, b: Fingerprint) => Object.keys(a).filter(name => a[name] !== b[name]);

  // ---- Synthetic tenant builder: one row in EVERY tenant model, plus realistic extra volume. ------
  interface Tenant { businessId: string; ids: Record<string, string>; created: Map<string, string[]> }
  async function seedTenant(client: Client, label: string, withExtras: boolean): Promise<Tenant> {
    const businessId = randomUUID();
    const ids: Record<string, string> = {};
    const created = new Map<string, string[]>();
    for (const entity of format.backupModels) ids[entity.name] = entity.name === "Business" ? businessId : randomUUID();
    function row(entityName: string, id: string, tag: string, overrides: Row = {}): Row {
      const entity = format.backupModels.find(candidate => candidate.name === entityName)!;
      const data: Row = { id };
      for (const field of entity.fields.filter(field => field.kind !== "object" && field.name !== "id")) {
        const relation = entity.fields.find(parent => parent.relationFromFields?.includes(field.name));
        if (relation) data[field.name] = ids[relation.type];
        else if (field.name === "businessId") data[field.name] = businessId;
        else if (field.name === "productId") data[field.name] = ids.Product;
        else if (field.name === "branchId") data[field.name] = ids.Branch;
        else if (field.type === "Json") data[field.name] = field.isRequired ? { response: "synthetic", label, financialTotal: 125.25 } : Prisma.DbNull;
        else if (field.name === "deletedAt" && ["Customer", "Product"].includes(entityName)) data[field.name] = new Date("2025-01-02T03:04:05.000Z");
        else if (!field.isRequired || field.hasDefaultValue) continue;
        else data[field.name] = field.type === "DateTime" ? new Date("2025-01-02T03:04:05.000Z") : (field.type === "Float" || field.type === "Decimal") ? 125.25 : field.type === "Int" ? 3 : field.type === "Boolean" ? true : `${entityName}-${field.name}-${tag}`;
      }
      if (entityName === "Business") data.settings = Prisma.JsonNull;
      if (entityName === "Sale") Object.assign(data, { total: 125.25, paidAmount: 25.25, paymentStatus: "PARTIAL" });
      if (entityName === "Payment") Object.assign(data, { amount: 25.25, method: "CASH" });
      if (entityName === "Customer") data.balance = 100;
      if (entityName === "CustomerLedger") Object.assign(data, { debit: 100, balance: 100 });
      if (entityName === "Supplier") data.balance = 75.5;
      if (entityName === "SupplierLedger") Object.assign(data, { credit: 75.5, balance: 75.5 });
      if (["ProductStock", "Batch"].includes(entityName)) data.quantity = 7.5;
      if (entityName === "PaymentAllocation") Object.assign(data, { amount: 25.25, saleId: ids.Sale, purchaseId: null });
      if (entityName === "PaymentReversal") Object.assign(data, { reason: "Synthetic payment reversal" });
      if (entityName === "Refund") Object.assign(data, { amount: 25.25, reason: "Synthetic customer return", method: "CASH", status: "COMPLETED" });
      if (entityName === "StockMovement") Object.assign(data, { quantity: 7.5, sourceType: "SALE", sourceId: ids.Sale, unit: "pcs" });
      if (entityName === "OutboxEvent") Object.assign(data, { aggregateType: "Sale", aggregateId: ids.Sale, eventType: "SALE_COMPLETED", payload: { response: "synthetic", label, financialTotal: 125.25 }, status: "PENDING" });
      if (entityName === "Reservation") Object.assign(data, {
        checkInDate: new Date("2025-01-02T14:00:00.000Z"),
        checkOutDate: new Date("2025-01-05T11:00:00.000Z"),
        totalAmount: 300,
        depositAmount: 100,
      });
      if (entityName === "Stay") Object.assign(data, {
        checkInTime: new Date("2025-01-02T14:00:00.000Z"),
        expectedCheckOut: new Date("2025-01-05T11:00:00.000Z"),
        ratePerNight: 100,
        totalAmount: 300,
        paidAmount: 100,
      });
      if (entityName === "RoomAllocation") Object.assign(data, {
        startDate: new Date("2025-01-02T14:00:00.000Z"),
        endDate: new Date("2025-01-05T11:00:00.000Z"),
        maintenanceTicketId: null,
      });
      if (entityName === "MaintenanceTicket") Object.assign(data, {
        startDate: new Date("2025-01-10T10:00:00.000Z"),
        endDate: new Date("2025-01-12T18:00:00.000Z"),
      });
      return { ...data, ...overrides };
    }
    async function insert(tx: unknown, entityName: string, data: Row) {
      await model(tx, entityName).createMany({ data: [data] });
      created.set(entityName, [...(created.get(entityName) || []), data.id as string]);
    }
    await client.$transaction(async tx => {
      for (const entity of format.backupModels) await insert(tx, entity.name, row(entity.name, ids[entity.name], businessId));
      if (!withExtras) return;
      // Products with batch-tracked stock: the stock projection must equal the sum of its batches.
      const products = [randomUUID(), randomUUID(), randomUUID()];
      const batchPlan: [number, number[]][] = [[12, [8, 4]], [0.5, [0.5]], [30, [30]]];
      for (const [index, productId] of products.entries()) {
        await insert(tx, "Product", row("Product", productId, `${businessId}-p${index}`, { deletedAt: null }));
        await insert(tx, "ProductStock", row("ProductStock", randomUUID(), `${businessId}-s${index}`, { productId, quantity: batchPlan[index][0] }));
        for (const [b, quantity] of batchPlan[index][1].entries()) await insert(tx, "Batch", row("Batch", randomUUID(), `${businessId}-b${index}${b}`, { productId, quantity }));
      }
      // Sales with partial / unpaid settlement; payments tie to paidAmount; customer balance = receivable.
      const sales: [number, number, string, string | null][] = [[1000, 1000, "PAID", "CASH"], [2500.5, 1000, "PARTIAL", "ESEWA"], [730.25, 0, "UNPAID", null], [99.99, 50, "PARTIAL", "KHALTI"]];
      for (const [index, [total, paid, status, method]] of sales.entries()) {
        const saleId = randomUUID();
        await insert(tx, "Sale", row("Sale", saleId, `${businessId}-sale${index}`, { total, paidAmount: paid, paymentStatus: status, correctedInvoiceId: null }));
        await insert(tx, "SaleItem", row("SaleItem", randomUUID(), `${businessId}-item${index}`, { saleId, productId: products[index % 3] }));
        if (method) await insert(tx, "Payment", row("Payment", randomUUID(), `${businessId}-pay${index}`, { saleId, amount: paid, method }));
      }
      let running = 100;
      for (const [index, debit] of [1500.5, 730.25, 49.99].entries()) {
        running += debit;
        await insert(tx, "CustomerLedger", row("CustomerLedger", randomUUID(), `${businessId}-led${index}`, { debit, balance: running }));
      }
      await tx.customer.update({ where: { id: ids.Customer }, data: { balance: running } });
      for (let index = 0; index < 3; index++) await insert(tx, "AuditLog", row("AuditLog", randomUUID(), `${businessId}-audit${index}`));
      for (let index = 0; index < 2; index++) await insert(tx, "RequestResult", row("RequestResult", randomUUID(), `${businessId}-req${index}`));
    });
    return { businessId, ids, created };
  }
  async function removeTenant(client: Client, tenant: Tenant) {
    // Generated IDs only: never truncate, never a broad predicate.
    await client.$transaction(async tx => {
      for (const entity of [...format.backupModels].reverse()) {
        const created = tenant.created.get(entity.name);
        if (created?.length) await model(tx, entity.name).deleteMany({ where: { id: { in: created } } });
      }
    });
  }

  // ---- Tenant-scoped reconciliation, evaluated by SQL on each database independently. ---------------
  async function reconcile(client: Client, businessId: string) {
    const num = async (sql: string) => (await client.$queryRawUnsafe<{ v: string | null }[]>(sql, businessId))[0].v ?? "0";
    const sums: Record<string, string> = {
      saleTotal: await num(`SELECT round(coalesce(sum("total"),0)::numeric, 6)::text AS v FROM "Sale" WHERE "businessId" = $1`),
      salePaid: await num(`SELECT round(coalesce(sum("paidAmount"),0)::numeric, 6)::text AS v FROM "Sale" WHERE "businessId" = $1`),
      paymentTotal: await num(`SELECT round(coalesce(sum("amount"),0)::numeric, 6)::text AS v FROM "Payment" WHERE "businessId" = $1`),
      customerBalance: await num(`SELECT round(coalesce(sum("balance"),0)::numeric, 6)::text AS v FROM "Customer" WHERE "businessId" = $1`),
      supplierBalance: await num(`SELECT round(coalesce(sum("balance"),0)::numeric, 6)::text AS v FROM "Supplier" WHERE "businessId" = $1`),
      customerLedgerDebit: await num(`SELECT round(coalesce(sum(l."debit"),0)::numeric, 6)::text AS v FROM "CustomerLedger" l JOIN "Customer" c ON c."id" = l."customerId" WHERE c."businessId" = $1`),
      supplierLedgerCredit: await num(`SELECT round(coalesce(sum(l."credit"),0)::numeric, 6)::text AS v FROM "SupplierLedger" l JOIN "Supplier" s ON s."id" = l."supplierId" WHERE s."businessId" = $1`),
      stockQuantity: await num(`SELECT round(coalesce(sum(ps."quantity"),0)::numeric, 6)::text AS v FROM "ProductStock" ps JOIN "Product" p ON p."id" = ps."productId" WHERE p."businessId" = $1`),
      batchQuantity: await num(`SELECT round(coalesce(sum("quantity"),0)::numeric, 6)::text AS v FROM "Batch" b JOIN "Product" p ON p."id" = b."productId" WHERE p."businessId" = $1`),
      receivable: await num(`SELECT round(coalesce(sum("total" - "paidAmount"),0)::numeric, 6)::text AS v FROM "Sale" WHERE "businessId" = $1`),
    };
    // Invariants that must hold independently of the source: each is a SQL count of violations.
    const violations = {
      paymentsVsPaidAmount: await num(`SELECT count(*)::text AS v FROM "Sale" s WHERE s."businessId" = $1 AND abs(s."paidAmount" - coalesce((SELECT sum(p."amount") FROM "Payment" p WHERE p."saleId" = s."id"), 0)) > 0.005`),
      stockVsBatches: await num(`SELECT count(*)::text AS v FROM "ProductStock" ps JOIN "Product" pr ON pr."id" = ps."productId" WHERE pr."businessId" = $1 AND EXISTS (SELECT 1 FROM "Batch" b WHERE b."productId" = ps."productId") AND abs(ps."quantity" - (SELECT sum(b."quantity") FROM "Batch" b WHERE b."productId" = ps."productId")) > 0.005`),
      receivableVsCustomerBalance: await num(`SELECT (abs((SELECT coalesce(sum("total" - "paidAmount"),0) FROM "Sale" WHERE "businessId" = $1) - (SELECT coalesce(sum("balance"),0) FROM "Customer" WHERE "businessId" = $1)) > 0.005)::int::text AS v`),
      orphanSaleItems: await num(`SELECT count(*)::text AS v FROM "SaleItem" i WHERE i."saleId" IN (SELECT "id" FROM "Sale" WHERE "businessId" = $1) AND NOT EXISTS (SELECT 1 FROM "Product" p WHERE p."id" = i."productId")`),
      orphanLogicalAuditBranch: await num(`SELECT count(*)::text AS v FROM "AuditLog" a WHERE a."businessId" = $1 AND a."branchId" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "Branch" b WHERE b."id" = a."branchId")`),
      orphanReturnItemProducts: await num(`SELECT count(*)::text AS v FROM "SaleReturnItem" r WHERE NOT EXISTS (SELECT 1 FROM "Product" p WHERE p."id" = r."productId")`),
    };
    return { sums, violations };
  }

  async function tenantTableCounts(client: Client, businessId: string) {
    const snapshotStore = new TenantBackupStore(client, directory, key);
    const snapshot = await snapshotStore.capture(businessId);
    return snapshot;
  }

  let tenantA: Tenant | undefined, tenantB: Tenant | undefined, tenantC: Tenant | undefined;
  try {
    // ---- 0. Two distinct PostgreSQL clusters; source/target migration identity. ----------------------
    const identity = async (client: Client) => (await client.$queryRaw<{ db: string; role: string; cluster: string }[]>`SELECT current_database() AS db, current_user AS role, (SELECT system_identifier::text FROM pg_control_system()) AS cluster`)[0];
    const [sourceId, targetId] = [await identity(source), await identity(target)];
    check("source and target are different PostgreSQL clusters, databases and roles", sourceId.cluster !== targetId.cluster && sourceId.db !== targetId.db && sourceId.role !== targetId.role, `source ${sourceId.db} / target ${targetId.db}`);
    const migrations = async (client: Client) => (await client.$queryRaw<{ migration_name: string; checksum: string }[]>`SELECT migration_name, checksum FROM "_prisma_migrations" WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL ORDER BY migration_name`);
    const [sourceMigrations, targetMigrations] = [await migrations(source), await migrations(target)];
    check("target migration history equals source (names and checksums)", JSON.stringify(sourceMigrations) === JSON.stringify(targetMigrations), sourceMigrations.map(entry => entry.migration_name).join(", "));

    // ---- 1. Seed synthetic tenants. Target gets an UNRELATED tenant C before recovery. ---------------
    const sourceBaseline = await fingerprint(source);
    await timed("seedSource", async () => { tenantA = await seedTenant(source, "tenant-A", true); tenantB = await seedTenant(source, "tenant-B", false); });
    await timed("seedTargetUnrelatedTenant", async () => { tenantC = await seedTenant(target, "tenant-C", true); });
    const A = tenantA!, B = tenantB!, C = tenantC!;
    const sourceAfterSeed = await fingerprint(source);
    const targetBeforeRestore = await fingerprint(target);
    const tenantCBefore = await tenantTableCounts(target, C.businessId);
    check("target holds no trace of the tenant to recover or of tenant B", (await target.business.count({ where: { id: { in: [A.businessId, B.businessId] } } })) === 0);

    // ---- 2. Backup from the source (read-only). -------------------------------------------------------
    const sourceStore = new TenantBackupStore(source, directory, key);
    const sourceSnapshot = await timed("capture", () => sourceStore.capture(A.businessId));
    const metadata = await timed("backupWrite", () => sourceStore.executeBackup(A.businessId));
    const archivePath = path.join(directory, metadata.filename);
    const archiveBytes = await fs.readFile(archivePath);
    const totalRows = Object.values(metadata.tables).reduce((sum, count) => sum + count, 0);
    check(`archive covers all ${format.backupModels.length} tenant models and only tenant A`, Object.keys(metadata.tables).length === format.backupModels.length && sourceSnapshot.tables.Business.length === 1 && Object.values(sourceSnapshot.tables).every(rows => rows.every(entry => !("businessId" in entry) || entry.businessId === A.businessId)), `${totalRows} rows, ${archiveBytes.length} bytes`);
    check("archive is encrypted and carries the migration identity", !archiveBytes.toString().includes("synthetic") && !archiveBytes.toString().includes("passwordHash") && JSON.parse(archiveBytes.toString()).migrations.length === sourceMigrations.length);
    check("backup status never claims restore verification", metadata.verified === false && metadata.recoveryStatus === "NOT_REHEARSED" && metadata.integrityVerified === true);
    const sourceAfterBackup = await fingerprint(source);
    check("source database byte-for-byte unchanged by backup", same(sourceAfterSeed, sourceAfterBackup), diff(sourceAfterSeed, sourceAfterBackup).join(","));

    // ---- 3. Negative cases against the target; target must be unchanged after every one. -------------
    const targetStore = new TenantBackupStore(target, directory, key);
    async function refused(name: string, work: () => Promise<unknown>, expected: RegExp, status?: number) {
      const before = await fingerprint(target);
      let message = "", code: number | undefined;
      try { await work(); } catch (error) { message = error instanceof Error ? error.message : String(error); code = (error as { status?: number }).status; }
      const after = await fingerprint(target);
      check(`refused without writes: ${name}`, expected.test(message) && (status === undefined || code === status) && same(before, after), message || "NOT REFUSED");
    }
    const envelope = JSON.parse(archiveBytes.toString());
    const write = async (name: string, content: Buffer | string) => { await fs.writeFile(path.join(directory, name), content); return name; };
    const newName = () => `backup-${randomUUID()}.pbackup`;
    const flipped = JSON.parse(archiveBytes.toString()); const cipher = Buffer.from(flipped.ciphertext, "base64"); cipher[cipher.length >> 1] ^= 0xff; flipped.ciphertext = cipher.toString("base64");
    await refused("corrupted ciphertext", async () => targetStore.restoreMissingTenant(A.businessId, await write(newName(), JSON.stringify(flipped))), /authentication|invalid/);
    await refused("truncated archive", async () => targetStore.restoreMissingTenant(A.businessId, await write(newName(), archiveBytes.subarray(0, archiveBytes.length >> 1))), /invalid|incomplete|legacy|authentication/);
    await refused("tampered manifest counts", async () => targetStore.restoreMissingTenant(A.businessId, await write(newName(), JSON.stringify({ ...envelope, counts: { ...envelope.counts, Payment: envelope.counts.Payment + 1 } }))), /authentication/);
    await refused("wrong encryption key", () => new TenantBackupStore(target, directory, randomBytes(32).toString("hex")).restoreMissingTenant(A.businessId, metadata.filename), /authentication/);
    await refused("legacy plaintext JSON export", async () => targetStore.restoreMissingTenant(A.businessId, await write(newName(), JSON.stringify({ sales: [], payments: [] }))), /legacy|invalid/);
    await refused("incompatible schema hash", async () => targetStore.restoreMissingTenant(A.businessId, await write(newName(), JSON.stringify({ ...envelope, schemaHash: "0".repeat(64) }))), /schema mismatch/);
    const foreignMigration = structuredClone(sourceSnapshot); foreignMigration.migrations = [...foreignMigration.migrations.slice(0, -1), { name: "202699990001_unknown_future", checksum: "c".repeat(64) }];
    await refused("incompatible migration history (authenticated archive, different schema lineage)", async () => targetStore.restoreMissingTenant(A.businessId, await write(newName(), format.sealSnapshot(foreignMigration, Buffer.from(key, "hex")))), /migration history differs/, 409);
    const incomplete = structuredClone(sourceSnapshot); delete incomplete.tables.Payment;
    await refused("authenticated archive missing the Payment table", async () => format.sealSnapshot(incomplete, Buffer.from(key, "hex")), /manifest/);
    await refused("tenant B identity against tenant A archive", () => targetStore.restoreMissingTenant(B.businessId, metadata.filename), /tenant or schema mismatch/);
    for (const unsafe of ["../outside.pbackup", "..\\outside.pbackup", path.join(directory, metadata.filename), `${metadata.filename}/../../${metadata.filename}`, "backup-not-a-uuid.pbackup", "nul", ""]) {
      await refused(`unsafe filename ${JSON.stringify(unsafe.length > 40 ? `${unsafe.slice(0, 37)}...` : unsafe)}`, () => targetStore.restoreMissingTenant(A.businessId, unsafe), /Invalid archive filename/);
    }
    await refused("missing archive file", () => targetStore.restoreMissingTenant(A.businessId, newName()), /unavailable/);
    const outside = path.resolve("scratch", `rehearsal-outside-${randomUUID()}.pbackup`);
    await fs.writeFile(outside, archiveBytes);
    const linkName = newName();
    let linked = false;
    try { await fs.symlink(outside, path.join(directory, linkName), "file"); linked = true; } catch { /* Windows may deny symlinks without privilege */ }
    if (linked) await refused("symlink escaping the backup directory", () => targetStore.restoreMissingTenant(A.businessId, linkName), /not confined|unavailable/);
    else check("symlink escape rehearsal", true, "NOT EXERCISED: operating system denied symlink creation (code path is covered by lstat/realpath checks only)");
    await fs.unlink(outside);
    const oversized = newName();
    const handle = await fs.open(path.join(directory, oversized), "wx"); await handle.truncate(format.MAX_BACKUP_BYTES + 1); await handle.close();
    await refused("oversized archive", () => targetStore.restoreMissingTenant(A.businessId, oversized), /size/);
    await fs.unlink(path.join(directory, oversized));

    // ---- 4. Restore tenant A into the disposable target. ---------------------------------------------
    const targetBeforeGoodRestore = await fingerprint(target);
    await timed("loadAndValidateArchive", () => targetStore.load(A.businessId, metadata.filename));
    await timed("restoreTransaction", () => targetStore.restoreMissingTenant(A.businessId, metadata.filename));
    check("restore recorded exactly one recovery audit entry", (await target.auditLog.count({ where: { businessId: A.businessId, action: "BACKUP_RESTORE" } })) === 1);

    // ---- 5. Reconcile. ------------------------------------------------------------------------------
    const restored = await timed("postRestoreCapture", () => targetStore.capture(A.businessId));
    const recoveryAudit = restored.tables.AuditLog.filter(entry => entry.action === "BACKUP_RESTORE");
    restored.tables.AuditLog = restored.tables.AuditLog.filter(entry => entry.action !== "BACKUP_RESTORE");
    for (const entry of recoveryAudit) delete restored.jsonDatabaseNulls.AuditLog[entry.id as string];
    const counts = Object.fromEntries(format.backupModels.map(entity => [entity.name, [sourceSnapshot.tables[entity.name].length, restored.tables[entity.name].length]]));
    const mismatched = Object.entries(counts).filter(([, [a, b]]) => a !== b).map(([name]) => name);
    check(`entity counts equal for all ${format.backupModels.length} models`, mismatched.length === 0, mismatched.join(",") || `${totalRows} rows`);
    const rowDiff = format.backupModels.map(entity => entity.name).filter(name => JSON.stringify(restored.tables[name]) !== JSON.stringify(sourceSnapshot.tables[name]) || JSON.stringify(restored.jsonDatabaseNulls[name]) !== JSON.stringify(sourceSnapshot.jsonDatabaseNulls[name]));
    for (const name of rowDiff) {
      const a = sourceSnapshot.tables[name], b = restored.tables[name];
      for (const [i, sourceRow] of a.entries()) for (const field of Object.keys(sourceRow)) if (JSON.stringify(sourceRow[field]) !== JSON.stringify(b[i]?.[field])) console.log(`DIFF ${name}[${i}].${field}: ${JSON.stringify(sourceRow[field])} vs ${JSON.stringify(b[i]?.[field])}`);
      console.log(`DIFF nulls ${name}: ${JSON.stringify(sourceSnapshot.jsonDatabaseNulls[name])} vs ${JSON.stringify(restored.jsonDatabaseNulls[name])}`);
    }
    check("every restored row equals its source row (IDs, timestamps, values, SQL-vs-JSON nulls)", rowDiff.length === 0, rowDiff.join(",") || `${format.backupModels.length}/${format.backupModels.length} models identical`);
    const [reconSource, reconTarget] = [await reconcile(source, A.businessId), await reconcile(target, A.businessId)];
    check("invoice, payment, balance, ledger, stock and batch totals identical source vs target", JSON.stringify(reconSource.sums) === JSON.stringify(reconTarget.sums), JSON.stringify(reconTarget.sums));
    check("target invariants hold: payments match paidAmount, stock matches batches, receivable matches customer balance, no orphans", Object.values(reconTarget.violations).every(value => value === "0"), JSON.stringify(reconTarget.violations));
    check("source satisfies the same invariants (rehearsal fixtures are internally consistent)", Object.values(reconSource.violations).every(value => value === "0"));
    check("expected synthetic totals: receivable 2380.74, payments 2075.25, stock 50 across products", reconTarget.sums.receivable === "2380.740000" && reconTarget.sums.paymentTotal === "2075.250000" && reconTarget.sums.stockQuantity === "50.000000", `receivable ${reconTarget.sums.receivable}, payments ${reconTarget.sums.paymentTotal}, stock ${reconTarget.sums.stockQuantity}`);
    check("audit history and request-deduplication records preserved", restored.tables.AuditLog.length === sourceSnapshot.tables.AuditLog.length && restored.tables.RequestResult.length === sourceSnapshot.tables.RequestResult.length && sourceSnapshot.tables.RequestResult.length === 3, `${restored.tables.AuditLog.length} audit, ${restored.tables.RequestResult.length} request results`);

    // ---- 6. Isolation, idempotence, source untouched. --------------------------------------------------
    const tenantCAfter = await tenantTableCounts(target, C.businessId);
    check(`unrelated tenant C in the target is untouched (all ${format.backupModels.length} models, every row)`, JSON.stringify(tenantCBefore.tables) === JSON.stringify(tenantCAfter.tables) && JSON.stringify(tenantCBefore.jsonDatabaseNulls) === JSON.stringify(tenantCAfter.jsonDatabaseNulls));
    check("tenant B (never restored) has no rows in the target", (await target.business.count({ where: { id: B.businessId } })) === 0 && (await target.sale.count({ where: { businessId: B.businessId } })) === 0);
    const targetAfterRestore = await fingerprint(target);
    const changedTables = diff(targetBeforeGoodRestore, targetAfterRestore);
    check("restore wrote only the recovered tenant's tables", changedTables.length > 0 && changedTables.every(name => counts[name] ? (counts[name] as number[])[0] > 0 || name === "AuditLog" : name === "AuditLog"), `${changedTables.length} tables changed`);
    await refused("second restore of an already-present tenant (no overwrite, no delete)", () => targetStore.restoreMissingTenant(A.businessId, metadata.filename), /absent tenant/, 409);
    check("target fingerprint before the first recovery equals its state before any negative case", same(targetBeforeRestore, targetBeforeGoodRestore));
    const sourceAfterRestore = await fingerprint(source);
    check("source database unchanged after the whole backup + restore + negative sequence", same(sourceAfterSeed, sourceAfterRestore), diff(sourceAfterSeed, sourceAfterRestore).join(","));

    // ---- 7. Cleanup of generated source fixtures only; prove no residue in the source. ----------------
    await removeTenant(source, A); await removeTenant(source, B);
    tenantA = tenantB = undefined;
    const sourceAfterCleanup = await fingerprint(source);
    check("source returned exactly to its pre-rehearsal content after generated-ID cleanup", same(sourceBaseline, sourceAfterCleanup), diff(sourceBaseline, sourceAfterCleanup).join(","));
    timings.totalRehearsal = Math.round(performance.now() - rehearsalStart);

    const report = {
      generatedAt: new Date().toISOString(), schemaHash: format.schemaHash, rows: totalRows, archiveBytes: archiveBytes.length,
      archiveSha256: createHash("sha256").update(archiveBytes).digest("hex"),
      migrations: sourceMigrations.map(entry => entry.migration_name), timingsMs: timings, counts, reconciliation: { source: reconSource, target: reconTarget },
      checks,
    };
    await fs.mkdir("scratch", { recursive: true });
    const reportFile = path.join("scratch", `rehearsal-results-${randomUUID()}.json`);
    await fs.writeFile(reportFile, JSON.stringify(report, null, 2));
    const failed = checks.filter(entry => !entry.ok);
    console.log(`\nRehearsal: ${checks.length - failed.length}/${checks.length} checks passed; timings ms ${JSON.stringify(timings)}; report ${reportFile}`);
    if (failed.length) process.exitCode = 1;
    tenantA = undefined;
  } finally {
    // Failure path: remove any still-registered generated source fixtures (generated IDs only).
    for (const leftover of [tenantA, tenantB]) if (leftover) await removeTenant(source, leftover).catch(() => undefined);
    for (const file of await fs.readdir(directory).catch(() => [])) await fs.unlink(path.join(directory, file)).catch(() => undefined);
    await fs.rmdir(directory).catch(() => undefined);
    await source.$disconnect(); await target.$disconnect();
    const { db } = await import("@dynapos/db"); await db.$disconnect();
  }
}
main().catch(error => { console.error(error instanceof Error ? error.message : "Rehearsal failed"); process.exitCode = 1; });
