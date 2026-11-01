# Phase 5 Frontend Survey: Hotel Inventory, Rooms & Guest Stays
**Author:** p5_explorer_frontend (Explorer UI/UX Specialist)  
**Target:** Phase 5 Hotel Stays & Rooms (`docs/hospitality/phases/PHASE_5_HOTEL_STAYS_ROOMS.md`, `c:\projects\pos\.agents\teamwork\ORIGINAL_REQUEST.md`)  
**Design Reference:** `.agent/skill/uiuxskills.md` ("Refined Hospitality Ergonomics")  
**Handoff File Path:** `c:\projects\pos\.agents\teamwork\p5_explorer_frontend\handoff.md`  

---

## 1. Observation

Direct code and architectural inspection across the repository revealed the following concrete findings:

### 1.1 Monorepo Architecture & Proxy Rewrites
- The project is a monorepo consisting of:
  - `frontend/`: Next.js 16.2.9, React 19.2.4, Tailwind CSS v4, Lucide React 1.24.0, Framer Motion 12.40.0.
  - `backend/`: Next.js 16 App Router running on port 3001 (`http://localhost:3001`).
  - `packages/db`: Prisma 6.19.3 ORM client and database migration scripts.
- In `frontend/next.config.ts:16-28`:
  ```ts
  async rewrites() {
    const backendUrl = process.env.BACKEND_URL || "http://localhost:3001";
    return [
      {
        source: "/api/v1/:path*",
        destination: `${backendUrl}/api/v1/:path*`,
      },
      {
        source: "/api/docs/:path*",
        destination: `${backendUrl}/api/docs/:path*`,
      },
    ];
  }
  ```
  **Direct Implication:** Any frontend call to `/api/v1/hotel/*` is transparently proxied to the backend on port 3001 while preserving session authentication cookies and request headers.

### 1.2 Current Sidebar Navigation State (`frontend/src/lib/nav-config.ts`)
- Inspection of `frontend/src/lib/nav-config.ts:53-87` reveals that while `Restaurant` navigation is integrated (lines 62-87 with Tables, POS, and KDS), there is **zero existing navigation for Hotel**:
  ```ts
  // Restaurant Dining - Available to Cashier, Manager, Owner
  {
    title: "Restaurant",
    icon: UtensilsCrossed,
    roles: ["OWNER", "MANAGER", "CASHIER"],
    children: [
      {
        title: "Tables and Floors",
        href: "/dashboard/restaurant/tables",
        icon: Store,
        roles: ["OWNER", "MANAGER", "CASHIER"],
      },
      ...
    ],
  },
  ```
- Tool verification confirmed that `lucide-react` exports all required hospitality icons: `Hotel`, `Bed`, `CalendarCheck`, `Key`, `Sparkles`.

### 1.3 RestroInn Design Tokens & Color Palette (`frontend/src/app/globals.css`)
- In `frontend/src/app/globals.css:6-117`, RestroInn semantic tokens are defined:
  - Primary Burgundy: `--color-burgundy: #6B2837;` / `--color-burgundy-hover: #541E2A;`
  - Background Neutral: `--color-ivory: #F7F3EC;` (Warm ivory)
  - Card & Surface: `--color-porcelain: #FFFCF7;`
  - Border Neutral: `--color-sandstone: #D8CEC1;`
  - Text Primary: `--color-espresso: #292320;`
  - Text Secondary: `--color-warmgray: #71675E;`
  - Accent Brass: `--color-brass: #A77B38;`
- In `docs/hospitality/phases/PHASE_5_HOTEL_STAYS_ROOMS.md:32` and `ORIGINAL_REQUEST.md:115-119`, four authoritative room state colors are mandated:
  1. **Vacant Clean**: Soft forest / Emerald
     - Hex: `#28634B` (Text/Icon), `#EAF3EE` (Background), `#C3DED0` (Border)
  2. **Occupied**: Soft burgundy (`#6B2837`)
     - Hex: `#6B2837` (Text/Bar background), `#F5EAEB` (Light background tint), `#E2BAC1` (Border), `#FFFFFF` (Text on bar)
  3. **Vacant Dirty**: Soft ochre / Amber
     - Hex: `#946000` (Text/Icon), `#FDF5E7` (Background), `#EDD7AD` (Border)
  4. **Maintenance / Out of Service**: Soft red
     - Hex: `#B33432` (Text/Icon), `#FBEBEB` (Background), `#F2C2C2` (Border)
  5. **Confirmed Reservation** (Supporting token): Soft blue
     - Hex: `#315F85` (Text), `#EDF4F9` (Background), `#B8D2E6` (Border)

