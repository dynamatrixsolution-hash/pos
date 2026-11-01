# 5-Component Handoff Report: Phase 3 Verification Strategy & Test Architecture
**Role**: Tester Concurrency & Invariants Explorer  
**Working Directory**: `c:\projects\pos\.agents\teamwork\tester_survey_2`  
**Milestone**: Phase 3 Restaurant Staff MVP (Dine-in, Tables, Menus & Orders)  
**Date**: 2026-11-01  

---

## 1. Observation

1. **Isolated PostgreSQL Container Status (`127.0.0.1:55439`)**:
   - `scripts/database-verification.mjs` lines 1–9 strictly validates:
     ```js
     if (!["postgres:", "postgresql:"].includes(url.protocol) || url.hostname !== "127.0.0.1" || url.port !== "55439" || url.pathname !== "/restro_test" || url.username !== "restro_dev" || url.search || url.hash) {
       throw new Error("Refusing non-isolated database target");
     }
     ```
   - Running live commands against `127.0.0.1:55439`:
     * `npm.cmd run typecheck`: Exited 0 with zero errors (`tsc -p backend/tsconfig.json ... && tsc -p frontend/tsconfig.json ...`).
     * `npm.cmd test`: Exited 0 with 9 passed test files, 85 passed tests, and 41 skipped integration tests.
     * `node scripts/restro-env.mjs recovery-test`: Exited 0 with 8/8 passed tests in `tests/recovery.integration.test.ts`.
     * `node scripts/restro-restore-env.mjs rehearse`: Exited 0 with 41/41 rehearsal checks passed (`source restro_test:55439` -> `target restro_restore:55440`).
     * `node scripts/restro-env.mjs integration`: Exited 0 with 14/14 tests passed in `tests/commerce.integration.test.ts`.
     * `node scripts/restro-env.mjs backend-build`: Exited 0; compiled 60 Next.js routes.
     * `node scripts/restro-env.mjs frontend-build`: Exited 0; compiled 64 Next.js routes.

2. **Backup Topological Dependency Engine (`backend/src/lib/backup-format.ts`)**:
   - Lines 12–19 compute `backupModels` dynamically:
     ```ts
     const models = Prisma.dmmf.datamodel.models.filter(model => !excludedModels.includes(model.name));
     export const backupModels: typeof models = [];
     const pending = [...models];
     while (pending.length) {
       const index = pending.findIndex(model => model.fields.filter(field => field.relationFromFields?.length).every(field => backupModels.some(parent => parent.name === field.type)));
       if (index < 0) throw new Error("Backup schema has unsupported dependency cycle");
       backupModels.push(pending.splice(index, 1)[0]);
     }
     ```
   - In `tests/recovery.integration.test.ts` line 88, the model count assertion is currently hardcoded:
     ```ts
     expect(Object.keys(original.tables)).toHaveLength(48);
     ```
   - In `scripts/rehearse-recovery.ts` lines 260–263, model verification is dynamic:
     ```ts
     check(`entity counts equal for all ${format.backupModels.length} models`, mismatched.length === 0, mismatched.join(",") || `${totalRows} rows`);
     ```

3. **Concurrency and Transaction Serialization Architecture**:
   - `backend/src/lib/commerce-transaction.ts` lines 19–28 executes interactive transactions with `isolationLevel: Serializable` and retries Prisma error `P2034` up to 3 times before returning HTTP 409 Conflict.
   - `tests/commerce.integration.test.ts` lines 60–67 and `scripts/verify-restro-milestone.mjs` lines 40–48 observe real PostgreSQL backends:
     ```sql
     SELECT pg_backend_pid() AS pid;
     SELECT pg_sleep(0.025);
     ```
     logging `RACE_CONNECTIONS` and verifying `new Set(witness.pids).size >= 2`.

4. **Audit Event Logging Implementation**:
   - `backend/src/lib/audit-event.ts` lines 49–72:
     ```ts
     export async function createAuditEvent(input: CreateAuditEventInput, tx?: Prisma.TransactionClient)
     ```
     Records append-only `AuditEvent` with sanitized `oldValue`, `newValue`, `metadata`, and operational `reason`. When passed transaction client `tx`, failure to write the audit event rolls back the enclosing transaction.

