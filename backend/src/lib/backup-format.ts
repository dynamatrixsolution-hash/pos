import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { Prisma } from "@dynapos/db";
import { z } from "zod";

export class BackupError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}
export type BackupRow = Record<string, unknown>;
export const MAX_BACKUP_BYTES = 64 * 1024 * 1024;
// Platform onboarding is not owned by an operating tenant.
export const excludedModels = ["BusinessRegistrationRequest"];
const models = Prisma.dmmf.datamodel.models.filter(model => !excludedModels.includes(model.name));
export const backupModels: typeof models = [];
const pending = [...models];
while (pending.length) {
  const index = pending.findIndex(model => model.fields.filter(field => field.relationFromFields?.length).every(field => backupModels.some(parent => parent.name === field.type)));
  if (index < 0) throw new Error("Backup schema has unsupported dependency cycle");
  backupModels.push(pending.splice(index, 1)[0]);
}
export const schemaHash = createHash("sha256").update(JSON.stringify(backupModels)).digest("hex");
export interface MigrationIdentity { name: string; checksum: string }
export interface TenantSnapshot {
  version: 2; businessId: string; createdAt: string; schemaHash: string;
  /** Finished Prisma migrations (name + checksum) of the database the snapshot was read from. */
  migrations: MigrationIdentity[];
  tables: Record<string, BackupRow[]>;
  jsonDatabaseNulls: Record<string, Record<string, string[]>>;
}
const envelopeSchema = z.object({
  format: z.literal("prayassh-tenant-backup"), version: z.literal(2),
  businessId: z.string().min(1), createdAt: z.string().datetime(), schemaHash: z.string().length(64),
  migrations: z.array(z.object({ name: z.string().min(1), checksum: z.string().length(64) }).strict()).min(1),
  counts: z.record(z.string(), z.number().int().nonnegative()),
  nonce: z.string().min(1), tag: z.string().min(1), ciphertext: z.string().min(1),
}).strict();

export function encryptionKey(encoded: string | undefined): Buffer {
  if (!encoded || !/^[a-fA-F0-9]{64}$/.test(encoded)) throw new BackupError("A separate 32-byte BACKUP_ENCRYPTION_KEY (hex) is required", 503);
  return Buffer.from(encoded, "hex");
}

