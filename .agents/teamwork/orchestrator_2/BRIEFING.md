# BRIEFING — 2026-11-01T04:42:00Z

## Mission
Orchestrate Phase 3: Restaurant Staff MVP (Dine-in, Tables, Menus & Orders) to production readiness adhering to all invariants, UI/UX, and testing standards.

## 🔒 My Identity
- Archetype: orchestrator
- Roles: orchestrator, user_liaison, human_reporter, successor
- Working directory: c:\projects\pos\.agents\teamwork\orchestrator_2
- Original parent: sentinel
- Original parent conversation ID: cffaa667-38e3-44ad-8743-65a08248b6f1

## 🔒 My Workflow
- **Pattern**: Project
- **Scope document**: c:\projects\pos\.agents\teamwork\orchestrator_2\PROJECT.md
1. **Decompose**: Survey full scope using 3 Explorers (Planner, Designer, Tester), synthesize into PROJECT.md, define Milestones (M1: Core Schema & Migration, M2: Table & Floor Lifecycle Invariants, M3: Menu & Modifier Catalog, M4: Multi-Round 3D Order Status Services, M5: Hospitality Staff POS UI/UX, M6: Adversarial Testing, Reconciliation & Docs), then dispatch.
2. **Dispatch & Execute**:
   - **Direct (iteration loop)**: Explorer -> Worker -> Reviewer -> Challenger -> Auditor -> Gate check.
3. **On failure**: Retry -> Replace -> Skip -> Redistribute -> Redesign -> Escalate.
4. **Succession**: At 16 spawns, write handoff.md, cancel crons, spawn successor.
- **Work items**:
  1. Survey & Map Scope (Planner, Designer, Tester) [done]
  2. Synthesize PROJECT.md & Decompose Milestones [done]
  3. Milestone M1: Core Schema Additions & Additive Migration [done]
  4. Milestone M2: Table & Floor Management Services & APIs [in-progress]
  5. Milestone M3: Restaurant Menu & Modifier Catalog [pending]
  6. Milestone M4: Multi-Round Orders & 3D Status Lifecycles [pending]
  7. Milestone M5: Hospitality Staff POS UI/UX [pending]
  8. Milestone M6: Adversarial Hardening, Reconciliation & Phase 3 Docs [pending]
- **Current phase**: 2
- **Current focus**: Milestone M2 (Floor, Table & TableSession Management Services & APIs) — Worker Implementation Phase

## 🔒 Key Constraints
- Never write, modify, or create source code files directly.
- Never run build/test commands yourself — require workers to do so.
- Never investigate or explore the problem at the code level — dispatch Explorers for technical investigation.
- Use file-editing tools ONLY for metadata/state files (.md) in .agents/teamwork/orchestrator_2/.
- Binary veto on Forensic Auditor integrity violations.
- Always include path to ORIGINAL_REQUEST.md in every subagent dispatch.
- Mandatory integrity warning in Worker dispatch prompts.
- Strictly adhere to Phase 3 Restaurant Staff MVP scope; defer KDS and recipe consumption to Phase 4.

## Current Parent
- Conversation ID: cffaa667-38e3-44ad-8743-65a08248b6f1
- Updated: 2026-11-01T04:23:17Z

## Key Decisions Made
- Milestone M1 passed Gate with unanimous approvals and clean forensic audit. Marked DONE.
- Completed M2 exploration with 3 specialists (Floor/Table spec, TableSession lifecycle, Atomic move/merge).
- Dispatched M2 Builder Worker (`p3_m2_worker_1`) to implement services, routes, and tests.

