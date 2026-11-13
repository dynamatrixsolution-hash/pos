# 🛡️ DynaPOS / RestroInn Security & Optimization Architecture Guide

**System Version:** 2.0 (Production Hardened)  
**System:** Hospitality POS, Hotel & Restaurant Management ERP  
**Scope:** Database Layer (`packages/db`), Backend API Engine (`backend`), and Frontend App (`frontend`)  
**Audience:** Engineering Team, DevOps, Security Auditors, and System Administrators  

---

## 📑 Table of Contents
1. [System Architecture & Technology Stack](#1-system-architecture--technology-stack)
2. [Security Architecture by Layer](#2-security-architecture-by-layer)
   - [2.1 Database Security & Isolation](#21-database-security--isolation)
   - [2.2 Backend & API Security](#22-backend--api-security)
   - [2.3 Web Frontend & Edge Security](#23-web-frontend--edge-security)
   - [2.4 Hardware & POS Security](#24-hardware--pos-security)
3. [Performance & Scalability Optimization](#3-performance--scalability-optimization)
   - [3.1 Database Speed & B-Tree Indexing](#31-database-speed--b-tree-indexing)
   - [3.2 In-Memory Sliding-Window Rate Limiting](#32-in-memory-sliding-window-rate-limiting)
   - [3.3 Payload Compression & Keyset Pagination](#33-payload-compression--keyset-pagination)
4. [Hospitality RBAC & Authorization Matrix](#4-hospitality-rbac--authorization-matrix)
5. [Master Environment & Pre-Deployment Matrix](#5-master-environment--pre-deployment-matrix)

---

## 1. System Architecture & Technology Stack

```mermaid
graph TD
    TabletClient["Steward Tablets / Mobile POS (Waiters)"] -->|HTTPS / WSS| EdgeProxy["Edge Proxy & Rate Limiter (proxy.ts)"]
    DesktopPOS["Desktop Cashier Register & Front Desk"] -->|HTTPS| EdgeProxy
    KitchenKDS["Kitchen Display System (KDS Screens)"] -->|HTTPS / WSS| EdgeProxy
    GuestMobile["Guest Table / Room QR Scanning"] -->|HTTPS| EdgeProxy
    
    subgraph "Application Core (Next.js 16 + Turbopack)"
        EdgeProxy --> RateLimiter["Sliding Window Rate Limiter (30/300 rpm)"]
        RateLimiter --> ZeroTrust["Zero-Trust Session Guard (getSessionContext)"]
        ZeroTrust --> APIHandlers["100+ Parameterized API Route Handlers"]
    end
    
    subgraph "Data & Persistence Layer"
        APIHandlers -->|Prisma Client v6 (Connection Pool)| PG[("PostgreSQL 15+ (Strict TLS)")]
        APIHandlers -->|Idempotency Cache| ReqResult[("RequestResult (Atomic Commit)")]
    end

    subgraph "External Integrations"
        APIHandlers --> CBMS["Nepal IRD CBMS API Gateway"]
        APIHandlers --> Printers["Network ESC/POS Thermal Printers"]
    end
```

### Complete Technology Stack:
* **Web Frontend & Backend Engine:** Next.js 16 (App Router + Turbopack), React 19, TypeScript 5, Tailwind CSS.
* **ORM & Database:** Prisma ORM 6.19.3, PostgreSQL 15+ with connection pooling and TLS encryption.
* **Authentication & Session:** Auth.js (NextAuth v5), signed HTTP-Only JWT cookies, HMAC-SHA-256 password pepper, timing-equalized verification.
* **Hardware Integrations:** ESC/POS network & USB thermal printers, camera-based 1D/2D barcode scanners, QR matrix generators.
* **Tax Compliance:** Nepal Inland Revenue Department (IRD) Central Billing Monitoring System (CBMS).

---

## 2. Security Architecture by Layer

### 2.1 Database Security & Isolation
* **Multi-Tenant Scoping:** Every query executed via `getSessionContext()` is strictly scoped to `where: { businessId: context.businessId }`. Cross-tenant data leaks are physically blocked at the query builder layer.
* **Soft Deletes:** Critical business entities preserve historical audit records through `deletedAt TIMESTAMP?`.
* **Database Error Masking:** Prisma exceptions (e.g. `P2002` unique constraint, `P2003` foreign key) are intercepted by `safeErrorMessage()` and transformed into generic user-friendly responses to prevent schema disclosure.

### 2.2 Backend & API Security
* **Global Sliding-Window Rate Limiting (`backend/src/proxy.ts`):** Automatically limits request velocity per IP address with automated 5-minute memory garbage collection to prevent memory leaks.
* **Password Pepper:** Pre-hashes passwords with `PASSWORD_PEPPER` via HMAC-SHA-256 before bcrypt comparison.
* **Timing-Attack Resistance:** `verifyDummyPassword` runs a real bcrypt check on failed lookups to prevent username enumeration.
* **ReDoS & XSS Defenses:** Input strings pass through `stripHtml()` and UUID parameters are validated using regex (`isValidUUID()`).

### 2.3 Web Frontend & Edge Security
* **Next.js Edge Proxy (`frontend/src/proxy.ts`):** Restricts dashboard paths according to role permissions (`canAccessRoute()`).
* **Security Headers (`next.config.ts`):** Enforces HSTS 2-year preload (`max-age=63072000`), `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, and `poweredByHeader: false`.
* **Camera Scanning Security:** `Permissions-Policy: camera=self` safely enables POS barcode and QR camera scanners while disabling microphone and geolocation tracking.

---

## 3. Performance & Scalability Optimization

### 3.1 Database Speed & B-Tree Indexing
Targeted compound indexes on high-throughput operational models eliminate sequential table scans:
* `Sale`: `[businessId, branchId, createdAt]`, `[businessId, customerId]`, `[businessId, paymentStatus]`
* `Product`: `[businessId, barcode]`, `[businessId, sku]`, `[businessId, categoryId]`
* `Batch`: `[productId, branchId]`, `[branchId, expiryDate]`
* `RestaurantOrder`: `[businessId, branchId, settlementStatus]`, `[businessId, tableSessionId]`
* `Stay`: `[businessId, branchId, status]`, `[businessId, roomId, status]`
* `Payment`: `[businessId, branchId, createdAt]`, `[businessId, saleId]`
* `CustomerLedger` & `SupplierLedger`: `[customerId, createdAt]`, `[supplierId, createdAt]`

### 3.2 Pagination Bounds Enforcement
* Listing endpoints parse query parameters through `getPaginationParams(request, defaultLimit, maxLimit = 100)`.
* Requests attempting unbounded queries are capped at 100 items per page to prevent memory exhaustion.

### 3.3 Payload Compression
* Dynamic Gzip/Brotli payload compression enabled on both backend and frontend via `compress: true`.

---

## 4. Hospitality RBAC & Authorization Matrix

| Role | Operational Scope | Default Entry View |
| :--- | :--- | :--- |
| **`OWNER`** | Full administration, branches, billing, users, business reports | `/dashboard` |
| **`MANAGER`** | Operations & F&B, tables, kitchen routing, room allocation, inventory | `/dashboard` |
| **`FRONT_DESK`** | Hotel room reservations, guest check-in/out, folios, key cards | `/dashboard/hotel/rooms` |
| **`CASHIER`** | POS billing, dining table settlement, customer invoices, receipts | `/dashboard/restaurant/pos?view=menu` |
| **`WAITER`** | Restaurant tables, customer order entry, order rounds to kitchen | `/dashboard/restaurant/tables` |
| **`KITCHEN`** | Kitchen Display System (KDS), ticket bumping, recipes | `/dashboard/restaurant/kds` |
| **`HOUSEKEEPING`** | Room cleanliness turnover (dirty/clean), room inspections | `/dashboard/hotel/rooms` |
| **`ACCOUNTANT`** | Financial statements, ledgers, expense vouchers, CBMS tax | `/dashboard/reports` |
| **`SUPER_ADMIN`** | SaaS platform management, subscription plans, tenant monitoring | `/dashboard/super-admin` |

---

## 5. Master Environment & Pre-Deployment Matrix

| Variable | Requirement | Purpose |
| :--- | :---: | :--- |
| `DATABASE_URL` | **Required** | PostgreSQL connection string with `?sslmode=require` |
| `AUTH_SECRET` | **Required** | 64-character random hex string for NextAuth JWT signing |
| `PASSWORD_PEPPER` | **Required** | Secret key for HMAC-SHA-256 password pre-hashing |
| `FRONTEND_URL` | **Required** | Public origin for CORS whitelisting (e.g. `https://app.yourdomain.com`) |
| `BACKEND_URL` | **Required** | Internal or public backend URL (e.g. `https://api.yourdomain.com`) |
| `NODE_ENV` | **Required** | Set to `production` |
