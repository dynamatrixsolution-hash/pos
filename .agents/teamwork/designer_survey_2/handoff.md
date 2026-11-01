# Phase 3 Designer Survey Handoff Report: Restaurant Staff MVP (Dine-in, Tables, Menus & Orders)

**Author:** Designer (UI/UX Explorer & Systems Architect)  
**Target:** Phase 3: Restaurant Staff MVP (Dine-in, Tables, Menus & Orders)  
**Authoritative References:**  
- `c:\projects\pos\.agents\teamwork\ORIGINAL_REQUEST.md`  
- `docs/hospitality/phases/PHASE_3_RESTAURANT_MVP.md`  
- `.agent/skill/uiuxskills.md` ("Refined Hospitality Ergonomics")  
- `.agent/skill/stack.md`  
- `frontend/src/app/globals.css`  
- `frontend/src/lib/currency.ts`  
- `frontend/src/lib/idempotent-request.ts`  
**Primary Specification Artifact:** `c:\projects\pos\.agents\teamwork\designer_survey_2\designer_survey_report.md`  

---

## 1. Observation

Direct inspections of the RestroInn repository, design token definitions, specification guidelines, and existing frontend code revealed the following facts:

### 1.1 Existing Design Tokens and Operational Badge Classes
- In `frontend/src/app/globals.css`:
  - Lines 7-27 define base theme tokens:
    * `--background: 38 41% 95%` (`#F7F3EC` Warm ivory)
    * `--foreground: 20 12% 14%` (`#292320` Espresso)
    * `--card: 38 100% 98%` (`#FFFCF7` Porcelain)
    * `--primary: 347 46% 29%` (`#6B2837` Deep burgundy)
    * `--secondary: 35 33% 90%` (`#EEE7DD` Warm stone)
    * `--border: 34 23% 80%` (`#D8CEC1` Sandstone)
    * `--accent: 36 50% 44%` (`#A77B38` Muted brass)
  - Lines 91-94 define operational status tokens:
    * `--color-status-ready: #28634B` (Forest)
    * `--color-status-pending: #946000` (Ochre)
    * `--color-status-cancelled: #B33432` (Red)
    * `--color-status-info: #315F85` (Slate Blue)
  - Lines 156-175 define operational status utility classes:
    * `.badge-status-ready`: bg `#EAF3EE`, color `#28634B`, border `#C3DED0`
    * `.badge-status-pending`: bg `#FDF5E7`, color `#946000`, border `#EDD7AD`
    * `.badge-status-cancelled`: bg `#FAEAEC`, color `#B33432`, border `#E9B6B7`
    * `.badge-status-info`: bg `#EDF4F9`, color `#315F85`, border `#B8D2E6`
- Table occupancy status tokens require strict color isolation per `.agent/skill/uiuxskills.md`:
  - `Available`: Forest `#28634B` (bg `#EAF3EE`, border `#C3DED0`)
  - `Occupied`: Slate Blue `#315F85` (bg `#EDF4F9`, border `#B8D2E6`)
  - `Reserved`: Ochre `#946000` (bg `#FDF5E7`, border `#EDD7AD`)
  - `Billed`: Plum/Purple `#6F3668` (bg `#F6EEF8`, border `#DCBFE1`)

### 1.2 Frontend Dependency Baseline & Framework Version
- In `frontend/package.json`:
  * `"next": "16.2.9"` (App Router)
  * `"react": "19.2.4"`, `"react-dom": "19.2.4"`
  * `"tailwindcss": "^4"` (v4 with `@theme`)
  * `"lucide-react": "^1.24.0"`
  * `"framer-motion": "^12.40.0"`
  * `"zod": "^4.4.3"`, `"react-hook-form": "^7.78.0"`
- In `frontend/src/lib/currency.ts`:
  * Scaled integer (cents/paisa) mathematics functions already exist: `toCents`, `fromCents`, `formatMoney`, `addMoney`, `subMoney`, and `mulMoney`.
  * Eliminates binary IEEE-754 floating-point drift in POS cart and split-billing calculations.

