# Phase 1 Security Foundation & Tenant Isolation: Database Schema & Relational Constraints Specification

## 1. Observation

### 1.1 Authoritative Sources Inspected
1. `c:\projects\pos\.agents\teamwork\ORIGINAL_REQUEST.md` (lines 38–56): Mandates implementation of Phase 1: Security Foundation & Tenant Isolation as specified in `PHASE_1_SECURITY_AUTHORITY.md`, coordinating Planner, Designer, Builder, and Tester roles.
2. `c:\projects\pos\docs\hospitality\phases\PHASE_1_SECURITY_AUTHORITY.md`: Authoritative milestone document specifying server-derived authority, composite tenant foreign keys `(businessId, id)`, `UserBranchMembership`, append-only `AuditEvent`, `CapabilityFlag`, and atomic rollback on audit failure.
3. `c:\projects\pos\.agent\skill\stack.md` (§ 3 & § 4): Authoritative technology stack specifying Next.js 16 Route Handlers, PostgreSQL 15+, Prisma 6.19.3 with custom SQL migrations, composite tenant integrity `(businessId, id)` on all branch-scoped tables, and immutable financial ledgers.
4. `c:\projects\pos\docs\hospitality\IMPLEMENTATION_PLAN.md` (§ "Proposed persistence and invariants" & § "Shared core changes", lines 90–99, 148): Mandates adding unique `(businessId, id)` keys, composite tenant references, `UserBranchMembership`, explicit capability checks, and transaction-safe `AuditEvent`.
5. `c:\projects\pos\docs\hospitality\PHASE_0_READINESS_REPORT.md` (lines 28–46): Verifies Phase 0 verification suite (41/41 rehearsal checks, 8/8 recovery tests, 0 typecheck errors, 30/30 unit tests) and approves Phase 1 progression on isolated dev target `127.0.0.1:55439`.
6. `c:\projects\pos\packages\db\prisma\schema.prisma` (847 lines): Canonical Prisma schema containing 42 models.
7. `c:\projects\pos\packages\db\prisma\migrations/`: Contains two applied migrations:
   - `202610300001_retail_baseline` (checksum `b6ad5ae0ccb47977468582b33c14a9332b79a4c4aa9b44801e81eae3a4b5e5c6`)
   - `202610300002_commerce_hardening` (checksum `bfefae88d0f161c623833f831e24b74822c496844b425e582dc63af0effd7330`)
8. `c:\projects\pos\backend\src\lib\backup-format.ts` (lines 11–20, 81–88): Calculates `backupModels` dynamically from `Prisma.dmmf.datamodel.models` (excluding `BusinessRegistrationRequest`), creates `schemaHash`, and contains strict validation rules:
   - Line 82: `if (field.relationFromFields!.length !== 1 || field.relationToFields?.[0] !== "id") throw new BackupError("Unsupported composite backup relation");`
9. `c:\projects\pos\tests\recovery.integration.test.ts` (line 83): Explicitly asserts `expect(Object.keys(original.tables)).toHaveLength(41);`.
10. `c:\projects\pos\tests\commerce.integration.test.ts` (lines 219–240): Tests atomic rollback of sale, payment, ledger, stock, and audit when an intentional database trigger fails during insert on `"AuditLog"`.

### 1.2 Active Database State Probed (`127.0.0.1:55439/restro_test`)
A live query via `@dynapos/db` directly on PostgreSQL revealed:
- `_prisma_migrations`: Exactly the 2 recorded migrations above are finished and not rolled back.
- Public tables count: 43 (including `_prisma_migrations`, and 42 entity tables).
- Existing records in development database:
  - `Business`: 1 row (`id: e9b51092-5ac6-4ee3-9f82-1add8ceafc77`)
  - `Branch`: 1 row (`id: 6a00468d-10d6-4bce-8995-914bbcb1ad29`, `businessId: e9b51092-5ac6-4ee3-9f82-1add8ceafc77`)
  - `User`: 2 rows (`cashier@restroinn.com`, `owner@restroinn.com`, both assigned to the business and main branch)
  - `AuditLog`: 2 rows
  - All other business entities (`Sale`, `Payment`, `ProductStock`, etc.): 0 rows
