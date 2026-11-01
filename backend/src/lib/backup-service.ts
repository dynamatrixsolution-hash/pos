import { db, Prisma, PrismaClient } from "@dynapos/db";
import { createHash, randomUUID } from "node:crypto";
import { promises as fs, constants } from "node:fs";
import path from "node:path";
import { BackupError, backupModels, BackupRow, encryptionKey, MigrationIdentity, MAX_BACKUP_BYTES, openSnapshot, schemaHash, sealSnapshot, TenantSnapshot, validateSnapshot } from "./backup-format";

export { BackupError } from "./backup-format";
export interface BackupMetadata {
  filename: string; sizeBytes: number; timestamp: string; tables: Record<string, number>;
  checksum: string; verified: false; integrityVerified: true; status: "SUCCESS";
  formatVersion: 2; recoveryStatus: "NOT_REHEARSED";
}
type Delegate = {
  findMany(args: { where: Record<string, unknown>; orderBy: { id: "asc" } }): Promise<BackupRow[]>;
  createMany(args: { data: BackupRow[] }): Promise<{ count: number }>;
};
function delegate(client: Prisma.TransactionClient, model: string): Delegate {
  return (client as unknown as Record<string, Delegate>)[model[0].toLowerCase() + model.slice(1)];
}
function scope(modelName: string, businessId: string): Record<string, unknown> {
  const model = backupModels.find(candidate => candidate.name === modelName)!;
  if (modelName === "Business") return { id: businessId };
  if (model.fields.some(field => field.name === "businessId")) return { businessId };
  const relations = model.fields.filter(field => field.relationFromFields?.length);
  if (!relations.length) throw new BackupError(`Unclassified tenant model: ${modelName}`);
  return { OR: relations.map(field => ({ [field.name]: scope(field.type, businessId) })) };
}
function identifier(name: string) {
  if (!/^[A-Za-z][A-Za-z0-9_]*$/.test(name)) throw new BackupError("Unsupported backup database identifier");
  return Prisma.raw(`"${name}"`);
}
/** Finished, not rolled-back migrations: the schema identity a snapshot is bound to. */
async function appliedMigrations(client: Prisma.TransactionClient): Promise<MigrationIdentity[]> {
  const rows = await client.$queryRaw<{ migration_name: string; checksum: string }[]>(Prisma.sql`SELECT migration_name, checksum FROM "_prisma_migrations" WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL ORDER BY migration_name`);
  return rows.map(row => ({ name: row.migration_name, checksum: row.checksum }));
}
function sameMigrations(a: MigrationIdentity[], b: MigrationIdentity[]) { return JSON.stringify(a) === JSON.stringify(b); }
function safeFailure(error: unknown, fallback: string) { return error instanceof BackupError ? error : new BackupError(fallback, 500); }

