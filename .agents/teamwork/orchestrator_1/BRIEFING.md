# BRIEFING — 2026-11-01T03:27:00Z

## Mission
Implement Phase 3: Restaurant Staff MVP (Dine-in, Tables, Menus & Orders) for production as specified in docs/hospitality/phases/PHASE_3_RESTAURANT_MVP.md and docs/hospitality/IMPLEMENTATION_PLAN.md using the 4 specialized roles (Planner, Designer, Builder, Tester).

## 🔒 My Identity
- Archetype: teamwork_orchestrator
- Roles: orchestrator, user_liaison, human_reporter, successor
- Working directory: c:\projects\pos\.agents\teamwork\orchestrator_1\
- Original parent: sentinel
- Original parent conversation ID: cffaa667-38e3-44ad-8743-65a08248b6f1

## 🔒 My Workflow
- **Pattern**: Project Pattern (Survey -> Decompose & Delegate / Iteration Loop)
- **Scope document**: c:\projects\pos\.agents\teamwork\orchestrator_1\PROJECT.md
1. **Decompose**:
   - Step 0: Survey Phase 3 specifications and codebase using Planner, Designer, and Tester explorers.
   - Synthesize survey findings into PROJECT.md (Architecture, Feature Inventory, Milestones, Interface Contracts).
   - Decompose Phase 3 along module boundaries into sequential, verified milestones.
2. **Dispatch & Execute**:
   - For each milestone: Explorer(s) -> Worker (Builder) -> Reviewers (2) -> Challengers (2) -> Forensic Auditor (1).
   - Require worker & reviewer build and test execution on isolated PostgreSQL (127.0.0.1:55439).
   - Strict gate enforcement: 100% test pass, APPROVE from reviewers, CHALLENGER confirmation, CLEAN audit verdict.
3. **On failure** (in this order):
   - Retry: nudge stuck agent or re-send task
   - Replace: spawn fresh agent with partial progress
   - Skip: proceed without (only if non-critical)
   - Redistribute: split stuck agent's remaining work
   - Redesign: re-partition decomposition
   - Escalate: report to parent (sub-orchestrators only, last resort)
4. **Succession**: At 16 spawns, write handoff.md, cancel crons, spawn successor.
- **Work items**:
  1. Survey phase (Planner, Designer, Tester) [IN-PROGRESS]
  2. PROJECT.md feature inventory & milestone decomposition [PENDING]
  3. Milestones execution & gates [PENDING]
  4. Final integration & documentation verification [PENDING]
- **Current phase**: 0 (Survey)
- **Current focus**: Awaiting Survey Explorers (Planner, Designer, Tester)

## 🔒 Key Constraints
- NEVER write, modify, or create source code files directly.
- NEVER run build/test commands directly — delegate to workers/reviewers/challengers.
- NEVER investigate code directly — dispatch Explorers for investigation.
- You MAY use file-editing tools ONLY for metadata/state files (.md) in your .agents/teamwork/ folder.
- Organize work using the 4 requested specialist roles: Planner, Designer, Builder, Tester.
- Multi-tenant isolation using composite businessId keys.
- Decimal pricing deltas across all catalog and order lines.
- Independent 3D status lifecycles: Acceptance, Fulfillment, Settlement.
- Invariant: Paying for an order does NOT transition food lines to SERVED.
- Atomic table move and merge operations without duplicating order lines.
- Multi-round orders preserving earlier round items and states.
- Mandatory staff reason and audit record for voiding/rejecting lines.
- Scope strictly restricted to Phase 3 Restaurant Staff MVP (defer KDS routing/printing and recipe consumption to Phase 4).
- Binary Veto on Forensic Auditor: if integrity violation, fail unconditionally.
- Never reuse a subagent after it has delivered its handoff — always spawn fresh.

## Current Parent
- Conversation ID: cffaa667-38e3-44ad-8743-65a08248b6f1
- Updated: 2026-11-01T03:25:00Z

## Key Decisions Made
- Commenced Step 0: Survey with 3 parallel Explorers tailored to Planner, Designer, and Tester perspectives.

## Team Roster
| Agent | Type | Work Item | Status | Conv ID |
|-------|------|-----------|--------|---------|
| p3_planner_survey | teamwork_spec_miner | Survey Architecture & Invariants | in-progress | 4fb4b59b-2d28-4ae8-8abc-8494cd948bb8 |
| p3_designer_survey | teamwork_explorer | Survey Hospitality UI/UX | in-progress | c216ced2-c19e-427f-a858-bb08e8f09bbf |
| p3_tester_survey | teamwork_spec_miner | Survey Test Infra & Invariants | in-progress | 343db80b-c49e-406c-9f24-dadddbc6ef7f |

## Succession Status
- Succession required: no
- Spawn count: 3 / 16
- Pending subagents: 4fb4b59b-2d28-4ae8-8abc-8494cd948bb8, c216ced2-c19e-427f-a858-bb08e8f09bbf, 343db80b-c49e-406c-9f24-dadddbc6ef7f
- Predecessor: none
- Successor: not yet spawned

## Active Timers
- Heartbeat cron: c151eb2c-171d-4e4a-9eec-dd15e96c40d9/task-26
- Safety timer: c151eb2c-171d-4e4a-9eec-dd15e96c40d9/task-28

## Artifact Index
- c:\projects\pos\.agents\teamwork\ORIGINAL_REQUEST.md — Authoritative user request
- c:\projects\pos\.agents\teamwork\orchestrator_1\DISPATCH.md — Incoming dispatch log
- c:\projects\pos\.agents\teamwork\orchestrator_1\BRIEFING.md — Persistent working memory
- c:\projects\pos\.agents\teamwork\orchestrator_1\progress.md — Liveness & status tracking
- c:\projects\pos\.agents\teamwork\orchestrator_1\PROJECT.md — Global architecture, milestones & inventory
- c:\projects\pos\.agents\teamwork\orchestrator_1\GATE_STATUS.md — Milestone gate evaluation record
- c:\projects\pos\.agents\teamwork\orchestrator_1\DEAD_ENDS.md — Append-only failed approach log
