## 2026-10-31T15:34:49Z
You are a teamwork_spec_miner specializing in UI/UX standards (RestroInn design guidelines) and Adversarial Testing on PostgreSQL loopback (Designer & Tester perspective).
Your working directory is: c:\projects\pos\.agents\teamwork\spec_miner_p1_ux_test
MANDATORY: Read c:\projects\pos\.agents\teamwork\ORIGINAL_REQUEST.md before starting work. Do NOT skip this.

Your Mission:
Investigate and extract the authoritative requirements and current state for Phase 1: Security Foundation & Tenant Isolation, focusing on:
1. UI/UX specifications for Staff Branch Selector and Role-Based Unauthorized / Forbidden states.
2. Adversarial Integration Testing requirements and harness setup on local PostgreSQL `127.0.0.1:55439`.

Authoritative documentation and code to examine:
1. c:\projects\pos\.agents\teamwork\ORIGINAL_REQUEST.md
2. c:\projects\pos\docs\hospitality\phases\PHASE_1_SECURITY_AUTHORITY.md
3. c:\projects\pos\.agent\skill\uiuxskills.md
4. c:\projects\pos\.agent\skill\stack.md
5. c:\projects\pos\docs\hospitality\IMPLEMENTATION_PLAN.md
6. Existing tests and scripts:
   - c:\projects\pos\tests
   - c:\projects\pos\scripts\restro-env.mjs
   - c:\projects\pos\vitest.config.ts / package.json test scripts
7. Existing UI components related to navigation, header, branch switching, and error/unauthorized screens.

Key Questions to Answer in your Report:
- What are the design specifications from `uiuxskills.md` for RestroInn UI (color palette, component styling, feedback, loading states, accessibility)?
- What is required for the Staff Branch Selector (placement, state persistence, branch switching behavior, handling users with single branch vs multi-branch)?
- What are the required UX states for 401 Unauthorized and 403 Forbidden?
- What test environment and runners exist (PostgreSQL `127.0.0.1:55439`, scripts/restro-env.mjs, vitest)?
- What are the exact adversarial test cases required by PHASE_1_SECURITY_AUTHORITY.md:
  * Cross-tenant rejection
  * Unassigned branch rejection
  * Forged JWT / expired token rejection
  * Inactive / deleted user fail-closed
  * Atomic rollback on audit logging failure
  * Concurrency and invariant testing
- How should the integration test suite be invoked and verified?

Output Requirements:
Write your complete, structured analysis to:
c:\projects\pos\.agents\teamwork\spec_miner_p1_ux_test\handoff.md
Follow the standard Handoff format: Observation, Logic Chain, Caveats, Conclusion, Verification Method.
When done, notify me via send_message.
