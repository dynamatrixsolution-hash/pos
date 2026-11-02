# RestroInn UI/UX Design System & Anti-AI-Slop Enforcement Guide

> **Core Purpose**: This guide is the single authoritative source of truth for all AI agents and developers designing or modifying pages, widgets, buttons, containers, forms, modals, tables, and POS/hospitality interfaces in **RestroInn**.
>
> **Design Philosophy**: *"Refined Hospitality Ergonomics — Zero AI Slop"*. High-density operational clarity inspired by classic Swiss and boutique hospitality hardware terminals. Warm, tactile, calm, and strictly utilitarian—every pixel must serve cashier speed, front-desk accuracy, or kitchen throughput.

---

## 1. Palette & Design Tokens

Always reference the official design tokens defined in [`frontend/src/app/globals.css`](file:///c:/projects/pos/frontend/src/app/globals.css). Never introduce arbitrary hex codes, neon accents, or pure white (`#FFFFFF`) canvases outside print templates.

| Role | Token / Name | Hex | HSL / CSS Var | Purpose & Strict Usage Rules |
| :--- | :--- | :--- | :--- | :--- |
| **Primary** | Deep burgundy | `#6B2837` | `--primary` | Main action buttons, active sidebar state, primary confirmations. **Do NOT cover whole screens with burgundy.** |
| **Primary Hover** | Wine burgundy | `#541E2A` | `--color-burgundy-hover` | Hover state for primary buttons. |
| **Background** | Warm ivory | `#F7F3EC` | `--background` | Base application canvas across all pages. Glare-free under bright counter lighting. **Never use pure white `#FFFFFF` as a page background.** |
| **Surface** | Porcelain | `#FFFCF7` | `--card` / `--popover` | Cards, forms, modals, table bodies, elevated panels. |
| **Secondary surface**| Warm stone | `#EEE7DD` | `--secondary` / `--muted`| Table header bars, segmented control tracks, inactive tab pills, group wrappers. |
| **Text** | Espresso | `#292320` | `--foreground` | Main headings, body copy, tabular numbers, item titles. |
| **Muted Text** | Warm gray | `#71675E` | `--muted-foreground` | Secondary metadata, timestamps, SKU numbers, input helper text. |
| **Border** | Sandstone | `#D8CEC1` | `--border` / `--input` | Table cell borders, container dividers, unselected input borders. Crisp `1px` structural lines. |
| **Accent** | Muted brass | `#A77B38` | `--accent` | **SPARING USE ONLY**: Active navigation edge line, brand badge, fine highlights. **NEVER** use for normal body text or all icons. |

### Operational Status Tokens (Strict Color Isolation)
Operational statuses represent workflow states in restaurant orders, room occupancy, and fiscal ledgers. **Never mix or swap these, and never invent rainbow status colors**:

| Operational Status | Token | Hex | Badge Background | Badge Border | Semantic Meaning |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Ready / Available / Completed** | Forest | `#28634B` | `#EAF3EE` | `#C3DED0` | Clean room, served dish, settled payment, in-stock item |
| **Pending / Preparing / Attention** | Ochre | `#946000` | `#FDF5E7` | `#EDD7AD` | Cooking in kitchen, occupied dirty room, unpaid hold, low stock |
| **Cancelled / Failed / Urgent** | Red | `#B33432` | `#FAEAEC` | `#E9B6B7` | Voided line, kitchen reject, maintenance lock, payment failure |
| **Informational / Assigned** | Blue | `#315F85` | `#EDF4F9` | `#B8D2E6` | Table transferred, cashier assigned, guest inquiry, stay extension |

---

## 2. Strict Anti-AI-Slop Rules (Banned & Restricted Patterns)

AI-generated interfaces often suffer from recognizable "AI slop" clichés. Every rule below is **mandatory**. Use decorative elements **only at a bare minimum when functionally required—and if not required, omit them completely.**

### 🚫 A. Color, Surface & Lighting Bans
1. **No Harsh Gradients**: Never use multi-stop CSS linear/radial gradients (`bg-gradient-to-r`, `from-purple-500 to-pink-500`) on cards, buttons, headers, or text (`bg-clip-text`). Use solid, flat semantic tokens (`#6B2837`, `#FFFCF7`, `#F7F3EC`, `#EEE7DD`).
2. **No Purple & Black Cyberpunk Themes**: Never use `#000000` with violet/indigo/purple (`#8B5CF6`, `#6366F1`) glows. Dark surfaces (such as KDS) must use warm dark espresso (`#1F1A18`, `#262320`) with Sandstone/Porcelain contrast.
3. **No Pure White Backgrounds (`#FFFFFF`)**: Never use `bg-white` for application pages or main cards; always use Warm Ivory (`#F7F3EC`) for page canvas and Porcelain (`#FFFCF7`) for surfaces (white is reserved strictly for thermal/A4 paper print previews and QR quiet zones).
4. **No Rainbow Coloring or Basic Pastel Grids**: Do not assign a different pastel color (pink, mint, lavender, cyan, peach) to every card or metric box. Rely on typography, hierarchy, and the 4 strict operational status tokens.
5. **No Neon Colors**: Never use high-saturation neon greens, electric blues, magentas, or fluorescent yellows.
6. **No "Liquid Glass" / Heavy Glassmorphism**: Do not layer `backdrop-blur-2xl bg-white/10 border-white/20` frosted panels over blurred colorful blobs. Only subtle modal backdrops (`bg-[#292320]/40`) are permitted.
7. **No Radial Orbs or Dot/Mesh Grids**: Never place blurred floating background circles (`blur-3xl rounded-full`), SVG dot matrices, or perspective grid lines behind UI content.

### 🚫 B. Iconography, Typography & Copywriting Bans
8. **Minimal Lucide Icons (No Icon Soup)**: Do not prefix every label, table header, badge, or paragraph with a Lucide icon. Use icons **only** where they aid rapid spatial scanning (e.g., primary navigation, icon-only action buttons, search input). Never use `<Sparkles />`, `<Zap />`, or `<Flame />` as decorative filler.
9. **No Sparkle Icons (`✨` / `<Sparkles />`)**: Completely banned unless an action literally invokes an AI generation tool (RestroInn is a deterministic hospitality POS—never put sparkles on rooms, dishes, or bills).
10. **No Emojis in UI**: Never render emojis (`👨‍🍳`, `⚠️`, `🔥`, `🎉`, `✅`, `🍽️`) in headings, buttons, empty states, status badges, or toasts. Use clean typographic badges or a single restrained vector icon when necessary.
11. **No Default AI Font Clichés (`Inter` / `Geist` / `Space Grotesk` Over-Styling)**: Do not rely on oversized tight-tracked `Space Grotesk` or generic `Inter` hero titles. Use clean, high-legibility operational typography with `tabular-nums` (`font-variant-numeric: tabular-nums`) on all currency, quantities, timers, and room/table numbers.
12. **No Em-Dash (`—`) Abuse or `"It's not X, it's Y"` AI Copywriting**:
    - Never write marketing-style AI filler copy like *"It's not just a POS—it's a hospitality revolution"* or *"Seamless — Fast — Effortless"*.
    - Write direct, factual operational labels (`"Table T-02 • 4 Covers"`, `"Balance Due: Rs. 9,605.00"`).
13. **No Checkmark Bullet Lists**: Do not build feature lists of `✓ Fast checkout`, `✓ Easy billing`. In operational screens, show the actual interactive controls and data directly.

### 🚫 C. Layout, Geometry & Component Bans
14. **No Heavy Drop Shadows**: Never use `shadow-lg`, `shadow-xl`, `shadow-2xl`, or colored shadows. Depth is communicated through `1px` Sandstone borders (`border-[#D8CEC1]`) and surface contrast (`#F7F3EC` vs `#FFFCF7`). At most `shadow-2xs` or `shadow-xs` is allowed.
15. **No Colored Left Stripes on Cards**: Do not put `border-l-4 border-l-blue-500` or `border-l-4 border-l-emerald-500` on every card or alert box. Use clean `1px` full-perimeter borders (`border-[#D8CEC1]`) and a compact status pill in the header.
16. **No Pillowy Soft Corner Radiuses (`rounded-3xl` / `rounded-[32px]`)**: Avoid bubbly consumer-app corners. Use crisp architectural radii: `rounded-md` (`6px`) or `rounded-lg` (`8px`) for buttons, inputs, and badges; `rounded-xl` (`12px`) maximum for modals and panels.
17. **No "Bento Grids" or Generic "3 Feature Cards in a Row"**: Do not arrange operational tools into decorative asymmetric bento boxes or 3-column icon-title-blurb marketing cards. Use structured split-panes, dense data tables, or uniform room/table racks.
18. **No Fake macOS Terminal Windows**: Do not render fake dark terminal boxes with red/yellow/green traffic-light dots (`● ● ●`). When showing ESC/POS payloads or logs, use a clean monospace inspection table or bordered `<pre>` block.
19. **No Bouncy Hover Animations or Animated Arrows**:
    - Never use `hover:scale-105`, `hover:-translate-y-1`, `animate-bounce`, or sliding arrow icons (`group-hover:translate-x-1`) on cards or buttons.
    - POS touch targets must feel instant and solid (`transition-colors duration-100`).
20. **No Fake Testimonials, No 3-Tier Pricing Tables, No Mock Product Marketing**: Never insert SaaS marketing tropes into the product. Every screen must operate on real database state.
21. **Always Provide Skeleton Loaders & Legal/Compliance Footers Where Applicable**:
    - **Skeleton Loaders**: Never show raw jarring text like `"Loading..."` on primary workspaces; use calm `animate-pulse bg-[#EEE7DD]` structural skeleton rows/cards that match the final layout geometry.
    - **Terms of Service & Privacy Policy**: Public-facing and authentication/guest-portal surfaces must include clear links/references to Terms of Service and Guest Privacy Policy.

---

## 3. Standard Component Blueprint Library

### 1. Buttons (Crisp, Solid, Zero Bounce)

```tsx
/* Primary Action Button (Order, Submit, Checkout) */
<button className="px-4 py-2 bg-[#6B2837] hover:bg-[#541E2A] text-[#FFFCF7] font-semibold text-xs rounded-lg transition-colors cursor-pointer disabled:opacity-50 inline-flex items-center justify-center gap-2">
  Confirm Order
</button>

/* Secondary / Neutral Action Button */
<button className="px-3.5 py-2 bg-[#FFFCF7] hover:bg-[#EEE7DD] text-[#292320] font-semibold text-xs rounded-lg border border-[#D8CEC1] transition-colors cursor-pointer">
  Cancel
</button>

/* Destructive Button (Void, Delete, Reject) */
<button className="px-3.5 py-2 bg-[#B33432] hover:bg-[#992826] text-white font-semibold text-xs rounded-lg transition-colors cursor-pointer">
  Void Item
</button>
```

### 2. Status Badges (Typography + Dot Only, No Emojis)

```tsx
/* Completed / Ready / Vacant Clean */
<span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-[11px] font-semibold bg-[#EAF3EE] text-[#28634B] border border-[#C3DED0]">
  <span className="h-1.5 w-1.5 rounded-full bg-[#28634B]" />
  Vacant Clean
</span>

/* Pending / Preparing / Occupied */
<span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-[11px] font-semibold bg-[#FDF5E7] text-[#946000] border border-[#EDD7AD]">
  <span className="h-1.5 w-1.5 rounded-full bg-[#946000]" />
  Preparing
</span>

/* Cancelled / Rejected / Urgent */
<span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-[11px] font-semibold bg-[#FAEAEC] text-[#B33432] border border-[#E9B6B7]">
  <span className="h-1.5 w-1.5 rounded-full bg-[#B33432]" />
  Maintenance
</span>

/* Informational / Assigned */
<span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-[11px] font-semibold bg-[#EDF4F9] text-[#315F85] border border-[#B8D2E6]">
  Folio #FOL-101
</span>
```

### 3. Skeleton Loaders (Mandatory Instead of Plain "Loading..." Text)

```tsx
<div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
  {Array.from({ length: 6 }).map((_, idx) => (
    <div key={idx} className="rounded-lg border border-[#D8CEC1] bg-[#FFFCF7] p-3.5 space-y-2.5">
      <div className="h-3.5 w-2/3 rounded bg-[#EEE7DD] animate-pulse" />
      <div className="h-3 w-1/2 rounded bg-[#EEE7DD] animate-pulse" />
      <div className="h-7 w-full rounded bg-[#EEE7DD] animate-pulse mt-2" />
    </div>
  ))}
</div>
```

### 4. High-Density Data Tables

```tsx
<div className="overflow-x-auto rounded-lg border border-[#D8CEC1] bg-[#FFFCF7]">
  <table className="w-full text-left text-xs">
    <thead className="bg-[#EEE7DD] text-[#292320] font-semibold uppercase text-[10px] tracking-wider border-b border-[#D8CEC1]">
      <tr>
        <th className="py-2.5 px-3">Item</th>
        <th className="py-2.5 px-3">Qty</th>
        <th className="py-2.5 px-3 text-right">Amount</th>
        <th className="py-2.5 px-3 text-center">Status</th>
      </tr>
    </thead>
    <tbody className="divide-y divide-[#D8CEC1]/60">
      <tr className="hover:bg-[#F7F3EC] transition-colors">
        <td className="py-2 px-3 font-medium text-[#292320]">Royal Thakali Thali</td>
        <td className="py-2 px-3 tabular-nums text-[#292320]">2</td>
        <td className="py-2 px-3 text-right tabular-nums font-semibold text-[#292320]">Rs. 2,300.00</td>
        <td className="py-2 px-3 text-center">
          <span className="badge-status-ready px-2 py-0.5 rounded text-[10px] font-semibold border">Served</span>
        </td>
      </tr>
    </tbody>
  </table>
</div>
```

---

## 4. Operational Screen Ergonomics

### Point of Sale (POS) Layout Budget
* **Left Catalog / Menu Area (65–70% width)**:
  * Compact top bar with Dine-In / Takeaway / Bar mode selector and table pills.
  * Category tabs + instant filter input on a single row.
  * High-density dish cards (`rounded-lg`, `border-[#D8CEC1]`, no heavy shadows, no decorative icons) showing item name, price (`tabular-nums`), prep time, and a clean `Options` button when modifiers exist.
* **Right Order Ticket (30–35% width)**:
  * Sticky table/order header with running bill total.
  * Active draft round with inline `-` / `+` quantity steppers and kitchen notes input.
  * Collapsible/compact list of previously sent rounds.
  * Pinned bottom checkout/dispatch bar with Subtotal, 13% VAT, Total, and a solid `#6B2837` action button.

### Kitchen Display System (KDS) Ergonomics
* Warm dark espresso canvas (`#1F1A18`) with `#262320` ticket cards and crisp `#3D3733` borders.
* Zero emojis—use typographic badges (`URGENT`, `ALLERGY: NO NUTS`) with high-contrast Ochre (`#946000`) and Red (`#B33432`) tokens.
* Single-tap status progression (`Start Prep` -> `Mark Ready` -> `Serve`).
