# RestroInn Phase 3: Restaurant Staff MVP — UI/UX Design System & Architectural Specification

**Document Version:** 1.0.0  
**Target Milestone:** Phase 3: Restaurant Staff MVP (Dine-in, Tables, Menus & Orders)  
**Author:** Designer (UI/UX Explorer & Systems Architect)  
**Authoritative Standards:** `.agent/skill/uiuxskills.md` ("Refined Hospitality Ergonomics"), `.agent/skill/stack.md`, `docs/hospitality/phases/PHASE_3_RESTAURANT_MVP.md`, `docs/hospitality/IMPLEMENTATION_PLAN.md`  
**Output Path:** `c:\projects\pos\.agents\teamwork\designer_survey_2\designer_survey_report.md`  

---

## Executive Summary & Core Design Philosophy

RestroInn's front-of-house staff interface is built upon the philosophy of **"Refined Hospitality Ergonomics"**:
* **High-density operational clarity**: High-touch, fast-paced restaurant dining rooms demand rapid visual scanning, zero inner-scroll traps, zero decorative bloat, and instant tactile feedback under bright counter or dim dining room ambient lighting.
* **Warm, calm aesthetic**: Grounded in Warm Ivory (`#F7F3EC`), Porcelain surfaces (`#FFFCF7`), Sandstone dividers (`#D8CEC1`), Espresso typography (`#292320`), and Deep Burgundy (`#6B2837`) primary accents.
* **Strict Color Isolation for Operational Statuses**: Table occupancy, kitchen fulfillment, order acceptance, and bill settlement must never share ambiguous or overlapping color tokens.
* **Penny-Perfect Precision**: Every calculation across menus, modifier deltas, and split-billing uses minor-unit (cents/paisa) integer mathematics via `frontend/src/lib/currency.ts` to prevent IEEE-754 floating-point drift.
* **Next.js 16 & React 19 Alignment**: Strict App Router conventions, pure render lifecycles, and atomic optimistic client state paired with durable idempotency headers (`postCommerce`).

---

## 1. Palette & Design Token Mappings

All components must strictly adhere to the official CSS variables and tokens defined in `frontend/src/app/globals.css`:

### 1.1 Base Theme Tokens
| Role | Token / Name | Hex Code | Tailwind Class | Usage in Restaurant POS |
| :--- | :--- | :--- | :--- | :--- |
| **Primary** | Deep burgundy | `#6B2837` | `bg-primary`, `text-primary` | Primary action buttons ("Send Round", "Settle Bill", active tab pills). |
| **Primary Hover** | Wine burgundy | `#541E2A` | `hover:bg-[#541E2A]` | Button hover/active states. |
| **Canvas** | Warm ivory | `#F7F3EC` | `bg-background` | Base application canvas across floor grid and POS views. |
| **Surface** | Porcelain | `#FFFCF7` | `bg-card` | Table cards, menu item cards, order carts, modal panels. |
| **Secondary** | Warm stone | `#EEE7DD` | `bg-secondary` | Inactive tab pills, table card headers, divider bars. |
| **Text Primary** | Espresso | `#292320` | `text-foreground` | Table titles, item names, tabular numbers, modal titles. |
| **Text Muted** | Warm gray | `#71675E` | `text-muted-foreground` | Capacity labels, elapsed timers, modifier subtitles. |
| **Borders** | Sandstone | `#D8CEC1` | `border-border` | Crisp 1px card and cell borders. |
| **Accent** | Muted brass | `#A77B38` | `text-accent`, `border-accent` | Active table edge indicator, special dietary badges, gold accents. |

### 1.2 Table Occupancy Status Tokens (Strict Color Isolation)
Table occupancy states convey immediate table availability to hosts, captains, and waitstaff:

| Occupancy Status | Token Name | Text Hex | Badge Bg Hex | Border Hex | Visual Icon | Semantic Meaning |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Available** | Forest | `#28634B` | `#EAF3EE` | `#C3DED0` | `CheckCircle2` | Table clean and vacant; ready to seat guests. |
| **Occupied** | Slate Blue | `#315F85` | `#EDF4F9` | `#B8D2E6` | `Users` | Dining session active; orders in progress. |
| **Reserved** | Ochre | `#946000` | `#FDF5E7` | `#EDD7AD` | `Clock` | Table booked for upcoming arrival; locked. |
| **Billed** | Plum / Purple | `#6F3668` | `#F6EEF8` | `#DCBFE1` | `Receipt` | Guest check printed / presented; awaiting payment. |

### 1.3 Three-Dimensional Status Lifecycles Tokens
Order lines and sessions have 3 orthogonal dimensions that must never be conflated:

| Dimension | State | Badge Token | Hex | Badge Classes | Meaning |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Acceptance** | `PENDING` | Ochre | `#946000` | `bg-[#FDF5E7] text-[#946000] border-[#EDD7AD]` | Submitted by waiter/QR; awaiting kitchen/staff acceptance. |
| | `ACCEPTED` | Forest | `#28634B` | `bg-[#EAF3EE] text-[#28634B] border-[#C3DED0]` | Kitchen confirmed preparation queue. |
| | `REJECTED` | Red | `#B33432` | `bg-[#FAEAEC] text-[#B33432] border-[#E9B6B7]` | Rejected or voided with mandatory staff reason. |
| **Fulfillment** | `QUEUED` | Muted Stone | `#71675E` | `bg-[#EEE7DD] text-[#71675E] border-[#D8CEC1]` | Waiting in kitchen line. |
| | `PREPARING` | Ochre Pulse | `#946000` | `bg-[#FDF5E7] text-[#946000] border-[#EDD7AD]` | Currently on stove/grill/bar. |
| | `READY` | Forest Pulse| `#28634B` | `bg-[#EAF3EE] text-[#28634B] border-[#C3DED0]` | Plated; bell rang for runner pickup. |
| | `SERVED` | Forest Muted| `#28634B` | `bg-[#EAF3EE] text-[#28634B] border-[#C3DED0]` | Delivered to guest table. |
| | `CANCELLED` | Red | `#B33432` | `bg-[#FAEAEC] text-[#B33432] border-[#E9B6B7]` | Cancelled before/during prep. |
| **Settlement** | `UNPAID` | Ochre | `#946000` | `bg-[#FDF5E7] text-[#946000] border-[#EDD7AD]` | No payments applied. |
| | `PARTIAL` | Slate Blue | `#315F85` | `bg-[#EDF4F9] text-[#315F85] border-[#B8D2E6]` | Partial split or deposit collected. |
| | `PAID` | Forest | `#28634B` | `bg-[#EAF3EE] text-[#28634B] border-[#C3DED0]` | 100% reconciled and settled. |
| | `REFUNDED` | Red | `#B33432` | `bg-[#FAEAEC] text-[#B33432] border-[#E9B6B7]` | Reversal or refund issued. |

> **CRITICAL ARCHITECTURAL INVARIANT**:  
> Paying for an order (`Settlement: PAID`) **NEVER** transitions kitchen lines to `SERVED`. Kitchen fulfillment and cashier billing are strictly independent.

---

## 2. Interactive Floor Grid Specification

The Interactive Floor Grid is the dining room command center, allowing captains and hosts to oversee floor occupancy, open sessions, move parties, merge tables, and monitor table turn times.

### 2.1 Layout Architecture & Ergonomic Budget
* **Location**: Accessible under `/dashboard/restaurant/tables` and directly toggleable from the POS header (`Grid` vs `Cart` view switch).
* **Header Ribbon**:
  * **Floor Switcher Tabs**: Pinned horizontal pill track (`bg-secondary/70 p-1 rounded-xl flex gap-1.5`):
    * e.g., `Ground Floor (14)`, `Terrace Garden (8)`, `Rooftop Lounge (6)`, `Private Dining (4)`.
    * Active pill: `bg-primary text-primary-foreground font-bold shadow-xs`.
  * **Status Filter Tabs**: `All (32)`, `Available (18)`, `Occupied (10)`, `Reserved (2)`, `Billed (2)`.
  * **Floor Metrics Summary**:
    * Active Guests: `34 guests`
    * Occupancy Rate: `56%`
    * Active Running Balance: `formatMoney(totalOpenBills)`
    * Turn Warning Count: `2 tables > 90m`