- Total foreign keys in DB: 100 foreign keys, all referencing single-column primary keys `"id"`.
- Total composite unique indices: 3 (`FiscalYearInvoiceSequence_businessId_branchId_fiscalYearId_key`, `ProductStock_productId_branchId_key`, `RequestResult_businessId_operation_key_key`).
- **Zero models currently possess composite `(businessId, id)` unique constraints.**
- **Zero composite tenant foreign keys exist in the current database.**

---

## 2. Features Discovered & Technical Specifications

### Features Discovered
| # | Category | Feature | Description | Inputs | Outputs | Error Behavior | Discovered Via |
|---|----------|---------|-------------|--------|---------|----------------|----------------|
| 1 | Multi-Tenant Authorization | `UserBranchMembership` | Explicit many-to-many staff-to-branch allocation table | `userId`, `branchId`, `businessId`, `role?`, `isDefault`, `isActive` | Membership record | Rejects duplicate `(userId, branchId)` with unique violation; unassigned branch mutations rejected with 403 Forbidden | `PHASE_1_SECURITY_AUTHORITY.md`, `IMPLEMENTATION_PLAN.md` |
| 2 | Auditing & Compliance | `AuditEvent` | Append-only transactional audit trail capturing actor, business, branch, entity version diffs, and reason | `businessId`, `branchId`, `userId`, `action`, `entity`, `entityId`, `oldValue`, `newValue`, `metadata`, `reason`, `ipAddress`, `userAgent` | `AuditEvent` record | Rejects missing mandatory tenant/action fields; failure inside transaction causes 100% rollback of mutating business transaction | `PHASE_1_SECURITY_AUTHORITY.md`, `stack.md` |
| 3 | Tenant Integrity | Composite Unique Key `(businessId, id)` | Enforces composite uniqueness on all tenant tables to serve as parent key for composite tenant foreign keys | `businessId`, `id` on each tenant model | PostgreSQL UNIQUE constraint & index | Prevents duplicate compound keys; enables referencing composite foreign keys | `stack.md` § 4, `IMPLEMENTATION_PLAN.md` |
| 4 | Relational Isolation | Composite Tenant Foreign Keys | Foreign keys binding child rows to parent resources requiring identical `businessId` | `(businessId, foreignId)` pointing to `TargetTable(businessId, id)` | PostgreSQL FK constraint | Cross-tenant foreign ID reference fails with PostgreSQL FK violation (code `23503`) at DB kernel level | `PHASE_1_SECURITY_AUTHORITY.md`, `stack.md` |
| 5 | Role Security | Cashier Invariant Enforcements | Cashiers denied stock movement, price modifications, and tenant financial reports | Cashier session token + mutation command | 403 Forbidden response | Immediate fail closed; no database write | `PHASE_1_SECURITY_AUTHORITY.md` § 3 |
| 6 | Identity Lifecycle | Server-Derived Authority Fail-Closed | Server validates user active status, business active status, and non-deleted flags on every privileged request | Session bearer token / cookie | Active `AuthContext` | Inactive, soft-deleted, or mismatched tenant fails closed immediately with 401 Unauthorized | `PHASE_1_SECURITY_AUTHORITY.md`, `api-helper.ts` |
| 7 | Data Protection | Sensitive Data Redaction | Strips sensitive fields (`passwordHash`, tokens, secrets) before serialization in API responses or audit logs | Object or diff payload | Sanitized payload | Throws or redacts; never stores plaintext passwords or hashes in audit trails | `PHASE_1_SECURITY_AUTHORITY.md` § 3, `backup-format.ts` |
| 8 | Disaster Recovery | Tenant Snapshot Compatibility | Dynamic backup manifest generator indexing all tenant models in topological dependency order | Prisma DMMF models | Encrypted AES-256-GCM archive + migration lineage | Unsupported composite Prisma relations or dependency cycles throw `BackupError` | `backup-format.ts`, `backup-service.ts` |

