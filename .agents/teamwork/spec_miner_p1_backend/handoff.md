# Phase 1 Specification Mining: Backend Authority Helpers, Endpoint Guards, and Atomic Audit Logging

**Milestone**: Phase 1: Security Foundation & Tenant Isolation  
**Specialist**: teamwork_spec_miner (Next.js 16 Route Handlers, Backend Authority Helpers, Audit Logging Architecture)  
**Target Audience**: Builder (Implementation), Tester (Adversarial Verification), Planner (Coordination)

---

## 1. Observation

Direct code and documentation observations across `backend/src`, `packages/db`, and authoritative phase specifications:

### 1.1 Existing Authentication & Session Handling
- **Runtime & Version**: Next.js `16.2.9`, React `19.2.4`, `next-auth` `5.0.0-beta.25` (`backend/package.json:14-18`).
- **Session Strategy**: Configured for JSON Web Tokens in `backend/src/auth.config.ts:8`:
  ```ts
  session: { strategy: "jwt" }
  ```
- **JWT Callback & Forgery Prevention**: In `backend/src/auth.config.ts:68-77`:
  ```ts
  async jwt({ token, user }) {
    if (user) {
      token.id = user.id;
      token.role = (user as any).role;
      token.businessId = (user as any).businessId;
      token.branchId = (user as any).branchId;
    }
    // Authority is resolved from the database, never from client session updates.
    return token;
  }
  ```
  Verified by `tests/session.test.ts:8-13`: Client session updates sending forged role (`OWNER`) or branch (`b1`) are ignored by `authConfig.callbacks.jwt`.
- **Server Database Authority Verification**: Implemented in `backend/src/lib/api-helper.ts:12-37` (`getSessionContext`):
  ```ts
  export async function getSessionContext(): Promise<SessionContext | null> {
    const session = await auth();
    const sessionUser = session?.user as { id?: string; businessId?: string } | undefined;
    if (!sessionUser?.id || !sessionUser.businessId) return null;

    const userExists = await db.user.findUnique({
      where: { id: sessionUser.id },
      select: { id: true, businessId: true, branchId: true, role: true, isActive: true, deletedAt: true, business: { select: { deletedAt: true } } },
    });

    if (!userExists || !userExists.isActive || userExists.deletedAt || userExists.business.deletedAt ||
        !["OWNER", "MANAGER", "CASHIER", "SUPER_ADMIN"].includes(userExists.role) ||
        userExists.businessId !== sessionUser.businessId) {
      return null;
    }
    if (!["OWNER", "SUPER_ADMIN"].includes(userExists.role) && !userExists.branchId) return null;

    return {
      userId: sessionUser.id as string,
      businessId: sessionUser.businessId as string,
      branchId: userExists.branchId,
      role: userExists.role,
    };
  }
  ```

### 1.2 Current Gaps in Backend Authority & Branch Isolation
1. **Single-Branch Constraint vs Multi-Branch Staff**:
   - `packages/db/prisma/schema.prisma:106-107`: `User` has only a single nullable column `branchId String?`.
   - `UserBranchMembership` model does **not yet exist** in `schema.prisma`.
   - `api-helper.ts:29` hard-fails any non-owner staff lacking `userExists.branchId`, making multi-branch staff assignment impossible without the new `UserBranchMembership` entity specified in `PHASE_1_SECURITY_AUTHORITY.md:13`.
2. **Inconsistent Endpoint Authorization**:
   - `backend/src/app/api/v1/customers/route.ts:132`: Accepts `branchId: data.branchId || context.branchId || null` without validating that `data.branchId` belongs to `context.businessId` or is assigned to the current actor.
   - `backend/src/app/api/v1/expenses/route.ts:139-144`: Verifies that `branchId` belongs to `context.businessId`, but does NOT verify that a `MANAGER` or `CASHIER` is actually assigned to that branch! Any manager can record expenses for another branch.
   - `backend/src/app/api/v1/branches/route.ts:28-31`: If query parameter `?all=true` is sent, non-owners (e.g. Cashiers) receive all branches of the business.
   - `backend/src/app/api/v1/branches/route.ts:50-52` & `users/route.ts:61-63`: Only blocks `CASHIER`, inadvertently allowing `MANAGER` to create branches and create/elevate users to `SUPER_ADMIN`/`OWNER`.
