## 2026-11-01T03:39:41Z
You are the Designer UI/UX Explorer for Phase 3: Restaurant Staff MVP (Dine-in, Tables, Menus & Orders).

Working Directory: c:\projects\pos\.agents\teamwork\designer_survey_2
Authoritative Original Request: c:\projects\pos\.agents\teamwork\ORIGINAL_REQUEST.md
Specification Documents:
- docs/hospitality/phases/PHASE_3_RESTAURANT_MVP.md
- .agent/skill/uiuxskills.md
Existing Codebase References:
- frontend/src/
- frontend/src/app/
- frontend/src/components/

Your Mission:
Survey and design the comprehensive hospitality staff POS UI/UX specifications for Phase 3 according to `.agent/skill/uiuxskills.md`:
1. Interactive Floor Grid:
   - Floor layout / table grid with visual occupancy badges (Available: green/neutral, Occupied: blue/indigo, Reserved: amber/yellow, Billed: purple).
   - Display seating capacity, elapsed time, current party size, active bill total.
   - Quick table actions: Open Session, View Order, Move Table, Merge Table, Close/Settle.
2. Compact Menu Item Grid:
   - Category / Section quick-switching (tabs or top pill bar) designed for rapid touch selection.
   - Menu items with clear typography, dietary/prep badges, and price indicators.
   - Fast item tap-to-add with instant feedback.
3. Touch-Friendly Modifier Selection Modal:
   - Modal/drawer triggered when selecting items with modifier groups (required vs optional, min/max selections).
   - Option buttons with explicit, instant price delta calculations (+/- Decimal, e.g., "+$1.50 Oat Milk", "$0.00 Regular").
   - Special instructions / line notes input field.
4. Split-Billing Sheet / Drawer:
   - Flexible split-billing UI:
     * Split by Item (moving individual order lines to separate guest bills / seat assignments).
     * Split by Equal Shares (divide total bill across N guests with penny-perfect reconciliation).
   - Real-time balance calculations showing allocated vs unallocated balances.
5. Invariant & Ergonomic Alignments:
   - Three-dimensional status visual cues (Acceptance, Fulfillment, Settlement).
   - Void / line rejection modal requiring mandatory staff reason selection or input.
   - Multi-round ordering visualization (Round 1 appetizers, Round 2 mains) showing line statuses clearly.

Execution Rules:
- You are read-only; DO NOT modify or create any source code or test files.
- Maintain progress in c:\projects\pos\.agents\teamwork\designer_survey_2\progress.md.
- Write your comprehensive UI/UX design specifications to c:\projects\pos\.agents\teamwork\designer_survey_2\designer_survey_report.md.
- Write your structured 5-component handoff to c:\projects\pos\.agents\teamwork\designer_survey_2\handoff.md.
- Notify the orchestrator upon completion via send_message.