* **Grid Density**:
  * Responsive auto-fill grid: `grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4`.
  * Table Card Dimensions: Standardized fixed aspect / min-height `min-h-[148px]` to prevent layout shifting.

### 2.2 Table Card UI Anatomy
Each table card is a rich tactile surface:
1. **Card Header**:
   * Table Identifier: `font-black text-sm sm:text-base text-foreground` (e.g. `T-04`, `P-02`, `Bar 1`).
   * Seating Capacity Badge: `inline-flex items-center gap-1 text-[11px] font-semibold text-muted-foreground bg-secondary/80 px-2 py-0.5 rounded-md` (e.g. `<Users className="h-3 w-3" /> 4`).
   * Occupancy Status Badge: Pill badge positioned top-right with status-specific dot indicator.
2. **Card Body (Operational Metrics)**:
   * **For Occupied & Billed Tables**:
     * Current Party Size: `<User className="h-3.5 w-3.5 text-muted-foreground" /> 3 guests`.
     * Elapsed Time: `<Clock className="h-3.5 w-3.5 text-muted-foreground" /> 42m` (changes to Ochre `#946000` text if elapsed time > 75m, Red `#B33432` if > 90m).
     * Running Bill Balance: `font-mono font-black text-sm text-foreground` (e.g., `Rs. 3,450.00`).
     * Assigned Waiter / Captain: `text-[11px] text-muted-foreground truncate` (e.g. `Server: Suman K.`).
     * Active Round Indicator: `text-[10px] font-bold text-primary` (e.g. `Round 2: Preparing`).
   * **For Available Tables**:
     * Friendly prompt: `Ready to seat guests`.
     * Clean state badge: `Clean · Inspected`.
   * **For Reserved Tables**:
     * Guest Name & Time: `Reservation 19:30 · Mr. Sharma (4p)`.
3. **Card Footer (Quick Actions Bar)**:
   * **For Available**: Full-width high-contrast button: `Open Session` (`bg-primary text-primary-foreground hover:bg-[#541E2A] text-xs font-bold py-1.5 rounded-lg`).
   * **For Occupied**: Two-button cluster:
     * `View Order` (`bg-primary text-primary-foreground text-xs font-bold px-2.5 py-1.5 rounded-lg flex-1`).
     * `•••` Quick Actions Menu (`Move Table`, `Merge Table`, `Transfer Waiter`, `Print Bill`, `Close Session`).
   * **For Billed**: High-contrast Plum/Burgundy button: `Settle Bill` (`bg-[#6F3668] text-white hover:bg-[#562851] text-xs font-bold py-1.5 rounded-lg flex-1`).

### 2.3 Modal Workflows for Floor Management

#### 1. Open Session Modal
* **Trigger**: Tapping `Open Session` on an Available table.
* **Fields**:
  * Party Size Numeric Stepper: Large touch-friendly `[-] [ 2 ] [+]` with preset chips: `[1] [2] [4] [6] [8] [10+]`. Warns if party size exceeds table capacity.
  * Waiter / Server Selector: Quick grid of active staff on shift with avatar/initials.
  * Guest Information (Optional): Name and phone number for registered customer or walk-in loyalty lookup.
  * Dining Notes: Quick tags (`Anniversary`, `Birthday`, `VIP`, `Window Seat`).
* **Submission**: Creates `TableSession` with status `ACTIVE`, transitions table to `OCCUPIED`, and redirects seamlessly to the POS Menu Grid for Round 1 ordering.

#### 2. Move Table Modal (Atomic Session Transfer)
* **Trigger**: Tapping `Move Table` from table action menu.
* **Ergonomics**:
  * Displays source table summary: `From: Table T-04 (Party of 3 · Rs. 2,450.00)`.
  * Grid of Available destination tables filtered by capacity:
    * Tables with sufficient capacity highlighted in Forest border.
    * Incompatible tables (already occupied or capacity < party size) disabled with explicit capacity warning badge.
  * Transfer Reason selector: `Guest Requested Different Seating`, `Air Conditioning / Draft`, `Table Combining`, `Spill / Cleaning Needed`.
* **Execution**: Sends idempotent `POST /api/v1/restaurant/tables/move` payload:
  ```json
  {
    "sourceTableId": "tbl_04",
    "targetTableId": "tbl_09",
    "reason": "Guest Requested Outdoor Seating"
  }
  ```
  Backend transfers open `TableSession` atomically to target table, sets `tbl_04.status = AVAILABLE`, sets `tbl_09.status = OCCUPIED`, and logs an `AuditEvent`. Line items and rounds are 100% preserved without duplication.

#### 3. Merge Table Modal (Multi-Table Consolidation)
* **Trigger**: Tapping `Merge Table` from table action menu.
* **Ergonomics**:
  * Step 1: Select Secondary Table to merge into Primary Table `T-04`.
  * Step 2: Reconciliation Preview:
    * If secondary table has an active session, displays line item aggregation preview:
      * `T-04 Orders: 4 items (Rs. 1,800.00)`
      * `T-05 Orders: 3 items (Rs. 1,200.00)`
      * `Combined Bill: 7 items (Rs. 3,000.00)`
    * Highlights that all rounds from both sessions will be consolidated into primary session with original submission timestamps intact.
  * Step 3: Confirmation: Burgundy confirmation button `Confirm Merge Tables`.
* **Execution**: Sends idempotent `POST /api/v1/restaurant/tables/merge`. Primary session absorbs secondary orders; secondary session is marked `MERGED_CLOSED`; secondary table status updates to `OCCUPIED (Merged with T-04)`.

---

## 3. Compact Menu Item Grid Specification

In high-volume restaurant service, waitstaff must add items rapidly without navigating deep nested trees or waiting for layout reflows.

### 3.1 POS Layout Budget & Grid Anatomy
* **Split Layout Budget**:
  * **Left / Center Catalog Area (65-70% width)**:
    1. Top Section: Floor/Table indicator bar with active table pill, server badge, and search bar.
    2. Category / Section Quick-Switch Pill Bar: Pinned horizontal scroll track.
    3. Sub-Category / Dietary Filter Bar (optional quick filters: `All`, `Veg Only`, `Beverages`, `Chef Specials`).
    4. Compact Product Grid.
  * **Right Order Cart Sidebar (30-35% width)**:
    1. Sticky header: Table #, Session #, Active Round indicator.
    2. Multi-round line items list.
    3. Sticky billing totals & primary round dispatch button.

### 3.2 Category & Section Quick-Switching Bar
* Pinned at the top of the menu catalog area.
* Designed for rapid touch gestures:
  * Minimum tap target height: `44px` (`py-2.5 px-4`).
  * Horizontal scroll container with hidden scrollbar (`scrollbar-hide overflow-x-auto flex gap-2 whitespace-nowrap`).
  * Visual States:
    * **Active Category**: `bg-primary text-primary-foreground font-black text-xs uppercase tracking-wider rounded-xl shadow-xs border border-primary`.
    * **Inactive Category**: `bg-secondary/70 hover:bg-[#E5DDCF] text-foreground font-semibold text-xs uppercase tracking-wider rounded-xl border border-border transition-colors`.
    * Category item count badge: e.g. `Appetizers (14)`.

### 3.3 Menu Item Card Design Specification
* **Dimensions & Density**:
  * Strict height limit: `min-h-[100px] max-h-[115px]`.
  * Multi-column responsive grid: `grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-4 gap-2.5 sm:gap-3`.
* **Card Interior Structure**:
  * **Header Row**:
    * Dietary indicator dot:
      * `VEG`: `h-2 w-2 rounded-full bg-[#28634B]` inside green ring.
      * `NON-VEG`: `h-2 w-2 rounded-full bg-[#B33432]` inside red ring.
    * Spicy level: e.g. `<Flame className="h-3 w-3 text-amber-600" />`.
    * Modifier Indicator: If item has modifier groups, display Muted Brass pill: `<SlidersHorizontal className="h-2.5 w-2.5 text-[#A77B38]" /> Modifiers`.
  * **Title**: `font-bold text-xs sm:text-sm text-foreground line-clamp-2 leading-tight tracking-tight` (e.g. `Crispy Duck Bao Buns`, `Himalayan Truffle Momo`).
  * **Footer Row**:
    * Price: `font-mono font-black text-xs sm:text-sm text-primary` (e.g. `Rs. 450.00`).
    * Prep Time / Calories (if available): `text-[10px] text-muted-foreground` (e.g. `12 min`).
    * Tap feedback ripple: On touch tap, card triggers a 120ms micro-flash ring (`ring-2 ring-primary/40`).

