# Phase 1: Security Foundation & Tenant Isolation

> **Status**: Completed & Verified.
> **Dependencies**: Phase 0.
> **Verification**: `tests/phase1-security.integration.test.ts` (14/14 passed), `scripts/restro-env.mjs security-test`, `scripts/restro-env.mjs recovery-test` (8/8 passed), `npm run typecheck` (0 errors).

## 1. Objectives Completed
- Enforced server-derived current authority across API endpoints and access checks (`verifyBranchAccess`, `verifyBusinessAccess`).
- Added composite tenant foreign keys `(businessId, id)` across all tenant models to prevent cross-tenant data access.
- Added `UserBranchMembership` model to restrict multi-branch staff from executing mutations in unassigned branches.
- Implemented atomic `AuditEvent` logging with sensitive data sanitization (`sanitizeAuditData`) and full transactional rollback support.

## 2. Key Entities & Schema Additions
- `UserBranchMembership`: Explicit mapping between staff users and permitted branches with `isActive` status.
- `AuditEvent`: Append-only audit record capturing `actorId`, `businessId`, `branchId`, `action`, `entity`, `entityId`, `entityVersion`, `oldValue`, `newValue`, `metadata`, `ipAddress`, and `reason`.
- Composite unique indices `@@unique([businessId, id])` on all 29 tenant models.

## 3. Strict Rules & Invariants Enforced
- Cashiers cannot modify settings, move stock, or delete users.
- Inactive or deleted users/businesses fail closed immediately on the server.
- Passwords, hashes, tokens, auth headers, and secrets are automatically redacted to `[REDACTED]` prior to audit persistence.
- Transactional rollback: Any failure during domain transaction or audit write atomically rolls back the entire transaction.

## 4. Verification Suite
- `tests/phase1-security.integration.test.ts`:
  - 14/14 automated assertions covering branch authority, user branch membership activation/deactivation, cross-tenant isolation, audit redaction, and atomic rollback.
- Disaster recovery rehearsal (`scripts/restro-restore-env.mjs rehearse`): 41/41 model checks passed.
- Recovery integration tests (`scripts/restro-env.mjs recovery-test`): 8/8 passed.
