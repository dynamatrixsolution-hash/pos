# Security & Optimization Patch Notes

**System:** DynaPOS / RestroInn (Hospitality POS, Hotel & Restaurant Management ERP)  
**Patch Release:** 2.0.0 (Production Hardened)  
**Release Date:** November 2026  

---

## 1. Database Indexing & Query Speed
- **Status:** Applied & Compiled in Prisma.
- **Details:** Added high-performance compound B-Tree indexes across transactional models in `packages/db/prisma/schema.prisma`:
  - `Product`: `[businessId, barcode]`, `[businessId, sku]`, `[businessId, categoryId]`, `[businessId, deletedAt]`
  - `Batch`: `[productId, branchId]`, `[branchId, expiryDate]`
  - `Customer` & `Supplier`: `[businessId, phone]`, `[businessId, name]`, `[businessId, deletedAt]`
  - `Sale` & `Purchase`: `[businessId, branchId, createdAt]`, `[businessId, customerId]`, `[businessId, paymentStatus]`, `[businessId, deletedAt]`
  - `SaleItem` & `PurchaseItem`: `[saleId]`, `[purchaseId]`, `[productId]`
  - `Payment`: `[businessId, branchId, createdAt]`, `[businessId, saleId]`, `[businessId, purchaseId]`, `[businessId, customerId]`, `[businessId, supplierId]`
  - `CustomerLedger` & `SupplierLedger`: `[customerId, createdAt]`, `[supplierId, createdAt]`
  - `Expense` & `Income`: `[businessId, branchId, createdAt]`, `[businessId, categoryId]`, `[businessId, deletedAt]`
  - `AuditLog` & `CbmsSyncQueue`: `[businessId, module, createdAt]`, `[businessId, userId]`, `[businessId, syncStatus]`, `[businessId, createdAt]`

---

## 2. Global API Rate Limiting & DoS Defense
- **Status:** Active & Verified.
- **Details:** 
  - Deployed `backend/src/proxy.ts` and `backend/src/lib/rate-limiter.ts`.
  - Automatically intercepts all requests hitting `/api/v1/*`.
  - Implements multi-proxy IP extraction (`cf-connecting-ip`, `x-forwarded-for`, `x-real-ip`).
  - Tiered rate limits:
    - `30 req/min` for authentication endpoints (`/api/v1/auth/*`)
    - `20 req/min` for dining table/room QR verification (`/api/v1/guest/verify`)
    - `300 req/min` for general operational endpoints
  - In-memory sliding-window store runs a 5-minute automated garbage collection sweep to prevent V8 memory leaks.
  - Automatically appends `X-RateLimit-Limit`, `X-RateLimit-Remaining`, and `X-RateLimit-Reset` headers.

---

## 3. Cryptography & Password Hardening
- **Status:** Active & Verified.
- **Details:**
  - Implemented `pepperPassword(password)` in `backend/src/lib/security.ts` using HMAC-SHA-256 and `process.env.PASSWORD_PEPPER`.
  - Added backward-compatible `verifyPasswordSecurely()` to verify both peppered credentials and legacy bcrypt records.
  - Mitigated timing attacks with `verifyDummyPassword(password)`: performs real bcrypt comparison against a fixed dummy hash on missing/inactive users to equalize response times (~150ms).
  - Replaced pseudo-random token generation with CSPRNG `crypto.randomBytes`.

---

## 4. Multi-Tenant Role-Based Access Control (RBAC) Overhaul
- **Status:** Active & Verified.
- **Details:**
  - Standardized system roles around real Hotel & Restaurant operations:
    - `SUPER_ADMIN`, `OWNER`, `MANAGER`, `FRONT_DESK`, `CASHIER`, `WAITER`, `KITCHEN`, `HOUSEKEEPING`, `ACCOUNTANT`.
  - Updated frontend user management dropdown in `frontend/src/app/dashboard/users/users-client.tsx` and RBAC matrix in `frontend/src/features/users/presentation/RolesContainer.tsx`.
  - Edge proxy in `frontend/src/proxy.ts` verifies route access before rendering any dashboard page.
  - Backend `getSessionContext()` enforces zero-trust live database verification on every API call, verifying user status, tenant identity (`businessId`), and active subscription.

---

## 5. Network, Browser & Hardware Security
- **Status:** Active & Verified.
- **Details:**
  - Configured HTTP security headers in `backend/next.config.ts` and `frontend/next.config.ts`:
    - `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`
    - `X-Frame-Options: DENY`
    - `X-Content-Type-Options: nosniff`
    - `Referrer-Policy: strict-origin-when-cross-origin`
    - `Permissions-Policy: camera=self, microphone=(), geolocation=()` (Safe barcode/QR camera scanning)
    - `poweredByHeader: false` (Suppresses `X-Powered-By: Next.js`)
    - `compress: true` (Gzip/Brotli compression)
  - Intercepted database errors with `safeErrorMessage()` to prevent raw SQL or Prisma schema leaks.
  - Added ReDoS-safe UUID validation (`isValidUUID()`) and HTML tag stripping (`stripHtml()`).