3. **RBAC Invariant Violations**:
   - `backend/src/lib/rbac.ts:19-25`: Grants `CASHIER` full CRUD permissions on `inventory`:
     ```ts
     { resource: "inventory", actions: ["create", "view", "update", "delete"] }
     ```
     This directly violates `PHASE_1_SECURITY_AUTHORITY.md:18`: *"Cashiers cannot move stock, modify price structures, or access tenant-wide financial reports."*
4. **Missing Composite Keys `(businessId, id)`**:
   - In `packages/db/prisma/schema.prisma`, `Branch`, `Product`, `Customer`, `Supplier`, `Sale`, `Payment`, `Expense`, `Income` only have `@id @default(uuid())` primary keys.
   - None of them have `@@unique([businessId, id])`.
   - Mutations in `backend/src/app/api/v1/branches/[id]/route.ts:60` and `users/[id]/route.ts:82` execute updates via `where: { id: params.id }`, risking cross-tenant update if an ID collision or improper check occurs.

### 1.3 Current Audit Logging Deficiencies
- `backend/src/lib/activity-logger.ts:44-63` (`logActivity`):
  ```ts
  try {
    return await db.auditLog.create({
      data: {
        businessId, userId: userId || null, role: role || null,
        branchId: branchId || null, warehouseId: warehouseId || branchId || null,
        module: moduleName, action: actionType, details,
        oldValue: oldValue ? JSON.parse(JSON.stringify(oldValue)) : null,
        newValue: newValue ? JSON.parse(JSON.stringify(newValue)) : null,
        deviceInfo, ipAddress,
      },
    });
  } catch (error) {
    console.error("Failed to log activity:", error);
  }
  ```
  - **Non-Transactional**: Executes independently against `db.auditLog.create` outside domain transactions.
  - **Swallows Errors**: The `catch (error)` block catches and logs to console without throwing.
  - **Zero Atomicity**: If `logActivity` fails, the domain mutation has already committed. If the domain mutation fails, the audit log never rolled back.
  - **Lacks Sensitive Data Redaction**: Passes `newValue` and `oldValue` directly without scrubbing `passwordHash` or session secrets.
  - **Schema Divergence**: Writes to `AuditLog` table. `AuditEvent` model specified in `PHASE_1_SECURITY_AUTHORITY.md:14` (with `actorId`, `operation`, `entityName`, `entityVersion`, `diff`, `reason`) is not yet created.

### 1.4 Next.js 16 Route Handler Conventions
- As documented in `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/route.md:80-97`:
  In Next.js 16, dynamic route context parameters are asynchronous:
  ```ts
  export async function PUT(
    request: Request,
    context: { params: Promise<{ id: string }> }
  ) {
    const { id } = await context.params;
  }
  ```
  Synchronous access to `context.params` throws or warns in Next.js 16.

---

## 2. Logic Chain

From the direct observations above, we establish the requirements and architectural blueprint:

