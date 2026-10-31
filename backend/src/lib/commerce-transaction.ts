import { createHash } from "node:crypto";
import { db } from "@/lib/db";
import { Prisma } from "@dynapos/db";
import { assertBranch, CommerceContext, CommerceError } from "./commerce-policy";

export async function resolveBranch(tx: Prisma.TransactionClient, context: CommerceContext, requested?: string | null) {
  const id = requested || context.branchId;
  const branch = id ? await tx.branch.findUnique({ where: { id } }) :
    ["OWNER", "SUPER_ADMIN"].includes(context.role) ? await tx.branch.findFirst({
      where: { businessId: context.businessId, deletedAt: null, isActive: true }, orderBy: { createdAt: "asc" },
    }) : null;
  return assertBranch(context, branch);
}

export async function checkBranch(context: CommerceContext, requested?: string | null) {
  return resolveBranch(db, context, requested);
}

export async function serializable<T>(work: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await db.$transaction(work, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, maxWait: 10000, timeout: 30000 });
    } catch (error) {
      if ((error as { code?: string }).code !== "P2034") throw error;
      if (attempt >= 3) throw new CommerceError("Concurrent update; retry with the same Idempotency-Key", 409);
    }
  }
}

/** Persist the response in the same transaction as all checkout effects. */
export async function commerceTransaction<T>(request: Request, context: CommerceContext, operation: string, body: unknown,
  work: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  const key = request.headers.get("Idempotency-Key");
  if (!key || !/^[a-zA-Z0-9_-]{16,128}$/.test(key)) throw new CommerceError("Idempotency-Key (16-128 characters) is required", 428);
  const requestHash = createHash("sha256").update(JSON.stringify({ userId: context.userId, branchId: context.branchId, role: context.role, body })).digest("hex");
  return serializable(async tx => {
    // Serialize same-business commands, including legacy callers of this wrapper.
    // Row lock also protects first sequence/fiscal-year creation without requiring a stock row to exist.
    await tx.business.update({ where: { id: context.businessId }, data: { updatedAt: new Date() } });
    const requested = body && typeof body === "object" && "branchId" in body && typeof body.branchId === "string" ? body.branchId : undefined;
    await resolveBranch(tx, context, requested);
    const where = { businessId_operation_key: { businessId: context.businessId, operation, key } };
    const existing = await tx.requestResult.findUnique({ where });
    if (existing) {
      if (existing.requestHash !== requestHash) throw new CommerceError("Idempotency key reused with different request", 409);
      return existing.response as T;
    }
    const result = await work(tx);
    const response = JSON.parse(JSON.stringify(result));
    await tx.requestResult.create({ data: { businessId: context.businessId, operation, key, requestHash, response } });
    return response as T;
  });
}