### 1.4 Existing Dashboard and Component Patterns
- `frontend/src/app/dashboard/restaurant/tables/page.tsx:89-120`: Shows how status badges and filters are styled with high-contrast pills.
- `frontend/src/components/restaurant/split-bill-sheet.tsx:94-96`: Uses a clean backdrop drawer pattern:
  `fixed inset-0 z-50 flex items-center justify-center bg-espresso/40 p-4 backdrop-blur-xs`
- `frontend/src/lib/currency.ts:1-85`: Established financial arithmetic using integer cents (`toCents`, `fromCents`, `formatMoney`, `mulMoney`, `addMoney`) eliminating binary floating-point drift.
- `package.json` in `frontend/`: Verified `framer-motion@12.40.0`, `lucide-react@1.24.0`, `react-hook-form@7.78.0`, `zod@4.4.3`.
- Typecheck status: Running `npm.cmd run typecheck` succeeds with code 0 across the monorepo.

---

## 2. Logic Chain

1. **Premise 1 (Hospitality UX Invariant)**: In hotel operations, front-desk staff need instant, zero-click visibility of room occupancy across time (Tape Chart / Room Rack), rapid guest check-in (sub-60-second Fast Check-In drawer), atomic room transfers during guest complaints, and clean status coordination with housekeeping (dirty upon checkout; only clean after inspection).
2. **Premise 2 (Design System Compliance)**: RestroInn has strict brand identity rules (`#6B2837` Deep Burgundy, `#F7F3EC` Warm Ivory, `#292320` Espresso, `#D8CEC1` Sandstone) and color tokens for hotel room statuses. Re-using generic Tailwind colors (like vivid neon green or purple) would break visual cohesion and fail specification R4.
3. **Premise 3 (API Proxy Alignment)**: Backend routes under `backend/src/app/api/v1/hotel/` are exposed transparently at `/api/v1/hotel/` on the frontend. The frontend API client should use standardized types matching the Prisma models (`Room`, `RoomType`, `Reservation`, `Stay`, `RoomAllocation`, `HousekeepingTask`, `MaintenanceTicket`).
4. **Premise 4 (Next.js 16 Client Conventions)**: Next.js 16 requires client components to be explicitly annotated with `"use client"`. Server page components passing route params receive Promises. All interactive dashboard views (Tape Chart, Fast Check-In, Housekeeping Grid) must be client components utilizing React 19 hooks and `@/lib/currency`.
5. **Inference 1 (Dedicated Hotel Navigation)**: `frontend/src/lib/nav-config.ts` must be extended with a top-level `Hotel` item with role access `["OWNER", "MANAGER", "CASHIER"]` containing links to:
   - `/dashboard/hotel/rooms` (Tape Chart & Inventory)
   - `/dashboard/hotel/stays` (Active In-House Stays & Fast Check-In)
   - `/dashboard/hotel/reservations` (Future Bookings)
   - `/dashboard/hotel/housekeeping` (Housekeeping & Maintenance Board)
6. **Inference 2 (Component Modularization)**: Rather than cramming all functionality into monolithic page files, the frontend architecture must split into reusable components:
   - `TapeChartMatrix` (timeline grid with date-navigation, sticky room headers, multi-day stay bars)
   - `FastCheckInDrawer` (slide-over modal with guest identity, room assignment, rate plan, advance deposit)
   - `StayActionsModal` (atomic room transfer, stay extension, checkout folio prompt)
   - `HousekeepingGrid` (one-touch status toggles: Clean, Dirty, Inspected, Maintenance block)

---

## 3. Caveats