```
[Incoming Request]
       │
       ▼
[NextAuth v5 Decryption via await auth()]
       │
       ├─ No session / invalid cookie? ──► 401 Unauthorized (authErrorResponse)
       │
       ▼
[Backend Authority Helper: requireAuth(request)]
       │
       ├─ Query User & Business by sessionUser.id & sessionUser.businessId
       ├─ User deleted / inactive / business deleted? ──► 401 Unauthorized
       ├─ Tenant mismatch (user.businessId !== session.businessId)? ──► 401 Unauthorized
       ├─ Role unknown / not in [SUPER_ADMIN, OWNER, MANAGER, CASHIER, etc.]? ──► 403 Forbidden
       ├─ Fetch UserBranchMembership records for user
       ├─ If non-owner/non-super-admin has 0 branch memberships ──► 403 Forbidden
       │
       ▼
[Return TenantAuthorityContext]
  { userId, businessId, role, activeBranchId, assignedBranchIds, capabilities, user, business }
       │
       ▼
[Route Guard: requireRole / requireCapability]
       │
       ├─ Cashier attempting stock adjustment or price edit? ──► 403 Forbidden
       ├─ Manager attempting user management or global settings? ──► 403 Forbidden
       │
       ▼
[Branch Guard: requireBranchAccess(context, targetBranchId, tx?)]
       │
       ├─ Branch belongs to different businessId? ──► 403 Forbidden
       ├─ Branch inactive or deleted? ──► 403 Forbidden
       ├─ Non-owner/non-super-admin not assigned to targetBranchId in UserBranchMembership? ──► 403 Forbidden
       │
       ▼
[Execute Domain Service in Prisma Interactive Transaction: db.$transaction]
       │
       ├─ Read & Mutate Domain Entities using composite keys (businessId, id)
       │
       ▼
[Atomic Audit Logging: recordAuditEvent(tx, params)]
       │
       ├─ Sanitize 'before', 'after', and 'diff' (strip passwordHash, secrets)
       ├─ Insert into AuditEvent table within SAME tx
       ├─ If AuditEvent write fails ──► Error propagates ──► $transaction ROLLS BACK
       │
       ▼
[Commit Transaction & Return Sanitized NextResponse.json]
```

---

## 3. Detailed Answers to Key Dispatch Questions

### Q1: How does the server currently authenticate requests?
1. NextAuth v5 (App Router compatible) manages sessions using signed, HttpOnly encrypted JWT cookies (`authjs.session-token`).
2. Incoming route handlers resolve the token by invoking `await auth()` from `backend/src/auth.ts`.
3. The server extracts `sessionUser.id` and `sessionUser.businessId`.
4. Crucially, the server does **not** rely on role or branch claims in the JWT. It executes a live database query (`db.user.findUnique`) in `getSessionContext` to retrieve active role and branch state.
5. In Phase 1, this mechanism must be standardized across **all** route handlers via `requireAuth` / `withTenantContext`.

### Q2: How must backend authority helpers read current database authority (fail-closed)?
The authority helper must enforce a strict fail-closed cascade:
1. **Unauthenticated / No Session**: If `await auth()` returns null or lacks `id`/`businessId`, return `401 Unauthorized`.
2. **Inactive / Soft-Deleted User**: If `user.isActive === false` or `user.deletedAt !== null`, return `401 Unauthorized`.
3. **Soft-Deleted Business**: If `user.business.deletedAt !== null`, return `401 Unauthorized`.
4. **Mismatched Tenant**: If `user.businessId !== sessionUser.businessId`, return `401 Unauthorized`.
5. **Unknown Role**: If `user.role` is not recognized, return `403 Forbidden`.
6. **Branchless Staff**: If `user.role` is not `OWNER` or `SUPER_ADMIN`, and the user has no active branch assigned via `UserBranchMembership` (or legacy `branchId`), return `403 Forbidden`.
7. **Unassigned Branch Mutation**: If a manager or cashier submits an operation targeting a `branchId` not in their `assignedBranchIds`, return `403 Forbidden`.
8. **Sensitive Field Redaction**: `user.passwordHash` must never be present in the returned context or API response.

### Q3: What exact function signatures and context objects should `requireAuth`, `requireBranchAccess`, `requireRole`, `withTenantContext` provide?

#### Context Type Contracts:
```ts
export interface TenantAuthorityContext {
  userId: string;
  businessId: string;
  role: "SUPER_ADMIN" | "OWNER" | "MANAGER" | "CASHIER" | string;
  activeBranchId: string | null;
  assignedBranchIds: string[];
  capabilities: Set<string>;
  user: {
    id: string;
    name: string;
    email: string;
    role: string;
    businessId: string;
    isActive: boolean;
  };
  business: {
    id: string;
    slug: string;
    name: string;
    isActive: boolean;
  };
}

export class AuthorityError extends Error {
  constructor(message: string, public status: 401 | 403 = 401) {
    super(message);
    this.name = "AuthorityError";
  }
}
```

