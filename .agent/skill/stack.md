# RestroInn Technology Stack & Architecture Standards

> **Scope**: Authoritative definition of all libraries, runtimes, database constraints, backend patterns, and integration standards used in **RestroInn** across the hospitality, restaurant, and hotel expansion phases outlined in `docs/hospitality/IMPLEMENTATION_PLAN.md`.

---

## 1. Core Runtime & Monorepo Structure

* **Package Manager / Monorepo**: npm workspaces with Node.js 20+ (Active runtime: Node 24 with locked dependencies).
* **Workspace Structure**:
  * `frontend/`: Next.js 16 (App Router), client components, POS terminal, staff dashboards, guest portal.
  * `backend/`: Next.js 16 Route Handlers acting as edge/node REST API service (`/api/v1/...`).
  * `packages/db/`: Prisma ORM schema, migration definitions, shared database client `@dynapos/db`.

---

## 2. Frontend Technology Stack

| Layer | Technology | Version | Purpose & Architecture Rules |
| :--- | :--- | :--- | :--- |
| **Framework** | Next.js App Router | `16.2.9` | Server Components by default; Client Components (`"use client"`) only when interactive state is required. |
| **View Engine** | React | `19.2.4` | Follow React 19 rules (no setState in effects during mount, pure render cycles, deterministic dates). |
| **Compiler** | Turbopack | Built-in | Fast Refresh & build optimization. |
| **Styling** | Tailwind CSS | `v4` | Configured via `@theme` in `globals.css`. Use semantic classes (`bg-primary`, `bg-card`, `text-foreground`). |
| **Icons** | Lucide React | `^1.24.0` | Uniform 16px (`h-4 w-4`) or 18px (`h-4.5 w-4.5`) operational iconography. |
| **Motion** | Framer Motion | `^12.40.0` | Restricted to dialog modals, drawer slide-outs, and toast alerts. Zero animations on fast cashier buttons. |
| **Forms** | React Hook Form + Zod | `^7.78.0` / `^4.4.3` | Schema-driven form validation with inline error states and disable-on-submit safeguards. |
| **Reporting / Export** | jsPDF, docx, xlsx | Latest | Client-side audit reports, thermal bill previews, and inventory spreadsheet exports. |
| **Barcode / Scanner** | html5-qrcode | `^2.3.8` | Camera-based barcode and QR scanning. |

---

## 3. Backend & API Architecture

| Layer | Technology | Guidelines & Rules |
| :--- | :--- | :--- |
| **API Endpoints** | Next.js Route Handlers | Located in `backend/src/app/api/v1/`. Strictly thin controllers that parse input, check authorization, and delegate to domain services. |
| **Authentication** | Auth.js (NextAuth v5 beta) | Session tokens validated against database authority on sensitive paths. No client-forged roles or branch claims. |
| **Idempotency** | Custom `Idempotency-Key` Engine | Mandatory for all state-mutating POST commands (Checkout, Payments, Notes, Adjustments, Room Bookings). Bound to `RequestResult`. |
| **Concurrency** | Serializable Transactions | Handled via `serializableTransaction` helper with exponential backoff on Prisma P2034 conflicts (max 4 attempts). |
| **Outbox Pattern** | Transactional Outbox | `OutboxEvent` written atomically with domain writes; decoupled workers deliver kitchen tickets and printer jobs. |

---

## 4. Database & Persistence Layer

* **Engine**: PostgreSQL 15+ (Alpine container for local development and CI).
* **ORM**: Prisma `6.19.3` with custom SQL migrations for advanced relational constraints.
* **Strict Financial Invariants**:
  * **No Float for Money**: All currency amounts, ledger entries, tax lines, and balances must use `Decimal` with explicit 2-digit retail rounding.
  * **Composite Tenant Integrity**: All branch-scoped tables enforce composite unique constraints `(businessId, id)` to prevent cross-tenant ID leakage.
  * **PostgreSQL GiST Exclusion Constraints**:
    * Used for **Hotel Room Allocations** (`RoomAllocation`).
    * Range: `tstzrange(start, end, '[)')`.
    * Requires `btree_gist` extension in PostgreSQL to prevent overlapping bookings for the same room. Authoritative in DB, not just application code.
  * **Immutable Financial Ledgers**: No hard deletion of sales, invoices, payment records, or audit trails. Reversals and refunds are explicit offset records.

---

## 5. Hardware & Operations Integration

* **Thermal Printing**:
  * Dual-format ESC/POS: 80mm wide (restaurant dine-in guest check & hotel invoice) and 58mm narrow (quick-service receipt & KOT).
  * Web Serial API and Network/USB printer spooling.
* **Kitchen Display System (KDS)**:
  * Persistent `KitchenTicket` entities per station (Hot Kitchen, Cold Larder, Bar/Beverage).
  * Station routing configured per MenuItem.
  * Reconnection recovery: KDS reconnects and replays active tickets from ticket revision numbers.
* **Guest QR System**:
  * Permanent physical QR tokens bound to Table or Room location.
  * Ephemeral guest session tokens created upon check-in or waiter open session.
  * QR tokens survive guest turnover without leaking previous guest folios or orders.

---

## 6. Development & Quality Assurance Stack

* **Test Runner**: Vitest `5.0.5` with Vite `8.3.5`.
* **Testing Strategy**:
  * Unit tests: Pure business policies, tax calculation, idempotency hashing, session validation.
  * Integration tests: Real disposable PostgreSQL container on loopback port `55439`/`55440`.
  * Adversarial tests: Concurrent checkout races, double-booking race tests, transaction rollback verification.
* **Type Safety**: Full strict TypeScript compilation (`tsc --noEmit`).