### 1.3 Absence of Dedicated Restaurant Staff MVP UI
- In `frontend/src/app/dashboard/pos/page.tsx`:
  * Currently contains a monolithic 3,449-line retail POS page with basic `posMode: "RETAIL" | "RESTAURANT" | "PHARMACY" | "WHOLESALE"` and simple text input `tableNumber: string`.
  * There is **no interactive floor grid**, **no table sessions**, **no multi-round order accumulation**, **no modifier group modal with price deltas**, **no split-billing drawer**, and **no 3D status visual cues**.
- In `docs/hospitality/IMPLEMENTATION_PLAN.md:36` & `IMPLEMENTATION_PLAN.md:179`:
  * *"No hospitality screens were added."*
  * *"Existing UI restaurant labels are not an MVP acceptance criterion."*
  * Confirms the requirement for a brand-new, purpose-built Restaurant Staff MVP frontend architecture under `frontend/src/components/hospitality/` and `frontend/src/app/dashboard/restaurant/`.

---

## 2. Logic Chain

1. **Step 1 — Ergonomic Budget & Brand Alignment**:
   - Per `.agent/skill/uiuxskills.md`, RestroInn interfaces must embody *"Refined Hospitality Ergonomics"*—high operational density, zero decorative confetti/gradients, 1px Sandstone borders (`#D8CEC1`), Warm Ivory canvas (`#F7F3EC`), and Deep Burgundy accents (`#6B2837`).
   - The POS screen must follow the 65% Catalog area / 35% Order Cart sidebar layout budget. Menu item card height is strictly capped at ~110px.

2. **Step 2 — Interactive Floor Grid Mechanics**:
   - Floor management requires instant visual scanning of table availability.
   - Tables display 4 distinct operational states: `Available` (Forest), `Occupied` (Slate Blue), `Reserved` (Ochre), and `Billed` (Plum).
   - Occupied tables display party size, elapsed turn timer (with warning highlights >75m and >90m), active bill total (`formatMoney`), assigned waiter, and quick table actions (`Open Session`, `View Order`, `Move Table`, `Merge Table`, `Close/Settle`).
   - Moving or merging tables transfers open sessions atomically via idempotent API commands without duplicating order lines.

3. **Step 3 — Fast Tap-to-Add & Modifier Modal Integration**:
   - Quick-service tap-to-add items (no modifiers) must increment cart immediately with zero lag or popups.
   - Items with modifier groups (cooking temperature, sides, toppings) trigger the Touch-Friendly Modifier Selection Modal.
   - The modal enforces `minSelections` and `maxSelections`, displays real-time price deltas (`+$1.50`, `-$0.50`, `+$0.00 Included`), supports one-tap preset instruction chips, and disables submission until all required groups are fulfilled.

4. **Step 4 — Penny-Perfect Split-Billing Reconciliation**:
   - The split-billing sheet supports both Split by Item (seat/guest assignments with fractional line sharing) and Split by Equal Shares (dividing total bill across N guests).
   - To guarantee zero monetary leakage, the equal-shares algorithm divides integer minor units (`toCents(totalBill) / N`) and distributes the remainder 1 paisa/cent at a time to the first $R$ guests, guaranteeing:
     $$\sum \text{Split Shares} = \text{Canonical Total Cents}$$
   - Real-time balance badges indicate `Balanced (100%)` vs `Unallocated` vs `Over-allocated`.

5. **Step 5 — Defensive Invariants (3D Status Separation & Mandatory Void Reason)**:
   - Three orthogonal lifecycles (Acceptance, Fulfillment, Settlement) operate independently. Crucially, marking an order `PAID` leaves kitchen lines unchanged in `PREPARING` or `READY`.
   - Voiding or rejecting an order line cannot be performed with a simple native `confirm()`. It requires the `VoidLineModal` with mandatory staff reason selection, optional spoilage/waste tracking, and an audit trail notice linking to `AuditEvent`.
   - Orders support multiple rounds (`Round 1`, `Round 2`...), where earlier submitted rounds remain frozen and immutable while new selections accumulate in the active draft round.

