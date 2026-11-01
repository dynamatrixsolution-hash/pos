## 2026-11-01T03:59:33Z
You are the M1 Builder Worker for Phase 3 Milestone M1: Core Schema Additions & Additive Migration.

Working Directory: c:\projects\pos\.agents\teamwork\p3_m1_worker_1
Authoritative Original Request: c:\projects\pos\.agents\teamwork\ORIGINAL_REQUEST.md
Scope Document: c:\projects\pos\.agents\teamwork\orchestrator_2\PROJECT.md

Explorer Deliverables & References (Read these before implementing):
- c:\projects\pos\.agents\teamwork\p3_m1_explorer_1\schema_spec_report.md
- c:\projects\pos\.agents\teamwork\p3_m1_explorer_1\handoff.md
- c:\projects\pos\.agents\teamwork\p3_m1_explorer_2\recovery_analysis_report.md
- c:\projects\pos\.agents\teamwork\p3_m1_explorer_2\handoff.md
- c:\projects\pos\.agents\teamwork\p3_m1_explorer_3\verification_plan_report.md
- c:\projects\pos\.agents\teamwork\p3_m1_explorer_3\handoff.md

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

File Write Ownership:
You own exclusively:
- packages/db/prisma/schema.prisma
- packages/db/prisma/migrations/202611010001_phase3_restaurant_staff_mvp/migration.sql
- tests/recovery.integration.test.ts
Do NOT modify files outside your ownership boundary.

Your Mission:
Execute the 5 sequential steps specified in Explorer 3's verification plan report:
1. Update `packages/db/prisma/schema.prisma`:
   - Add reverse navigation relations on `Business`, `Branch`, `User`, `Product`.
   - Append the 12 Phase 3 hospitality models: `Floor`, `RestaurantTable`, `TableSession`, `Menu`, `MenuSection`, `MenuItem`, `ModifierGroup`, `ModifierOption`, `MenuItemModifierGroup`, `RestaurantOrder`, `OrderRound`, `OrderLine`.
   - Crucial constraint: Ensure `RestaurantTable.currentSessionId` is a scalar `String?` without an `@relation` attribute to prevent dependency cycles in `backup-format.ts`.
2. Generate Prisma Client:
   - Run `npm.cmd run prisma:generate` (or `npx prisma generate --schema=packages/db/prisma/schema.prisma`).
3. Create Additive Migration:
   - Create `packages/db/prisma/migrations/202611010001_phase3_restaurant_staff_mvp/migration.sql`.
   - Use the complete, verified DDL provided in `schema_spec_report.md` / `verification_plan_report.md`.
4. Deploy Migrations:
   - Deploy to primary container database: `node scripts/restro-env.mjs migrate`
   - Deploy to restore target container database: `node scripts/restro-restore-env.mjs migrate`
5. Update Recovery Test Assertion:
   - In `tests/recovery.integration.test.ts` line 88, update `expect(Object.keys(original.tables)).toHaveLength(48)` to `expect(Object.keys(original.tables)).toHaveLength(60)`.
6. Verify Everything:
   - `npm.cmd run typecheck`
   - `npm.cmd test`
   - `node scripts/restro-env.mjs recovery-test`
   - `node scripts/restro-restore-env.mjs rehearse`
7. Write your 5-component handoff report (Observation, Logic Chain, Caveats, Conclusion, Verification Method) with all command outputs and exit codes to:
   `c:\projects\pos\.agents\teamwork\p3_m1_worker_1\handoff.md`.
8. Notify the orchestrator upon completion via send_message.
