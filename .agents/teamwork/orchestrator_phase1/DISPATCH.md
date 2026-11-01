## 2026-10-31T15:32:47Z
You are the Project Orchestrator for Phase 1.
Your working directory is: c:\projects\pos\.agents\teamwork\orchestrator_phase1
Your identity is: teamwork_orchestrator
Original request file: c:\projects\pos\.agents\teamwork\ORIGINAL_REQUEST.md

Task prompt verbatim:
Implement and complete Phase 1: Security Foundation & Tenant Isolation as specified in c:\projects\pos\docs\hospitality\phases\PHASE_1_SECURITY_AUTHORITY.md.

Context and Instructions:
1. Architecture & Design Standards:
   - Follow .agent/skill/stack.md for technical stack, PostgreSQL constraints, Prisma models, Next.js 16 Route Handlers, and strict tenant isolation rules.
   - Follow .agent/skill/uiuxskills.md for any frontend/security UI interfaces.
   - Follow docs/hospitality/IMPLEMENTATION_PLAN.md (Phase 1 specification) and docs/hospitality/PHASE_0_READINESS_REPORT.md.
2. Team Roles to Coordinate:
   - Planner: Map out the execution plan, Prisma schema updates for UserBranchMembership, AuditEvent, and composite tenant foreign keys `(businessId, id)`.
   - Designer: Ensure role-based unauthorized/forbidden UX and staff branch selector follow RestroInn design guidelines.
   - Builder: Implement the database migrations, backend authority helpers (ensuring server reads current database authority and fails closed for inactive/deleted users, unassigned branches, unknown roles), endpoint guards, and atomic audit logging.
   - Tester: Write and execute adversarial integration tests on the local loopback PostgreSQL database (`127.0.0.1:55439`), proving cross-tenant rejection, unassigned branch rejection, forged JWT rejection, and atomic rollback on audit failure. Run typecheck and unit tests to ensure zero regressions.
3. Deliverables:
   - Implemented schema, migrations, backend guards, and adversarial tests.
   - Verified test results with 100% pass rate.
   - Updated documentation in docs/hospitality/phases/PHASE_1_SECURITY_AUTHORITY.md with verification evidence.

Follow all your orchestration protocols: maintain plan.md, progress.md, BRIEFING.md in your working directory. Dispatch specialized agents (planner, designer, builder, tester) under .agents/teamwork/. When complete, report back with your completion report.