### Edge Cases
| # | Feature | Input | Observed Behavior |
|---|---------|-------|-------------------|
| 1 | `UserBranchMembership` Migration Backfill | Existing users with non-null `branchId` | Existing 2 users in dev DB (`cashier@restroinn.com`, `owner@restroinn.com`) must receive automatic backfill membership rows during migration to prevent lock-out from their current branch |
| 2 | Backup Model Count Assertion | Adding `UserBranchMembership` & `AuditEvent` | Total tenant models in `backup-format.ts` increases from 41 to 43. `tests/recovery.integration.test.ts` line 83 (`expect(Object.keys(original.tables)).toHaveLength(41)`) will fail unless updated to 43 |
| 3 | Backup Rehearsal Composite Relation Check | Prisma `@relation(fields: [businessId, branchId], references: [businessId, id])` | Line 82 of `backup-format.ts` explicitly rejects `field.relationFromFields.length !== 1`. Adding composite relations in Prisma schema requires updating `backup-format.ts` or applying composite FKs via custom SQL migration |
| 4 | Dual Database Migration Deployment | Applying migration on source (`55439`) only | `scripts/rehearse-recovery.ts` checks that target container `55440` has identical migration checksums. Migration MUST be deployed to both `55439` and `55440` |
| 5 | Audit Event Transactional Rollback | Synthetic DB exception thrown on `AuditEvent` insert | Whole interactive transaction (Sale, Payment, ProductStock decrement, sequence bump) rolls back completely with zero orphaned rows |
| 6 | Soft-Deleted / Inactive User Mutations | User has valid unexpired JWT token but `User.isActive = false` or `User.deletedAt IS NOT NULL` | API returns 401 Unauthorized immediately; token claims are ignored in favor of live DB lookup |
| 7 | Multi-Branch Staff with Unassigned Target | Manager assigned to Branch A attempts mutation targeting Branch B | Mutation rejected with 403 Forbidden ("Branch access denied") |
| 8 | Nullable Foreign Keys with Composite Tenant Constraints | Payment without `saleId` or `purchaseId` | In PostgreSQL, composite foreign keys where foreign key columns are NULL (e.g. `(businessId, NULL)`) pass foreign key check under `MATCH SIMPLE` (default), correctly allowing standalone payments while validating linked payments |

---

## 3. Key Questions Answered

### Q1: What models currently exist in `packages/db/prisma/schema.prisma`?
There are currently **42 models** in `packages/db/prisma/schema.prisma`:
1. `Business` (Tenant Root)
2. `Subscription`
3. `Branch`
4. `User`
5. `Category`
6. `Brand`
7. `Subcategory`
8. `Unit`
9. `Product`
10. `ProductStock`
11. `Batch`
12. `Customer`
13. `CustomerLedger`
14. `Supplier`
15. `SupplierLedger`
16. `Sale`
17. `SaleItem`
18. `Purchase`
19. `PurchaseItem`
20. `Payment`
21. `RequestResult`
22. `SaleReturn`
23. `SaleReturnItem`
24. `PurchaseReturn`
25. `PurchaseReturnItem`
26. `ExpenseCategory`
27. `Expense`
28. `IncomeCategory`
29. `Income`
30. `StockTransfer`
31. `StockTransferItem`
32. `AuditLog` (Legacy audit table)
33. `Notification`
34. `OpeningStock`
35. `BusinessRegistrationRequest` (Platform onboarding model; excluded from tenant snapshots)
36. `FiscalYear`
37. `FiscalYearInvoiceSequence`
38. `CreditNote`
39. `CreditNoteItem`
40. `DebitNote`
41. `DebitNoteItem`
42. `CbmsSyncQueue`

Of these, **41 are tenant models** captured in tenant recovery archives (excluding `BusinessRegistrationRequest`).

---

### Q2: How is `UserBranchMembership` specified?
`UserBranchMembership` provides the explicit relational link between staff users and the branches in which they are authorized to operate.

#### Prisma Model Definition
```prisma
model UserBranchMembership {
  id         String    @id @default(uuid())
  businessId String
  business   Business  @relation(fields: [businessId], references: [id], onDelete: Cascade)
  userId     String
  user       User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  branchId   String
  branch     Branch    @relation(fields: [branchId], references: [id], onDelete: Cascade)
  role       String?   // Branch-specific role override (e.g., CASHIER, MANAGER). If null, defaults to user.role
  isDefault  Boolean   @default(false)
  isActive   Boolean   @default(true)
  createdAt  DateTime  @default(now())
  updatedAt  DateTime  @updatedAt

  @@unique([userId, branchId])
  @@unique([businessId, id])
  @@index([businessId, userId])
  @@index([businessId, branchId])
}
```

