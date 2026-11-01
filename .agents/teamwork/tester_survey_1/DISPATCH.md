## 2026-10-31T22:21:50Z
[Message] timestamp=2026-10-31T22:21:50Z sender=400403a7-9a87-45bc-97f4-1570296f2846 priority=MESSAGE_PRIORITY_HIGH content=You are the Tester (Adversarial Security, Concurrency & Financial Reconciliation Specialist) acting as an Explorer.
Your working directory is: c:\projects\pos\.agents\teamwork\tester_survey_1\
Mandatory: Read c:\projects\pos\.agents\teamwork\ORIGINAL_REQUEST.md before doing anything else.

Mission:
Survey the testing infrastructure, verification harnesses, adversarial concurrency test requirements, and financial reconciliation test strategy for Phase 2: Financial & Inventory Core Hardening.

Authoritative sources to inspect:
- c:\projects\pos\.agents\teamwork\ORIGINAL_REQUEST.md
- docs/hospitality/phases/PHASE_2_FINANCIAL_INVENTORY_CORE.md
- docs/hospitality/IMPLEMENTATION_PLAN.md
- scripts/restro-env.mjs
- package.json (test scripts, vitest config, typecheck)
- Existing tests in the repository (unit, integration, recovery, e2e)

Specific survey targets:
1. Analyze the isolated test container environment:
   - Loopback port 127.0.0.1:55439 managed via scripts/restro-env.mjs.
   - Database connection strings, environment variables, lifecycle (start/stop/reset/migrate).
2. Examine existing test runners and scripts:
   - Vitest configuration, npm.cmd run typecheck command, integration test harnesses.
3. Concurrency & Race Condition Testing:
   - Design adversarial test cases where multiple concurrent requests sell items against the exact same batch.
   - Verify enforcement of configured negative-stock limits under high concurrency.
4. Financial Reconciliation Testing:
   - Design test harnesses that reconcile StockMovement signed sum against ProductStock projected inventory.
   - Design test harnesses that reconcile Invoice total = sum(PaymentAllocations) - sum(Refunds) + adjustments.
   - Design tests verifying soft-deletion and rejection of hard deletion on payments and finalized invoices.
5. Identify potential flakiness, isolation constraints, test commands, and exact test suite structure.

Output:
Write a comprehensive report to c:\projects\pos\.agents\teamwork\tester_survey_1\handoff.md.
Also update c:\projects\pos\.agents\teamwork\tester_survey_1\progress.md periodically with "Last visited: [timestamp]".
When complete, send a message to your parent reporting your findings and handoff path.
