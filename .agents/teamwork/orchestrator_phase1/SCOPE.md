# Scope: Phase 1 — Security Foundation & Tenant Isolation

## Architecture
- **Tenant Isolation**: Kernel-level PostgreSQL isolation via composite keys `(businessId, id)` and composite foreign keys binding child resources to parent resources under identical `businessId`.
- **Database Authority**: Server-derived current authority reading live PostgreSQL database records on every request, failing closed for inactive/deleted users/tenants, unknown roles, or unassigned branches.
- **Multi-Branch Membership**: `UserBranchMembership` entity mapping staff to assigned branches within their tenant with fine-grained role overrides and default branch designation.
- **Atomic Audit Trail**: Transactional `AuditEvent` table co-located in Prisma interactive transactions (`$transaction`), aborting domain mutations if audit recording fails. Sensitive fields (`passwordHash`, secrets) automatically sanitized.
- **Hospitality UI/UX**: RestroInn design system compliance with strict color isolation (Burgundy, Ivory, Porcelain, Espresso, Stone, Ochre, Forest, Red), dynamic multi-branch selector in header, and token-compliant 401/403 security states.
- **Adversarial Verification**: Automated test harness running on isolated loopback PostgreSQL container (`127.0.0.1:55439`) proving cross-tenant rejection, unassigned branch rejection, forged JWT rejection, and atomic rollback on audit failure.

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | `UserBranchMembership` Model | Explicit staff-to-branch allocation table with unique indices and default branch flag | M1 | Survey |
| 2 | `AuditEvent` Model | Append-only transactional audit trail model capturing actor, entity diffs, and reason | M1 | Survey |
| 3 | Composite Unique Keys `(businessId, id)` | `@@unique([businessId, id])` on all 30 tenant models in `schema.prisma` | M1 | Survey |
| 4 | Composite PostgreSQL Foreign Keys | Kernel-level composite foreign keys in SQL migration enforcing relational tenant integrity | M1 | Survey |
| 5 | Dual DB Migration & User Backfill | Migration script backfilling existing users into `UserBranchMembership`, deployed to `55439` and `55440` | M1 | Survey |
| 6 | Backup/Recovery Model Synchronization | Update `recovery.integration.test.ts` model count (41 -> 43) and `rehearse-recovery.ts` | M1 | Survey |
| 7 | Server Database Authority Helpers | `requireAuth` resolving live database authority, failing closed for inactive/deleted users/tenants | M2 | Survey |
| 8 | Multi-Branch Access Guard | `requireBranchAccess` validating branch belongs to tenant and staff is allocated via `UserBranchMembership` | M2 | Survey |
| 9 | Role & Capability Guards | `requireRole` and `requireCapability` enforcing cashier restrictions (no price edits, no inventory moves, no financial reports) | M2 | Survey |
| 10 | Route Handler Context Wrapper | `withTenantContext` wrapper handling Next.js 16 async params and standardized 401/403 responses | M2 | Survey |
| 11 | Atomic Audit Logger | `recordAuditEvent(tx, params)` executing inside interactive transaction with sensitive data scrubbing | M2 | Survey |
| 12 | Route Handler Hardening | Refactor key routes (`customers`, `expenses`, `branches`, `products`, `users`) with tenant authority guards | M2 | Survey |
| 13 | RestroInn 401 & 403 UX States | Token-compliant Porcelain cards with Ochre (401) and Red (403) status badges, removing gradient anti-patterns | M3 | Survey |
| 14 | Staff Branch Selector Component | Header dropdown for multi-branch staff/owners, static badge for single branch, fail-closed for 0 branches | M3 | Survey |
| 15 | Branch Selection Session Persistence | Server-validated active branch preference endpoint / cookie verified against `UserBranchMembership` | M3 | Survey |
| 16 | Cross-Tenant Adversarial Tests | Integration tests asserting 403/404 on cross-tenant resource access | M4 | Survey |
| 17 | Unassigned Branch Adversarial Tests | Integration tests asserting 403 on mutations targeting unassigned branches | M4 | Survey |
| 18 | Forged JWT Claim Adversarial Tests | Integration tests asserting client-tampered role/branch claims are overridden by live DB authority | M4 | Survey |
| 19 | Inactive/Deleted User Adversarial Tests | Integration tests asserting 401 on deactivated/deleted user requests | M4 | Survey |
| 20 | Atomic Audit Rollback Adversarial Tests | Integration tests proving complete rollback of domain writes when `AuditEvent` insert fails | M4 | Survey |
| 21 | Regression Test Suite Verification | Verification of 100% pass rate across recovery test, integration tests, unit tests, and typecheck | M4 | Survey |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | Database Schema & Relational Integrity | Prisma schema updates (`UserBranchMembership`, `AuditEvent`, `@@unique([businessId, id])`), SQL migration `202610310001_phase1_security_foundation`, user backfill, dual DB deployment (`55439` & `55440`), backup model sync | none | READY |
| M2 | Backend Authority Helpers & Atomic Audit Logging | `auth-helpers.ts` (`requireAuth`, `requireBranchAccess`, `requireRole`, `requireCapability`, `withTenantContext`), `audit-logger.ts` (`recordAuditEvent`), sensitive data redactor, Next.js 16 route handlers | M1 | PENDING |
| M3 | RestroInn UI/UX Branch Selector & Security States | Refactor `protected.tsx` with tokenized 401/403 states, update `dashboard-shell-client.tsx` with dynamic multi-branch selector, active branch preference API | M2 | PENDING |
| M4 | Adversarial Integration Tests & System Verification | Comprehensive adversarial test suite in `tests/security-authority.integration.test.ts`, regression checks (`restro-env.mjs integration`, `recovery-test`, `rehearse`, `typecheck`, unit tests) | M2, M3 | PENDING |