#### Required Constraints & Indices
- Primary Key: `id` (Required for recovery hash/ordering `ORDER BY t."id"`).
- `@@unique([userId, branchId])`: Prevents duplicate branch allocations for the same user.
- `@@unique([businessId, id])`: Enforces tenant composite uniqueness.
- `@@index([businessId, userId])`: Fast lookup of all branches permitted for an actor during server-derived authority resolution.
- `@@index([businessId, branchId])`: Fast lookup of staff roster per branch.

#### Inverse Relations to Add
- On `Business`: `branchMemberships UserBranchMembership[]`
- On `User`: `branchMemberships UserBranchMembership[]`
- On `Branch`: `userMemberships UserBranchMembership[]`

#### Compatibility Requirement
Retain `User.branchId` on `User` as the primary/default branch pointer for legacy route compatibility, while `UserBranchMembership` acts as the authoritative multi-branch permission registry.

---

### Q3: How is `AuditEvent` specified?
`AuditEvent` represents an immutable, append-only record of security and domain mutations.

#### Prisma Model Definition
```prisma
model AuditEvent {
  id            String    @id @default(uuid())
  businessId    String
  business      Business  @relation(fields: [businessId], references: [id], onDelete: Cascade)
  branchId      String?
  branch        Branch?   @relation(fields: [branchId], references: [id], onDelete: SetNull)
  userId        String?
  user          User?     @relation(fields: [userId], references: [id], onDelete: SetNull)
  action        String    // Operation name: CHECKOUT, PAYMENT_RECEIVED, STOCK_TRANSFER, USER_UPDATED, etc.
  entity        String    // Aggregate root: Sale, Payment, StockTransfer, User, Branch, etc.
  entityId      String?
  entityVersion Int?      @default(1)
  oldValue      Json?     // Sanitized before-state (secrets redacted)
  newValue      Json?     // Sanitized after-state (secrets redacted)
  metadata      Json?     // Additional context: requestId, stayId, clientIp, device
  reason        String?   // Operational justification or cancellation explanation
  ipAddress     String?
  userAgent     String?
  createdAt     DateTime  @default(now())

  @@unique([businessId, id])
  @@index([businessId, entity, entityId])
  @@index([businessId, createdAt])
  @@index([businessId, userId])
}
```

#### Key Properties & Invariants
- **Append-only**: No `updatedAt` and no `deletedAt`. Records are never modified or soft-deleted.
- **Atomic Rollback**: Must be written within the same interactive database transaction (`tx.auditEvent.create({ ... })`) as the mutating domain command. Any failure during audit recording MUST cause the entire transaction to abort.
- **Redaction**: Zero sensitive fields (`passwordHash`, session secrets, API tokens) may ever be stored in `oldValue`, `newValue`, or `metadata`.
- **Legacy Compatibility**: Keep `AuditLog` intact so historical queries and reports (`/api/v1/settings/audit-logs`) continue operating without regression.

---

### Q4: What are the exact requirements for composite tenant foreign keys `(businessId, id)` and indices? Which models must have them?

#### 1. Composite Tenant Unique Constraint `(businessId, id)`
Per `stack.md` § 4 ("All branch-scoped tables enforce composite unique constraints `(businessId, id)` to prevent cross-tenant ID leakage") and `IMPLEMENTATION_PLAN.md` lines 90–92:
Every tenant-scoped table that possesses a `businessId` must enforce `@@unique([businessId, id])`. In PostgreSQL, this generates `CREATE UNIQUE INDEX ... ON "Model"("businessId", "id")`.

#### Target Models Requiring `@@unique([businessId, id])`:
1. `Branch`
2. `User`
3. `Category`
4. `Subcategory`
5. `Brand`
6. `Unit`
7. `Product`
8. `Customer`
9. `Supplier`
10. `Sale`
11. `Purchase`
12. `Payment`
13. `OpeningStock`
14. `CreditNote`
15. `DebitNote`
16. `Expense`
17. `ExpenseCategory`
18. `Income`
19. `IncomeCategory`
20. `StockTransfer`
21. `SaleReturn`
22. `PurchaseReturn`
23. `Notification`
24. `FiscalYear`
25. `AuditLog`
26. `CbmsSyncQueue`
27. `Subscription`
28. `RequestResult`
29. `UserBranchMembership` (New)
30. `AuditEvent` (New)

