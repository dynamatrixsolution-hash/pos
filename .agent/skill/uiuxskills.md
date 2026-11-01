# RestroInn UI/UX Design System & Architectural Skill Guide

> **Core Purpose**: This guide is the single authoritative source of truth for all AI agents and developers designing or modifying pages, widgets, buttons, containers, forms, modals, tables, and POS/hospitality interfaces in **RestroInn**.
>
> **Design Philosophy**: *"Refined Hospitality Ergonomics"*. High-density operational clarity inspired by fine dining and heritage boutique hotels. Warm, elegant, and calm—never decorative, playful, or cluttered. Every pixel must serve cashier speed, front-desk accuracy, or kitchen throughput.

---

## 1. Palette & Design Tokens

Always reference the official design tokens defined in `frontend/src/app/globals.css`. Never introduce arbitrary hex codes outside this system.

| Role | Token / Name | Hex | HSL / CSS Var | Purpose & Strict Usage Rules |
| :--- | :--- | :--- | :--- | :--- |
| **Primary** | Deep burgundy | `#6B2837` | `--primary` | Main buttons, active sidebar navigation, primary confirmations. **Do NOT cover whole screens with burgundy.** |
| **Primary Hover** | Wine burgundy | `#541E2A` | `--color-burgundy-hover` | Hover state for primary buttons. |
| **Background** | Warm ivory | `#F7F3EC` | `--background` | Base application canvas across all pages. Warm, glare-free under bright counter lighting. |
| **Surface** | Porcelain | `#FFFCF7` | `--card` / `--popover` | Cards, forms, modals, table bodies, elevated panels. |
| **Secondary surface**| Warm stone | `#EEE7DD` | `--secondary` / `--muted`| Table header bars, segmented control tracks, inactive tab pills, group wrappers. |
| **Text** | Espresso | `#292320` | `--foreground` | Main headings, body copy, tabular numbers, item titles. |
| **Muted Text** | Warm gray | `#71675E` | `--muted-foreground` | Secondary metadata, timestamps, SKU numbers, input helper text. |
| **Border** | Sandstone | `#D8CEC1` | `--border` / `--input` | Table cell borders, container dividers, unselected input borders. Subtle, crisp 1px lines. |
| **Accent** | Muted brass | `#A77B38` | `--accent` | **SPARING USE ONLY**: Active navigation edge line, brand badge, gold rating star, fine highlights. **NEVER** use for normal body text or all icons. |

### Operational Status Tokens (Strict Color Isolation)
Operational statuses represent life-or-death workflow states in restaurant orders, room occupancy, and fiscal ledgers. **Never mix or swap these**:

| Operational Status | Token | Hex | Badge Background | Badge Border | Semantic Meaning |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Ready / Available / Completed** | Forest | `#28634B` | `#EAF3EE` | `#C3DED0` | Clean room, served dish, settled payment, in-stock item |
| **Pending / Preparing / Attention** | Ochre | `#946000` | `#FDF5E7` | `#EDD7AD` | Cooking in kitchen, occupied dirty room, unpaid hold, low stock |
| **Cancelled / Failed / Urgent** | Red | `#B33432` | `#FAEAEC` | `#E9B6B7` | Voided line, kitchen reject, maintenance lock, payment failure |
| **Informational / Assigned** | Blue | `#315F85` | `#EDF4F9` | `#B8D2E6` | Table transferred, cashier assigned, guest inquiry, stay extension |

---

## 2. The Anti-Pattern Codex (What NOT to Do)

Agents frequently generate bloated, unergonomic interfaces. Adhere strictly to these negatives:

### ❌ 1. Over-Padding & Nested White Space Waste
* **Anti-pattern**: `p-8` container containing a `p-6` card containing a `p-6` section with `space-y-8`. This pushes operational data off-screen and forces constant scrolling.
* **Rule**:
  * Page container padding: `p-4 sm:p-6` max.
  * Internal card padding: `p-3.5 sm:p-4`.
  * Grid gaps: `gap-3` or `gap-4`. Never `gap-8` on operational boards.

### ❌ 2. Arbitrary Heights & Inner Scroll Traps
* **Anti-pattern**: `h-[600px]`, `min-h-[500px]`, or nesting `overflow-y-auto` inside fixed height containers without a viewport budget.
* **Rule**: Let natural content height flow or use `flex-1 min-h-0 overflow-y-auto` for pinned POS sidebars.

### ❌ 3. Excessive & Rainbow Shadows
* **Anti-pattern**: `shadow-2xl`, `shadow-xl shadow-indigo-500/50`, or glowing colored halos.
* **Rule**: Use flat surfaces with crisp `border border-border` (`#D8CEC1`). The only permitted shadows are `shadow-xs` or `shadow-sm` on floating cards, and `shadow-md shadow-[#6B2837]/20` on primary action buttons.

### ❌ 4. Decorative Frivolousness
* **Anti-pattern**: Gradient backgrounds, decorative confetti, huge header hero banners taking 300px of vertical space, animated spin/bounce effects on data tables.
* **Rule**: Interfaces must look like a high-end Swiss or Parisian boutique hotel POS. Calm, typography-driven, zero gimmickry.

### ❌ 5. Brass Overuse
* **Anti-pattern**: Brass icons on every button, gold text for headings, brass borders on every card.
* **Rule**: Brass `#A77B38` is reserved for fine brand details (subtitles, selected indicators, small accents). Headings are always Espresso `#292320`.

