import { db } from "@/lib/db";
import { Prisma } from "@dynapos/db";

export interface CreateAuditEventInput {
  businessId: string;
  branchId?: string | null;
  userId?: string | null;
  action: string;
  entity: string;
  entityId?: string | null;
  entityVersion?: number;
  oldValue?: any;
  newValue?: any;
  metadata?: any;
  reason?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
}

/**
 * Redact sensitive fields (passwords, tokens, secrets, encryption keys)
 */
export function sanitizeAuditData(data: any): any {
  if (data === null || data === undefined) return data;
  if (typeof data !== "object") return data;
  if (data instanceof Date) return data.toISOString();
  if (typeof data.toJSON === "function") return data.toJSON();

  if (Array.isArray(data)) {
    return data.map(item => sanitizeAuditData(item));
  }

  const sanitized: Record<string, any> = {};
  for (const [key, value] of Object.entries(data)) {
    if (/(?:password|hash|secret|token|encryptionkey|auth)/i.test(key)) {
      sanitized[key] = "[REDACTED]";
    } else if (typeof value === "object" && value !== null) {
      sanitized[key] = sanitizeAuditData(value);
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
}

/**
 * Record an append-only AuditEvent.
 * When passed a transaction client `tx`, failure to write the audit event
 * guarantees rollback of the enclosing transaction.
 */
export async function createAuditEvent(
  input: CreateAuditEventInput,
  tx?: Prisma.TransactionClient
) {
  const client = tx || db;

  return await (client as any).auditEvent.create({
    data: {
      businessId: input.businessId,
      branchId: input.branchId || null,
      userId: input.userId || null,
      action: input.action,
      entity: input.entity,
      entityId: input.entityId || null,
      entityVersion: input.entityVersion ?? 1,
      oldValue: input.oldValue !== undefined ? sanitizeAuditData(input.oldValue) : undefined,
      newValue: input.newValue !== undefined ? sanitizeAuditData(input.newValue) : undefined,
      metadata: input.metadata !== undefined ? sanitizeAuditData(input.metadata) : undefined,
      reason: input.reason || null,
      ipAddress: input.ipAddress || null,
      userAgent: input.userAgent || null,
    },
  });
}
