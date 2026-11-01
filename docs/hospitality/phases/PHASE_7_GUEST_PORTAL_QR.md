# Phase 7: Guest Self-Service Portal & Location QR System

> **Status**: Completed & Verified (2026-11-01).
> **Dependencies**: Phase 3 (Menu/Orders), Phase 5 (Hotel Stays & Rooms) & Phase 6 (Folios).

## 1. Objectives & Delivered Architecture
- **Permanent Physical QR Codes (`QrLocation`)**: Deployed opaque physical QR identifiers (`QRL-RM-*` and `QRL-TB-*`) bound to hotel rooms (`Room`) and restaurant tables (`RestaurantTable`), carrying zero stay secrets or reusable guest credentials.
- **Mobile-First Zero-Install Guest Portal (`/guest/qr/[publicCode]`)**: Built a high-contrast warm ivory & porcelain mobile web application for browsing digital menus, customizing modifiers, initiating orders, tracking live kitchen preparation, submitting service requests, and reviewing verified room folios.
- **Strict Occupant Turnover Privacy**: Guaranteed that scanning a physical Room QR never exposes guest names, phone numbers, folio balances, or prior orders until guest verification succeeds, and that Front Desk checkout atomically revokes all active `GuestAccessGrant` and `GuestSession` tokens.
- **Abuse Prevention & Rate Limiting**: Enforced a strict 1-call-per-3-minutes cooldown per `QrLocation` on digital waiter calls (`429 RATE_LIMIT_EXCEEDED`) with idempotency key deduplication.

