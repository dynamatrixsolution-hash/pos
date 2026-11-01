# Milestone M1 Handoff Report: Verification & Migration Execution Plan

**Author**: M1 Explorer 3 (Monorepo Verification & Migration Analyst)  
**Recipient**: Orchestrator (`98f60f04-06d4-493d-9df7-9f604839d4bc`) / Milestone M1 Worker  
**Date**: 2026-11-01  
**Status**: Task Complete (Hard Handoff)  
**Report Artifact**: `c:\projects\pos\.agents\teamwork\p3_m1_explorer_3\verification_plan_report.md`  

---

## 1. Observation

1. **Current Schema & Model Topology**:
   - `packages/db/prisma/schema.prisma` currently defines 48 tenant models + 1 platform model (`BusinessRegistrationRequest`).
   - `backend/src/lib/backup-format.ts` lines 11–19 dynamically resolves tenant models and sorts them topologically:
     ```ts
     export const excludedModels = ["BusinessRegistrationRequest"];
     const models = Prisma.dmmf.datamodel.models.filter(model => !excludedModels.includes(model.name));
     export const backupModels: typeof models = [];
     const pending = [...models];
     while (pending.length) {
       const index = pending.findIndex(model => model.fields.filter(field => field.relationFromFields?.length).every(field => backupModels.some(parent => parent.name === field.type)));
       if (index < 0) throw new Error("Backup schema has unsupported dependency cycle");
       backupModels.push(pending.splice(index, 1)[0]);
     }
     ```
   - `tests/recovery.integration.test.ts` lines 87–88 directly assert:
     ```ts
     it("R1 captures all 48 tenant models and authenticates encrypted archives without claiming rehearsal", async () => {
       expect(Object.keys(original.tables)).toHaveLength(48);
     ```

2. **Existing Migration Lineage**:
   - Directory `packages/db/prisma/migrations/` contains 4 existing migrations:
     * `202610300001_retail_baseline`
     * `202610300002_commerce_hardening`
     * `202610310001_phase1_security_foundation`
     * `202610310002_phase2_financial_inventory_core`

3. **Dual Container Databases**:
   - `scripts/restro-env.mjs` manages the primary test database at `127.0.0.1:55439` (`restro_test`).
   - `scripts/restro-restore-env.mjs` manages the disposable restore target database at `127.0.0.1:55440` (`restro_restore`).
   - `scripts/rehearse-recovery.ts` line 2 asserts:
     ```ts
     check("target migration history equals source (names and checksums)", ...)
     ```
     Both databases must have matching migration histories for rehearsal to pass.

4. **Live Verification Baseline**:
   - `npm.cmd run typecheck`: Exit code 0 (0 type errors).
   - `npm.cmd test`: Exit code 0 (9 test files passed, 85 passed, 41 integration tests skipped).
   - `node scripts/restro-env.mjs recovery-test`: Exit code 0 (8/8 tests passed).
   - `node scripts/restro-restore-env.mjs rehearse`: Exit code 0 (41/41 checks passed).

---

## 2. Logic Chain

1. **Step 1 -> Schema Model Expansion**:
   From Observation 1, adding the 12 Phase 3 models (`Floor`, `RestaurantTable`, `TableSession`, `Menu`, `MenuSection`, `MenuItem`, `ModifierGroup`, `ModifierOption`, `MenuItemModifierGroup`, `RestaurantOrder`, `OrderRound`, `OrderLine`) increases the tenant model count from 48 to 60 ($48 + 12 = 60$).

2. **Step 2 -> Acyclicity Constraint**:
   From Observation 1, `backup-format.ts` performs topological sorting on `relationFromFields`. If `RestaurantTable` were to add a relation on `currentSessionId` pointing to `TableSession`, while `TableSession` points to `RestaurantTable` via `tableId`, `backup-format.ts` line 17 would throw `"Backup schema has unsupported dependency cycle"`. Therefore, `RestaurantTable.currentSessionId` must remain an unconstrained scalar `String?` without an `@relation` attribute.