5. **Decimal Precision Infrastructure**:
   - `backend/src/lib/services/decimal-math.ts` lines 38–47 provides `roundHalfEven(val, 2)` (Banker's rounding mode 6) and exact Decimal arithmetic (`addMoney`, `subMoney`, `mulMoney`, `divMoney`).
   - `tests/challenger-financial-stress.test.ts` lines 64–79 proves 10,000 penny increments accumulate zero drift under `Prisma.Decimal`, while IEEE 754 floats accumulate drift.

---

## 2. Logic Chain

1. **From Observation 1**: The container environment on `127.0.0.1:55439` is active, healthy, and all seven core verification commands pass with exit code 0.
2. **From Observation 2**:
   - The backup engine topologically sorts all non-excluded Prisma models based on foreign key references.
   - The proposed 12 Phase 3 restaurant entities (`Floor`, `RestaurantTable`, `TableSession`, `Menu`, `MenuSection`, `MenuItem`, `ModifierGroup`, `ModifierOption`, `MenuItemModifierGroup`, `RestaurantOrder`, `OrderRound`, `OrderLine`) have clean parent-child foreign key relationships.
   - **Crucial Rule**: `TableSession` must NOT store an `activeOrderId` pointing to `RestaurantOrder` while `RestaurantOrder` points to `TableSession.id`. Any two-way foreign key creates a cycle, triggering line 17 of `backup-format.ts` (`"Backup schema has unsupported dependency cycle"`).
   - Adding 12 models increases the total tenant model count from 48 to 60.
   - Because `tests/recovery.integration.test.ts` line 88 hardcodes `expect(Object.keys(original.tables)).toHaveLength(48);`, this assertion will immediately fail once the Phase 3 schema is added unless updated to expect `60` models.
   - `rehearse-recovery.ts` uses `format.backupModels.length`, so it will automatically adapt to 60 models and execute 41 checks without hardcoded count failure.
3. **From Observation 3 & Specs**:
   - In a restaurant POS, multiple terminals concurrently read and write the same `TableSession` and `RestaurantOrder`.
   - Applying `serializable()` interactive transactions to session and order operations will catch `P2034` conflicts and retry safely, preventing lost updates during simultaneous order round submissions.
   - Optimistic concurrency control (checking `version: Int` on `TableSession`, `RestaurantOrder`, and `OrderLine`) ensures stale terminal writes fail closed with HTTP 409 Conflict.
4. **From Observation 4 & Specs**:
   - Rejecting or voiding an `OrderLine` must enforce `reason.trim().length > 0` at the API boundary, returning HTTP 400 Bad Request if missing.
   - Within the void transaction, calling `createAuditEvent({ action: "ORDER_LINE_VOIDED", entity: "OrderLine", entityId, reason }, tx)` guarantees that if the audit log insertion fails, the void mutation rolls back.
5. **From Observation 5 & Specs**:
   - Equal-shares split billing across prime guest counts ($N = 3, 7, 11, 13$) cannot use naive floating point division without causing penny drift.
   - Using the standard hospitality integer-cent remainder algorithm ($\text{Base} = \lfloor T/N \rfloor$, $R = T \pmod N$, where the first $R$ guests pay $\text{Base} + 1$ and $N - R$ pay $\text{Base}$) mathematically proves zero penny drift: $\sum \text{shares} \equiv \text{order total}$.

---

## 3. Caveats

1. **Phase 4 Deferral**: Kitchen Display System (KDS) live station routing, printer hardware drivers, and recipe ingredient depletion are deferred to Phase 4. Tests for Phase 3 focus exclusively on core restaurant tables, menus, multi-round orders, 3D statuses, and staff UI/API invariants.
2. **Offline Local POS Cache**: Offline terminal synchronization with local storage journals is out of scope for the Phase 3 staff MVP; online PostgreSQL connectivity is assumed for active session transitions and settlement.
3. **Prisma Client Generation**: When Phase 3 models are migrated to `packages/db/prisma/schema.prisma`, `npm run prisma:generate` must be executed to refresh `Prisma.dmmf` metadata before running test suites.

---

## 4. Conclusion

The verification architecture and test strategy for Phase 3: Restaurant Staff MVP is fully surveyed, specified, and ready for implementation.

Key deliverables designed and specified in `tester_survey_report.md`:
1. **Three-Dimensional Status Independence Test Suite**: Proves `UNPAID` -> `PAID` preserves `READY` (paying never marks food served), `READY` -> `SERVED` preserves `UNPAID` (serving never settles bill), and `REJECTED` never auto-refunds.
2. **Multi-Round Order Integrity Test Suite**: Proves Round 2 preserves Round 1 lines, modifiers, statuses, and totals with zero duplication and cumulative billing.
3. **Atomic Table Move & Merge Test Suite**: Proves Table A -> Table B transfers active session and orders atomically; verifies conflict rollback.
4. **Mandatory Audit Logging Test Suite**: Proves void/rejection fails closed without reason and rolls back on audit failure.
5. **Immutable Price Snapshotting Test Suite**: Proves catalog price/delta edits do not mutate historical or open order lines.
6. **Adversarial Concurrency Harness**: Multi-terminal simultaneous additions with PostgreSQL connection PID witnessing and optimistic version checks.
7. **Split-Billing Reconciliation Suite**: Proves itemized split and equal-shares split with zero penny drift across all prime denominators.
8. **Recovery Engine Protection**: Documented the exact model transition (48 -> 60 models) and acyclic relation constraint required for `backup-format.ts` and `recovery.integration.test.ts:88`.

---

## 5. Verification Method

To independently verify the environment and test harness:

1. **Verify Environment Health & Builds**:
   ```bash
   npm.cmd run typecheck
   npm.cmd test
   node scripts/restro-env.mjs recovery-test
   node scripts/restro-restore-env.mjs rehearse
   node scripts/restro-env.mjs integration
   node scripts/restro-env.mjs backend-build
   node scripts/restro-env.mjs frontend-build
   ```
2. **Inspect Survey Artifacts**:
   - Survey Report: `c:\projects\pos\.agents\teamwork\tester_survey_2\tester_survey_report.md`
   - Progress Log: `c:\projects\pos\.agents\teamwork\tester_survey_2\progress.md`
   - Briefing: `c:\projects\pos\.agents\teamwork\tester_survey_2\BRIEFING.md`
3. **Invalidation Conditions**:
   - Any test command failing with non-zero exit code.
   - Introducing a two-way relation between `TableSession` and `RestaurantOrder` that causes `backup-format.ts` to throw dependency cycle errors.
   - Forgetting to update `tests/recovery.integration.test.ts:88` from 48 to 60 models following schema migration.
