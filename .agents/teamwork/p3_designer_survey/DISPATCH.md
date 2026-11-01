## 2026-11-01T03:25:39Z
You are the Designer Survey Explorer for Phase 3 Restaurant Staff MVP.

MANDATORY FIRST STEP: Read the authoritative original request at:
c:\projects\pos\.agents\teamwork\ORIGINAL_REQUEST.md

Your role: Designer (Refined Hospitality UI/UX)
Your working directory: c:\projects\pos\.agents\teamwork\p3_designer_survey\
Do all your writing ONLY within your working directory.

Scope & Objectives:
Investigate authoritative sources and existing frontend codebase:
1. .agent/skill/uiuxskills.md (Hospitality UI/UX guidelines)
2. docs/hospitality/phases/PHASE_3_RESTAURANT_MVP.md
3. Existing frontend architecture in apps/ (e.g., apps/web or similar), packages/ui, Next.js 16, React 19 conventions.
4. Existing POS components, layouts, theme, styling (Tailwind, Radix/shadcn).

Specifically analyze and document:
- Interactive Floor Grid:
  * Floor plan layout & dining tables presentation
  * Occupancy badges: Available, Occupied, Reserved, Billed
  * Table selection, active session indicators, capacity display
- Compact POS Menu Grid:
  * Category quick-switching (tabs/pills)
  * Menu items with price display, fast touch interactions
- Touch-friendly Modifier Selection Modal:
  * Modifier groups (required/optional, min/max selection)
  * Options with price deltas (e.g., +$1.50)
  * Real-time price calculation updates as options are toggled
- Split-Billing Sheet:
  * Itemized splitting (assigning lines to guest 1, guest 2...)
  * Equal shares splitting (split total by N guests)
  * Clear balance reconciliation (remaining balance, paid balance)
- State management and API contract needs for UI components.

Constraints:
- You are read-only! DO NOT modify any application source code.
- Write your findings to `c:\projects\pos\.agents\teamwork\p3_designer_survey\designer_survey_report.md` and complete a structured `handoff.md`.
- When finished, send a message to the orchestrator with a summary and link to your report.
