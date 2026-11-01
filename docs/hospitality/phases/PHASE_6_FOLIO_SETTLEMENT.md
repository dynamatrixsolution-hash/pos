# Phase 6: Guest Folios & Cross-Module Combined Settlement

> **Status**: Completed & Verified.
> **Dependencies**: Phase 3 (Restaurant Orders) & Phase 5 (Hotel Stays).

## 1. Objectives & Scope
- Maintain authoritative `GuestFolio` records per stay (including split-folio windows: `PRIMARY`, `COMPANY`, `PERSONAL`, `INCIDENTALS`) capturing all accommodation, dining, minibar, laundry, spa, and incidental charges.
- Implement the **"Charge to Room" Bridge**: Dining orders (`RestaurantOrder`) post an accounts-receivable transfer (`postingKind: "RECEIVABLE_TRANSFER"`, `isRevenueRecognizedHere: false`) to the stay folio without creating duplicate food revenue.
- Support automated daily night audit and room-night charge postings (`RoomNightCharge`).
- Enforce a checkout `SETTLING` lock preventing concurrent late charges from attaching during front-desk settlement, and provide unified multi-tender split settlement (`FolioSettlementAllocation`).

---

## 2. Key Entities & Schema Additions
Added 4 multi-tenant folio models to [`packages/db/prisma/schema.prisma`](file:///c:/projects/pos/packages/db/prisma/schema.prisma) with composite `@@unique([businessId, id])` keys and acyclic DAG design (`FolioEntry.reversedEntryId` maintained as a scalar logical reference) for disaster recovery:
1. `GuestFolio`: Financial accumulator tied to a `Stay` and `windowName` (`@@unique([businessId, stayId, windowName])`), tracking `chargesTotal`, `creditsTotal`, `paymentsTotal`, `balance` (`@db.Decimal(12, 2)`), `status` (`OPEN`, `SETTLING`, `CLOSED`, `VOID`), and optimistic concurrency `version`.
2. `RoomNightCharge`: Daily recurring accommodation charge with `@@unique([businessId, stayId, chargeDate])` preventing duplicate night-audit postings for the same stay and date.
3. `FolioEntry`: Immutable charge, receivable transfer, credit adjustment, or reversal entry linked to a canonical source (`@@unique([businessId, sourceType, sourceId, postingKind])`) with explicit `direction` (`DEBIT` | `CREDIT`) and `isRevenueRecognizedHere` (`Boolean`).
4. `FolioSettlementAllocation`: Multi-tender settlement payment (`CASH`, `CARD`, `QR`, `BANK_TRANSFER`, `DEPOSIT`) applied against folio balances.

---

## 3. Revenue Invariants & Accounting Contracts Enforced
- **Zero Duplicate Revenue on "Charge to Room"**:
  - A food order of Rs. 2,000 posted to Room 302 recognizes restaurant food revenue once on `RestaurantOrder`.
  - `postRestaurantOrderToFolio` creates a `FolioEntry` with `sourceType: "RESTAURANT_ORDER"`, `postingKind: "RECEIVABLE_TRANSFER"`, `category: "DINING"`, and `isRevenueRecognizedHere: false`.
  - Retrying the same food order to the same stay replays idempotently (`idempotentReplay: true`) via `@@unique([businessId, sourceType, sourceId, postingKind])`; attempting to post an already-charged order to another stay rejects with `409 Conflict` (`ORDER_ALREADY_CHARGED`).
  - Settling the folio at hotel check-out clears the receivable via `FolioSettlementAllocation` and never creates a second food `Sale` or `Income` record (`doubleCountedRevenue === "0.00"`).
- **Credit Adjustments & Reversals**:
  - Voiding or adjusting a dining or room charge after folio posting generates an offsetting `CREDIT` `FolioEntry` (`postingKind: "CREDIT_ADJUSTMENT"` or `"REVERSAL"`, `reversedEntryId`) that reduces the folio balance accurately once.
- **Posting Lock on Checkout (`SETTLING`)**:
  - `lockFolioForCheckout` transitions the folio to `status: "SETTLING"`. Any concurrent restaurant order or manual charge attempting to attach while `SETTLING` or `CLOSED` is rejected with `409 Conflict` (`FOLIO_SETTLING_LOCKED` / `FOLIO_LOCKED`).
- **Room Transfer Continuity**:
  - Room transfers preserve the stay's `GuestFolio` identity, number, entries, and balance without modification.

---

## 4. Implemented Services, API Endpoints & UI/UX
- **Domain Services ([`backend/src/lib/services/folio-service.ts`](file:///c:/projects/pos/backend/src/lib/services/folio-service.ts))**:
  - `ensureGuestFolio`, `getFoliosForStay`, `getAllFolios`, `getFolioById`, `recalculateFolioTotals`
  - `lockFolioForCheckout`, `unlockFolio`
  - `postRoomNightCharge`, `runNightAuditForBranch`
  - `postManualFolioCharge`, `postRestaurantOrderToFolio`
  - `reverseOrAdjustFolioEntry`, `transferFolioEntryBetweenWindows`
  - `settleGuestFolio`, `getFolioAccountingReconciliation`
- **REST API Endpoints (`backend/src/app/api/v1/hotel/`)**:
  - [`GET, POST /api/v1/hotel/folios`](file:///c:/projects/pos/backend/src/app/api/v1/hotel/folios/route.ts)
  - [`GET, PATCH /api/v1/hotel/folios/[id]`](file:///c:/projects/pos/backend/src/app/api/v1/hotel/folios/%5Bid%5D/route.ts)
  - [`POST /api/v1/hotel/folios/[id]/charges`](file:///c:/projects/pos/backend/src/app/api/v1/hotel/folios/%5Bid%5D/charges/route.ts)
  - [`POST /api/v1/hotel/folios/[id]/charge-order`](file:///c:/projects/pos/backend/src/app/api/v1/hotel/folios/%5Bid%5D/charge-order/route.ts)
  - [`POST /api/v1/hotel/folios/[id]/entries/[entryId]/reverse`](file:///c:/projects/pos/backend/src/app/api/v1/hotel/folios/%5Bid%5D/entries/%5BentryId%5D/reverse/route.ts)
  - [`POST /api/v1/hotel/folios/[id]/entries/[entryId]/transfer`](file:///c:/projects/pos/backend/src/app/api/v1/hotel/folios/%5Bid%5D/entries/%5BentryId%5D/transfer/route.ts)
  - [`POST /api/v1/hotel/folios/[id]/settle`](file:///c:/projects/pos/backend/src/app/api/v1/hotel/folios/%5Bid%5D/settle/route.ts)
  - [`POST /api/v1/hotel/night-audit`](file:///c:/projects/pos/backend/src/app/api/v1/hotel/night-audit/route.ts)
- **Hospitality UI/UX ([`frontend/src/app/dashboard/hotel/folios/page.tsx`](file:///c:/projects/pos/frontend/src/app/dashboard/hotel/folios/page.tsx))**:
  - Chronological itemized Folio Ledger with category filters (`ALL`, `ROOM`, `DINING`, `MINIBAR`, `LAUNDRY`, `SPA`, `OTHER`) and revenue/receivable provenance tags.
  - Split-Folio Window tabs (`PRIMARY`, `COMPANY`, `PERSONAL`, `INCIDENTALS`) and one-click inter-window charge transfer.
  - Charge Restaurant Order to Room modal, Night Audit runner, Void/Credit Adjust modal, Checkout `SETTLING` lock toggle, Multi-Tender Split Settlement modal, and printable **80mm ESC/POS & A4 Hotel Folio Tax Invoice** preview.
  - Sidebar navigation updated in [`frontend/src/lib/nav-config.ts`](file:///c:/projects/pos/frontend/src/lib/nav-config.ts).

---

## 5. Verification Evidence

| Test Suite / Command | Scope | Result |
| :--- | :--- | :---: |
| `tests/phase6-folio-settlement.integration.test.ts` | Night audit & duplicate rejection (`409`), Charge-to-Room bridge with zero duplicate revenue & idempotent replay, credit adjustments, split-folio window transfers, `SETTLING` lock, multi-tender settlement, room-transfer folio continuity | **5/5 PASSED** |
| `tests/phase5-hotel-stays.integration.test.ts` | 10-way concurrent GiST exclusion, check-in, atomic room transfer, checkout dirty transition, maintenance blocks, extension conflict rollback | **6/6 PASSED** |
| `npm test` | All unit & invariant test suites (13 test files) | **136/136 PASSED** |
| `scripts/restro-restore-env.mjs rehearse` | 79-model disaster recovery rehearsal, topological sort, tenant isolation | **41/41 PASSED** |
| `npm run typecheck` | Cross-workspace strict TypeScript typecheck (`backend` + `frontend`) | **0 ERRORS** |