3. **Step 3 -> Dual-Target Database Migration Requirement**:
   From Observation 3, `scripts/rehearse-recovery.ts` checks that `restro_restore` (`55440`) possesses the exact migration history and checksums of `restro_test` (`55439`). Applying the migration only via `node scripts/restro-env.mjs migrate` leaves the restore target on the older schema, which breaks rehearsal immediately. Therefore, both `node scripts/restro-env.mjs migrate` and `node scripts/restro-restore-env.mjs migrate` must be executed.

4. **Step 4 -> Test Assertion Update**:
   From Observation 1 and Logic Step 1, because the number of tenant models changes from 48 to 60, `tests/recovery.integration.test.ts:88` (`expect(Object.keys(original.tables)).toHaveLength(48)`) will fail unless updated to `60`. All other fixtures in `recovery.integration.test.ts` and `rehearse-recovery.ts` dynamically iterate over `format.backupModels`, so no further test modifications are required.

5. **Step 5 -> Zero Lock Contention / Additive Safety**:
   From Observation 2, Phase 3 models are completely new tables. No existing table (`Sale`, `Payment`, `ProductStock`) has columns added, altered, or dropped in PostgreSQL. Thus, no exclusive table locks or blocking operations are incurred on existing tables.

---

## 3. Caveats

- **Docker Container Dependency**: The isolated PostgreSQL containers must be running for `restro-env.mjs` and `restro-restore-env.mjs` commands. If either container is down, run `npm.cmd run restro:db` or `node scripts/restro-restore-env.mjs db`.
- **Pre-existing Snapshots**: Adding Phase 3 models changes `schemaHash` in `backup-format.ts`. Backups created prior to Phase 3 cannot be restored into a Phase 3 database without schema matching, which is the intended security design.
- **Scope Boundary**: Milestone M1 covers strictly the schema, client generation, migration DDL, container migration deployment, and recovery assertion update. Services, routes, and UI components are deferred to Milestones M2–M5 per `PROJECT.md`.

---

## 4. Conclusion

Milestone M1 has a definitive, verified 5-step execution protocol:
1. Edit `packages/db/prisma/schema.prisma` to add navigation arrays on `Business`, `Branch`, `User`, `Product` and append the 12 new Phase 3 models (with scalar `RestaurantTable.currentSessionId`).
2. Run `npm.cmd run prisma:generate`.
3. Create `packages/db/prisma/migrations/202611010001_phase3_restaurant_staff_mvp/migration.sql` with the complete DDL provided in `verification_plan_report.md`.
4. Run `node scripts/restro-env.mjs migrate` and `node scripts/restro-restore-env.mjs migrate`.
5. Update `tests/recovery.integration.test.ts:88` from 48 to 60.

All risk factors (dependency cycles, dual migration synchronization, and foreign key ordering) are thoroughly mitigated.

---

## 5. Verification Method

To independently verify Milestone M1 completion, run the following verification commands:

```powershell
# 1. Monorepo TypeScript check
npm.cmd run typecheck

# 2. Vitest unit and recovery-format suite
npm.cmd test

# 3. Isolated PostgreSQL tenant recovery test (127.0.0.1:55439)
node scripts/restro-env.mjs recovery-test

# 4. Disaster recovery rehearsal across dual clusters (55439 -> 55440)
node scripts/restro-restore-env.mjs rehearse
```

### Pass Criteria:
- `npm.cmd run typecheck`: Exit 0, 0 type errors.
- `npm.cmd test`: Exit 0, 9 passed test files, 85 passed tests.
- `node scripts/restro-env.mjs recovery-test`: Exit 0, 8 passed tests, assertion R1 confirms 60 tenant models captured and verified.
- `node scripts/restro-restore-env.mjs rehearse`: Exit 0, 41/41 checks passed, zero invariant drift, 60 tenant models reconciled.

### Invalidation Conditions:
- Any circular foreign key between `RestaurantTable` and `TableSession` throwing `"Backup schema has unsupported dependency cycle"`.
- Failure to run `node scripts/restro-restore-env.mjs migrate`, resulting in `target migration history equals source` failure in rehearsal.
- Forgetting to update line 88 of `tests/recovery.integration.test.ts` from 48 to 60.