#### Helper Signatures:
```ts
/**
 * Resolves current database authority from NextAuth session.
 * Throws AuthorityError(401) if unauthenticated/inactive/deleted.
 * Throws AuthorityError(403) if unknown role or branchless staff.
 */
export async function requireAuth(
  request?: Request
): Promise<TenantAuthorityContext>;

/**
 * Validates that actor possesses at least one of the required roles.
 * Throws AuthorityError(403) on mismatch.
 */
export function requireRole(
  context: TenantAuthorityContext,
  allowedRoles: string[]
): void;

/**
 * Validates that actor possesses a specific fine-grained capability.
 * Enforces cashier restrictions (no price edits, no inventory moves, no financial reports).
 */
export function requireCapability(
  context: TenantAuthorityContext,
  capability: string
): void;

/**
 * Validates that a branch belongs to the tenant and that the actor has permission to access it.
 * - OWNER & SUPER_ADMIN: Can access any active branch within the tenant.
 * - MANAGER & CASHIER: Can only access branches in context.assignedBranchIds.
 * Returns the verified branchId.
 */
export async function requireBranchAccess(
  context: TenantAuthorityContext,
  targetBranchId?: string | null,
  tx?: Prisma.TransactionClient
): Promise<string>;

/**
 * High-level wrapper for Route Handlers.
 * Automatically catches AuthorityError and returns standard 401/403 responses.
 */
export function withTenantContext<T = any>(
  handler: (
    req: Request,
    context: TenantAuthorityContext,
    routeParams?: T
  ) => Promise<NextResponse>
): (req: Request, routeProps?: { params: Promise<T> }) => Promise<NextResponse>;
```

### Q4: How should atomic audit logging be implemented?
1. **Transaction Co-Location**:
   - `recordAuditEvent` MUST accept `tx: Prisma.TransactionClient`.
   - The audit log record MUST be written within the same interactive database transaction (`db.$transaction`) as the domain entities.
2. **Rollback Behavior**:
   - `recordAuditEvent` MUST NOT catch and swallow errors.
   - If writing the `AuditEvent` fails (e.g. database disk error, foreign key violation, schema constraint), the error throws upward, aborting `tx`, which rolls back all domain mutations (stock decr, invoice generation, payment creation).
3. **Audited Actions & Entities**:
   - Financial mutations: `Sale`, `Payment`, `CreditNote`, `DebitNote`, `Expense`, `Income`.
   - Inventory mutations: `StockTransfer`, `OpeningStock`, `ProductStock`, `Batch`, manual adjustments.
   - Catalog & Pricing changes: `Product` cost/selling prices, `Category`, `TaxConfig`.
   - Identity & Security mutations: `User` creation/deletion/role change, `UserBranchMembership`, device authorization lock/unlock.
   - Branch configuration: `Branch` creation, editing, status toggling, soft deletion.
4. **Mandatory Schema for `AuditEvent`**:
   ```prisma
   model AuditEvent {
     id            String   @id @default(uuid())
     businessId    String
     business      Business @relation(fields: [businessId], references: [id], onDelete: Cascade)
     branchId      String?
     branch        Branch?  @relation(fields: [branchId], references: [id], onDelete: SetNull)
     actorId       String
     actor         User     @relation(fields: [actorId], references: [id], onDelete: Cascade)
     operation     String   // e.g. "CHECKOUT", "STOCK_TRANSFER", "PRICE_UPDATE", "USER_CREATE"
     entityName    String   // e.g. "Sale", "Payment", "Product", "User"
     entityId      String?
     entityVersion Int      @default(1)
     before        Json?
     after         Json?
     diff          Json?
     reason        String?
     ipAddress     String?
     userAgent     String?
     createdAt     DateTime @default(now())

     @@index([businessId, createdAt])
     @@index([businessId, entityName, entityId])
     @@index([businessId, actorId])
     @@index([businessId, branchId])
   }
   ```