### 3.4 Fast Item Tap-to-Add Mechanics
* **Items Without Modifiers**:
  * Single tap immediately dispatches `addItemToCurrentRound(item)`.
  * Visual feedback: Instant soundless checkmark micro-animation or badge count bump in the cart sidebar.
* **Items With Modifier Groups**:
  * Single tap intercepts add action and immediately opens the **Touch-Friendly Modifier Selection Modal**.
  * The modal autofocuses on the first required modifier group.

---

## 4. Touch-Friendly Modifier Selection Modal Specification

The Modifier Selection Modal manages portion sizes, cooking temperatures, sauces, toppings, and dietary instructions with instant price delta transparency.

### 4.1 Modal Architecture & Ergonomics
* **Container**: Centered dialog modal (`max-w-xl w-full`) on desktop/tablet, or high-density bottom-sheet drawer on mobile POS terminals.
* **Header Area**:
  * Title: Item Name (`font-black text-base sm:text-lg text-foreground`).
  * Base Price: `text-xs text-muted-foreground` (e.g. `Base Price: Rs. 650.00`).
  * Running Configured Price: Pinned top-right: `font-mono font-black text-base text-primary` (dynamically recalculates with every modifier toggle).
  * Close button: `<X className="h-5 w-5 text-muted-foreground hover:text-foreground" />`.

### 4.2 Modifier Groups & Selection Rules
Modifier groups model real culinary rules with strict validation:

```ts
interface ModifierOption {
  id: string;
  name: string;
  priceDelta: string; // Decimal string e.g. "150.00", "-50.00", "0.00"
  isDefault?: boolean;
}

interface ModifierGroup {
  id: string;
  name: string;
  description?: string;
  minSelections: number; // e.g. 1 for mandatory single-choice
  maxSelections: number; // e.g. 1 for radio, 4 for multi-toppings
  isRequired: boolean;
  options: ModifierOption[];
}
```

#### Group Header Status Badges:
* **Required Group (Unsatisfied)**: `<span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#FDF5E7] text-[#946000] border border-[#EDD7AD]">Required · Select {min}</span>`.
* **Required Group (Satisfied)**: `<span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#EAF3EE] text-[#28634B] border border-[#C3DED0]">✓ Satisfied</span>`.
* **Optional Group**: `<span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-secondary text-muted-foreground border border-border">Optional · Max {max}</span>`.
* **Selection Counter**: Displays real-time selection tally: e.g. `(2 of 3 selected)`.

### 4.3 Option Button Touch Ergonomics & Price Delta Calculations
* **Touch Target**: Minimum height `48px` (`p-3 rounded-xl border flex items-center justify-between cursor-pointer`).
* **Visual States**:
  * **Unselected**: `bg-card border-border hover:bg-secondary/40 text-foreground transition-colors`.
  * **Selected**: `bg-primary/5 border-primary text-primary font-bold ring-2 ring-primary/20 shadow-xs`.
  * **Disabled (Max selections reached)**: `opacity-40 cursor-not-allowed bg-secondary/30`.
* **Explicit Decimal Price Delta Presentation**:
  * **Zero Delta**: `<span className="text-xs font-semibold text-muted-foreground">Included (+Rs. 0.00)</span>`.
  * **Positive Delta**: `<span className="font-mono font-black text-xs text-primary">+Rs. 150.00</span>`.
  * **Negative Delta**: `<span className="font-mono font-black text-xs text-[#28634B]">-Rs. 50.00</span>`.

### 4.4 Special Instructions / Line Notes Field
* High-frequency kitchen tags accessible via one-tap pills:
  * Preset chips: `No Onion/Garlic`, `Extra Spicy`, `Mild / No Chili`, `Allergy: Peanuts`, `Sauce on Side`, `Gluten-Free Prep`, `Separate Box`.
  * Tapping a preset chip appends or toggles it in the notes field.
* Free-Text Input: Multi-line textarea (`min-h-[56px] text-xs p-2.5 rounded-xl border border-border bg-background focus:ring-2 focus:ring-primary/20`) for custom guest specifications.

### 4.5 Sticky Footer & Action Validation
* Pinned to bottom of the modal:
  * **Quantity Stepper**: `[-] [ 1 ] [+]` with tactile 36px square buttons.
  * **Total Configured Line Price**: `font-mono font-black text-base text-foreground` (`formatMoney(totalLinePrice)`).
  * **Primary Submit Button**:
    * If required groups are missing: Button is disabled with helper label: `Select Cooking Temperature to proceed`.
    * When valid: Burgundy button: `Add to Current Round · {formatMoney(totalLinePrice)}` (`bg-primary hover:bg-[#541E2A] text-primary-foreground font-black text-xs uppercase tracking-wider py-3 px-6 rounded-xl shadow-sm`).

---

## 5. Split-Billing Sheet / Drawer Specification

Restaurant groups frequently request split checks at the end of a meal. RestroInn provides a flexible, dual-mode split-billing sheet with penny-perfect reconciliation.

### 5.1 Drawer Architecture & Reconciliation Invariants
* **Trigger**: Tapping `Split Bill` in the POS cart header or settlement screen.
* **Layout**: Slide-over sheet from the right (`w-full max-w-4xl`) with porcelain background and pinned header/footer.
* **The Balancing Invariant**:
  $$\text{Total Session Bill} = \sum_{k=1}^{N} \text{Split Bill}_k$$
  $$\text{Unallocated Balance} = \text{Total Session Bill} - \text{Allocated Balance}$$
* **Header Balance Indicator**:
  * **Fully Balanced**:
    ```tsx
    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-[#EAF3EE] text-[#28634B] border border-[#C3DED0]">
      <CheckCircle2 className="h-3.5 w-3.5" />
      Balanced · 100% Reconciled
    </div>
    ```
  * **Unallocated Remaining**:
    ```tsx
    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-[#FDF5E7] text-[#946000] border border-[#EDD7AD]">
      <AlertCircle className="h-3.5 w-3.5" />
      Unallocated: {formatMoney(unallocatedCents)}
    </div>
    ```
  * **Over-Allocated Error**:
    ```tsx
    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-[#FAEAEC] text-[#B33432] border border-[#E9B6B7]">
      <AlertTriangle className="h-3.5 w-3.5" />
      Over-allocated by {formatMoney(Math.abs(unallocatedCents))}
    </div>
    ```

### 5.2 Mode A: Split by Item (Seat / Guest Assignment)
* **Workflow**:
  1. Displays pool of unassigned order lines on the left column (or top container).
  2. Displays guest bill columns on the right: `Bill 1 (Guest 1)`, `Bill 2 (Guest 2)` + `+ Add Guest Bill` button.
  3. One-Tap Item Movement:
     * Each order line has a quick target selector button: `[-> Bill 1]`, `[-> Bill 2]`, `[-> Bill 3]`.
     * Tapping moves the item line immediately into that guest's bill container.
  4. Fractional Line Sharing:
     * For shared appetizers or wine bottles (e.g. 1x Truffle Pizza @ Rs. 1,200 shared by Guest 1 & Guest 2):
     * Staff taps `Split Line` on the item, chooses number of sharing guests (e.g. 2).
     * The line divides into 2 fractional lines: `1/2 Truffle Pizza @ Rs. 600.00` assigned to Bill 1 and Bill 2.
  5. Independent Settlement:
     * Each Guest Bill container displays its own subtotal, VAT, and Total.
     * Cashier can settle Bill 1 with Card immediately (`Settle Bill 1`), printing an individual guest receipt, while Bill 2 remains open or settles separately with Cash.

### 5.3 Mode B: Split by Equal Shares (N Guests) with Penny-Perfect Reconciliation
When guests request "split the bill 3 ways equally":
* **Stepper Selector**: `Divide equally among: [-] [ 3 ] [+] guests` (quick preset chips: `2`, `3`, `4`, `5`, `6`).
* **Penny-Perfect Minor-Unit Algorithm**:
  ```ts
  function calculateEqualSplits(totalCents: number, guestCount: number): number[] {
    const baseShareCents = Math.floor(totalCents / guestCount);
    const remainderCents = totalCents % guestCount;
    
    // Distribute remainder 1 cent at a time to the first remainderCents guests
    const splits: number[] = [];
    for (let i = 0; i < guestCount; i++) {
      splits.push(baseShareCents + (i < remainderCents ? 1 : 0));
    }
    return splits;
  }
  ```