#### 2. Composite Foreign Keys in PostgreSQL
In PostgreSQL, once the target model has `UNIQUE (businessId, id)`, composite foreign keys can be enforced at the relational layer:
- `Sale`:
  - `FOREIGN KEY ("businessId", "branchId") REFERENCES "Branch"("businessId", "id") ON DELETE CASCADE`
  - `FOREIGN KEY ("businessId", "userId") REFERENCES "User"("businessId", "id") ON DELETE CASCADE`
  - `FOREIGN KEY ("businessId", "customerId") REFERENCES "Customer"("businessId", "id") ON DELETE SET NULL`
- `Purchase`:
  - `FOREIGN KEY ("businessId", "branchId") REFERENCES "Branch"("businessId", "id") ON DELETE CASCADE`
  - `FOREIGN KEY ("businessId", "supplierId") REFERENCES "Supplier"("businessId", "id") ON DELETE CASCADE`
  - `FOREIGN KEY ("businessId", "userId") REFERENCES "User"("businessId", "id") ON DELETE CASCADE`
- `Payment`:
  - `FOREIGN KEY ("businessId", "branchId") REFERENCES "Branch"("businessId", "id") ON DELETE SET NULL`
  - `FOREIGN KEY ("businessId", "userId") REFERENCES "User"("businessId", "id") ON DELETE SET NULL`
  - `FOREIGN KEY ("businessId", "saleId") REFERENCES "Sale"("businessId", "id") ON DELETE CASCADE`
  - `FOREIGN KEY ("businessId", "purchaseId") REFERENCES "Purchase"("businessId", "id") ON DELETE CASCADE`
  - `FOREIGN KEY ("businessId", "customerId") REFERENCES "Customer"("businessId", "id") ON DELETE SET NULL`
  - `FOREIGN KEY ("businessId", "supplierId") REFERENCES "Supplier"("businessId", "id") ON DELETE SET NULL`
- `UserBranchMembership`:
  - `FOREIGN KEY ("businessId", "userId") REFERENCES "User"("businessId", "id") ON DELETE CASCADE`
  - `FOREIGN KEY ("businessId", "branchId") REFERENCES "Branch"("businessId", "id") ON DELETE CASCADE`
- `AuditEvent`:
  - `FOREIGN KEY ("businessId", "branchId") REFERENCES "Branch"("businessId", "id") ON DELETE SET NULL`
  - `FOREIGN KEY ("businessId", "userId") REFERENCES "User"("businessId", "id") ON DELETE SET NULL`

#### Architectural Implementation Recommendation for the Builder
Because `backend/src/lib/backup-format.ts` (line 82) validates `if (field.relationFromFields!.length !== 1 || field.relationToFields?.[0] !== "id") throw new BackupError(...)`, defining composite relations directly in Prisma schema would fail backup recovery rehearsals unless `backup-format.ts` is simultaneously expanded.
**Recommended Architecture**:
1. Add `@@unique([businessId, id])` to all models in `schema.prisma`.
2. Add the custom composite foreign keys in the SQL migration `202610310001_phase1_security_foundation/migration.sql`.
3. In Prisma schema, maintain single-column relation definitions (`@relation(fields: [branchId], references: [id])`) or update `backup-format.ts` line 82 to support composite relations whose first field is `businessId`.

---

### Q5: What is the migration plan and how do existing records/data on PostgreSQL `127.0.0.1:55439` need to be handled during migration?

#### Current State
- The development database on `127.0.0.1:55439` currently contains:
  - 1 Business (`e9b51092-5ac6-4ee3-9f82-1add8ceafc77`)
  - 1 Branch (`6a00468d-10d6-4bce-8995-914bbcb1ad29`)
  - 2 Users (`cashier@restroinn.com`, `owner@restroinn.com`)
  - 2 AuditLogs
- Zero sales, zero payments, zero stock transfers.
- **Zero cross-tenant corruptions exist.**

