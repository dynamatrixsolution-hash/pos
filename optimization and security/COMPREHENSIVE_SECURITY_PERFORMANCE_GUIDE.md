# Comprehensive Security & Performance Architecture Guide

**System:** DynaPOS / RestroInn (Hospitality POS, Hotel & Restaurant Management ERP)  
**Version:** 2.0 (Production Hardened)  
**Scope:** Full-Stack Database (`packages/db`), Backend API (`backend`), and Frontend App (`frontend`)

---

## 1. Database Speed, Integrity & Scale (Prisma ORM 6 + PostgreSQL)

### Performance & Scaling
* **Targeted B-Tree & Composite Indexing (`packages/db/prisma/schema.prisma`):** Critical foreign keys and high-frequency compound query patterns are explicitly indexed to prevent full-table scans during heavy point-of-sale and check-in operations:
  * **Sales & Invoices:** `Sale` (`[businessId, branchId, createdAt]`, `[businessId, customerId]`, `[businessId, paymentStatus]`, `[businessId, deletedAt]`), `SaleItem` (`[saleId]`, `[productId]`)
  * **Products & Stock:** `Product` (`[businessId, barcode]`, `[businessId, sku]`, `[businessId, categoryId]`, `[businessId, deletedAt]`), `Batch` (`[productId, branchId]`, `[branchId, expiryDate]`)
  * **Restaurant & KDS:** `RestaurantOrder` (`[businessId, branchId, settlementStatus]`, `[businessId, tableSessionId]`, `[businessId, tableId]`), `OrderLine` (`[businessId, orderId, roundId]`, `[businessId, menuItemId]`), `KitchenTicket` (`[businessId, branchId, status]`, `[businessId, stationId, status]`)
  * **Hotel Management:** `Room` (`[businessId, branchId, status]`, `[businessId, roomTypeId]`), `Reservation` (`[businessId, checkInDate, checkOutDate]`), `Stay` (`[businessId, branchId, status]`, `[businessId, roomId, status]`), `GuestFolio` (`[businessId, stayId]`)
  * **Procurement & Ledger:** `Purchase` (`[businessId, branchId, createdAt]`, `[businessId, supplierId]`), `PurchaseItem` (`[purchaseId]`, `[productId]`), `CustomerLedger` (`[customerId, createdAt]`), `SupplierLedger` (`[supplierId, createdAt]`)
  * **Audit & Tax Compliance:** `AuditLog` (`[businessId, module, createdAt]`, `[businessId, userId]`), `CbmsSyncQueue` (`[businessId, syncStatus]`, `[businessId, createdAt]`)
* **Soft Deletes:** Core transactional tables (`Product`, `Customer`, `Supplier`, `Sale`, `Purchase`, `Expense`, `Income`, `Room`, `User`, `Business`) utilize `deletedAt TIMESTAMP?` columns. Historical records are preserved for auditing and regulatory compliance.
* **Idempotency Protection:** The `RequestResult` model atomically commits request hashes and cached responses against `[businessId, operation, key]` to guarantee network retries do not produce duplicate sales, payments, or room folio postings.

### Engine-Level Security & Compliance
* **Zero-Trust Multi-Tenant Isolation:** Every operational table links to `businessId`. All queries in `backend/src/lib/api-helper.ts` automatically verify the active session tenant and scope database reads and writes to `where: { businessId: context.businessId }`.
* **Nepal Inland Revenue Department (IRD) CBMS Audit Trail:** Real-time billing compliance queue (`CbmsSyncQueue`) records invoice submissions, cancellation reasons, and fiscal year IDs with non-repudiation timestamps.
* **Encrypted Database Transit:** PostgreSQL connections strictly enforce TLS via the `?sslmode=require` protocol parameter in `DATABASE_URL`.

---

## 2. API & Backend Performance (Next.js 16 App Router + Turbopack)

### Rate Limiting & DoS Mitigation
* **Global Sliding-Window Rate Limiter (`backend/src/proxy.ts`, `backend/src/lib/rate-limiter.ts`):** 
  * Intercepts all traffic arriving at `/api/v1/*` before routing to application logic.
  * Multi-proxy IP extraction (`cf-connecting-ip`, `x-forwarded-for`, `x-real-ip`).
  * **Tiered Protection:**
    * `30 req/min` for authentication endpoints (`/api/v1/auth/*`) to prevent brute-force attacks and credential stuffing.
    * `20 req/min` for dining table and room QR verification (`/api/v1/guest/verify`).
    * `300 req/min` for general POS, Hotel, and Restaurant operational endpoints.
  * **Automated V8 Memory Garbage Collection:** Runs an in-memory sweep every 5 minutes to purge stale rate-limit records, preventing memory leaks.
  * Returns standard HTTP 429 with `Retry-After`, `X-RateLimit-Limit`, `X-RateLimit-Remaining`, and `X-RateLimit-Reset` headers.