5. **Sensitive Field Scrubbing**:
   The audit engine must recursively strip forbidden keys before serialization:
   `["passwordHash", "password", "sessionSecret", "token", "creditCard", "cvv"]`.

### Q5: How are Next.js 16 Route Handlers structured to enforce tenant isolation and branch validation on every endpoint?

```ts
// Example: backend/src/app/api/v1/products/[id]/route.ts
import { NextResponse } from "next/server";
import { withTenantContext, requireRole, requireBranchAccess } from "@/lib/auth-helpers";
import { recordAuditEvent } from "@/lib/audit-logger";
import { serializable } from "@/lib/commerce-transaction";
import { z } from "zod";

const updateProductSchema = z.object({
  sellingPrice: z.number().positive().optional(),
  costPrice: z.number().positive().optional(),
  name: z.string().min(2).optional(),
});

export const PUT = withTenantContext(async (req, context, routeParams: { id: string }) => {
  // 1. Role / Capability check: Cashiers cannot modify product pricing
  requireRole(context, ["OWNER", "MANAGER", "SUPER_ADMIN"]);

  const productId = routeParams.id;
  const body = await req.json();
  const parsed = updateProductSchema.parse(body);

  // 2. Execute mutation in transaction with atomic audit
  const updated = await serializable(async (tx) => {
    // Composite tenant query ensures no cross-tenant modification
    const existing = await tx.product.findFirst({
      where: { id: productId, businessId: context.businessId, deletedAt: null },
    });
    if (!existing) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    const result = await tx.product.update({
      where: { id: productId },
      data: { ...parsed },
    });

    // 3. Co-located atomic audit event
    await recordAuditEvent(tx, {
      businessId: context.businessId,
      branchId: context.activeBranchId,
      actorId: context.userId,
      operation: "PRICE_UPDATE",
      entityName: "Product",
      entityId: productId,
      before: { sellingPrice: existing.sellingPrice, costPrice: existing.costPrice },
      after: { sellingPrice: result.sellingPrice, costPrice: result.costPrice },
      reason: "Manager price revision",
      request: req,
    });

    return result;
  });

  return NextResponse.json(updated);
});
```

### Q6: What are the interface contracts for backend authority helpers to be used by route handlers and tests?

#### Helper Contracts (`backend/src/lib/auth-helpers.ts`):
```ts
export interface AuditEventParams {
  businessId: string;
  branchId?: string | null;
  actorId: string;
  operation: string;
  entityName: string;
  entityId?: string | null;
  entityVersion?: number;
  before?: Record<string, any> | null;
  after?: Record<string, any> | null;
  diff?: Record<string, any> | null;
  reason?: string | null;
  request?: Request | null;
}

export async function recordAuditEvent(
  tx: Prisma.TransactionClient,
  params: AuditEventParams
): Promise<void>;
```

#### Test Interface & Mock Contract for Adversarial Verification:
```ts
// In tests: Mock session token while verifying real DB authority
export function setSyntheticSession(user: { id: string; businessId: string; role?: string; branchId?: string });

// Integration test cases:
// 1. Cross-tenant rejection: User from Business A requests resource in Business B -> 403 / 404
// 2. Unassigned branch rejection: Manager assigned to Branch 1 mutates Branch 2 -> 403
// 3. Forged JWT claim rejection: JWT has role="OWNER", DB has role="CASHIER" -> acts as CASHIER (403 on owner endpoints)
// 4. Inactive/deleted user: User marked isActive=false in DB -> 401 Unauthorized
// 5. Atomic audit rollback: Mocking recordAuditEvent to throw -> asserts domain mutation is 100% rolled back in PostgreSQL
```

---

## 4. Features Discovered Table