export function validateSnapshot(input: unknown, businessId: string): TenantSnapshot {
  if (!input || typeof input !== "object") throw new BackupError("Invalid snapshot");
  const snapshot = input as TenantSnapshot;
  if (snapshot.version !== 2 || snapshot.businessId !== businessId || snapshot.schemaHash !== schemaHash || !snapshot.createdAt || !Number.isFinite(Date.parse(snapshot.createdAt))) throw new BackupError("Snapshot tenant, version or schema mismatch");
  if (!Array.isArray(snapshot.migrations) || !snapshot.migrations.length || snapshot.migrations.some(entry => !entry || typeof entry.name !== "string" || !entry.name || typeof entry.checksum !== "string" || entry.checksum.length !== 64)) throw new BackupError("Snapshot migration identity is missing or invalid");
  const names = backupModels.map(model => model.name).sort();
  if (!snapshot.tables || JSON.stringify(Object.keys(snapshot.tables).sort()) !== JSON.stringify(names) || !snapshot.jsonDatabaseNulls || JSON.stringify(Object.keys(snapshot.jsonDatabaseNulls).sort()) !== JSON.stringify(names)) throw new BackupError("Incomplete snapshot model manifest");
  const ids = new Map<string, Set<string>>();
  for (const model of backupModels) {
    const rows = snapshot.tables[model.name];
    if (!Array.isArray(rows)) throw new BackupError("Invalid snapshot rows");
    const fields = model.fields.filter(field => field.kind !== "object"), seen = new Set<string>();
    for (const row of rows) {
      if (!row || JSON.stringify(Object.keys(row).sort()) !== JSON.stringify(fields.map(field => field.name).sort())) throw new BackupError(`Incomplete ${model.name} fields`);
      if (typeof row.id !== "string" || !row.id || seen.has(row.id)) throw new BackupError(`Invalid ${model.name} identity`);
      seen.add(row.id);
      if ((model.name === "Business" && row.id !== businessId) || ("businessId" in row && row.businessId !== businessId)) throw new BackupError("Cross-tenant snapshot row");
      for (const field of fields) {
        const value = row[field.name];
        if (value === null && (!field.isRequired || field.type === "Json")) continue;
        const valid = field.type === "String" ? typeof value === "string" : field.type === "Boolean" ? typeof value === "boolean" :
          field.type === "Float" ? typeof value === "number" && Number.isFinite(value) :
          field.type === "Decimal" ? (typeof value === "string" && /^-?\d+(\.\d+)?$/.test(value)) || (typeof value === "number" && Number.isFinite(value)) :
          field.type === "Int" ? typeof value === "number" && Number.isInteger(value) && value >= -2147483648 && value <= 2147483647 :
          field.type === "DateTime" ? typeof value === "string" && Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value :
          field.type === "Json" ? value !== undefined : false;
        if (!valid) throw new BackupError(`Invalid ${model.name}.${field.name}`);
      }
    }
    ids.set(model.name, seen);
    const nulls = snapshot.jsonDatabaseNulls[model.name];
    if (!nulls || typeof nulls !== "object" || Array.isArray(nulls)) throw new BackupError("Invalid JSON null manifest");
    for (const [id, nullFields] of Object.entries(nulls)) {
      if (!seen.has(id) || !Array.isArray(nullFields) || new Set(nullFields).size !== nullFields.length) throw new BackupError("Invalid JSON null identity");
      const row = rows.find(candidate => candidate.id === id)!;
      for (const name of nullFields) if (!fields.some(field => field.name === name && field.type === "Json" && !field.isRequired) || row[name] !== null) throw new BackupError("Invalid JSON database-null marker");
    }
  }
  if (snapshot.tables.Business.length !== 1) throw new BackupError("Snapshot must contain exactly one business");
  for (const model of backupModels) for (const row of snapshot.tables[model.name]) {
    for (const field of model.fields.filter(field => field.relationFromFields?.length)) {
      if (field.relationFromFields!.length !== 1 || field.relationToFields?.[0] !== "id") throw new BackupError("Unsupported composite backup relation");
      const value = row[field.relationFromFields![0]];
      if (value !== null && !ids.get(field.type)?.has(value as string)) throw new BackupError(`Foreign or missing ${model.name} reference`);
    }
    const logical = ["SaleReturnItem", "PurchaseReturnItem"].includes(model.name) ? [["productId", "Product"]] : model.name === "AuditLog" ? [["branchId", "Branch"]] : model.name === "Sale" ? [["correctedInvoiceId", "Sale"]] : [];
    for (const [field, parent] of logical) if (row[field] !== null && !ids.get(parent)?.has(row[field] as string)) throw new BackupError(`Foreign or missing ${model.name} logical reference`);
  }
  return snapshot;
}
function header(snapshot: TenantSnapshot) {
  return { format: "prayassh-tenant-backup" as const, version: 2 as const, businessId: snapshot.businessId, createdAt: snapshot.createdAt, schemaHash: snapshot.schemaHash, migrations: snapshot.migrations, counts: Object.fromEntries(backupModels.map(model => [model.name, snapshot.tables[model.name].length])) };
}
export function sealSnapshot(snapshot: TenantSnapshot, key: Buffer): Buffer {
  validateSnapshot(snapshot, snapshot.businessId);
  const payload = Buffer.from(JSON.stringify(snapshot));
  if (payload.length > MAX_BACKUP_BYTES / 2) throw new BackupError("Snapshot exceeds supported archive size");
  const metadata = header(snapshot), nonce = randomBytes(12), cipher = createCipheriv("aes-256-gcm", key, nonce);
  cipher.setAAD(Buffer.from(JSON.stringify(metadata)));
  const ciphertext = Buffer.concat([cipher.update(payload), cipher.final()]);
  return Buffer.from(JSON.stringify({ ...metadata, nonce: nonce.toString("base64"), tag: cipher.getAuthTag().toString("base64"), ciphertext: ciphertext.toString("base64") }));
}
export function openSnapshot(bytes: Buffer, key: Buffer, businessId: string): TenantSnapshot {
  if (bytes.length > MAX_BACKUP_BYTES) throw new BackupError("Archive exceeds supported size");
  try {
    const parsed = envelopeSchema.parse(JSON.parse(bytes.toString("utf8")));
    if (parsed.businessId !== businessId || parsed.schemaHash !== schemaHash) throw new BackupError("Snapshot tenant or schema mismatch");
    const { nonce, tag, ciphertext, ...metadata } = parsed;
    const nonceBytes = Buffer.from(nonce, "base64"), tagBytes = Buffer.from(tag, "base64");
    if (nonceBytes.length !== 12 || tagBytes.length !== 16) throw new BackupError("Invalid archive encryption metadata");
    const decipher = createDecipheriv("aes-256-gcm", key, nonceBytes);
    decipher.setAAD(Buffer.from(JSON.stringify(metadata)));
    decipher.setAuthTag(tagBytes);
    const snapshot = validateSnapshot(JSON.parse(Buffer.concat([decipher.update(Buffer.from(ciphertext, "base64")), decipher.final()]).toString("utf8")), businessId);
    if (JSON.stringify(header(snapshot)) !== JSON.stringify(metadata)) throw new BackupError("Snapshot manifest mismatch");
    return snapshot;
  } catch (error) {
    if (error instanceof BackupError) throw error;
    throw new BackupError("Archive is invalid, incomplete, legacy or failed authentication");
  }
}