### Data Delivery & Query Optimization
* **Pagination Bounds Enforcement (`getPaginationParams`):** Listing endpoints parse `page` and `limit` with a strict ceiling of `100` items maximum. Unbounded `findMany()` queries are barred to prevent out-of-memory crashes and table-scan starvation.
* **Gzip & Brotli Payload Compression:** Configured `compress: true` in `backend/next.config.ts` and `frontend/next.config.ts`, minimizing JSON payload transfer sizes over cellular and wireless POS terminals.
* **Database Error Masking (`safeErrorMessage`):** Internal database exceptions, Prisma constraint names (`P2002`, `P2003`), and raw SQL messages are intercepted and converted to sanitized user-safe errors, preventing database schema fingerprinting.

---

## 3. Application Security & RBAC Defense

### Authentication & Password Hardening
* **HMAC-SHA-256 Server Password Pepper (`backend/src/lib/security.ts`):**
  * Passwords pass through an HMAC-SHA-256 pre-hash using `process.env.PASSWORD_PEPPER` before undergoing bcrypt hashing (salt 10). Even in the event of an SQL database dump, raw hashes cannot be cracked without the external server-side pepper key.
  * Backward-compatible verification (`verifyPasswordSecurely`) dynamically verifies both peppered and legacy bcrypt records.
* **Anti-Timing Attack Protection:**
  * When an email does not exist or the account is deactivated, `verifyDummyPassword(password)` executes a real bcrypt compare against a constant dummy hash. This ensures response times are identical (~150ms) regardless of whether an email exists, eliminating username enumeration.
* **CSPRNG Token Generation:** Replaced insecure `Math.random()` with cryptographically secure random bytes (`crypto.randomBytes`).

### Domain-Tailored Role-Based Access Control (RBAC)
Configured in `backend/src/lib/rbac.ts`, `frontend/src/lib/rbac.ts`, and `frontend/src/auth.config.ts` for hospitality operations:
* **`OWNER`**: Full business administration, multi-branch control, user invitations, and financial reports.
* **`MANAGER`**: Operations & F&B management, floor tables, kitchen routing, room allocations, purchases, and branch reports.
* **`FRONT_DESK`**: Hotel room reservations, guest check-in/out, folios, key card assignment, and guest requests.
* **`CASHIER`**: POS billing, dining table settlement, customer invoices, and payment receipting.
* **`WAITER`**: Restaurant floor tables, customer order taking, rounds submission to kitchen, and table session service.
* **`KITCHEN`**: Kitchen Display System (KDS) live view, ticket status bumping (queued, preparing, ready), and recipes.
* **`HOUSEKEEPING`**: Room turnover status (dirty/clean), room inspections, and maintenance ticket reporting.
* **`ACCOUNTANT`**: Financial reports, ledger audits, expense/income vouchers, and Nepal CBMS tax filing.
* **`SUPER_ADMIN`**: Multi-tenant platform management, subscription tiers, and system monitoring.

### Network & Browser Defense
* **HTTP Security Headers (`next.config.ts`):**
  * `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload` (2 full years, SSL Labs / HSTS Preload standard).
  * `X-Frame-Options: DENY` (Anti-clickjacking).
  * `X-Content-Type-Options: nosniff` (MIME sniffing prevention).
  * `Referrer-Policy: strict-origin-when-cross-origin`.
  * `Permissions-Policy: camera=self, microphone=(), geolocation=()` (Allows integrated camera barcode and QR scanning while disabling microphone and location access).
* **Information Disclosure Shield:** Enabled `poweredByHeader: false` on both frontend and backend to completely hide `X-Powered-By: Next.js`.
* **CORS Whitelisting:** Cross-origin requests explicitly whitelist authorized frontend URLs and local POS device subnets (`192.168.*.*`, `localhost:3000`).
* **Input Sanitization (`stripHtml`, `isValidUUID`):** ReDoS-safe UUID validation and HTML/script stripping across all mutation inputs to neutralize injection vectors.