| # | Category | Feature | Description | Inputs | Outputs | Error Behavior | Discovered Via |
|---|----------|---------|-------------|--------|---------|----------------|----------------|
| 1 | Auth | Current Database Authority | Overrides stale JWT claims with real-time DB User status | Request session token | `TenantAuthorityContext` | Returns `null` / 401 if user deleted or inactive | `api-helper.ts:12-37`, `session.test.ts` |
| 2 | Auth | JWT Callback Forgery Shield | Ignores client session `update` calls trying to mutate role/branch | Session update payload | Unmodified token | Ignores forged fields | `auth.config.ts:68-77`, `session.test.ts` |
| 3 | Tenant | Composite Tenant Key Constraints | Enforce `@@unique([businessId, id])` on all tenant resources | `businessId`, `id` | Relational integrity | PostgreSQL 23505 unique violation | `PHASE_1_SECURITY_AUTHORITY.md:8`, `schema.prisma` |
| 4 | Membership | `UserBranchMembership` | Multi-branch explicit staff permission mapping | `userId`, `branchId`, `businessId` | Membership record | 403 on unassigned branch access | `PHASE_1_SECURITY_AUTHORITY.md:13` |
| 5 | Role / RBAC | Cashier Invariant Guard | Restricts Cashiers from moving stock, editing prices, or viewing tenant financials | `role`, `action`, `resource` | Boolean allow/deny | 403 Forbidden | `PHASE_1_SECURITY_AUTHORITY.md:18`, `rbac.ts` |
| 6 | Branch | Branch Access Guard | Validates that branch belongs to tenant and staff is assigned | `context`, `branchId` | Validated `branchId` | 403 Forbidden | `commerce-policy.ts:assertBranch`, `commerce-transaction.ts` |
| 7 | Audit | Transactional `AuditEvent` | Co-located transactional audit logging in Prisma `$transaction` | `tx`, `AuditEventParams` | Persisted `AuditEvent` | Throws error; transaction rolls back | `PHASE_1_SECURITY_AUTHORITY.md:14,25` |
| 8 | Security | Sensitive Data Redaction | Strips `passwordHash`, session secrets, tokens from responses & audits | Entity payload | Sanitized JSON | Strips matched keys recursively | `PHASE_1_SECURITY_AUTHORITY.md:21` |
| 9 | Next.js 16 | Async Route Context Params | Route handler dynamic parameters resolve as `Promise<{ id: string }>` | `context.params` | Awaited param object | Type error / runtime warning if accessed sync | Next.js 16 route docs (`route.md`) |
| 10 | Concurrency | Serializable Transaction Engine | Retries P2034 serialization conflicts up to 4 attempts | `work(tx)` | Transaction result | 409 Conflict if exhausted | `commerce-transaction.ts:19-28` |
| 11 | Outbox | Domain Outbox Pattern | Append-only `OutboxEvent` written atomically with domain writes | Domain event payload | `OutboxEvent` row | Aborts transaction on outbox failure | `stack.md:41`, `IMPLEMENTATION_PLAN.md:99` |
| 12 | Subscriptions | Business Usage Limits Guard | Enforces plan limits for users, branches, warehouses, transactions | `businessId`, operation | Allowed / Denied | 400 / 403 with upgrade notice | `api-helper.ts:53-92` |

---

## 5. Edge Cases Table

| # | Feature | Input | Observed Behavior |
|---|---------|-------|-------------------|
| 1 | JWT Authority | Session token claims `role: "OWNER"`, but database record was downgraded to `CASHIER` | Server treats actor as `CASHIER`; attempts to access owner settings or delete resources return 403 Forbidden. |
| 2 | Deactivated User | Valid unexpired session token, but `user.isActive` set to `false` in database | Endpoint returns 401 Unauthorized; zero database mutations occur. |
| 3 | Soft-Deleted Business | Valid token, but `business.deletedAt` set to timestamp | Endpoint returns 401 Unauthorized; tenant cannot execute queries or mutations. |
| 4 | Cross-Tenant Branch Injection | Tenant A user submits POST `/api/v1/customers` with `branchId` belonging to Tenant B | `requireBranchAccess` detects `branch.businessId !== context.businessId` and rejects with 403 Forbidden. |
| 5 | Unassigned Branch Transfer | Manager assigned to Branch 1 attempts stock transfer from Branch 2 to Branch 3 | `requireBranchAccess` fails for source and/or target branch; mutation rejected with 403 Forbidden. |
| 6 | Intentional Audit Failure | `recordAuditEvent` throws within `tx` (e.g. simulated DB error) | Entire `$transaction` rolls back; stock quantities, invoice counters, and payment records remain unchanged in PostgreSQL. |
| 7 | Sensitive Field Exposure | User creation or profile update endpoint produces audit log and JSON response | `passwordHash` is pruned from both `AuditEvent.after` payload and the HTTP response body. |
| 8 | Next.js 16 Params Unwrapping | Request to `/api/v1/branches/[id]` accessing `context.params.id` without `await` | Fails or warns in Next.js 16; must do `const { id } = await context.params`. |

