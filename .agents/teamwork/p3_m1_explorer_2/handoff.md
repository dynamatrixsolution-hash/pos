# Disaster Recovery Topological Analysis — Handoff Report

**Author**: M1 Explorer 2 (Disaster Recovery Topological Analyst)  
**Recipient**: Orchestrator & M1 Builder/Worker  
**Working Directory**: `c:\projects\pos\.agents\teamwork\p3_m1_explorer_2`  
**Milestone**: Phase 3 Milestone M1 (Core Schema & Disaster Recovery Topology)  
**Date**: 2026-11-01  
**Handoff Type**: Hard (Task Complete)  

---

## 1. Observation

1. **Topological Sort in `backend/src/lib/backup-format.ts`**:
   - Lines 12–19:
     ```ts
     const models = Prisma.dmmf.datamodel.models.filter(model => !excludedModels.includes(model.name));
     export const backupModels: typeof models = [];
     const pending = [...models];
     while (pending.length) {
       const index = pending.findIndex(model => model.fields.filter(field => field.relationFromFields?.length).every(field => backupModels.some(parent => parent.name === field.type)));
       if (index < 0) throw new Error("Backup schema has unsupported dependency cycle");
       backupModels.push(pending.splice(index, 1)[0]);
     }
     export const schemaHash = createHash("sha256").update(JSON.stringify(backupModels)).digest("hex");
     ```
   - Current database models count: `49` total DMMF models, with `1` excluded (`BusinessRegistrationRequest`), giving `48` active models in `backupModels`.
   - Lines 81–86:
     ```ts
     for (const model of backupModels) for (const row of snapshot.tables[model.name]) {
       for (const field of model.fields.filter(field => field.relationFromFields?.length)) {
         if (field.relationFromFields!.length !== 1 || field.relationToFields?.[0] !== "id") throw new BackupError("Unsupported composite backup relation");
         const value = row[field.relationFromFields![0]];
         if (value !== null && !ids.get(field.type)?.has(value as string)) throw new BackupError(`Foreign or missing ${model.name} reference`);
       }
     ```

2. **Simulation of Circular Dependency (`RestaurantTable` vs `TableSession`)**:
   - When `RestaurantTable.currentSessionId` was configured with `@relation("CurrentTableSession", fields: [currentSessionId], references: [id])` and `TableSession.tableId` with `@relation("AllTableSessions", fields: [tableId], references: [id])`:
   - Empirical script execution output:
     ```
     CYCLE DETECTED! index < 0
     Unresolved pending models: [ 'RestaurantTable', 'TableSession' ]
     ```
   - When `currentSessionId` is scalar without `@relation`:
     ```
     SUCCESS! Total models sorted: 60
     Phase 3 models resolved in order: 1. Floor, 2. RestaurantTable, 3. TableSession, 4. Menu, 5. MenuSection, 6. MenuItem, 7. ModifierGroup, 8. ModifierOption, 9. MenuItemModifierGroup, 10. RestaurantOrder, 11. OrderRound, 12. OrderLine
     ```

3. **Existing Recovery Test Assertion in `tests/recovery.integration.test.ts`**:
   - Line 87–89:
     ```ts
     it("R1 captures all 48 tenant models and authenticates encrypted archives without claiming rehearsal", async () => {
       expect(Object.keys(original.tables)).toHaveLength(48);
       for (const rows of Object.values(original.tables)) expect(rows).toHaveLength(1);
     ```

4. **Dynamic Model Resolution in `scripts/rehearse-recovery.ts`**:
   - Lines 46, 68, 103, 135, 202, 262, 269:
     All table iteration, synthetic tenant row seeding, reverse fixture deletion, archive validation, and count checks use `format.backupModels` dynamically.
   - Lines 181–183:
     ```ts
     const migrations = async (client: Client) => (await client.$queryRaw<{ migration_name: string; checksum: string }[]>`SELECT migration_name, checksum FROM "_prisma_migrations" WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL ORDER BY migration_name`);
     const [sourceMigrations, targetMigrations] = [await migrations(source), await migrations(target)];
     check("target migration history equals source (names and checksums)", JSON.stringify(sourceMigrations) === JSON.stringify(targetMigrations), sourceMigrations.map(entry => entry.migration_name).join(", "));
     ```

5. **Migration Environment Launchers**:
   - `scripts/restro-env.mjs`: `migrate` deploys pending migrations to primary test container `127.0.0.1:55439`.
   - `scripts/restro-restore-env.mjs`: `migrate` deploys pending migrations to disposable recovery target container `127.0.0.1:55440`.