* **Visual Clarity**:
  * e.g., Total Bill = Rs. 1,000.00 split among 3 guests:
    * `Share 1`: `Rs. 333.34` (`* includes 1 paisa rounding balancing`)
    * `Share 2`: `Rs. 333.33`
    * `Share 3`: `Rs. 333.33`
    * Total sum: `333.34 + 333.33 + 333.33 = Rs. 1,000.00 exact! (0.00 drift)`.
* **Print Individual Checks**:
  * Quick button: `Print All 3 Checks` spools 3 consecutive 80mm thermal guest checks, each labeled `Check 1 of 3 (Equal Share)`.

---

## 6. Invariant & Ergonomic Alignments

RestroInn enforces strict hospitality business invariants through defensive UI controls.

### 6.1 Three-Dimensional Status Separation in the POS Cart
* In the Order Cart sidebar and table summary:
  * **Order Header**: Displays the composite status bar:
    * `Acceptance: ACCEPTED` (Forest)
    * `Fulfillment: 3 of 5 Items Served` (Ochre / Forest progress bar)
    * `Settlement: UNPAID` (Ochre)
  * **Payment Execution Decoupling**:
    * When cashier processes payment in the settlement drawer, the UI updates `Settlement` to `PAID`.
    * The kitchen lines remain in their exact current fulfillment state (`QUEUED`, `PREPARING`, or `READY`).
    * A prominent banner confirms: `Payment Settled · Kitchen ticket remains active until marked Served`.

### 6.2 Mandatory Staff Reason Void / Line Rejection Modal
* When waitstaff or cashier taps `Void` or `Reject` on an active order line:
* The action cannot complete without capturing an audited reason.
* **Modal Structure**:
  1. **Line Item Summary**: Item title, quantity, price, and current round.
  2. **Mandatory Reason Selector**:
     * Grid of high-touch preset buttons:
       * `Customer Changed Mind`
       * `Kitchen 86'd (Out of Stock)`
       * `Wrong Item Punched`
       * `Food Quality / Defect`
       * `Customer Left / Walkout`
       * `Order Delayed / Dissatisfied`
       * `Other (Custom Reason)`
  3. **Staff Notes Textarea**: Required if `Other` is selected.
  4. **Waste vs Restock Flag**:
     * If food was already being prepared, staff indicates whether line is `Wasted (Kitchen Spoilage)` or `Restocked (Unopened / Unprepared)`.
  5. **Audit Trail Notice**:
     * Displays warning: `This action will be permanently recorded in the Audit Ledger under staff: Suman K.`.
  6. **Destructive Action Button**:
     * `Void Line & Record Audit` (`bg-[#B33432] hover:bg-[#992826] text-white font-black py-2.5 rounded-xl`).

### 6.3 Multi-Round Ordering Visualization
Dining parties order in waves (e.g. Round 1: Aperitifs & Starters, Round 2: Mains & Steaks, Round 3: Desserts & Digestifs).

#### Cart Sidebar Architecture:
* **Round Grouping Accordion**:
  * **Round 1 (Submitted 19:15 · 3 Items · SERVED)**:
    * Collapsible card with subtle Sandstone border.
    * Contains immutable lines with struck/dimmed status badges and green checkmarks.
    * Line items from Round 1 cannot be deleted directly; only voided via the audited Void Modal.
  * **Round 2 (Submitted 19:40 · 2 Items · PREPARING)**:
    * Displays active preparation timer badge (`Prep: 14m`).
  * **Round 3 (Draft / Unsubmitted · 2 Items)**:
    * Highlighted with Burgundy active border (`border-primary/40 bg-card`).
    * Newly tapped items from the menu grid append into this draft round.
    * Items can be freely edited, quantity-stepped, or removed before submission.
* **Round Submission Action Button**:
  * Pinned at the bottom of the cart:
  * Burgundy high-contrast button: `Send Round 3 to Kitchen (2 Items)` (`py-3.5 text-sm font-black uppercase tracking-wider rounded-xl bg-primary text-primary-foreground shadow-md`).
  * On submit:
    * Sends idempotent `POST /api/v1/restaurant/orders/[id]/rounds`.
    * Round 3 freezes immutably into `Submitted`.
    * Ready for Round 4 whenever needed!

---

## 7. Concrete TypeScript Interfaces & Component Contracts

To ensure the Builder agent can implement these components without ambiguity, here are the authoritative TypeScript interfaces:

### 7.1 Domain & State Interfaces

```ts
// types/hospitality.ts

export type TableOccupancyStatus = "AVAILABLE" | "OCCUPIED" | "RESERVED" | "BILLED";
export type AcceptanceStatus = "PENDING" | "ACCEPTED" | "REJECTED";
export type FulfillmentStatus = "QUEUED" | "PREPARING" | "READY" | "SERVED" | "CANCELLED";
export type SettlementStatus = "UNPAID" | "PARTIAL" | "PAID" | "REFUNDED";

export interface DiningTable {
  id: string;
  floorId: string;
  tableNumber: string;
  capacity: number;
  status: TableOccupancyStatus;
  currentSessionId?: string | null;
  activePartySize?: number | null;
  activeBillTotal?: string; // Decimal string e.g. "3450.00"
  elapsedMinutes?: number | null;
  serverName?: string | null;
  lastRoundStatus?: string | null;
}

export interface FloorArea {
  id: string;
  name: string;
  tableCount: number;
  tables: DiningTable[];
}

export interface MenuItemModifierOption {
  id: string;
  name: string;
  priceDelta: string; // "+150.00", "-50.00", "0.00"
  isDefault?: boolean;
}

export interface MenuItemModifierGroup {
  id: string;
  name: string;
  description?: string;
  minSelections: number;
  maxSelections: number;
  isRequired: boolean;
  options: MenuItemModifierOption[];
}

export interface RestaurantMenuItem {
  id: string;
  name: string;
  description?: string;
  categoryId: string;
  basePrice: string; // Decimal string e.g. "450.00"
  dietaryType: "VEG" | "NON_VEG" | "VEGAN";
  isSpicy?: boolean;
  prepMinutes?: number;
  isAvailable: boolean;
  modifierGroups: MenuItemModifierGroup[];
}

export interface AppliedModifier {
  groupId: string;
  groupName: string;
  optionId: string;
  optionName: string;
  priceDelta: string;
}

export interface RestaurantOrderLine {
  id: string;
  menuItemId: string;
  itemName: string;
  basePrice: string;
  quantity: number;
  appliedModifiers: AppliedModifier[];
  lineNotes?: string;
  lineTotal: string; // Decimal string
  acceptanceStatus: AcceptanceStatus;
  fulfillmentStatus: FulfillmentStatus;
  settlementStatus: SettlementStatus;
  voidReason?: string;
}

export interface RestaurantOrderRound {
  id: string;
  roundNumber: number;
  submittedAt?: string | null;
  status: "DRAFT" | "SUBMITTED" | "COMPLETED";
  lines: RestaurantOrderLine[];
}

export interface ActiveRestaurantSession {
  id: string;
  tableId: string;
  tableNumber: string;
  partySize: number;
  serverName: string;
  openedAt: string;
  rounds: RestaurantOrderRound[];
  totalBill: string;
  acceptanceStatus: AcceptanceStatus;
  settlementStatus: SettlementStatus;
}
```

---

## 8. Frontend Component Code Blueprints

Below are complete, production-grade component blueprints written in Next.js 16 (App Router), React 19, and Tailwind v4.

### 8.1 Component 1: `InteractiveFloorGrid.tsx`

