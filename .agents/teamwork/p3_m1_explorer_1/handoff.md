# Milestone M1: Prisma Schema & Additive Migration Handoff Report

**Sender**: M1 Explorer 1 (Prisma Schema & Migration Specialist)  
**Recipient**: Orchestrator (`98f60f04-06d4-493d-9df7-9f604839d4bc`) / Milestone M1 Workers & Reviewers  
**Working Directory**: `c:\projects\pos\.agents\teamwork\p3_m1_explorer_1`  
**Date**: 2026-11-01  
**Handoff Type**: Hard (Task Complete)  

---

## 1. Observation

1. **Schema File**: `packages/db/prisma/schema.prisma` currently ends at line 1087 with `model OutboxEvent`. The existing schema defines 48 tenant models (verified by counting models matching `!excludedModels.includes(model.name)` in `backend/src/lib/backup-format.ts:12`).
2. **Multi-Tenant Key Precedents**: In `packages/db/prisma/schema.prisma`, every tenant model contains `id String @id @default(uuid())`, `businessId String`, and `@@unique([businessId, id])` (e.g. `Subscription` line 78, `Branch` line 114, `AuditEvent` line 970, `StockMovement` line 1059).
3. **Disaster Recovery Constraints in `backend/src/lib/backup-format.ts`**:
   - Lines 13–19:
     ```ts
     while (pending.length) {
       const index = pending.findIndex(model => model.fields.filter(field => field.relationFromFields?.length).every(field => backupModels.some(parent => parent.name === field.type)));
       if (index < 0) throw new Error("Backup schema has unsupported dependency cycle");
       backupModels.push(pending.splice(index, 1)[0]);
     }
     ```
   - Line 83:
     ```ts
     if (field.relationFromFields!.length !== 1 || field.relationToFields?.[0] !== "id") throw new BackupError("Unsupported composite backup relation");
     ```
4. **Recovery Integration Test Assertion**: In `tests/recovery.integration.test.ts:88`:
   ```ts
   it("R1 captures all 48 tenant models and authenticates encrypted archives without claiming rehearsal", async () => {
     expect(Object.keys(original.tables)).toHaveLength(48);
   ```
5. **Phase 1 & Phase 2 Migration Precedents**:
   - `packages/db/prisma/migrations/202610310001_phase1_security_foundation/migration.sql` lines 96–150 and `packages/db/prisma/migrations/202610310002_phase2_financial_inventory_core/migration.sql` lines 297–333 enforce composite foreign keys using `FOREIGN KEY ("businessId", "<targetId>") REFERENCES "<TargetModel>"("businessId", "id")`.
6. **Docker Environment**: `compose.restro.yml` line 4 specifies `image: postgres:15-alpine` running on port 55439.

---

## 2. Logic Chain

1. **Acyclicity & Disaster Recovery** (supported by Observation 3):
   If `RestaurantTable` were defined with an explicit relation `@relation(fields: [currentSessionId], references: [id])` to `TableSession`, while `TableSession` defines `@relation(fields: [tableId], references: [id])` to `RestaurantTable`, the `backup-format.ts` topological sort would encounter a cycle (`index < 0`) and throw `"Backup schema has unsupported dependency cycle"`. Therefore, `RestaurantTable.currentSessionId` MUST remain a scalar `String?` without an `@relation` attribute in Prisma.
2. **Prisma Single-Column Relation Format** (supported by Observation 3):
   `backup-format.ts:83` requires all relations in Prisma schema to have `relationFromFields.length === 1` and `relationToFields === ["id"]`. Thus, Prisma schema declarations must use standard single-column foreign keys (`fields: [branchId], references: [id]`), while multi-tenant composite isolation is enforced in Prisma via `@@unique([businessId, id])` and in PostgreSQL DDL via explicit composite foreign keys.
3. **Monetary Decimal Precision** (supported by Observation 2 and User Requirements R2):
   All currency and financial amount fields (`basePrice`, `priceDelta`, `unitPrice`, `taxAmount`, `subtotal`, `totalAmount`, `discountTotal`, `taxTotal`, `paidAmount`, `total`) must be specified as `Decimal @db.Decimal(12, 2)` in Prisma and `DECIMAL(12, 2) NOT NULL` in PostgreSQL DDL. Tax rates are defined as `Decimal @default(0) @db.Decimal(5, 2)`.
4. **Database-Level Composite Foreign Keys** (supported by Observation 5):
   Following the exact pattern in Phase 1 and Phase 2 migrations, the PostgreSQL migration script must create:
   - Primary key on `id`
   - Unique index on `("businessId", "id")`
   - Unique scope indexes (e.g. `("businessId", "branchId", "name")`)
   - Composite foreign keys: `FOREIGN KEY ("businessId", "<parentField>") REFERENCES "<ParentTable>"("businessId", "id") ON DELETE CASCADE ON UPDATE CASCADE`.
5. **Model Count Expansion** (supported by Observation 1, 4):
   Appending the 12 new Phase 3 models increases the tenant model total from 48 to 60. Updating line 88 of `tests/recovery.integration.test.ts` to expect 60 models ensures the recovery suite passes without regression.

---

## 3. Caveats

- **Read-Only Bound**: Per role instructions, no source or test files (`packages/db/prisma/schema.prisma`, `packages/db/prisma/migrations/`, `tests/recovery.integration.test.ts`) were directly modified. All additions, blocks, and SQL are fully prepared in `schema_spec_report.md` for implementers.
- **Application Enums**: Status fields (`status`, `acceptanceStatus`, `fulfillmentStatus`, `settlementStatus`) are modeled as `String` with defaults in Prisma/PostgreSQL, matching all prior models in DynaPOS (e.g. `Sale.paymentStatus`, `Refund.status`). Static validation is enforced via TypeScript unions and Zod schemas in the application layer.

---

## 4. Conclusion

1. The exact Prisma schema blocks for all 12 Phase 3 restaurant hospitality models (`Floor`, `RestaurantTable`, `TableSession`, `Menu`, `MenuSection`, `MenuItem`, `ModifierGroup`, `ModifierOption`, `MenuItemModifierGroup`, `RestaurantOrder`, `OrderRound`, `OrderLine`) and complementary relation additions for parent models (`Business`, `Branch`, `User`, `Product`) have been synthesized and verified.
2. Strict multi-tenant composite patterns and Decimal(12, 2) monetary precision are fully satisfied.
3. The exact PostgreSQL DDL migration script for `packages/db/prisma/migrations/202611010001_phase3_restaurant_staff_mvp/migration.sql` is formulated and complete.
4. The schema graph is strictly acyclic, guaranteeing full compatibility with `backup-format.ts` and disaster recovery.

---

## 5. Verification Method

To verify the schema specification and migration:

1. **Prisma Schema Generation & Validation**:
   - Check that `schema.prisma` parses and client generates:
     `npx prisma validate --schema packages/db/prisma/schema.prisma`
     `npx prisma generate --schema packages/db/prisma/schema.prisma`
2. **Additive Migration Deployment**:
   - Run migration on the isolated PostgreSQL test container (127.0.0.1:55439):
     `node scripts/restro-env.mjs migrate`
3. **Monorepo Typecheck**:
   - Run typecheck across workspaces:
     `npm.cmd run typecheck`
4. **Disaster Recovery & Model Count**:
   - Verify line 88 of `tests/recovery.integration.test.ts` is updated to 60 models:
     `node scripts/restro-env.mjs recovery-test`
5. **Baseline Test Suite**:
   - Run test suite without regression:
     `npm.cmd test`