1. **Physical Keycard Hardware Encoders (VingCard / Onity RFID)**: Direct hardware serial port communication for RFID door lock encoding is deferred; the UI provides a Keycard UID input / jacket slip printing format for front-desk staff.
2. **Phase 6 Folio Settlement Integration**: Stays capture room rate and advance deposits; comprehensive itemized split folios and city ledger transfers belong to Phase 6 (`PHASE_6_FOLIO_SETTLEMENT.md`). The Phase 5 check-out UI warns of unbilled liabilities and records completion.
3. **Read-Only Scope**: This report defines the architectural survey, component specifications, and concrete code patterns. Source code implementation will be executed by the builder agent.

---

## 4. Conclusion & Concrete Implementation Specifications

### 4.1 Navigation Configuration (`frontend/src/lib/nav-config.ts`)
Add `Hotel` immediately after `Restaurant` (lines 87-88):
```ts
// Imports to add:
import {
  Hotel,
  Bed,
  CalendarCheck,
  Key,
  Sparkles,
} from "lucide-react";

// Nav item insertion:
  // Hotel Stays & Rooms - Available to Cashier, Manager, Owner
  {
    title: "Hotel",
    icon: Hotel,
    roles: ["OWNER", "MANAGER", "CASHIER"],
    children: [
      {
        title: "Room Rack / Tape Chart",
        href: "/dashboard/hotel/rooms",
        icon: Bed,
        roles: ["OWNER", "MANAGER", "CASHIER"],
      },
      {
        title: "Check-In & Stays",
        href: "/dashboard/hotel/stays",
        icon: Key,
        roles: ["OWNER", "MANAGER", "CASHIER"],
      },
      {
        title: "Reservations",
        href: "/dashboard/hotel/reservations",
        icon: CalendarCheck,
        roles: ["OWNER", "MANAGER", "CASHIER"],
      },
      {
        title: "Housekeeping",
        href: "/dashboard/hotel/housekeeping",
        icon: Sparkles,
        roles: ["OWNER", "MANAGER", "CASHIER"],
      },
    ],
  },
```

---

### 4.2 Room Rack / Tape Chart Matrix (`frontend/src/app/dashboard/hotel/rooms/page.tsx` & `tape-chart-matrix.tsx`)

#### Layout & Hierarchy:
- **Timeline Controls**:
  - Date window: `[ < Previous Week ]`, `[ Today ]`, `[ Next Week > ]`.
  - Span toggle: `7 Days`, `14 Days`, `30 Days`.
  - Filter Bar: Floor selector dropdown (`All Floors`, `Floor 1`, `Floor 2`), Room Type filter (`All Types`, `Deluxe`, `Suite`), Status filter.
  - Quick action: `+ Fast Check-In` button in RestroInn burgundy (`bg-burgundy hover:bg-burgundy-hover text-porcelain`).
- **Matrix Grid**:
  - **Left Header Column (Sticky)**:
    - Room Number (e.g., `101`, `102`), Room Type pill, Floor badge, and Current status dot.
  - **Date Columns**:
    - Day of week (Mon, Tue, Wed...) and Calendar Day (1, 2, 3...) with `Today` highlighted with burgundy top-border.
  - **Occupancy & Allocation Bars**:
    - Spans `[checkInDate, checkOutDate)` across the corresponding grid columns using CSS grid column spans.
    - Occupied stay bars: Solid soft burgundy (`bg-[#6B2837] text-white`) showing Guest Name and Stay ID.
    - Confirmed reservations: Soft blue (`bg-[#EDF4F9] text-[#315F85] border border-[#B8D2E6]`).
    - Maintenance block: Soft red hatched pattern (`bg-[#FBEBEB] text-[#B33432] border border-[#F2C2C2]`) showing "Ticket: AC Repair".
  - **Cell Actions**:
    - Clicking an empty cell on a `VACANT_CLEAN` room opens `FastCheckInDrawer` prefilled with `(roomId, checkInDate)`.
    - Clicking an empty cell on a `VACANT_DIRTY` room shows warning toast: *"Room 102 is currently dirty. Please dispatch housekeeping before check-in."* with a one-click "Mark Clean" shortcut.
    - Clicking an active stay bar opens `StayActionsModal` (Guest details, Room Transfer, Stay Extension, Checkout).