## 2. Key Entities & Schema Additions (`202611010005_phase7_guest_portal_qr`)
- [`QrLocation`](file:///c:/projects/pos/packages/db/prisma/schema.prisma#L2075-L2104): Opaque physical QR identifier (`publicCode`) bound to a `Room` or `RestaurantTable`, with `rotationCount`, `isActive`, and tenant-scoped uniqueness (`@@unique([businessId, roomId])`, `@@unique([businessId, tableId])`).
- [`GuestAccessGrant`](file:///c:/projects/pos/packages/db/prisma/schema.prisma#L2106-L2136): Ephemeral authorization grant (`STAY_VERIFIED` or `TABLE_OPEN`) storing a SHA-256 `grantCodeHash`, explicit `scopes` (`MENU_BROWSE`, `ORDER_INITIATE`, `SERVICE_REQUEST`, `BILL_VIEW`, `CHECKOUT_REQUEST`), masked `guestDisplayName`, and `expiresAt`.
- [`GuestSession`](file:///c:/projects/pos/packages/db/prisma/schema.prisma#L2138-L2164): Time-bounded device session storing a SHA-256 `sessionTokenHash` linked to an active `GuestAccessGrant`, `Stay`, or `TableSession`.
- [`ServiceRequest`](file:///c:/projects/pos/packages/db/prisma/schema.prisma#L2166-L2211): Guest-initiated requests (`WAITER_CALL`, `WATER_REFILL`, `BILL_REQUEST`, `EXTRA_TOWELS`, `HOUSEKEEPING`, `ROOM_AMENITIES`, `CHECKOUT_REQUEST`, `OTHER`) routed by department (`RESTAURANT`, `HOUSEKEEPING`, `FRONT_DESK`, `CONCIERGE`) with `OPEN` ➔ `ACKNOWLEDGED` ➔ `IN_PROGRESS` ➔ `COMPLETED` lifecycle tracking.

## 3. Strict Security & Privacy Invariants Enforced
1. **Zero-Secret Physical Plaques**: [`resolvePublicQrLocation`](file:///c:/projects/pos/backend/src/lib/services/guest-portal-service.ts) returns only public property/branch metadata, the Google Review URL, and the active digital menu catalog—never leaking occupant PII, stay IDs, folios, or orders.
2. **Room Guest Verification Gate**: [`verifyAndCreateGuestSession`](file:///c:/projects/pos/backend/src/lib/services/guest-portal-service.ts) verifies the active in-house `Stay` on the scanned room using Guest Last Name and/or Phone Last-4 Digits before issuing a hashed `STAY_VERIFIED` grant and session token.
3. **Atomic Revocation & Rebinding Across Stay Lifecycle**:
   - **Checkout**: [`checkOutStay`](file:///c:/projects/pos/backend/src/lib/services/hotel-checkout-service.ts) atomically revokes all active `GuestAccessGrant` and `GuestSession` rows inside the checkout transaction (`revokeGuestAccessForStay`).
   - **Room Transfer**: [`transferRoom`](file:///c:/projects/pos/backend/src/lib/services/hotel-room-transfer-service.ts) atomically rebinds active guest grants, sessions, and open service requests to the target room's `QrLocation` (`rebindGuestAccessOnRoomTransfer`), detaching the vacated room's QR.
   - **Stay Extension**: [`extendStay`](file:///c:/projects/pos/backend/src/lib/services/hotel-checkin-service.ts) extends `expiresAt` on active grants and sessions (`extendGuestAccessForStay`).
   - **Table Close & Merge**: [`closeTableSession`](file:///c:/projects/pos/backend/src/lib/services/table-session-service.ts) revokes table QR sessions on close, and [`mergeTableSessions`](file:///c:/projects/pos/backend/src/lib/services/table-session-service.ts) rebinds sessions to the target table session.
4. **Canonical Pricing & Staff Acceptance Gate**: [`submitGuestOrder`](file:///c:/projects/pos/backend/src/lib/services/guest-portal-service.ts) computes canonical server-side price snapshots from `MenuItem` and `ModifierOption` records and initiates orders with `acceptanceStatus: "PENDING"`, requiring cashier/waiter confirmation before kitchen routing.
5. **Express Checkout Safety**: Submitting a `CHECKOUT_REQUEST` creates a high-priority `FRONT_DESK` `ServiceRequest` and never silently checks out the `Stay`.

## 4. Delivered API Endpoints & UI Surfaces
- **Public Guest APIs**:
  - [`GET /api/v1/guest/qr/[publicCode]`](file:///c:/projects/pos/backend/src/app/api/v1/guest/qr/%5BpublicCode%5D/route.ts)
  - [`POST /api/v1/guest/verify`](file:///c:/projects/pos/backend/src/app/api/v1/guest/verify/route.ts)
  - [`GET /api/v1/guest/session`](file:///c:/projects/pos/backend/src/app/api/v1/guest/session/route.ts)
  - [`GET & POST /api/v1/guest/orders`](file:///c:/projects/pos/backend/src/app/api/v1/guest/orders/route.ts)
  - [`POST /api/v1/guest/service-requests`](file:///c:/projects/pos/backend/src/app/api/v1/guest/service-requests/route.ts)
- **Staff Management APIs**:
  - [`GET & POST /api/v1/hotel/qr-locations`](file:///c:/projects/pos/backend/src/app/api/v1/hotel/qr-locations/route.ts)
  - [`GET /api/v1/hotel/service-requests`](file:///c:/projects/pos/backend/src/app/api/v1/hotel/service-requests/route.ts)
  - [`PATCH & PUT /api/v1/hotel/service-requests/[id]`](file:///c:/projects/pos/backend/src/app/api/v1/hotel/service-requests/%5Bid%5D/route.ts)
- **Frontend Views**:
  - [`/guest/qr/[publicCode]`](file:///c:/projects/pos/frontend/src/app/guest/qr/%5BpublicCode%5D/page.tsx): Mobile-first Guest Self-Service Portal with Digital Menu, 3-stage Live Order Tracker (`Order Received` ➔ `Cooking` ➔ `On Its Way`), 1-tap Service Requests with 3-minute cooldown timer, and Verified Folio Review.
  - [`/dashboard/hotel/qr-portal`](file:///c:/projects/pos/frontend/src/app/dashboard/hotel/qr-portal/page.tsx): Staff Guest Service Desk & Physical QR Plaque Generator with printable room plaques and table tents.

## 5. Verification Evidence
- **Phase 7 Integration & Exit Criteria Suite** ([`tests/phase7-guest-portal-qr.integration.test.ts`](file:///c:/projects/pos/tests/phase7-guest-portal-qr.integration.test.ts)): **6/6 passed** (`node scripts/restro-env.mjs guest-qr-test`):
  1. Topological DAG & `backupModels` verification across all 83 tenant models.
  2. Permanent opaque QR deployment for rooms and tables with zero stay secret leakage.
  3. Room guest verification (`Last Name` + `Phone Last 4`), canonical server-priced QR ordering, live tracker progression (`ORDER_RECEIVED` ➔ `COOKING` ➔ `ON_ITS_WAY`), and folio bill review.
  4. Seamless guest session preservation across room transfer (`104` ➔ `105`) while detaching vacated Room 104 QR.
  5. **Exit Criterion — Room QR Occupant Turnover Privacy**: Checkout atomically invalidates prior occupant tokens (`401`), and a new occupant scanning the exact same Room QR cannot view prior bills, names, or orders.
  6. **Exit Criterion — Table QR Draft Orders & Waiter Call Rate Limiting**: Table QR orders initiate as `PENDING` acceptance, idempotent retries deduplicate cleanly, and repeated waiter calls within 3 minutes are throttled with `429 RATE_LIMIT_EXCEEDED`.
- **Disaster Recovery Rehearsal**: **41/41 checks passed** across all **83 tenant models** (`node scripts/restro-restore-env.mjs rehearse`).
- **Typecheck & Unit Suite**: `npm run typecheck` passed with **0 errors** across backend and frontend; `npm test` passed **137/137 tests**.