## Interface Contracts

### Backend Authority Context (`backend/src/lib/auth-helpers.ts`)
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

export async function requireAuth(request?: Request): Promise<TenantAuthorityContext>;
export function requireRole(context: TenantAuthorityContext, allowedRoles: string[]): void;
export function requireCapability(context: TenantAuthorityContext, capability: string): void;
export async function requireBranchAccess(context: TenantAuthorityContext, targetBranchId?: string | null, tx?: any): Promise<string>;
export function withTenantContext<T = any>(
  handler: (req: Request, context: TenantAuthorityContext, routeParams?: T) => Promise<Response>
): (req: Request, routeProps?: { params: Promise<T> }) => Promise<Response>;
```

### Transactional Audit Logging (`backend/src/lib/audit-logger.ts`)
```ts
export interface AuditEventParams {
  businessId: string;
  branchId?: string | null;
  actorId: string;
  action: string;
  entity: string;
  entityId?: string | null;
  entityVersion?: number;
  oldValue?: Record<string, any> | null;
  newValue?: Record<string, any> | null;
  metadata?: Record<string, any> | null;
  reason?: string | null;
  request?: Request | null;
}

export async function recordAuditEvent(tx: any, params: AuditEventParams): Promise<void>;
export function sanitizeAuditPayload<T>(payload: T): T;
```

### Code Layout
- `packages/db/prisma/schema.prisma` — Prisma models: `UserBranchMembership`, `AuditEvent`, composite unique constraints
- `packages/db/prisma/migrations/202610310001_phase1_security_foundation/migration.sql` — Migration script with user backfill & composite foreign keys
- `backend/src/lib/auth-helpers.ts` — Central authority helpers & route guard wrappers
- `backend/src/lib/audit-logger.ts` — Transactional atomic audit logger & sensitive data scrubbing
- `backend/src/lib/backup-format.ts` — Backup model catalog & composite relation handling
- `frontend/src/components/protected.tsx` — 401 Unauthorized & 403 Forbidden RestroInn UI components
- `frontend/src/components/dashboard-shell-client.tsx` — Staff branch selector in navigation header
- `backend/src/app/api/v1/auth/active-branch/route.ts` — Active branch selection persistence endpoint
- `tests/security-authority.integration.test.ts` — Adversarial security and tenant isolation integration test suite