---

## 3. Standard Component Blueprint Library

### 1. Buttons

```tsx
/* Primary Action Button (Order, Submit, Checkout) */
<button className="px-4 py-2 bg-primary hover:bg-[#541E2A] text-primary-foreground font-bold text-xs uppercase tracking-wider rounded-xl shadow-sm transition-colors cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2">
  <CheckCircle className="h-4 w-4" />
  Confirm Order
</button>

/* Secondary / Cancel Button */
<button className="px-4 py-2 bg-secondary hover:bg-[#E5DDCF] text-foreground font-semibold text-xs rounded-xl border border-border transition-colors cursor-pointer">
  Dismiss
</button>

/* Destructive Button (Void, Delete, Reject) */
<button className="px-3.5 py-1.5 bg-[#B33432] hover:bg-[#992826] text-white font-bold text-xs rounded-xl transition-colors cursor-pointer flex items-center gap-1.5">
  <Trash2 className="h-3.5 w-3.5" />
  Void Item
</button>
```

### 2. Status Badges

```tsx
/* Completed / Ready */
<span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[#EAF3EE] text-[#28634B] border border-[#C3DED0]">
  <span className="h-1.5 w-1.5 rounded-full bg-[#28634B]" />
  Ready to Serve
</span>

/* Pending / Cooking / In-Progress */
<span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[#FDF5E7] text-[#946000] border border-[#EDD7AD]">
  <span className="h-1.5 w-1.5 rounded-full bg-[#946000] animate-pulse" />
  Preparing (Table 4)
</span>

/* Cancelled / Rejected / Alert */
<span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[#FAEAEC] text-[#B33432] border border-[#E9B6B7]">
  <AlertCircle className="h-3 w-3" />
  Cancelled
</span>

/* Informational / Assigned */
<span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[#EDF4F9] text-[#315F85] border border-[#B8D2E6]">
  Folio Room 204
</span>
```

### 3. Surface Containers & Cards

```tsx
<div className="bg-card border border-border rounded-2xl p-4 shadow-xs space-y-3">
  <div className="flex items-center justify-between pb-3 border-b border-border">
    <h3 className="text-sm font-black text-foreground tracking-tight">Active Table Sessions</h3>
    <span className="text-xs font-semibold text-muted-foreground">Floor 1</span>
  </div>
  {/* Content */}
</div>
```

### 4. High-Density Data Tables

```tsx
<div className="overflow-x-auto rounded-xl border border-border bg-card">
  <table className="w-full text-left text-xs">
    <thead className="bg-secondary/70 text-foreground font-black uppercase text-[10px] tracking-wider border-b border-border">
      <tr>
        <th className="py-2.5 px-3">Item / Description</th>
        <th className="py-2.5 px-3">Qty</th>
        <th className="py-2.5 px-3 text-right">Price</th>
        <th className="py-2.5 px-3 text-center">Status</th>
        <th className="py-2.5 px-3 text-right">Action</th>
      </tr>
    </thead>
    <tbody className="divide-y divide-border/60">
      <tr className="hover:bg-secondary/30 transition-colors">
        <td className="py-2 px-3 font-bold text-foreground">Royal Heritage Feast</td>
        <td className="py-2 px-3 font-mono text-foreground">2</td>
        <td className="py-2 px-3 text-right font-mono font-bold text-foreground">Rs. 2,500.00</td>
        <td className="py-2 px-3 text-center">
          <span className="badge-status-ready">Ready</span>
        </td>
        <td className="py-2 px-3 text-right">...</td>
      </tr>
    </tbody>
  </table>
</div>
```

---

## 4. Operational Screen Ergonomics

### Point of Sale (POS) Layout Budget
* **Left Catalog / Menu Area (65-70% width)**:
  * Category quick-switch tabs pinned at top.
  * Search input with instant autofocus.
  * Product grid with clean 1:1 or 4:3 cards. Card height capped at ~110px.
  * Clear prices, tax-inclusive markers, and modifier badges.
* **Right Order Cart (30-35% width)**:
  * Sticky header with Table / Room / Customer selector.
  * Scrollable line item list with inline quantity steppers (`+`, `-`, delete).
  * Subtotal, VAT, Discount, and Total pinned at bottom.
  * **Primary Checkout button**: Full-width, high-contrast burgundy button (`py-3.5 text-sm font-black`).

### Kitchen Display System (KDS) Ergonomics
* Cards group items by **Order Round** with elapsed timer.
* High-contrast typography readable from 3 meters away.
* Status toggles: single tap transitions line from `QUEUED` ➔ `PREPARING` ➔ `READY`.
* Modifiers rendered in distinct Ochre `#946000` text so dietary restrictions (e.g. *"NO PEANUTS, EXTRA SPICY"*) are instantly spotted.

### Hotel Room & Folio Grid
* Clean matrix view: Floors on Y-axis, Dates or Room Numbers on X-axis.
* State indicators:
  * Vacant Clean: Soft forest `#EAF3EE`
  * Occupied: Soft burgundy `#F5EAEC`
  * Vacant Dirty: Soft ochre `#FDF5E7`
  * Maintenance Block: Soft red `#FAEAEC` with cross-hatch.