## Team Roster
| Agent | Type | Work Item | Status | Conv ID |
|-------|------|-----------|--------|---------|
| planner_survey_2 | teamwork_explorer | Architecture, Schema & Invariant Survey | completed | db5461de-083f-458e-bafb-60332708e737 |
| designer_survey_2 | teamwork_explorer | UI/UX Specifications per uiuxskills.md | completed | 2eeb5e53-0064-487e-a78c-ddf5615dc820 |
| tester_survey_2 | teamwork_explorer | Concurrency, Invariants & Test Strategy | completed | d4777b71-a398-43a5-9ae5-c5590ac8ae0a |
| p3_m1_explorer_1 | teamwork_spec_miner | M1 Schema & Additive Migration Mining | completed | 6d73cadb-f130-443f-850d-105361e1b539 |
| p3_m1_explorer_2 | teamwork_explorer | M1 Backup DAG & Recovery Count Analysis | completed | f785fbf1-83df-4a09-a807-3add450699dd |
| p3_m1_explorer_3 | teamwork_explorer | M1 Monorepo Verification Protocol | completed | ddbacf1b-e57b-4273-b3e2-7ca2c6d5107b |
| p3_m1_worker_1 | teamwork_worker | M1 Schema, Additive Migration & Verification | completed | fab73f8d-db76-4943-864f-80e83c59c44c |
| p3_m1_reviewer_1 | teamwork_reviewer | M1 Schema & Recovery Review | completed | 5c118e9a-d6e8-453a-bca9-a6b0c6c4ccbd |
| p3_m1_reviewer_2 | teamwork_reviewer | M1 Multi-Tenant & DDL Review | completed | 4c80aee2-9e5e-4ba4-90f6-6091a27a3e57 |
| p3_m1_challenger_1 | teamwork_challenger | M1 Topological DAG Stress Challenger | completed | 0ffd78e9-d38c-4835-96fd-dc867717ff2b |
| p3_m1_challenger_2 | teamwork_challenger | M1 Tenant Isolation Challenger | completed | fec9261c-a905-4975-bdad-b8e5a31db295 |
| p3_m1_auditor_1 | teamwork_auditor | M1 Forensic Integrity Audit | completed | c61de5f5-a084-4a25-a80f-55072ed3a9dd |
| p3_m2_explorer_1 | teamwork_spec_miner | M2 Floor & Table Service/Route Mining | completed | e9dae537-34e4-4350-ab26-d9b52adb349f |
| p3_m2_explorer_2 | teamwork_explorer | M2 TableSession Lifecycle & State Machine | completed | e31d929f-5d4f-445d-bf65-ef18bda4c38f |
| p3_m2_explorer_3 | teamwork_explorer | M2 Atomic Table Move & Merge Transactions | completed | fa7838ab-8a12-4276-a7fc-e85f1573338e |
| p3_m2_worker_1 | teamwork_worker | M2 Floor & Table Services & Routes | in-progress | 6a260b26-30ab-479a-8797-e4ca6a65b087 |

## Succession Status
- Succession required: yes (threshold reached, pending subagent completion)
- Spawn count: 16 / 16
- Pending subagents: 6a260b26-30ab-479a-8797-e4ca6a65b087
- Predecessor: orchestrator_1
- Successor: not yet spawned

## Active Timers
- Heartbeat cron: 98f60f04-06d4-493d-9df7-9f604839d4bc/task-283
- Safety timer: 98f60f04-06d4-493d-9df7-9f604839d4bc/task-459
- On succession: kill all timers before spawning successor
- On context truncation: handle timers as step 4 of the State Recovery section of your prompt says

## Artifact Index
- c:\projects\pos\.agents\teamwork\ORIGINAL_REQUEST.md — Authoritative user requirements
- c:\projects\pos\.agents\teamwork\orchestrator_2\DISPATCH.md — Parent dispatch messages
- c:\projects\pos\.agents\teamwork\orchestrator_2\progress.md — Liveness & iteration tracking
- c:\projects\pos\.agents\teamwork\orchestrator_2\PROJECT.md — Global project plan & feature inventory
- c:\projects\pos\.agents\teamwork\orchestrator_2\GATE_STATUS.md — Gate status ledger
- c:\projects\pos\.agents\teamwork\planner_survey_2\planner_survey_report.md — Architectural survey findings
- c:\projects\pos\.agents\teamwork\designer_survey_2\designer_survey_report.md — Hospitality UI/UX specifications
- c:\projects\pos\.agents\teamwork\tester_survey_2\tester_survey_report.md — Invariants & concurrency test design
- c:\projects\pos\.agents\teamwork\p3_m1_worker_1\handoff.md — M1 Worker implementation handoff
- c:\projects\pos\.agents\teamwork\p3_m1_auditor_1\handoff.md — M1 Forensic Auditor CLEAN handoff
- c:\projects\pos\.agents\teamwork\p3_m2_explorer_1\floor_table_spec_report.md — M2 Floor/Table specs
- c:\projects\pos\.agents\teamwork\p3_m2_explorer_2\table_session_lifecycle_report.md — M2 TableSession lifecycle specs
- c:\projects\pos\.agents\teamwork\p3_m2_explorer_3\move_merge_spec_report.md — M2 Move/Merge transactional specs