export class TenantBackupStore {
  private key: Buffer;
  constructor(private client: PrismaClient, private directory: string, encodedKey: string | undefined) {
    if (!path.isAbsolute(directory)) throw new BackupError("An absolute persistent BACKUP_DIRECTORY is required", 503);
    this.key = encryptionKey(encodedKey);
  }
  /** One MVCC snapshot, including historical/deleted rows; no independently timed table reads. */
  async capture(businessId: string): Promise<TenantSnapshot> {
    try {
      return await this.client.$transaction(async tx => {
        const tables: TenantSnapshot["tables"] = {}, jsonDatabaseNulls: TenantSnapshot["jsonDatabaseNulls"] = {};
        for (const model of backupModels) {
          let where = scope(model.name, businessId);
          if (["SaleReturnItem", "PurchaseReturnItem"].includes(model.name)) where = { OR: [where, { productId: { in: (tables.Product || []).map(row => row.id) } }] };
          const rows = await delegate(tx, model.name).findMany({ where, orderBy: { id: "asc" } });
          tables[model.name] = JSON.parse(JSON.stringify(rows));
          jsonDatabaseNulls[model.name] = {};
          const jsonFields = model.fields.filter(field => field.type === "Json" && field.kind !== "object");
          if (rows.length && jsonFields.length) {
            const flags = await tx.$queryRaw<BackupRow[]>(Prisma.sql`SELECT "id", ${Prisma.join(jsonFields.map(field => Prisma.sql`${identifier(field.name)} IS NULL AS ${identifier(field.name)}`))} FROM ${identifier(model.name)} WHERE "id" IN (${Prisma.join(rows.map(row => row.id as string))}) ORDER BY "id"`);
            for (const row of flags) {
              const nulls = jsonFields.filter(field => row[field.name] === true).map(field => field.name);
              if (nulls.length) jsonDatabaseNulls[model.name][row.id as string] = nulls;
            }
          }
        }
        const migrations = await appliedMigrations(tx);
        return validateSnapshot({ version: 2, businessId, createdAt: new Date().toISOString(), schemaHash, migrations, tables, jsonDatabaseNulls }, businessId);
      }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead, timeout: 60000 });
    } catch (error) { throw safeFailure(error, "Snapshot capture failed; no archive created"); }
  }
  private async root() {
    await fs.mkdir(this.directory, { recursive: true, mode: 0o700 });
    return fs.realpath(this.directory);
  }
  private async read(filename: string): Promise<Buffer> {
    if (!/^backup-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.pbackup$/.test(filename)) throw new BackupError("Invalid archive filename; legacy JSON recovery is unsupported");
    const root = await this.root(), file = path.join(root, filename);
    try {
      if ((await fs.lstat(file)).isSymbolicLink() || path.dirname(await fs.realpath(file)) !== root) throw new BackupError("Archive path is not confined");
      const handle = await fs.open(file, constants.O_RDONLY | (constants.O_NOFOLLOW || 0));
      try {
        const stat = await handle.stat();
        if (!stat.isFile() || stat.size > MAX_BACKUP_BYTES) throw new BackupError("Invalid archive file or size");
        return await handle.readFile();
      } finally { await handle.close(); }
    } catch (error) { throw safeFailure(error, "Archive unavailable"); }
  }
  async load(businessId: string, filename: string) { return openSnapshot(await this.read(filename), this.key, businessId); }
  private metadata(filename: string, bytes: Buffer, snapshot: TenantSnapshot): BackupMetadata {
    return { filename, sizeBytes: bytes.length, timestamp: snapshot.createdAt, tables: Object.fromEntries(backupModels.map(model => [model.name, snapshot.tables[model.name].length])), checksum: createHash("sha256").update(bytes).digest("hex"), verified: false, integrityVerified: true, status: "SUCCESS", formatVersion: 2, recoveryStatus: "NOT_REHEARSED" };
  }
  async executeBackup(businessId: string): Promise<BackupMetadata> {
    const snapshot = await this.capture(businessId), bytes = sealSnapshot(snapshot, this.key);
    const filename = `backup-${randomUUID()}.pbackup`, root = await this.root();
    const temporary = path.join(root, `${filename}.partial`), destination = path.join(root, filename);
    try {
      const handle = await fs.open(temporary, "wx", 0o600);
      try { await handle.writeFile(bytes); await handle.sync(); } finally { await handle.close(); }
      await fs.rename(temporary, destination);
      return this.metadata(filename, bytes, openSnapshot(bytes, this.key, businessId));
    } catch (error) {
      await fs.unlink(temporary).catch(() => undefined);
      throw safeFailure(error, "Encrypted archive write failed");
    }
  }
  async listBackups(businessId: string): Promise<BackupMetadata[]> {
    const result: BackupMetadata[] = [];
    for (const filename of (await fs.readdir(await this.root())).filter(name => name.endsWith(".pbackup"))) {
      try {
        const bytes = await this.read(filename);
        result.push(this.metadata(filename, bytes, openSnapshot(bytes, this.key, businessId)));
      } catch { /* Never trust legacy metadata, foreign tenants or unauthenticated files. */ }
    }
    return result.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  }
  /** Additive recovery only: no deletes, overwrites, ID remapping or recomputation. */
  async restoreMissingTenant(businessId: string, filename: string): Promise<void> {
    const snapshot = await this.load(businessId, filename);
    try {
      await this.client.$transaction(async tx => {
        // Schema/migration identity must match exactly before any row is written.
        if (!sameMigrations(snapshot.migrations, await appliedMigrations(tx))) throw new BackupError("Target database migration history differs from the archive; recovery refused before any write", 409);
        if (await tx.business.findUnique({ where: { id: businessId } })) throw new BackupError("In-place restore is disabled; recover only into an absent tenant", 409);
        for (const model of backupModels) {
          const data = snapshot.tables[model.name].map(row => {
            const result = { ...row };
            for (const field of model.fields.filter(field => field.type === "Json" && field.kind !== "object")) {
              if (row[field.name] === null) result[field.name] = snapshot.jsonDatabaseNulls[model.name][row.id as string]?.includes(field.name) ? Prisma.DbNull : Prisma.JsonNull;
            }
            return result;
          });
          if (data.length) await delegate(tx, model.name).createMany({ data });
        }
        await tx.auditLog.create({ data: { businessId, action: "BACKUP_RESTORE", module: "BACKUP", role: "RECOVERY_OPERATOR", details: `Recovered missing tenant from authenticated archive ${filename}; existing records were not overwritten.` } });
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 60000 });
    } catch (error) { throw safeFailure(error, "Recovery transaction failed; no data committed"); }
  }
}
export function configuredBackupStore() { return new TenantBackupStore(db, process.env.BACKUP_DIRECTORY || "", process.env.BACKUP_ENCRYPTION_KEY); }
export class BackupService {
  static executeBackup(businessId: string) { return configuredBackupStore().executeBackup(businessId); }
  static listBackups(businessId: string) { return configuredBackupStore().listBackups(businessId); }
  static async executeRestore(businessId: string, filename: string): Promise<never> {
    void businessId; void filename;
    throw new BackupError("Live overwrite restore is disabled. Use isolated operator recovery into an absent tenant.", 409);
  }
}
