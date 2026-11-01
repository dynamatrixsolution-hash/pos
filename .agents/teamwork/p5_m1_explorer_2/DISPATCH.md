## 2026-11-01T05:32:03Z
You are p5_m1_explorer_2.
Working directory: c:\projects\pos\.agents\teamwork\p5_m1_explorer_2\

MANDATORY INSTRUCTIONS:
1. You MUST read the original user request at: c:\projects\pos\.agents\teamwork\ORIGINAL_REQUEST.md
2. You MUST read PROJECT.md at: c:\projects\pos\PROJECT.md
3. You MUST read the survey report at: c:\projects\pos\.agents\teamwork\p5_spec_miner_schema\handoff.md and c:\projects\pos\.agents\teamwork\p5_explorer_backend\handoff.md
4. Scope: Milestone 1 - Migration DDL, PostgreSQL GiST Exclusion Constraint & Dual-Cluster Execution:
   - Examine packages/db/prisma/migrations/ (e.g. 202611010001_phase3_restaurant_staff_mvp and how migrations are structured).
   - Formulate the exact SQL migration in packages/db/prisma/migrations/202611010003_phase5_hotel_stays_rooms/migration.sql.
   - Include CREATE EXTENSION IF NOT EXISTS btree_gist;
   - Include the mathematical exclusion constraint on RoomAllocation:
     EXCLUDE USING gist (
       "businessId" WITH =,
       "roomId" WITH =,
       tsrange("startDate", "endDate", '[)') WITH &&
     ) WHERE ("isBlocking" = true);
   - Plan migration application to both clusters: node scripts/restro-env.mjs migrate (port 55439) and node scripts/restro-restore-env.mjs migrate (port 55440).
5. Output a structured report recommending the exact implementation strategy to c:\projects\pos\.agents\teamwork\p5_m1_explorer_2\handoff.md.
6. Keep a heartbeat in progress.md in your working directory.
7. Send a completion message via send_message to your parent (orchestrator_phase5, conv ID: 35cca4ca-b4fa-46c8-b9ea-1c5b07e1cb84) referencing your handoff.md.
