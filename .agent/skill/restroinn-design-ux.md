---
name: restroinn-design-ux
description: >
  Mandatory design and user-experience skill for RestroInn, a Multi-Tenant Hotel,
  Restaurant, and Hospitality SaaS. Use this for ANY question of how something
  should look, feel, flow, or read — visual identity, semantic design tokens,
  information architecture, navigation and layout decisions, microcopy, dense data
  display, accessibility, and strict anti-slop rules. This design language is
  deliberately minimalist: zero unnecessary padding, zero heavy drop shadows,
  hairline borders, San Francisco typography, flat semantic Warm Ivory & Deep Burgundy
  tokens, and maximum scanning efficiency for operational staff.
---

# RestroInn Hospitality Design & UX Skill

## Design Philosophy

RestroInn is operated by people working in high-pressure, fast-paced hospitality environments — a restaurant cashier during dinner rush, a front desk receptionist checking in a tour group, a kitchen cook watching the KDS, a hotel housekeeper updating room statuses, or a platform super administrator auditing tenant billing.

Every design decision must answer one question: **Does this make that person's next five seconds easier and error-free?**

The product should feel: **modern, trustworthy, calm, institutional, premium, and effortless to scan**. It must never look or feel like a generic marketing dashboard, a startup pitch template, or a flashy crypto/AI demo. Those are built to impress in sales calls; RestroInn is used 14 hours a day by busy staff who need clean, immediate data.

**Minimalism is the default, not an aesthetic preference.** Every superfluous pixel of padding, every heavy shadow, every pillowy radius, and every decorative widget is cognitive noise the eye must process before reaching critical operational data. Treat every dense screen (tables, room racks, ledgers, POS orders, KDS queues) with disciplined information design.

---

# 1. Minimalism Discipline (Anti-Slop Standards)

Before placing any element on screen, ask: **Does removing this lose necessary information, or only decoration?** If it is decoration, remove it immediately.

### Padding & Spacing:
- **Tight & Intentional**: Use the smallest spacing value that keeps content legible, structured, and touch-safe. Do not inflate spacing to make it "airy."
- **No Blanket 4-Side Padding**: Do not arbitrarily wrap containers in `p-8` or `p-6` when `p-4` or `p-3.5` reads crisper.
- **Base Grid**: Use consistent multiples of `4px` (`gap-2`, `gap-3`, `gap-4`). Dense operational screens (tables, rosters, folios, ledgers) should resemble the efficiency of a precision spreadsheet.

### Elevation & Shadows:
- **Default to Flat**: Surfaces are flat by default (`shadow-none` or subtle `shadow-xs`). Separate layers using clean `1px` hairline borders (`border border-[#D8CEC1]/80`) or subtle background contrasts (`bg-[#FFFCF7]` over `bg-[#F7F3EC]`).
- **Restricted Shadows**: Heavy drop shadows (`shadow-lg`, `shadow-xl`, `shadow-2xl`) are strictly forbidden. Only float elements that physically sit above the page canvas: active modal overlays, command palettes, and open dropdown menus.
- **Never Stack Soft Shadows**: Never put floating card shadows underneath every grid item "to make it pop." When everything pops, nothing is readable.

### Radii & Geometry:
- **Crisp, Restrained Radii**: Interactive controls (inputs, buttons, select menus, badges) use small, crisp geometry: `rounded-md` (6px) or `rounded-lg` (8px).
- **No Pillowy Corners**: Never use `rounded-2xl`, `rounded-3xl`, or `rounded-full` cards. Pillowy corners waste valuable screen real estate and look like toy apps.
- **Consistency**: Keep the radius scale uniform across the screen.

### Zero Decorative Noise:
- **No Emojis in UI**: Never use emojis in navigation labels, table columns, card headers, alert boxes, or modal dialogs.
- **No Decorative Icon Soup**: Icons must serve a functional purpose (e.g. search, edit, delete, inspect) or replace a label. Never place a decorative icon next to every single table header or sentence.
- **No Gradients, Orbs, or Radial Meshes**: Never use harsh multi-color gradients, neon accents, liquid frosted blobs, or background dot grids.
- **Honest Empty States**: If a table has no records, display a simple, clear message with an actionable button. Do not fill empty space with cartoon illustrations.

### Height & Information Density:
- Keep table rows compact (`py-2.5` to `py-3`), form inputs compact (`py-1.5` to `py-2`), and header banners modest.
- A Super Admin scanning 50 businesses or a cashier scanning 100 products needs data density over empty whitespace.

---

# 2. RestroInn Visual Identity & Semantic Tokens

Our color identity is institutional, warm, and distinctly hospitality-grade — avoiding cold generic blue/white templates.

### Primary Palette:
- **Deep Burgundy (Primary Brand & Accent)**: `#6B2837`
  - Hover / Pressed State: `#521E2A`
  - Subtle Tint / Active Background: `#FAF2F4` or `#6B2837]/10`
  - Border Accent: `#E8D7DA`
