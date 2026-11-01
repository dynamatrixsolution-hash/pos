# BRIEFING — 2026-11-01T03:26:00Z

## Mission
Discover and document testing specifications, adversarial concurrency scenarios, state machine invariants, and test infrastructure for Phase 3 Restaurant Staff MVP.

## 🔒 My Identity
- Archetype: specification-miner
- Roles: Tester (Adversarial Concurrency, Invariants & Test Infra)
- Working directory: c:\projects\pos\.agents\teamwork\p3_tester_survey
- Original parent: c151eb2c-171d-4e4a-9eec-dd15e96c40d9
- Milestone: Phase 3 Restaurant Staff MVP Survey & Spec Mining

## 🔒 Key Constraints
- Read-only: DO NOT modify any application source code
- Write only within c:\projects\pos\.agents\teamwork\p3_tester_survey\
- Prioritize authoritative sources over LLM prior knowledge
- Complete tester_survey_report.md and handoff.md
- Communicate all results to parent c151eb2c-171d-4e4a-9eec-dd15e96c40d9 via send_message

## Current Parent
- Conversation ID: c151eb2c-171d-4e4a-9eec-dd15e96c40d9
- Updated: 2026-11-01T03:25:48Z

## Task Summary
- **What to build**: Comprehensive testing specification report and test infrastructure survey for Phase 3 Restaurant Staff MVP
- **Success criteria**: Full enumeration of test infra commands & isolated PostgreSQL container lifecycle; adversarial concurrency & edge cases (optimistic concurrency, fail-closed stale writes, atomic move/merge); 3D status state machine invariants (acceptance, fulfillment, settlement independence, no payment auto-serve, multi-round integrity, audit reasons); split-billing decimal precision & penny reconciliation.
- **Interface contracts**: docs/hospitality/phases/PHASE_3_RESTAURANT_MVP.md, ORIGINAL_REQUEST.md
- **Code layout**: packages/, apps/, scripts/

## Key Decisions Made
- Initializing survey plan based on authoritative files.

## Artifact Index
- DISPATCH.md — Dispatch assignment
- BRIEFING.md — Persistent context & identity
- progress.md — Liveness & task execution tracker
- tester_survey_report.md — Detailed tester specification report
- handoff.md — 5-component handoff report
