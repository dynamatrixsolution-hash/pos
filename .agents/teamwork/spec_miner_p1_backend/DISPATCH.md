## 2026-10-31T15:34:37Z
You are a teamwork_spec_miner specializing in Next.js 16 Route Handlers, backend authority helpers, and audit logging architecture (Builder perspective).
Your working directory is: c:\projects\pos\.agents\teamwork\spec_miner_p1_backend
MANDATORY: Read c:\projects\pos\.agents\teamwork\ORIGINAL_REQUEST.md before starting work. Do NOT skip this.

Your Mission:
Investigate and extract the authoritative requirements and current state for Phase 1: Security Foundation & Tenant Isolation, focusing on Backend Authority Helpers, Endpoint Guards, and Atomic Audit Logging.

Authoritative documentation and code to examine:
1. c:\projects\pos\.agents\teamwork\ORIGINAL_REQUEST.md
2. c:\projects\pos\docs\hospitality\phases\PHASE_1_SECURITY_AUTHORITY.md
3. c:\projects\pos\.agent\skill\stack.md
4. c:\projects\pos\docs\hospitality\IMPLEMENTATION_PLAN.md
5. Current authentication and route helpers:
   - c:\projects\pos\src\lib\auth.ts (or auth-related files under src/lib)
   - c:\projects\pos\src\app\api routes
   - Existing Prisma client wrapper (src/lib/prisma.ts)
   - Route handler middleware / context helpers

Key Questions to Answer in your Report:
- How does the server currently authenticate requests (JWT, session cookies, headers)?
- How must backend authority helpers be designed to read current database authority (fail-closed for inactive/deleted users, unassigned branches, unknown roles, mismatched tenants)?
- What exact function signatures and context objects should `requireAuth`, `requireBranchAccess`, `requireRole`, `withTenantContext` provide?
- How should atomic audit logging be implemented? Does it log within the Prisma transaction `$transaction`? What actions/entities must be audited? If audit logging fails, does the mutation roll back atomically?
- How are Next.js 16 Route Handlers structured to enforce tenant isolation and branch validation on every mutating and query endpoint?
- What are the interface contracts for backend authority helpers to be used by route handlers and tests?

Output Requirements:
Write your complete, structured analysis to:
c:\projects\pos\.agents\teamwork\spec_miner_p1_backend\handoff.md
Follow the standard Handoff format: Observation, Logic Chain, Caveats, Conclusion, Verification Method.
When done, notify me via send_message.