- **Warm Ivory (Page Canvas / Background)**: `#F7F3EC`
- **Porcelain (Elevated Card Surfaces & Inputs)**: `#FFFCF7`
- **Sandstone (Crisp 1px Borders & Dividers)**: `#D8CEC1` / `#EEE7DD`
- **Espresso Dark Slate (Primary Headings & Text)**: `#292320`
- **Muted Stone (Secondary Text & Table Labels)**: `#71675E`

### Semantic Feedback Palette:
Color is reserved strictly for functional meaning, never arbitrary decoration:
- **Success / Active / Paid**: Emerald (`bg-emerald-50 text-emerald-800 border-emerald-200`)
- **Warning / At Risk / Attention**: Amber (`bg-amber-50 text-amber-800 border-amber-200`)
- **Danger / Critical / Expired / Void**: Rose/Crimson (`bg-rose-50 text-rose-800 border-rose-200`)
- **Information / Neutral**: Stone/Burgundy (`bg-[#FAF2F4] text-[#6B2837] border-[#E8D7DA]`)

### Typography:
- **Font Family**: San Francisco / System Sans (`system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`).
- **Tabular Figures**: Always apply `tabular-nums` to financial amounts (NPR/USD), invoice numbers, dates, times, room numbers, and quota statistics.
- **Hierarchy**:
  - Page Title: `text-xl` or `text-2xl font-bold tracking-tight text-[#292320]`
  - Section Title: `text-sm font-bold text-[#292320]`
  - Table Header: `text-[10px] font-semibold text-[#71675E] uppercase tracking-wider`
  - Table Body / Inputs: `text-xs font-medium text-[#292320]`
  - Metadata / Help text: `text-[11px] text-[#71675E]`

---

# 3. Who You Are Designing For (Hospitality Roles)

1. **Super Administrator / Platform Admin**:
   - Oversees multi-tenant infrastructure, tenant billing, quotas, approvals, subscription expirations, modules, and platform audit logs. Needs density, instant filters, and bulk operations.
2. **Hotel / Restaurant Owner**:
   - Owns the business. Needs financial oversight, multi-branch performance, revenue analytics, and staff access control.
3. **Property / General Manager**:
   - Manages daily inventory, table turnovers, housekeeping, staff shifts, supplier purchases, and room occupancy. Needs speed and exception handling.
4. **Cashier / POS Billing Operator**:
   - High-volume transaction operator during peak hours. Needs instant keyboard shortcuts, low-click checkouts, split bills, and zero UI lag.
5. **Kitchen Display System (KDS) Chef**:
   - Kitchen staff viewing incoming order tickets. Needs large order numbers, elapsed time alerts, modifier badges, and 1-tap order bump.
6. **Front Desk Receptionist**:
   - Checks guests in and out, assigns rooms, manages guest folios, and records payments. Needs clear tape charts and immediate reservation search.

---

# 4. Dense Data UX (Tables, Queues, Rosters, Ledgers)

Dense operational screens are the heart of RestroInn:
1. **Instant Scanning**: Numerals right-aligned with `tabular-nums`. Statuses paired with both text and color pill (never color alone).
2. **Integrated Multi-Format Export**: Place the universal `ExportDropdown` (Excel, CSV, PDF, Word) in the top-right corner of every major data table.
3. **Immediate Search & Filter**: Search inputs and category filters must sit directly above the table header with 0 latency.
4. **Compact Row Heights**: Rows should not exceed `44px` height unless displaying multi-line guest notes or item modifiers.

---

# 5. Content, Microcopy & Voice

- **Hospitality Terminology**: Speak the language of restaurants and hotels — "Guest Folio", "Room Rack", "Table Floor", "Cover", "KDS Ticket", "Invoice", "Tenant".
- **Specific Action Verbs**: Use explicit button labels:
  - *"Approve Registration"*, not *"Submit"*
  - *"Extend Subscription"*, not *"Continue"*
  - *"Settle Folio"*, not *"OK"*
  - *"Dispatch Renewal Reminder"*, not *"Send"*
- **Audit Rationale Requirement**: Any destructive or administrative override (suspending a tenant, extending a trial, adjusting a balance) requires a mandatory reason input (>= 5 chars).
- **Constructive Error Voice**: State clearly what happened and how to proceed without blame:
  - *"Unable to record payment: Selected folio balance is already settled."*
  - Never display raw stack traces, unformatted SQL errors, or generic *"Error 500"*.

---

# 6. Design Review Checklist

Before finishing any screen, component, or workflow in RestroInn, verify:
- [ ] Is it using our Warm Ivory (`#F7F3EC`), Porcelain (`#FFFCF7`), Sandstone (`#D8CEC1`), and Deep Burgundy (`#6B2837`) palette?
- [ ] Are all drop shadows removed except for floating modals and dropdowns?
- [ ] Are all corners crisp `rounded-md` or `rounded-lg` (no pillowy `rounded-2xl`/`3xl`)?
- [ ] Are emojis completely absent from all labels, buttons, and badges?
- [ ] Are monetary figures and dates formatted with `tabular-nums`?
- [ ] Is spacing tight and intentional with no dead space or oversized margins?
- [ ] Does every button state exactly what action will occur?
- [ ] Is keyboard focus and high color contrast maintained throughout?