---

## 6. Caveats

1. **Database Schema Additions Required**:
   - `UserBranchMembership`, `AuditEvent`, and `CapabilityFlag` do not exist in the current Prisma schema (`packages/db/prisma/schema.prisma`). They must be added via a Prisma migration.
2. **Backfill Strategy for Existing Users**:
   - Existing staff currently store branch assignment in `User.branchId`.
   - When introducing `UserBranchMembership`, a migration script must backfill existing `(userId, branchId)` pairings to ensure no active staff lose branch access upon deployment.
3. **Legacy `AuditLog` vs `AuditEvent`**:
   - The repository contains an older `AuditLog` model (`activity-logger.ts`).
   - The new `AuditEvent` model specified for Phase 1 must be created cleanly without breaking legacy readers, or migrated seamlessly.
4. **Performance of Per-Request Authority Lookups**:
   - `requireAuth` performs a database lookup on every API request. Proper database indexes on `User.id`, `(businessId, id)`, and `UserBranchMembership(userId, branchId)` are critical to prevent connection pool exhaustion.

---

## 7. Conclusion

Phase 1 Security Foundation & Tenant Isolation requires transitioning from ad-hoc endpoint checks to a unified, fail-closed architecture:
1. **Centralize Authority in `auth-helpers.ts`**: Replace disparate checks (`api-helper.ts`, `api-auth.ts`, `commerce-policy.ts`) with `requireAuth`, `requireBranchAccess`, `requireRole`, and `withTenantContext`.
2. **Add Schema Models**: Add `UserBranchMembership`, `AuditEvent`, `CapabilityFlag`, and composite unique constraints `@@unique([businessId, id])` across tenant tables.
3. **Make Audit Logging Truly Atomic**: Replace `logActivity` with `recordAuditEvent` running inside Prisma `$transaction`, guaranteeing complete rollback on audit failure.
4. **Comply with Next.js 16**: Ensure all dynamic route handlers unwrap `params` as a Promise (`await context.params`).

---

## 8. Verification Method

To verify Phase 1 implementation independently:

1. **Unit Tests (Authority & Logic)**:
   ```bash
   node node_modules/vitest/vitest.mjs run tests/session.test.ts tests/commerce-policy.test.ts
   ```
   *Pass criteria*: Exit code 0, 100% assertions green.

2. **TypeScript Layout & App Router Compilation**:
   ```bash
   npm.cmd run typecheck
   ```
   *Pass criteria*: Exit code 0 across both frontend and backend without type errors.

3. **Real PostgreSQL Integration & Adversarial Rollback Tests**:
   Against the local loopback PostgreSQL instance on port `55439`:
   ```bash
   node scripts/restro-env.mjs integration
   ```
   *Scenarios to verify*:
   - Attempt cross-tenant queries -> assert 403 Forbidden.
   - Attempt unassigned branch mutation -> assert 403 Forbidden.
   - Send forged JWT role/branch claims -> assert server executes under real DB authority.
   - Deactivate user in DB -> assert immediate 401 Unauthorized.
   - Trigger intentional error in `recordAuditEvent` inside `$transaction` -> assert domain mutation (e.g. Sale, Stock, Payment) is 100% rolled back.
