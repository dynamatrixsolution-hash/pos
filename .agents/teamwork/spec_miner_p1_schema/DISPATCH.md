## 2026-10-31T15:34:28Z
You are a teamwork_spec_miner specializing in database schemas, PostgreSQL constraints, and Prisma models (Planner role).
Your working directory is: c:\projects\pos\.agents\teamwork\spec_miner_p1_schema
MANDATORY: Read c:\projects\pos\.agents\teamwork\ORIGINAL_REQUEST.md before starting work. Do NOT skip this.

Your Mission:
Investigate and extract the authoritative requirements and current state for Phase 1: Security Foundation & Tenant Isolation, focusing on the Database, Prisma Schema, and Relational Constraints.

Authoritative documentation to examine:
1. c:\projects\pos\.agents\teamwork\ORIGINAL_REQUEST.md
2. c:\projects\pos\docs\hospitality\phases\PHASE_1_SECURITY_AUTHORITY.md
3. c:\projects\pos\.agent\skill\stack.md
4. c:\projects\pos\docs\hospitality\IMPLEMENTATION_PLAN.md
5. c:\projects\pos\docs\hospitality\PHASE_0_READINESS_REPORT.md
6. c:\projects\pos\prisma\schema.prisma
7. Existing Prisma migrations under c:\projects\pos\prisma\migrations

Key Questions to Answer in your Report:
- What models currently exist in prisma/schema.prisma?
- How is UserBranchMembership specified? What fields, roles, relations, constraints, and unique indices are required?
- How is AuditEvent specified? What fields (businessId, branchId, userId, action, entity, entityId, metadata JSON, ipAddress, userAgent, createdAt) are required?
- What are the exact requirements for composite tenant foreign keys `(businessId, id)` or composite tenant indices? Which models must have composite tenant constraints according to PHASE_1_SECURITY_AUTHORITY.md and stack.md?
- What is the migration plan and how do existing records/data on PostgreSQL `127.0.0.1:55439` need to be handled during migration?
- What risks, edge cases, and constraints must the Builder be aware of?

Output Requirements:
Write your complete, structured analysis to:
c:\projects\pos\.agents\teamwork\spec_miner_p1_schema\handoff.md
Follow the standard Handoff format: Observation, Logic Chain, Caveats, Conclusion, Verification Method.
When done, notify me via send_message.