---

## 3. Caveats

1. **Kitchen Display System (KDS) & Printers Deferred**:
   - Per `docs/hospitality/phases/PHASE_3_RESTAURANT_MVP.md` and `docs/hospitality/IMPLEMENTATION_PLAN.md:151`, hardware printer spools, station routing, and kitchen display terminals are deferred to Phase 4. Phase 3 focuses strictly on the front-of-house staff POS, floor grid, sessions, and order rounds.
2. **Offline Local Storage Deferred**:
   - Per `IMPLEMENTATION_PLAN.md:157`, offline financial mutations require prior synchronization and conflict resolution hardening. Phase 3 operates with server-authoritative online validation using durable `Idempotency-Key` headers via `postCommerce`.
3. **No Direct Source Modification**:
   - In accordance with read-only explorer constraints, no source files in `frontend/src/` or `packages/db/` were altered during this survey. Complete, verified component blueprints are provided in `designer_survey_report.md` for immediate implementation by the Builder agent.

---

## 4. Conclusion

The Phase 3 Restaurant Staff MVP UI/UX specification is complete, robust, and fully aligned with RestroInn's design philosophy. All 5 core pillars have been thoroughly architected:
1. **Interactive Floor Grid**: Multi-floor switcher, occupancy badge color isolation (`Available`, `Occupied`, `Reserved`, `Billed`), live party/turn metrics, and quick action modals (`Open`, `View`, `Move`, `Merge`, `Settle`).
2. **Compact Menu Item Grid**: Category quick-switch pill bar, 65/35 screen budget, dietary badges, ~110px card height, and fast tap-to-add.
3. **Touch-Friendly Modifier Selection Modal**: Min/max group validation, explicit Decimal price deltas (`+Rs. 150.00`, `-Rs. 50.00`), preset instruction chips, and live line price calculation.
4. **Split-Billing Sheet / Drawer**: Dual-mode (By Item and By Equal Shares), real-time unallocated balance tracker, and penny-perfect minor-unit reconciliation.
5. **Invariant & Ergonomic Alignments**: Decoupled 3D status visual cues, mandatory staff reason void modal with audit logging, and multi-round order accumulation.

All specifications, interfaces, calculation algorithms, and component blueprints have been compiled in:
`c:\projects\pos\.agents\teamwork\designer_survey_2\designer_survey_report.md`.

---

## 5. Verification Method

To independently verify this specification and its downstream implementation:

1. **Inspect Specification Artifacts**:
   - Review `c:\projects\pos\.agents\teamwork\designer_survey_2\designer_survey_report.md` for complete TypeScript interfaces, mock state data, and JSX component implementations.
   - Cross-check against `.agent/skill/uiuxskills.md` to confirm strict compliance with color tokens, padding limits, font weights, and status badge classes.

2. **Verify Frontend Compatibility & Build Targets**:
   - Run typecheck:
     ```powershell
     npm.cmd run typecheck
     ```
   - Verify production frontend build:
     ```powershell
     node scripts/restro-env.mjs frontend-build
     ```
   - Run unit test suite:
     ```powershell
     npm.cmd test
     ```

3. **Runtime Ergonomic Validation**:
   - Mount `InteractiveFloorGrid` with mock tables across 4 occupancy states; verify that elapsed turn warnings trigger at >75m and >90m.
   - Mount `ModifierSelectionModal` with mandatory and optional groups; confirm that submit is blocked until minSelections is fulfilled, and that price deltas update dynamically via `frontend/src/lib/currency.ts`.
   - Test `calculateEqualSplits` with odd totals (e.g. Rs. 1,000 across 3 guests); confirm that sum of shares equals exactly 100,000 minor cents with zero floating-point remainder.
   - Mount `VoidLineModal`; confirm that voiding requires selecting a valid reason before submitting.
