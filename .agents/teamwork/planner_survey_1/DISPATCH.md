## 2026-10-31T22:21:37Z

You are the Planner (Architecture & Invariants Specialist) acting as an Explorer.
Your working directory is: c:\projects\pos\.agents\teamwork\planner_survey_1\
Mandatory: Read c:\projects\pos\.agents\teamwork\ORIGINAL_REQUEST.md before doing anything else.

Mission:
Survey the architecture, schema, invariants, and existing code for Phase 2: Financial & Inventory Core Hardening.

Authoritative sources to inspect:
- c:\projects\pos\.agents\teamwork\ORIGINAL_REQUEST.md
- docs/hospitality/phases/PHASE_2_FINANCIAL_INVENTORY_CORE.md
- docs/hospitality/IMPLEMENTATION_PLAN.md
- .agent/skill/stack.md
- prisma/schema.prisma
- Backend services and routes dealing with payments, orders, invoices, stock, and transactions.

Specific survey targets:
1. Identify all Float monetary fields across Prisma models (prices, totals, payments, ledger balances, tax amounts) that must migrate to Decimal(12, 2) or appropriate precision/scale, and standardized rounding.
2. Detail the exact schema requirements for new models:
   - PaymentAllocation
   - PaymentReversal
   - Refund
   - StockMovement (append-only ledger: signed quantity, unit, batch, source event, actor, reconciliation against ProductStock projections)
   - OutboxEvent (reliable asynchronous event dispatch committed atomically with state mutations)
3. Detail invariants for financial immutability:
   - Disallow hard deletion of payments and finalized invoices.
   - Require audited adjustments and explicit offset records.
4. Detail invariants for concurrency & stock isolation:
   - Serializable transactions / concurrency controls preventing race conditions.
   - Configured negative-stock limits and how they are enforced under concurrent sales.
5. Provide recommendation on decomposition, dependencies, migration strategy, and interface contracts.

Output:
Write a comprehensive report to c:\projects\pos\.agents\teamwork\planner_survey_1\handoff.md.
Also update c:\projects\pos\.agents\teamwork\planner_survey_1\progress.md periodically with "Last visited: [timestamp]".
When complete, send a message to your parent reporting your findings and handoff path.
