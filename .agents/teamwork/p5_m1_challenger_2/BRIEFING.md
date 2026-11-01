# BRIEFING — 2026-11-01T05:54:00Z

## Mission
Adversarially challenge and stress-test DAG acyclicity and disaster recovery invariants for Phase 5 Milestone 1 (Room.currentStayId decoupling, topological sort, backup models, restore rehearsal).

## 🔒 My Identity
- Archetype: EMPIRICAL CHALLENGER
- Roles: critic, specialist
- Working directory: c:\projects\pos\.agents\teamwork\p5_m1_challenger_2
- Original parent: 35cca4ca-b4fa-46c8-b9ea-1c5b07e1cb84
- Milestone: Phase 5 Milestone 1 (p5_m1)
- Instance: 2 of 2

## 🔒 Key Constraints
- Review-only — do NOT modify production implementation code
- Run tests and empirical verification directly; do NOT rely on assertions without test runs
- All metadata goes to .agents/teamwork/p5_m1_challenger_2/
- All test code must go to designated project directories (e.g. tests/)

## Current Parent
- Conversation ID: 35cca4ca-b4fa-46c8-b9ea-1c5b07e1cb84
- Updated: not yet

## Review Scope
- **Files to review**:
  - `prisma/schema.prisma`
  - `src/lib/backup-format.ts` (or relevant backup file)
  - `scripts/restro-restore-env.mjs`
  - `tests/challenger-p5-m1-schema-acyclicity.test.ts`
- **Interface contracts**: `c:\projects\pos\PROJECT.md`, `c:\projects\pos\.agents\teamwork\ORIGINAL_REQUEST.md`
- **Review criteria**: DAG acyclicity, topologicalSort correctness & monotonic order across 74 models, cycle detection failure modes, disaster recovery rehearsal zero FK violation.

## Key Decisions Made
- [TBD]

## Artifact Index
- `c:\projects\pos\.agents\teamwork\p5_m1_challenger_2\DISPATCH.md` — Inbound dispatch instructions
- `c:\projects\pos\.agents\teamwork\p5_m1_challenger_2\progress.md` — Liveness heartbeat and status
- `c:\projects\pos\.agents\teamwork\p5_m1_challenger_2\handoff.md` — Final challenge report and verdict

## Attack Surface
- **Hypotheses tested**:
  - Hypothesis 1: Room.currentStayId is scalar only and has no hidden foreign key or @relation.
  - Hypothesis 2: topologicalSort in backup-format correctly orders all 74 backup models monotonically without cycle.
  - Hypothesis 3: topologicalSort detects cycles and throws/errors instead of hanging or returning partial/corrupt DAGs.
  - Hypothesis 4: `node scripts/restro-restore-env.mjs rehearse` succeeds without any foreign key or ordering violations on live DB.
- **Vulnerabilities found**: [TBD]
- **Untested angles**: [TBD]

## Loaded Skills
- None requested in dispatch.