---

### 4.3 Fast Check-In Drawer (`frontend/src/components/hotel/fast-check-in-drawer.tsx`)

#### Slide-Over Drawer Structure:
- Overlay: `fixed inset-0 z-50 flex justify-end bg-espresso/40 backdrop-blur-xs`.
- Panel: `w-full max-w-xl bg-porcelain border-l border-sandstone shadow-xl flex flex-col h-full overflow-y-auto p-6 space-y-6`.
- **Form Sections**:
  1. **Stay Parameters**:
     - Room Type dropdown (auto-filters available rooms).
     - Room Number dropdown (displays only `VACANT_CLEAN` rooms with green indicator).
     - Check-in Date/Time (default: Now).
     - Check-out Date/Time (default: Tomorrow 11:00 AM).
     - Nights Counter (+ / - buttons).
     - Occupancy: Adults (1-4), Children (0-3).
  2. **Guest Identity & Profile**:
     - Full Name (required, text input).
     - Mobile / Phone Number (required, phone input).
     - Email Address (optional).
     - Identification Document: Dropdown `[Passport, Citizenship / National ID, Driving License, Other]`.
     - Identification Number (required).
     - Nationality (default: "Nepal").
  3. **Rate & Payment Plan**:
     - Base Nightly Rate (prefilled from Room Type; formatted with `formatMoney`).
     - Total Estimated Stay Amount (`nights * rate`).
     - Advance Deposit Amount input.
     - Payment Method: `[CASH, CREDIT_CARD, DIGITAL_WALLET / QR, UNPAID / DIRECT_BILL]`.
  4. **Keycard & Notes**:
     - Keycard UID / Jacket Room Slip reference.
     - Special requests (e.g., "Late check-out", "Extra towels", "Quiet room").
- **Footer**:
  - `Cancel` button (`text-warmgray hover:text-espresso`).
  - `Confirm Check-In` primary button (`bg-burgundy hover:bg-burgundy-hover text-porcelain`).
  - Sends `POST /api/v1/hotel/check-in`.

---

### 4.4 Room Management & Housekeeping Dashboard (`frontend/src/app/dashboard/hotel/housekeeping/page.tsx`)

#### Operational Views:
1. **Status KPI Counters**:
   - Total Rooms count.
   - `Vacant Clean`: Green card with count.
   - `Occupied`: Burgundy card with count.
   - `Vacant Dirty`: Amber card with count.
   - `Maintenance`: Red card with count.
2. **Room Housekeeping Grid**:
   - Filterable by Floor (`All Floors`, `Floor 1`, `Floor 2`) and Housekeeping State (`All`, `Dirty Only`, `Clean`, `Inspected`).
   - Room Cards:
     - Header: Room Number, Room Type, Floor.
     - Status Badge:
       - `CLEAN` (`bg-[#EAF3EE] text-[#28634B] border-[#C3DED0]`)
       - `DIRTY` (`bg-[#FDF5E7] text-[#946000] border-[#EDD7AD]`)
       - `INSPECTED` (`bg-[#1B4332] text-white`)
       - `MAINTENANCE` (`bg-[#FBEBEB] text-[#B33432] border-[#F2C2C2]`)
     - Assigned Housekeeper staff name.
     - One-Touch Quick Actions:
       - `Mark Clean`: Transitions status to `CLEAN`.
       - `Mark Inspected`: Supervisor sign-off.
       - `Flag Dirty`: Flag for turn-down.
       - `Maintenance`: Opens modal to create blocking maintenance ticket with start/end dates.

---

### 4.5 Stay Operations: Room Transfer, Stay Extension & Check-Out (`frontend/src/components/hotel/stay-actions-modals.tsx`)

1. **Atomic Room Transfer Dialog**:
   - Displays: Current Room (e.g. `Room 101 - Deluxe King`), In-house Guest Name.
   - Destination Room Selector: Only displays currently available `VACANT_CLEAN` rooms.
   - Reason for transfer: Mandatory audit field (e.g. "Air conditioner noise", "Guest requested high floor").
   - Action: `POST /api/v1/hotel/stays/${stayId}/transfer`. Atomically updates allocation and current stay room without losing stay history or folio items.