#### Step-by-Step Migration Execution Plan
1. **Create New Migration Directory**:
   `packages/db/prisma/migrations/202610310001_phase1_security_foundation/migration.sql`
2. **Migration SQL Contents**:
   - `CREATE TABLE "UserBranchMembership"` with all fields and foreign keys.
   - `CREATE UNIQUE INDEX "UserBranchMembership_userId_branchId_key" ON "UserBranchMembership"("userId", "branchId");`
   - `CREATE UNIQUE INDEX "UserBranchMembership_businessId_id_key" ON "UserBranchMembership"("businessId", "id");`
   - **Backfill Existing Users**:
     ```sql
     INSERT INTO "UserBranchMembership" ("id", "businessId", "userId", "branchId", "role", "isDefault", "isActive", "createdAt", "updatedAt")
     SELECT gen_random_uuid(), "businessId", "id", "branchId", "role", true, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
     FROM "User"
     WHERE "branchId" IS NOT NULL AND "deletedAt" IS NULL;
     ```
   - `CREATE TABLE "AuditEvent"` with all fields and foreign keys.
   - `CREATE UNIQUE INDEX "AuditEvent_businessId_id_key" ON "AuditEvent"("businessId", "id");`
   - Add `CREATE UNIQUE INDEX ... ON ...("businessId", "id")` across all 28 existing tenant models.
   - Add composite foreign key constraints (`Sale_businessId_branchId_fkey`, etc.) via `ALTER TABLE ... ADD CONSTRAINT ...`.
3. **Execute Migration on Source**:
   Run `node scripts/restro-env.mjs migrate` to apply to `127.0.0.1:55439/restro_test`.
4. **Execute Migration on Restore Target**:
   Run `node scripts/restro-restore-env.mjs migrate` to apply to disposable rehearsal database `127.0.0.1:55440/restro_restore`.
5. **Re-generate Prisma Client**:
   Run `npm run generate --workspace=@dynapos/db` to update `@dynapos/db` client bindings and DMMF datamodel.

---

### Q6: What risks, edge cases, and constraints must the Builder be aware of?

1. **Recovery Rehearsal & Model Count Drift (High Risk)**:
   - `scripts/rehearse-recovery.ts` and `tests/recovery.integration.test.ts` dynamically iterate over `backupModels` in `backup-format.ts`.
   - When `UserBranchMembership` and `AuditEvent` are added, `backupModels.length` increases from **41 to 43**.
   - `tests/recovery.integration.test.ts` line 83 contains an exact assertion: `expect(Object.keys(original.tables)).toHaveLength(41);`.
   - If not updated to `43` (or `backupModels.length`), `npm run test:recovery` will fail!
   - `scripts/rehearse-recovery.ts` also hardcodes check strings referencing "41 models" (lines 104, 127). The script or assertion counts must be updated.
2. **Composite Relation Check in Backup Sealer (High Risk)**:
   - `backend/src/lib/backup-format.ts` line 82 has an explicit assertion:
     `if (field.relationFromFields!.length !== 1 || field.relationToFields?.[0] !== "id") throw new BackupError("Unsupported composite backup relation");`
   - If composite relations are defined in Prisma schema without modifying `backup-format.ts`, backup capture and rehearsal will fail. Custom SQL composite foreign keys or expanding `backup-format.ts` to allow composite tenant references is required.
3. **Dual Container Migration Synchronization (High Risk)**:
   - If a migration is deployed only to `127.0.0.1:55439` and not `127.0.0.1:55440`, `node scripts/restro-restore-env.mjs rehearse` will fail check #2 (`target migration history equals source (names and checksums)`).
4. **Commerce Integration Test Invariants (Medium Risk)**:
   - In `tests/commerce.integration.test.ts`, tests seed users with `{ id, businessId, branchId, role: "CASHIER" }`.
   - If the endpoint guard strictly requires `UserBranchMembership` rows, existing tests or helper functions must either fallback to `User.branchId` if no explicit membership exists or seed a `UserBranchMembership` record.
   - Test line 219 tests audit failure rollback using a trigger on `"AuditLog"`. If transactions switch to `"AuditEvent"`, the trigger must target `"AuditEvent"` or both.
