## 2026-10-31T16:23:36Z
You are the Builder (teamwork_worker) responsible for Milestone 1: Database Schema & Relational Integrity for Phase 1.
Your working directory is: c:\projects\pos\.agents\teamwork\worker_p1_m1_schema

MANDATORY: Read c:\projects\pos\.agents\teamwork\ORIGINAL_REQUEST.md before starting work. Do NOT skip this.

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Technical Stack & Specifications to follow:
- .agent/skill/stack.md (PostgreSQL 15+, Prisma constraints, composite foreign keys)
- c:\projects\pos\.agents\teamwork\orchestrator_phase1\SCOPE.md (Phase 1 scope)
- c:\projects\pos\.agents\teamwork\spec_miner_p1_schema\handoff.md (Detailed planner report with exact model schemas, SQL migration statements, backfill queries, and recovery test mitigations)

Your Exclusive Write Ownership:
- packages/db/prisma/schema.prisma
- packages/db/prisma/migrations/202610310001_phase1_security_foundation/migration.sql
- tests/recovery.integration.test.ts (update model count assertion 41 -> 43)
- scripts/rehearse-recovery.ts (update model count check if needed)

Tasks to Complete:
1. Update packages/db/prisma/schema.prisma:
   - Add UserBranchMembership model with fields: id, businessId, userId, branchId, role?, isDefault, isActive, createdAt, updatedAt; relations to Business, User, Branch; @@unique([userId, branchId]), @@unique([businessId, id]), @@index([businessId, userId]), @@index([businessId, branchId]). Add inverse relations on Business, User, Branch.
   - Add AuditEvent model with fields: id, businessId, branchId?, userId?, action, entity, entityId?, entityVersion @default(1), oldValue Json?, newValue Json?, metadata Json?, reason?, ipAddress?, userAgent?, createdAt; relations to Business, Branch, User; @@unique([businessId, id]), indices on [businessId, entity, entityId], [businessId, createdAt], [businessId, userId]. Add inverse relations on Business, Branch, User.
   - Add @@unique([businessId, id]) to all 28 existing tenant models in schema.prisma.
2. Create migration packages/db/prisma/migrations/202610310001_phase1_security_foundation/migration.sql:
   - DDL for UserBranchMembership and AuditEvent tables and indices.
   - SQL backfill for existing users in User:
     INSERT INTO "UserBranchMembership" ("id", "businessId", "userId", "branchId", "role", "isDefault", "isActive", "createdAt", "updatedAt")
     SELECT gen_random_uuid(), "businessId", "id", "branchId", "role", true, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
     FROM "User" WHERE "branchId" IS NOT NULL AND "deletedAt" IS NULL;
   - CREATE UNIQUE INDEX on all tenant tables for (businessId, id).
   - Custom composite foreign keys:
     FOREIGN KEY ("businessId", "branchId") REFERENCES "Branch"("businessId", "id") ON DELETE CASCADE, etc.
3. Apply migration to local databases:
   - Deploy to dev DB: node scripts/restro-env.mjs migrate
   - Deploy to restore DB: node scripts/restro-restore-env.mjs migrate
   - Regenerate Prisma client: npm run generate --workspace=@dynapos/db
4. Synchronize backup/recovery assertions:
   - Update tests/recovery.integration.test.ts line 83 to 43 (or backupModels.length).
   - If scripts/rehearse-recovery.ts contains hardcoded model counts, update them so rehearsal checks match.
5. Verification commands:
   - node scripts/restro-restore-env.mjs rehearse (all 41 checks pass)
   - node scripts/restro-env.mjs recovery-test (all 8 tests pass)
   - node scripts/restro-env.mjs integration (all commerce tests pass)
   - npm.cmd run typecheck (clean exit code 0)

Output Requirements:
Write your complete report to:
c:\projects\pos\.agents\teamwork\worker_p1_m1_schema\handoff.md
Follow standard Handoff format: Observation, Logic Chain, Caveats, Conclusion, Verification Method. Include exact execution outputs.
When done, notify me via send_message.