```tsx
"use client";

import * as React from "react";
import { Users, Clock, Receipt, CheckCircle2, MoreVertical, ArrowRightLeft, Merge, PlusCircle } from "lucide-react";
import { formatMoney } from "@/lib/currency";
import { DiningTable, FloorArea, TableOccupancyStatus } from "@/types/hospitality";

interface InteractiveFloorGridProps {
  floors: FloorArea[];
  activeFloorId: string;
  onSelectFloor: (floorId: string) => void;
  onOpenSession: (table: DiningTable) => void;
  onViewOrder: (table: DiningTable) => void;
  onMoveTable: (table: DiningTable) => void;
  onMergeTable: (table: DiningTable) => void;
  onSettleBill: (table: DiningTable) => void;
}

const statusConfig: Record<TableOccupancyStatus, { label: string; badgeClass: string; dotClass: string }> = {
  AVAILABLE: {
    label: "Available",
    badgeClass: "bg-[#EAF3EE] text-[#28634B] border-[#C3DED0]",
    dotClass: "bg-[#28634B]",
  },
  OCCUPIED: {
    label: "Occupied",
    badgeClass: "bg-[#EDF4F9] text-[#315F85] border-[#B8D2E6]",
    dotClass: "bg-[#315F85]",
  },
  RESERVED: {
    label: "Reserved",
    badgeClass: "bg-[#FDF5E7] text-[#946000] border-[#EDD7AD]",
    dotClass: "bg-[#946000]",
  },
  BILLED: {
    label: "Billed",
    badgeClass: "bg-[#F6EEF8] text-[#6F3668] border-[#DCBFE1]",
    dotClass: "bg-[#6F3668]",
  },
};

export function InteractiveFloorGrid({
  floors,
  activeFloorId,
  onSelectFloor,
  onOpenSession,
  onViewOrder,
  onMoveTable,
  onMergeTable,
  onSettleBill,
}: InteractiveFloorGridProps) {
  const [selectedFilter, setSelectedFilter] = React.useState<"ALL" | TableOccupancyStatus>("ALL");
  const activeFloor = floors.find((f) => f.id === activeFloorId) || floors[0];

  const filteredTables = React.useMemo(() => {
    if (!activeFloor) return [];
    if (selectedFilter === "ALL") return activeFloor.tables;
    return activeFloor.tables.filter((t) => t.status === selectedFilter);
  }, [activeFloor, selectedFilter]);

  return (
    <div className="space-y-4">
      {/* Floor & Status Filter Tabs Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-card p-3 rounded-2xl border border-border">
        {/* Floor Selection Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide max-w-full">
          {floors.map((floor) => {
            const isActive = floor.id === activeFloor?.id;
            return (
              <button
                key={floor.id}
                onClick={() => onSelectFloor(floor.id)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer whitespace-nowrap ${
                  isActive
                    ? "bg-primary text-primary-foreground shadow-xs"
                    : "bg-secondary/70 hover:bg-[#E5DDCF] text-foreground border border-border"
                }`}
              >
                {floor.name} ({floor.tableCount})
              </button>
            );
          })}
        </div>

        {/* Occupancy Status Filters */}
        <div className="flex items-center gap-1 overflow-x-auto scrollbar-hide">
          {(["ALL", "AVAILABLE", "OCCUPIED", "RESERVED", "BILLED"] as const).map((filter) => {
            const isActive = selectedFilter === filter;
            return (
              <button
                key={filter}
                onClick={() => setSelectedFilter(filter)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-colors cursor-pointer ${
                  isActive
                    ? "bg-foreground text-background"
                    : "text-muted-foreground hover:bg-secondary/50"
                }`}
              >
                {filter === "ALL" ? "All" : statusConfig[filter].label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tables Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
        {filteredTables.map((table) => {
          const config = statusConfig[table.status];
          const isWarningElapsed = (table.elapsedMinutes || 0) > 75;

          return (
            <div
              key={table.id}
              className="bg-card border border-border hover:border-primary/40 rounded-2xl p-3.5 shadow-xs flex flex-col justify-between transition-all group"
            >
              {/* Card Top: Identifier + Status */}
              <div className="flex items-center justify-between pb-2 border-b border-border/60">
                <div className="flex items-center gap-1.5">
                  <span className="font-black text-sm text-foreground">{table.tableNumber}</span>
                  <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-muted-foreground bg-secondary px-1.5 py-0.5 rounded">
                    <Users className="h-2.5 w-2.5" />
                    {table.capacity}
                  </span>
                </div>
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${config.badgeClass}`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${config.dotClass}`} />
                  {config.label}
                </span>
              </div>

              {/* Card Middle: Active Operational Information */}
              <div className="py-2.5 space-y-1">
                {table.status === "OCCUPIED" || table.status === "BILLED" ? (
                  <>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground font-semibold flex items-center gap-1">
                        <Users className="h-3 w-3" /> {table.activePartySize || 2}p
                      </span>
                      <span
                        className={`font-semibold flex items-center gap-1 text-[11px] ${
                          isWarningElapsed ? "text-[#946000] font-bold animate-pulse" : "text-muted-foreground"
                        }`}
                      >
                        <Clock className="h-3 w-3" /> {table.elapsedMinutes}m
                      </span>
                    </div>
                    <div className="flex items-center justify-between pt-1">
                      <span className="text-[10px] text-muted-foreground truncate">{table.serverName || "Staff"}</span>
                      <span className="font-mono font-black text-xs text-foreground">
                        {formatMoney(table.activeBillTotal || "0.00")}
                      </span>
                    </div>
                  </>
                ) : table.status === "RESERVED" ? (
                  <div className="text-xs text-muted-foreground py-1">
                    <p className="font-bold text-[#946000]">19:30 Reserved</p>
                    <p className="text-[10px]">Party of {table.capacity}</p>
                  </div>
                ) : (
                  <div className="text-xs text-muted-foreground py-1 flex items-center gap-1 text-[#28634B]">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    <span className="text-[11px] font-bold">Ready to seat</span>
                  </div>
                )}
              </div>

              {/* Card Bottom: Quick Actions */}
              <div className="pt-2 border-t border-border/60">
                {table.status === "AVAILABLE" ? (
                  <button
                    onClick={() => onOpenSession(table)}
                    className="w-full py-1.5 bg-primary hover:bg-[#541E2A] text-primary-foreground font-bold text-xs uppercase tracking-wider rounded-xl transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <PlusCircle className="h-3.5 w-3.5" />
                    Open
                  </button>
                ) : table.status === "BILLED" ? (
                  <button
                    onClick={() => onSettleBill(table)}
                    className="w-full py-1.5 bg-[#6F3668] hover:bg-[#562851] text-white font-bold text-xs uppercase tracking-wider rounded-xl transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <Receipt className="h-3.5 w-3.5" />
                    Settle
                  </button>
                ) : (
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => onViewOrder(table)}
                      className="flex-1 py-1.5 bg-primary hover:bg-[#541E2A] text-primary-foreground font-bold text-xs rounded-xl transition-colors cursor-pointer text-center"
                    >
                      View Order
                    </button>
                    <button
                      onClick={() => onMoveTable(table)}
                      title="Move Table"
                      className="p-1.5 bg-secondary hover:bg-[#E5DDCF] text-foreground rounded-xl border border-border cursor-pointer transition-colors"
                    >
                      <ArrowRightLeft className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => onMergeTable(table)}
                      title="Merge Table"
                      className="p-1.5 bg-secondary hover:bg-[#E5DDCF] text-foreground rounded-xl border border-border cursor-pointer transition-colors"
                    >
                      <Merge className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

---

### 8.2 Component 2: `ModifierSelectionModal.tsx`

```tsx
"use client";

import * as React from "react";
import { X, Check, Plus, Minus, AlertCircle, Sparkles } from "lucide-react";
import { formatMoney, addMoney, mulMoney } from "@/lib/currency";
import { RestaurantMenuItem, MenuItemModifierGroup, MenuItemModifierOption, AppliedModifier } from "@/types/hospitality";

interface ModifierSelectionModalProps {
  isOpen: boolean;
  item: RestaurantMenuItem | null;
  onClose: () => void;
  onConfirm: (
    item: RestaurantMenuItem,
    appliedModifiers: AppliedModifier[],
    quantity: number,
    notes: string,
    calculatedTotal: string
  ) => void;
}

const PRESET_INSTRUCTIONS = [
  "No Onion/Garlic",
  "Extra Spicy",
  "Mild / No Chili",
  "Allergy: Peanuts",
  "Sauce on Side",
  "Gluten-Free Prep",
];

export function ModifierSelectionModal({ isOpen, item, onClose, onConfirm }: ModifierSelectionModalProps) {
  if (!isOpen || !item) return null;

  const [quantity, setQuantity] = React.useState(1);
  const [selectedOptions, setSelectedOptions] = React.useState<Record<string, MenuItemModifierOption[]>>({});
  const [notes, setNotes] = React.useState("");

  // Initialize defaults
  React.useEffect(() => {
    const defaults: Record<string, MenuItemModifierOption[]> = {};
    item.modifierGroups.forEach((group) => {
      const defaultOpts = group.options.filter((o) => o.isDefault);
      if (defaultOpts.length > 0) {
        defaults[group.id] = defaultOpts;
      } else if (group.isRequired && group.minSelections === 1 && group.options.length > 0) {
        defaults[group.id] = [group.options[0]];
      }
    });
    setSelectedOptions(defaults);
    setQuantity(1);
    setNotes("");
  }, [item]);

  // Toggle modifier option
  const toggleOption = (group: MenuItemModifierGroup, option: MenuItemModifierOption) => {
    setSelectedOptions((prev) => {
      const current = prev[group.id] || [];
      const isAlreadySelected = current.some((o) => o.id === option.id);

      if (group.maxSelections === 1) {
        // Single-select radio behavior
        return { ...prev, [group.id]: [option] };
      }

      if (isAlreadySelected) {
        // Deselect
        return { ...prev, [group.id]: current.filter((o) => o.id !== option.id) };
      } else {
        // Multi-select checkbox behavior with max limit guard
        if (current.length >= group.maxSelections) return prev;
        return { ...prev, [group.id]: [...current, option] };
      }
    });
  };

  // Toggle instruction preset chip
  const togglePresetChip = (chip: string) => {
    setNotes((prev) => {
      if (prev.includes(chip)) {
        return prev.replace(chip, "").replace(/,\s*,/, ",").replace(/^,\s*/, "").replace(/,\s*$/, "").trim();
      }
      return prev ? `${prev}, ${chip}` : chip;
    });
  };

  // Validation: verify all required groups meet minSelections
  const missingRequiredGroups = React.useMemo(() => {
    return item.modifierGroups.filter((group) => {
      if (!group.isRequired) return false;
      const selections = selectedOptions[group.id] || [];
      return selections.length < group.minSelections;
    });
  }, [item, selectedOptions]);

  const isValid = missingRequiredGroups.length === 0;

  // Real-time Decimal unit price calculation
  const unitPrice = React.useMemo(() => {
    let total = item.basePrice;
    Object.values(selectedOptions).flat().forEach((opt) => {
      total = addMoney(total, opt.priceDelta);
    });
    return total;
  }, [item, selectedOptions]);

  const totalLinePrice = mulMoney(unitPrice, quantity);

  const handleConfirm = () => {
    if (!isValid) return;
    const applied: AppliedModifier[] = [];
    item.modifierGroups.forEach((group) => {
      const opts = selectedOptions[group.id] || [];
      opts.forEach((opt) => {
        applied.push({
          groupId: group.id,
          groupName: group.name,
          optionId: opt.id,
          optionName: opt.name,
          priceDelta: opt.priceDelta,
        });
      });
    });

    onConfirm(item, applied, quantity, notes, totalLinePrice);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-espresso/60 backdrop-blur-xs p-4">
      <div className="bg-card border border-border rounded-3xl w-full max-w-xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between p-4 border-b border-border bg-porcelain">
          <div>
            <h2 className="text-base font-black text-foreground">{item.name}</h2>
            <p className="text-xs text-muted-foreground">Base: {formatMoney(item.basePrice)}</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-secondary text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-4 overflow-y-auto space-y-5 flex-1">
          {item.modifierGroups.map((group) => {
            const currentSelected = selectedOptions[group.id] || [];
            const isSatisfied = !group.isRequired || currentSelected.length >= group.minSelections;

            return (
              <div key={group.id} className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-black uppercase tracking-wider text-foreground">
                    {group.name}
                  </h3>
                  <div className="flex items-center gap-1.5">
                    {group.isRequired ? (
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                          isSatisfied
                            ? "bg-[#EAF3EE] text-[#28634B] border-[#C3DED0]"
                            : "bg-[#FDF5E7] text-[#946000] border-[#EDD7AD]"
                        }`}
                      >
                        {isSatisfied ? "✓ Selected" : `Required · Pick ${group.minSelections}`}
                      </span>
                    ) : (
                      <span className="text-[10px] font-semibold text-muted-foreground bg-secondary px-2 py-0.5 rounded-full border border-border">
                        Optional · Max {group.maxSelections}
                      </span>
                    )}
                  </div>
                </div>

                {/* Options Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {group.options.map((opt) => {
                    const isSelected = currentSelected.some((o) => o.id === opt.id);
                    const isZeroDelta = parseFloat(opt.priceDelta) === 0;
                    const isNegative = parseFloat(opt.priceDelta) < 0;

                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => toggleOption(group, opt)}
                        className={`p-3 rounded-xl border text-left transition-all flex items-center justify-between cursor-pointer ${
                          isSelected
                            ? "bg-primary/5 border-primary text-primary font-bold ring-2 ring-primary/20 shadow-xs"
                            : "bg-card border-border hover:bg-secondary/40 text-foreground"
                        }`}
                      >
                        <span className="text-xs">{opt.name}</span>
                        <span
                          className={`font-mono text-xs ${
                            isZeroDelta
                              ? "text-muted-foreground"
                              : isNegative
                              ? "text-[#28634B] font-bold"
                              : "text-primary font-black"
                          }`}
                        >
                          {isZeroDelta
                            ? "+$0.00"
                            : isNegative
                            ? `${formatMoney(opt.priceDelta)}`
                            : `+${formatMoney(opt.priceDelta)}`}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {/* Special Instructions & Presets */}
          <div className="space-y-2 pt-2 border-t border-border">
            <label className="text-xs font-black uppercase tracking-wider text-foreground">
              Special Instructions
            </label>
            <div className="flex flex-wrap gap-1.5">
              {PRESET_INSTRUCTIONS.map((chip) => {
                const isActive = notes.includes(chip);
                return (
                  <button
                    key={chip}
                    type="button"
                    onClick={() => togglePresetChip(chip)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer border ${
                      isActive
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-secondary text-foreground hover:bg-[#E5DDCF] border-border"
                    }`}
                  >
                    {chip}
                  </button>
                );
              })}
            </div>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Extra crispy, dressing on the side..."
              rows={2}
              className="w-full text-xs p-2.5 rounded-xl border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none"
            />
          </div>
        </div>

        {/* Modal Sticky Footer */}
        <div className="p-4 border-t border-border bg-porcelain flex items-center justify-between gap-4">
          {/* Quantity Stepper */}
          <div className="flex items-center gap-2 bg-secondary/80 p-1 rounded-xl border border-border">
            <button
              onClick={() => setQuantity((q) => Math.max(1, q - 1))}
              className="h-8 w-8 rounded-lg bg-card hover:bg-[#E5DDCF] flex items-center justify-center text-foreground font-bold cursor-pointer transition-colors"
            >
              <Minus className="h-3.5 w-3.5" />
            </button>
            <span className="font-mono font-black text-sm px-2 text-foreground">{quantity}</span>
            <button
              onClick={() => setQuantity((q) => q + 1)}
              className="h-8 w-8 rounded-lg bg-card hover:bg-[#E5DDCF] flex items-center justify-center text-foreground font-bold cursor-pointer transition-colors"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Confirm Button */}
          <button
            onClick={handleConfirm}
            disabled={!isValid}
            className={`flex-1 py-3 px-4 rounded-xl font-bold text-xs uppercase tracking-wider transition-colors flex items-center justify-between ${
              isValid
                ? "bg-primary hover:bg-[#541E2A] text-primary-foreground shadow-sm cursor-pointer"
                : "bg-secondary text-muted-foreground cursor-not-allowed border border-border"
            }`}
          >
            <span>{isValid ? "Add to Order" : `Select Required Options`}</span>
            <span className="font-mono font-black text-sm">{formatMoney(totalLinePrice)}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
```

---

### 8.3 Component 3: `SplitBillingDrawer.tsx`

```tsx
"use client";

import * as React from "react";
import { X, Users, Split, CheckCircle2, AlertCircle, Trash2, ArrowRight } from "lucide-react";
import { formatMoney, toCents, fromCents } from "@/lib/currency";
import { RestaurantOrderLine } from "@/types/hospitality";

interface SplitBillingDrawerProps {
  isOpen: boolean;
  tableNumber: string;
  orderLines: RestaurantOrderLine[];
  onClose: () => void;
  onFinalizeSplit: (splits: { guestName: string; amount: string; lineItemIds: string[] }[]) => void;
}

export function SplitBillingDrawer({
  isOpen,
  tableNumber,
  orderLines,
  onClose,
  onFinalizeSplit,
}: SplitBillingDrawerProps) {
  if (!isOpen) return null;

  const [mode, setMode] = React.useState<"EQUAL" | "BY_ITEM">("BY_ITEM");
  const [equalGuestCount, setEqualGuestCount] = React.useState(2);

  // By Item state: mapping of guest index to array of line IDs
  const [guestCount, setGuestCount] = React.useState(2);
  const [itemAssignments, setItemAssignments] = React.useState<Record<string, number>>({});

  // Canonical session total in cents
  const totalCents = React.useMemo(() => {
    return orderLines.reduce((acc, line) => acc + toCents(line.lineTotal), 0);
  }, [orderLines]);

  // Real-time calculation for By Item mode
  const { guestAllocations, unallocatedCents } = React.useMemo(() => {
    const allocations: Record<number, number> = {};
    for (let i = 1; i <= guestCount; i++) allocations[i] = 0;

    let allocatedTotal = 0;
    orderLines.forEach((line) => {
      const assignedGuest = itemAssignments[line.id];
      if (assignedGuest && assignedGuest <= guestCount) {
        const cents = toCents(line.lineTotal);
        allocations[assignedGuest] += cents;
        allocatedTotal += cents;
      }
    });

    return {
      guestAllocations: allocations,
      unallocatedCents: totalCents - allocatedTotal,
    };
  }, [orderLines, itemAssignments, guestCount, totalCents]);

  // Penny-perfect Equal Shares algorithm
  const equalShares = React.useMemo(() => {
    const baseShare = Math.floor(totalCents / equalGuestCount);
    const remainder = totalCents % equalGuestCount;

    return Array.from({ length: equalGuestCount }, (_, i) => ({
      guestName: `Guest ${i + 1}`,
      cents: baseShare + (i < remainder ? 1 : 0),
      hasRemainderPenny: i < remainder && remainder > 0,
    }));
  }, [totalCents, equalGuestCount]);

  const isBalanced = mode === "EQUAL" ? true : unallocatedCents === 0;

  const handleAssignItem = (lineId: string, guestNumber: number) => {
    setItemAssignments((prev) => ({
      ...prev,
      [lineId]: prev[lineId] === guestNumber ? 0 : guestNumber,
    }));
  };

  const handleConfirm = () => {
    if (!isBalanced) return;

    if (mode === "EQUAL") {
      const result = equalShares.map((share) => ({
        guestName: share.guestName,
        amount: fromCents(share.cents),
        lineItemIds: [],
      }));
      onFinalizeSplit(result);
    } else {
      const result = Array.from({ length: guestCount }, (_, i) => {
        const gNum = i + 1;
        const lineIds = Object.entries(itemAssignments)
          .filter(([_, assigned]) => assigned === gNum)
          .map(([id]) => id);
        return {
          guestName: `Guest ${gNum}`,
          amount: fromCents(guestAllocations[gNum]),
          lineItemIds: lineIds,
        };
      });
      onFinalizeSplit(result);
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-espresso/60 backdrop-blur-xs">
      <div className="bg-card border-l border-border w-full max-w-3xl h-full flex flex-col shadow-2xl overflow-hidden">
        {/* Pinned Drawer Header */}
        <div className="p-4 border-b border-border bg-porcelain flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h2 className="text-base font-black text-foreground">Split Bill — Table {tableNumber}</h2>
            {isBalanced ? (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[#EAF3EE] text-[#28634B] border border-[#C3DED0]">
                <CheckCircle2 className="h-3 w-3" />
                Balanced (100%)
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[#FDF5E7] text-[#946000] border border-[#EDD7AD]">
                <AlertCircle className="h-3 w-3" />
                Unallocated: {formatMoney(fromCents(unallocatedCents))}
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-secondary text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Mode Selector Tabs */}
        <div className="px-4 py-2 border-b border-border bg-secondary/40 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setMode("BY_ITEM")}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                mode === "BY_ITEM"
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "bg-card text-foreground border border-border hover:bg-secondary"
              }`}
            >
              Split by Item
            </button>
            <button
              onClick={() => setMode("EQUAL")}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                mode === "EQUAL"
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "bg-card text-foreground border border-border hover:bg-secondary"
              }`}
            >
              Split by Equal Shares
            </button>
          </div>
          <div className="text-xs text-muted-foreground">
            Total Bill: <strong className="font-mono text-foreground">{formatMoney(fromCents(totalCents))}</strong>
          </div>
        </div>

        {/* Drawer Body */}
        <div className="p-4 overflow-y-auto flex-1 space-y-4">
          {mode === "BY_ITEM" ? (
            <div className="space-y-4">
              {/* Guest Columns Counter Header */}
              <div className="flex items-center justify-between">
                <span className="text-xs font-black uppercase tracking-wider text-foreground">
                  Guest Bills ({guestCount})
                </span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setGuestCount((g) => Math.max(2, g - 1))}
                    className="px-2 py-1 bg-secondary text-xs font-bold rounded-lg border border-border hover:bg-[#E5DDCF] cursor-pointer"
                  >
                    - Guest
                  </button>
                  <button
                    onClick={() => setGuestCount((g) => Math.min(10, g + 1))}
                    className="px-2 py-1 bg-primary text-primary-foreground text-xs font-bold rounded-lg hover:bg-[#541E2A] cursor-pointer"
                  >
                    + Add Guest Bill
                  </button>
                </div>
              </div>

              {/* Guest Bill Summary Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {Array.from({ length: guestCount }, (_, i) => {
                  const gNum = i + 1;
                  const allocated = guestAllocations[gNum] || 0;
                  return (
                    <div key={gNum} className="p-3 bg-secondary/50 rounded-xl border border-border space-y-1">
                      <div className="flex items-center justify-between text-xs font-bold text-foreground">
                        <span>Guest {gNum}</span>
                        <span className="font-mono font-black text-primary">
                          {formatMoney(fromCents(allocated))}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Order Lines Assignment List */}
              <div className="space-y-2 pt-2">
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Tap Guest Number to Assign Item
                </span>
                <div className="divide-y divide-border border border-border rounded-xl bg-card overflow-hidden">
                  {orderLines.map((line) => {
                    const assigned = itemAssignments[line.id] || 0;
                    return (
                      <div key={line.id} className="p-3 flex items-center justify-between gap-3 hover:bg-secondary/20">
                        <div className="flex-1">
                          <p className="font-bold text-xs text-foreground">
                            {line.quantity}x {line.itemName}
                          </p>
                          <p className="font-mono text-xs text-muted-foreground">
                            {formatMoney(line.lineTotal)}
                          </p>
                        </div>
                        {/* Guest Assignment Buttons */}
                        <div className="flex items-center gap-1">
                          {Array.from({ length: guestCount }, (_, i) => {
                            const gNum = i + 1;
                            const isAssigned = assigned === gNum;
                            return (
                              <button
                                key={gNum}
                                onClick={() => handleAssignItem(line.id, gNum)}
                                className={`h-8 w-8 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                                  isAssigned
                                    ? "bg-primary text-primary-foreground shadow-xs ring-2 ring-primary/20"
                                    : "bg-secondary hover:bg-[#E5DDCF] text-foreground border border-border"
                                }`}
                              >
                                G{gNum}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : (
            /* Equal Shares View */
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-secondary/40 rounded-xl border border-border">
                <span className="text-xs font-bold text-foreground">Number of Guests</span>
                <div className="flex items-center gap-2">
                  {[2, 3, 4, 5, 6].map((n) => (
                    <button
                      key={n}
                      onClick={() => setEqualGuestCount(n)}
                      className={`h-8 w-8 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                        equalGuestCount === n
                          ? "bg-primary text-primary-foreground"
                          : "bg-card text-foreground border border-border hover:bg-secondary"
                      }`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>

              {/* Shares Breakdown */}
              <div className="space-y-2">
                {equalShares.map((share, idx) => (
                  <div
                    key={idx}
                    className="p-3 bg-card border border-border rounded-xl flex items-center justify-between"
                  >
                    <div>
                      <span className="font-bold text-xs text-foreground">{share.guestName}</span>
                      {share.hasRemainderPenny && (
                        <p className="text-[10px] text-muted-foreground">Includes 1¢ penny-balancing adjustment</p>
                      )}
                    </div>
                    <span className="font-mono font-black text-sm text-primary">
                      {formatMoney(fromCents(share.cents))}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Pinned Footer */}
        <div className="p-4 border-t border-border bg-porcelain flex items-center justify-between gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl border border-border text-foreground text-xs font-bold hover:bg-secondary cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={!isBalanced}
            className={`flex-1 py-2.5 px-4 rounded-xl text-xs font-black uppercase tracking-wider transition-colors flex items-center justify-center gap-2 ${
              isBalanced
                ? "bg-primary hover:bg-[#541E2A] text-primary-foreground shadow-sm cursor-pointer"
                : "bg-secondary text-muted-foreground cursor-not-allowed border border-border"
            }`}
          >
            <CheckCircle2 className="h-4 w-4" />
            {isBalanced ? "Confirm Split Checks" : "Allocate All Items to Proceed"}
          </button>
        </div>
      </div>
    </div>
  );
}
```

---

### 8.4 Component 4: `VoidLineModal.tsx`

```tsx
"use client";

import * as React from "react";
import { Trash2, AlertTriangle, X, ShieldAlert } from "lucide-react";
import { formatMoney } from "@/lib/currency";
import { RestaurantOrderLine } from "@/types/hospitality";

interface VoidLineModalProps {
  isOpen: boolean;
  line: RestaurantOrderLine | null;
  onClose: () => void;
  onConfirmVoid: (lineId: string, reason: string, notes: string, isWaste: boolean) => void;
}

const VOID_PRESET_REASONS = [
  "Customer Changed Mind",
  "Kitchen 86'd (Out of Stock)",
  "Wrong Item Entered by Staff",
  "Food Quality Issue / Defect",
  "Customer Walk-out",
  "Order Delayed / Cancelled",
  "Other Reason",
];

export function VoidLineModal({ isOpen, line, onClose, onConfirmVoid }: VoidLineModalProps) {
  if (!isOpen || !line) return null;

  const [selectedReason, setSelectedReason] = React.useState(VOID_PRESET_REASONS[0]);
  const [customNotes, setCustomNotes] = React.useState("");
  const [isWaste, setIsWaste] = React.useState(false);

  const isValid = selectedReason !== "Other Reason" || customNotes.trim().length > 0;

  const handleSubmit = () => {
    if (!isValid) return;
    onConfirmVoid(line.id, selectedReason, customNotes, isWaste);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-espresso/60 backdrop-blur-xs p-4">
      <div className="bg-card border border-border rounded-3xl w-full max-w-md flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border bg-[#FAEAEC]">
          <div className="flex items-center gap-2 text-[#B33432]">
            <AlertTriangle className="h-5 w-5" />
            <h2 className="text-sm font-black uppercase tracking-wider">Mandatory Void Reason</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-black/5 text-muted-foreground hover:text-foreground cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 space-y-4">
          {/* Target Item Summary */}
          <div className="p-3 bg-secondary/50 rounded-xl border border-border flex items-center justify-between">
            <div>
              <p className="font-bold text-xs text-foreground">
                {line.quantity}x {line.itemName}
              </p>
              <p className="text-[11px] text-muted-foreground">Line Total: {formatMoney(line.lineTotal)}</p>
            </div>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#FAEAEC] text-[#B33432] border border-[#E9B6B7]">
              Pending Void
            </span>
          </div>

          {/* Reason Selection */}
          <div className="space-y-2">
            <label className="text-xs font-black uppercase tracking-wider text-foreground">
              Select Authorized Reason
            </label>
            <div className="grid grid-cols-1 gap-1.5">
              {VOID_PRESET_REASONS.map((reason) => {
                const isSelected = selectedReason === reason;
                return (
                  <button
                    key={reason}
                    type="button"
                    onClick={() => setSelectedReason(reason)}
                    className={`p-2.5 rounded-xl border text-left text-xs font-semibold transition-colors cursor-pointer ${
                      isSelected
                        ? "bg-[#FAEAEC] border-[#B33432] text-[#B33432] font-bold ring-1 ring-[#B33432]/30"
                        : "bg-card border-border hover:bg-secondary/40 text-foreground"
                    }`}
                  >
                    {reason}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Notes if Other */}
          {selectedReason === "Other Reason" && (
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-foreground">Mandatory Explanation</label>
              <textarea
                value={customNotes}
                onChange={(e) => setCustomNotes(e.target.value)}
                placeholder="Explain why this item is being voided..."
                rows={2}
                className="w-full text-xs p-2.5 rounded-xl border border-border bg-background focus:ring-2 focus:ring-[#B33432]/20 resize-none"
              />
            </div>
          )}

          {/* Kitchen Waste Toggle */}
          <label className="flex items-center gap-2 p-2.5 rounded-xl bg-secondary/30 border border-border cursor-pointer">
            <input
              type="checkbox"
              checked={isWaste}
              onChange={(e) => setIsWaste(e.target.checked)}
              className="rounded border-border text-primary focus:ring-primary h-4 w-4"
            />
            <span className="text-xs font-semibold text-foreground">
              Food was already prepared (Record as Kitchen Spoilage / Waste)
            </span>
          </label>

          {/* Audit Notice */}
          <div className="flex items-start gap-2 p-2.5 rounded-xl bg-secondary/40 border border-border text-[11px] text-muted-foreground">
            <ShieldAlert className="h-4 w-4 text-[#A77B38] shrink-0 mt-0.5" />
            <span>
              This void event will be permanently written to the immutable <code>AuditEvent</code> ledger with your staff ID and timestamp.
            </span>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-border bg-porcelain flex items-center justify-between gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl border border-border text-foreground text-xs font-bold hover:bg-secondary cursor-pointer"
          >
            Dismiss
          </button>
          <button
            onClick={handleSubmit}
            disabled={!isValid}
            className="flex-1 py-2 px-4 rounded-xl text-xs font-bold uppercase tracking-wider bg-[#B33432] hover:bg-[#992826] text-white flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Confirm Void & Audit
          </button>
        </div>
      </div>
    </div>
  );
}
```

---

## 9. Builder Implementation Roadmap & Directory Plan

To organize the Builder agent's file additions cleanly within `frontend/src/` without disturbing existing retail POS logic:

```
frontend/src/
├── types/
│   └── hospitality.ts                 <-- Domain & UI contracts
├── components/
│   └── hospitality/
│       ├── floor/
│       │   ├── interactive-floor-grid.tsx
│       │   ├── open-session-modal.tsx
│       │   ├── move-table-modal.tsx
│       │   └── merge-table-modal.tsx
│       ├── menu/
│       │   ├── compact-menu-grid.tsx
│       │   ├── category-tabs-bar.tsx
│       │   └── menu-item-card.tsx
│       ├── modifiers/
│       │   └── modifier-selection-modal.tsx
│       ├── split-bill/
│       │   └── split-billing-drawer.tsx
│       └── rounds/
│           ├── multi-round-cart.tsx
│           └── void-line-modal.tsx
└── app/
    └── dashboard/
        └── restaurant/
            ├── tables/
            │   └── page.tsx           <-- Dedicated Floor Grid View
            └── pos/
                └── page.tsx           <-- Full Hospitality Staff POS Terminal
```

---

## 10. Summary Verification Checklist for Builder & Tester

- [ ] **Floor Grid**: Occupancy badges render with exact color isolation tokens (`Forest`, `Slate Blue`, `Ochre`, `Plum`).
- [ ] **Quick Table Actions**: Opening session, viewing order, moving tables, and merging tables function with zero line item duplication.
- [ ] **Compact Menu Grid**: Category quick-switching responds in <50ms without layout jumps; card height capped at ~110px.
- [ ] **Modifier Selection Modal**: Dynamically calculates price deltas (+/- Decimal) using `frontend/src/lib/currency.ts` without floating-point errors.
- [ ] **Split-Billing**: Penny-perfect reconciliation allocates exact integer minor units with zero cent drift.
- [ ] **3D Status Lifecycles**: Acceptance, fulfillment, and settlement remain decoupled; paying for an order leaves kitchen state unchanged.
- [ ] **Mandatory Void Reason**: Voiding any order line blocks until a reason is provided and recorded in the audit trail.