---

## 2. Logic Chain

1. **From Observation 1 to DAG Acyclicity**:
   - `backup-format.ts` sorts models by iteratively pulling models whose foreign-key targets are already resolved.
   - The 12 Phase 3 models only reference existing foundational models (`Business`, `Branch`, `User`, `Product`) and other Phase 3 models in a strictly forward hierarchical direction.
   - None of the existing 48 models depend on any of the 12 Phase 3 models.
   - Therefore, the augmented graph with 60 models is guaranteed acyclic.

2. **From Observation 2 to `currentSessionId` Scalar Mandate**:
   - If `RestaurantTable.currentSessionId` had `@relation` to `TableSession`, `RestaurantTable` would require `TableSession` to be resolved first.
   - But `TableSession.tableId` has non-null `@relation` to `RestaurantTable`, requiring `RestaurantTable` to be resolved first.
   - Neither model could be resolved in `backup-format.ts`, causing line 17 to throw `Backup schema has unsupported dependency cycle`.
   - Furthermore, sequential row insertion in `restoreMissingTenant` and reverse row deletion in test teardown would both fail with foreign key constraint violations.
   - Storing `currentSessionId` as a scalar `String?` without `@relation` breaks the circular reference in the schema DAG, ensuring `RestaurantTable` resolves before `TableSession` while still allowing fast logical lookup.

3. **From Observation 3 to `tests/recovery.integration.test.ts` Line 88 Update**:
   - Adding 12 models increases `backupModels` from 48 to 60.
   - `store.capture(businessId)` generates `original.tables` with 60 keys.
   - `expect(Object.keys(original.tables)).toHaveLength(48)` will fail unless updated to 60.

4. **From Observations 4 & 5 to Dual-Target Migration Requirement**:
   - `rehearse-recovery.ts` dynamically verifies all 60 models without code modifications.
   - However, check 0 explicitly queries `_prisma_migrations` on both port `55439` and port `55440` and asserts that their migration arrays are identical.
   - Therefore, the Worker must deploy the additive migration to both databases using `node scripts/restro-env.mjs migrate` AND `node scripts/restro-restore-env.mjs migrate`.

---

## 3. Caveats

- **Scope Boundary**: This analysis investigated disaster recovery topological integrity, schema acyclicity, and backup verification scripts. It did not create source code migrations or alter test files, as Explorer operates in read-only mode.
- **Prisma Client Generation**: Whenever `packages/db/prisma/schema.prisma` is modified, `npx prisma generate --schema=packages/db/prisma/schema.prisma` must be run before executing any node scripts or test runners so that `Prisma.dmmf` reflects the 60 models.

---

## 4. Conclusion

The disaster recovery topology for Phase 3 is fully validated and ready for M1 implementation:
1. All 12 Phase 3 models form a strictly acyclic DAG of 60 models with `backup-format.ts`.
2. `RestaurantTable.currentSessionId` must remain a scalar `String?` without `@relation`.
3. Updating line 88 of `tests/recovery.integration.test.ts` from 48 to 60 is the only test code modification required.
4. Deploying the migration to both `55439` and `55440` will allow `node scripts/restro-env.mjs recovery-test` and `node scripts/restro-restore-env.mjs rehearse` to pass cleanly with zero errors.

---

## 5. Verification Method

To independently verify this analysis:

1. **Verify Topological Sort Simulation**:
   ```powershell
   node -e "const { Prisma } = require('./packages/db/client'); console.log('Current backup models:', Prisma.dmmf.datamodel.models.filter(m => m.name !== 'BusinessRegistrationRequest').length);"
   ```
   *Expected*: `48` models currently. After schema update, will be `60`.

2. **Verify Recovery Integration Suite**:
   ```powershell
   node scripts/restro-env.mjs recovery-test
   ```
   *Expected*: `Recovery verification: 8 passed, zero skipped.`

3. **Verify Rehearsal Suite**:
   ```powershell
   node scripts/restro-restore-env.mjs rehearse
   ```
   *Expected*: `Rehearsal: 41/41 checks passed` with exit code 0.

4. **Invalidation Conditions**:
   - Any circular `@relation` between `RestaurantTable` and `TableSession` will cause immediate crash with `Backup schema has unsupported dependency cycle`.
   - Omitting `node scripts/restro-restore-env.mjs migrate` will fail rehearsal check 0 with `target migration history equals source (names and checksums)`.
   - Failing to update `tests/recovery.integration.test.ts:88` from 48 to 60 will fail recovery test assertion R1.