5. **Session Token Expiry & Deletion Failsafe (Medium Risk)**:
   - Deactivated users (`isActive: false`) or soft-deleted users (`deletedAt: new Date()`) must immediately return `401 Unauthorized` regardless of how valid the incoming Auth.js JWT session token is. Server-derived authority must query the DB on sensitive operations.
6. **Password Hash & Secret Leakage Prevention (Security Critical)**:
   - `AuditEvent` payloads (`oldValue`, `newValue`, `metadata`) and API responses MUST sanitize user records so `passwordHash` is never written to disk in plain or JSON form.

---

## 4. Logic Chain

1. **Premise 1**: Phase 1 requires enforcing strict tenant boundaries, staff branch allocations, server-derived current authority, and atomic audit logging.
2. **Premise 2**: Direct inspection of `schema.prisma` shows that currently `User` only links to a single `branchId`, `AuditLog` swallows errors asynchronously, and zero tables enforce `(businessId, id)` uniqueness.
3. **Premise 3**: In PostgreSQL, a foreign key can only reference columns with a UNIQUE or PRIMARY KEY constraint. Therefore, to enforce cross-tenant rejection at the relational layer, all parent tenant tables must first possess `UNIQUE ("businessId", "id")`.
4. **Premise 4**: Probing the active development database `127.0.0.1:55439` proves that only 2 baseline migrations exist, containing 1 business, 1 branch, and 2 users, with zero cross-tenant contamination.
5. **Premise 5**: Recovery scripts (`rehearse-recovery.ts` and `recovery.integration.test.ts`) dynamically calculate tenant models from `Prisma.dmmf.datamodel.models`. Adding `UserBranchMembership` and `AuditEvent` increments model count from 41 to 43.
6. **Premise 6**: `backup-format.ts` line 82 explicitly disallows composite relation fields unless updated.
7. **Deduction**: The Builder must create a new additive migration `202610310001_phase1_security_foundation`, deploy it to both `55439` and `55440`, backfill existing users into `UserBranchMembership`, add `UNIQUE ("businessId", "id")` across tenant models, add composite foreign keys in SQL, update the recovery test model count assertion from 41 to 43, and ensure `AuditEvent` is written inside domain transactions.

---

## 5. Caveats
- No changes to `schema.prisma` or migration files have been written yet; as a Specification Miner, this role is strictly read-only and analytical.
- The rehearsal database on `127.0.0.1:55440` is disposable and currently running; when the Builder applies the new migration, both containers must be online.
- Capability flags can be stored as a `capabilities Json?` column on `UserBranchMembership` or enforced via code constants (`CAN_MOVE_STOCK`, `CAN_MODIFY_PRICES`). A JSON column on `UserBranchMembership` is recommended to avoid heavy relation tables while providing maximum flexibility.

---

## 6. Conclusion
The specification for Phase 1 Database Schema and Relational Constraints is fully mined, verified against the running PostgreSQL database and existing test suites, and documented.
The Builder has a precise, deterministic roadmap:
1. Add `UserBranchMembership` and `AuditEvent` models to `packages/db/prisma/schema.prisma`.
2. Add `@@unique([businessId, id])` to all 30 tenant models.
3. Generate migration `202610310001_phase1_security_foundation` containing table creation, user backfill, unique indices, and composite foreign keys.
4. Deploy to both `127.0.0.1:55439` and `127.0.0.1:55440`.
5. Update `tests/recovery.integration.test.ts` model count expectation to 43.
6. Update backend authority helpers and Route Handlers to verify `UserBranchMembership` and record transactional `AuditEvent`.

---

## 7. Verification Method

To verify these findings and requirements independently:
1. **Inspect applied migrations on dev DB**:
   ```bash
   node scratch/probe-db.cjs
   ```
2. **Inspect existing indices and foreign keys**:
   ```bash
   node scratch/probe-constraints.cjs
   ```
3. **Execute recovery rehearsal (source 55439 vs target 55440)**:
   ```bash
   node scripts/restro-restore-env.mjs rehearse
   ```
4. **Execute recovery regression suite**:
   ```bash
   node scripts/restro-env.mjs recovery-test
   ```
5. **Execute commerce regression suite**:
   ```bash
   node scripts/restro-env.mjs integration
   ```
6. **Execute full TypeScript typecheck**:
   ```bash
   npm.cmd run typecheck
   ```