2. **Stay Extension Dialog**:
   - Current Check-Out date & time.
   - New Check-Out date & time picker.
   - Availability check indicator.
   - Action: `POST /api/v1/hotel/stays/${stayId}/extend`.
3. **Fast Check-Out Dialog**:
   - Summary: Guest name, nights stayed, room number.
   - Unbilled balance notification.
   - Keycard return confirmation checkbox.
   - Action: `POST /api/v1/hotel/stays/${stayId}/check-out`.
   - Result:
     - Stay transitions to `COMPLETED`.
     - Room status transitions to `VACANT_DIRTY`.
     - Automatically creates a new `HousekeepingTask` with `DIRTY` status.

---

### 4.6 Frontend API Client Specification (`frontend/src/lib/hotel-api.ts`)

```ts
export interface RoomType {
  id: string;
  name: string;
  code: string;
  baseRate: string | number;
  maxOccupancy: number;
  amenities: string[];
  description?: string;
}

export interface Room {
  id: string;
  roomNumber: string;
  floorId: string;
  floorNumber?: number;
  roomTypeId: string;
  roomType?: RoomType;
  status: "VACANT_CLEAN" | "VACANT_DIRTY" | "OCCUPIED_CLEAN" | "OCCUPIED_DIRTY" | "OUT_OF_SERVICE" | "MAINTENANCE";
  currentStay?: StaySummary | null;
}

export interface StaySummary {
  id: string;
  stayNumber: string;
  guestName: string;
  guestPhone: string;
  checkInTime: string;
  expectedCheckOutTime: string;
  status: "ACTIVE" | "COMPLETED" | "EXTENDED" | "TRANSFERRED";
}

export interface TapeChartAllocation {
  id: string;
  roomId: string;
  type: "STAY" | "RESERVATION" | "MAINTENANCE";
  guestName?: string;
  referenceNumber: string;
  startDate: string; // ISO
  endDate: string;   // ISO
  status: string;
}

export interface FastCheckInPayload {
  roomId: string;
  roomTypeId?: string;
  checkInDate: string;
  checkOutDate: string;
  guest: {
    name: string;
    phone: string;
    email?: string;
    idType: string;
    idNumber: string;
    nationality?: string;
  };
  ratePlan?: string;
  nightlyRate: string;
  advanceDeposit?: string;
  paymentMethod?: string;
  keycardNumber?: string;
  specialRequests?: string;
}
```

---

## 5. Verification Method

### 5.1 Verification Commands
1. **Monorepo Typecheck**:
   ```powershell
   npm.cmd run typecheck
   ```
   Must pass with 0 TypeScript compiler errors across both `backend` and `frontend`.
2. **Frontend Production Build**:
   ```powershell
   node scripts/restro-env.mjs frontend-build
   ```
   Ensures all new pages, components, and imports compile cleanly with Next.js 16 App Router.
3. **Full System Verification**:
   ```powershell
   npm.cmd test
   node scripts/restro-restore-env.mjs rehearse
   ```

### 5.2 Visual & Inspection Checklist
1. Open Sidebar in `/dashboard` -> Verify `Hotel` section is visible with `Hotel` icon.
2. Expand `Hotel` -> Verify 4 children:
   - `Room Rack / Tape Chart` (`/dashboard/hotel/rooms`)
   - `Check-In & Stays` (`/dashboard/hotel/stays`)
   - `Reservations` (`/dashboard/hotel/reservations`)
   - `Housekeeping` (`/dashboard/hotel/housekeeping`)
3. Verify token color adherence:
   - Vacant Clean: Emerald (`#28634B` on `#EAF3EE`)
   - Occupied: Burgundy (`#6B2837`)
   - Vacant Dirty: Ochre / Amber (`#946000` on `#FDF5E7`)
   - Maintenance: Soft red (`#B33432` on `#FBEBEB`)
4. Invalidation conditions: Any use of raw float math instead of `@/lib/currency`, any neon/inconsistent colors, or broken navigation roles will invalidate this verification.
