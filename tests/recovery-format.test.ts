import { describe, expect, it } from "vitest";
import { randomBytes } from "node:crypto";
import { BackupService, TenantBackupStore } from "../backend/src/lib/backup-service";
import { backupModels, encryptionKey, openSnapshot, schemaHash, sealSnapshot, type TenantSnapshot } from "../backend/src/lib/backup-format";
import { db } from "@dynapos/db";

function snapshot(): TenantSnapshot {
  const result: TenantSnapshot = { version: 2, businessId: "synthetic-only", createdAt: "2026-10-31T00:00:00.000Z", schemaHash, migrations: [{ name: "202610300001_retail_baseline", checksum: "a".repeat(64) }], tables: {}, jsonDatabaseNulls: {} };
  for (const model of backupModels) { result.tables[model.name] = []; result.jsonDatabaseNulls[model.name] = {}; }
  result.tables.Business = [{ id: result.businessId, name: "Synthetic only", slug: "synthetic-only", logo: null, phone: null, email: null, address: null, currency: "NPR", taxConfig: null, settings: null, createdAt: result.createdAt, updatedAt: result.createdAt, deletedAt: null }];
  result.jsonDatabaseNulls.Business[result.businessId] = ["taxConfig", "settings"];
  return result;
}
describe("encrypted recovery format and safe defaults", () => {
  it("requires an explicit encryption key and absolute storage path", () => {
    expect(() => encryptionKey(undefined)).toThrow("BACKUP_ENCRYPTION_KEY");
    expect(() => encryptionKey("short")).toThrow("BACKUP_ENCRYPTION_KEY");
    expect(() => new TenantBackupStore(db, "relative", randomBytes(32).toString("hex"))).toThrow("absolute persistent");
  });
  it("encrypts nondeterministically and authenticates tenant identity and metadata", () => {
    const data = snapshot(), key = randomBytes(32);
    const first = sealSnapshot(data, key), second = sealSnapshot(data, key);
    expect(first.equals(second)).toBe(false);
    expect(openSnapshot(first, key, data.businessId)).toEqual(data);
    const tampered = JSON.parse(first.toString()); tampered.createdAt = "2025-01-01T00:00:00.000Z";
    expect(() => openSnapshot(Buffer.from(JSON.stringify(tampered)), key, data.businessId)).toThrow("authentication");
    expect(() => openSnapshot(first, key, "foreign")).toThrow("tenant or schema mismatch");
  });
  it("rejects legacy exports, changed schemas and missing financial tables", () => {
    const key = randomBytes(32), data = snapshot();
    expect(() => openSnapshot(Buffer.from('{"sales":[]}'), key, data.businessId)).toThrow("legacy");
    data.schemaHash = "0".repeat(64);
    expect(() => sealSnapshot(data, key)).toThrow("schema mismatch");
    data.schemaHash = schemaHash; delete data.tables.Payment;
    expect(() => sealSnapshot(data, key)).toThrow("manifest");
  });
  it("binds archives to a migration identity and rejects a missing or malformed one", () => {
    const key = randomBytes(32), data = snapshot();
    const sealed = sealSnapshot(data, key);
    expect(JSON.parse(sealed.toString()).migrations).toEqual(data.migrations);
    const stripped = JSON.parse(sealed.toString()); delete stripped.migrations;
    expect(() => openSnapshot(Buffer.from(JSON.stringify(stripped)), key, data.businessId)).toThrow("legacy");
    const swapped = JSON.parse(sealed.toString()); swapped.migrations = [{ name: "202610300001_retail_baseline", checksum: "b".repeat(64) }];
    expect(() => openSnapshot(Buffer.from(JSON.stringify(swapped)), key, data.businessId)).toThrow("authentication");
    data.migrations = [];
    expect(() => sealSnapshot(data, key)).toThrow("migration identity");
  });
  it("blocks every legacy live-restore request before configuration or database access", async () => {
    await expect(BackupService.executeRestore("synthetic-only", "old.json")).rejects.toMatchObject({ status: 409 });
  });
});
