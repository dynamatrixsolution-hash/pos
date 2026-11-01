# Phase 1 Specification Mining Report: UI/UX Standards & Adversarial Testing Harness

> **Role**: Specification Miner (UI/UX Designer & Adversarial Tester Perspective)  
> **Working Directory**: `c:\projects\pos\.agents\teamwork\spec_miner_p1_ux_test`  
> **Milestone**: Phase 1: Security Foundation & Tenant Isolation  
> **Authoritative Sources**:
> - `c:\projects\pos\.agents\teamwork\ORIGINAL_REQUEST.md`
> - `c:\projects\pos\docs\hospitality\phases\PHASE_1_SECURITY_AUTHORITY.md`
> - `c:\projects\pos\.agent\skill\uiuxskills.md`
> - `c:\projects\pos\.agent\skill\stack.md`
> - `c:\projects\pos\docs\hospitality\IMPLEMENTATION_PLAN.md`
> - `c:\projects\pos\scripts\restro-env.mjs`, `scripts\database-verification.mjs`, `scripts\run-db-tests.mjs`
> - `c:\projects\pos\tests\commerce.integration.test.ts`, `tests\session.test.ts`, `tests\commerce-policy.test.ts`
> - `c:\projects\pos\frontend\src\components\dashboard-shell-client.tsx`, `frontend\src\components\protected.tsx`, `frontend\src\app\globals.css`
> - `c:\projects\pos\backend\src\app\api\v1\layout-context\route.ts`, `backend\src\lib\api-helper.ts`, `backend\src\lib\api-auth.ts`, `backend\src\lib\commerce-policy.ts`

---

## 1. Observation

### 1.1 RestroInn UI/UX Design System Specifications (`.agent/skill/uiuxskills.md` & `frontend/src/app/globals.css`)
Direct inspection of `.agent/skill/uiuxskills.md` (lines 9–35, 37–64, 66–155) and `frontend/src/app/globals.css` (lines 5–50, 78–117, 155–176) reveals the authoritative design tokens and rules:

1. **Brand Palette & CSS Tokens**:
   - **Primary**: Deep burgundy `#6B2837` (`--primary`, HSL `347 46% 29%`). Primary Hover: Wine burgundy `#541E2A` (`--color-burgundy-hover`). *Strict Rule*: Do NOT cover whole screens with burgundy.
   - **Background**: Warm ivory `#F7F3EC` (`--background`, HSL `38 41% 95%`). Base application canvas across all pages. Warm, glare-free under bright counter lighting.
   - **Surface**: Porcelain `#FFFCF7` (`--card` / `--popover`, HSL `38 100% 98%`). Used for cards, forms, modals, table bodies, elevated panels.
   - **Secondary Surface**: Warm stone `#EEE7DD` (`--secondary` / `--muted`, HSL `35 33% 90%`). Table headers, segmented control tracks, inactive tab pills, group wrappers.
   - **Text / Foreground**: Espresso `#292320` (`--foreground`, HSL `20 12% 14%`). Main headings, body copy, tabular numbers.
   - **Muted Text**: Warm gray `#71675E` (`--muted-foreground`, HSL `28 9% 41%`). Secondary metadata, timestamps, input helper text.
   - **Border / Input**: Sandstone `#D8CEC1` (`--border` / `--input`, HSL `34 23% 80%`). Table cell borders, dividers, crisp 1px lines.
   - **Accent**: Muted brass `#A77B38` (`--accent`, HSL `36 50% 44%`). *Strict Sparing Rule*: Active navigation edge line, brand badge, fine highlights. NEVER use for normal body text or all icons.

2. **Operational Status Tokens (Strict Color Isolation)**:
   - **Ready / Available / Completed**: Forest `#28634B`, Badge Background `#EAF3EE`, Badge Border `#C3DED0` (`.badge-status-ready`).
   - **Pending / Preparing / Attention**: Ochre `#946000`, Badge Background `#FDF5E7`, Badge Border `#EDD7AD` (`.badge-status-pending`).
   - **Cancelled / Failed / Urgent**: Red `#B33432`, Badge Background `#FAEAEC`, Badge Border `#E9B6B7` (`.badge-status-cancelled`).
   - **Informational / Assigned**: Blue `#315F85`, Badge Background `#EDF4F9`, Badge Border `#B8D2E6` (`.badge-status-info`).

3. **Anti-Pattern Codex**:
   - **Whitespace & Over-padding**: Maximum page padding `p-4 sm:p-6`; internal card padding `p-3.5 sm:p-4`; grid gaps `gap-3` or `gap-4`. No `p-8` or `space-y-8` nested whitespace waste.
   - **Heights & Scroll Traps**: No `h-[600px]` or nested unbudgeted overflow. Use `flex-1 min-h-0 overflow-y-auto` for pinned panels.
   - **Shadows**: Flat surfaces with crisp 1px borders (`border border-border`). Only permitted shadows: `shadow-xs`, `shadow-sm`, and `shadow-md shadow-[#6B2837]/20` on primary buttons. No glowing colored halos or `shadow-2xl`.
   - **Decorative Frivolousness**: Zero gradients, zero confetti, no decorative hero banners, no animated spin/bounce on tables.
   - **Brass Overuse**: Brass is reserved for accents; headings are always Espresso `#292320`.

4. **Component Blueprints**:
   - **Primary Action Button**: `px-4 py-2 bg-primary hover:bg-[#541E2A] text-primary-foreground font-bold text-xs uppercase tracking-wider rounded-xl shadow-sm transition-colors cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2`.
   - **Secondary / Cancel Button**: `px-4 py-2 bg-secondary hover:bg-[#E5DDCF] text-foreground font-semibold text-xs rounded-xl border border-border transition-colors cursor-pointer`.
   - **Destructive Button**: `px-3.5 py-1.5 bg-[#B33432] hover:bg-[#992826] text-white font-bold text-xs rounded-xl transition-colors cursor-pointer flex items-center gap-1.5`.

---

### 1.2 Staff Branch Selector: Current State vs. Phase 1 Authority
Inspection of `frontend/src/components/dashboard-shell-client.tsx` (lines 322–324, 380–385, 518–568) and `backend/src/app/api/v1/layout-context/route.ts` (lines 14–30):

1. **Current Header Placement & Rendering** (`dashboard-shell-client.tsx:518–568`):
   - Located in `<header>` adjacent to the mobile menu trigger and logo.
   - Currently gated by `["SUPER_ADMIN", "OWNER"].includes(userRole)`.
   - If user is OWNER or SUPER_ADMIN: Renders dropdown button `<button onClick={() => setBranchDropdownOpen(!branchDropdownOpen)} ...>` with branch list modal (`dashboard-shell-client.tsx:523-556`).
   - If user is NOT an owner: Renders static read-only badge `/* Non-owners see only their assigned warehouse as read-only */` (`dashboard-shell-client.tsx:559–566`).

2. **Backend Context Feeding** (`layout-context/route.ts:15–21`):
   ```ts
   const branchWhere: any = { businessId, deletedAt: null };
   if (!isOwner && userBranchId) {
     branchWhere.id = userBranchId;
   }
   const branches = await db.branch.findMany({ where: branchWhere, ... });
   ```
   *Defect / Stale Assumption*: If user is non-owner, backend only queries the single `user.branchId`. Multi-branch staff cannot receive multiple branches.

3. **Current State Persistence Flaw** (`dashboard-shell-client.tsx:380–385`):
   ```tsx
   const handleBranchSwitch = async (branch: BranchMeta) => {
     setActiveBranch(branch);
     setBranchDropdownOpen(false);
     await update({ branchId: branch.id });
     window.location.reload(); 
   };
   ```
   *Authority Conflict*: `backend/src/auth.config.ts` (lines 68–77) and `tests/session.test.ts` (lines 8–13) intentionally strip client session updates to prevent claim forgery:
   ```ts
   // Authority is resolved from the database, never from client session updates.
   return token;
   ```
   Calling NextAuth's `update({ branchId })` has zero effect on the server-derived JWT token.

4. **Phase 1 Authority Requirement** (`PHASE_1_SECURITY_AUTHORITY.md:13` & `stack.md:51`):
   - `UserBranchMembership`: Explicit mapping between staff users and permitted branches (`userId`, `branchId`, `businessId`).
   - Multi-branch staff: May be assigned to 2 or more branches within their tenant.
   - Single-branch staff: Assigned to exactly 1 branch.
   - Branchless staff (0 branches): Fail-closed immediately.
   - Branch switching persistence must be stored via a dedicated server-validated session preference endpoint or secure cookie (`restro_active_branch`), verified against `UserBranchMembership` on every API request.

---

### 1.3 Role-Based 401 Unauthorized & 403 Forbidden States
Inspection of `frontend/src/components/protected.tsx` (lines 19–66) and `backend/src/lib/api-helper.ts` (lines 39–51):

1. **Current Implementation in `protected.tsx`**:
   - Lines 38–66 define `AccessDenied`:
     ```tsx
     <div className="flex items-center justify-center min-h-[400px] bg-gradient-to-br from-red-50 to-orange-50 rounded-lg border border-red-200">
       ...
       <h2 className="text-2xl font-bold text-gray-800 mb-2">Access Denied</h2>
       <p className="text-gray-600">You don't have permission to access this resource.</p>
     </div>
     ```
   - *Design Violations*:
     - Violates Anti-Pattern Codex Rule 4: uses forbidden gradient `bg-gradient-to-br from-red-50 to-orange-50`.
     - Uses un-tokenized Tailwind utility colors (`text-gray-800`, `text-gray-600`, `border-red-200`) instead of RestroInn tokens (`--foreground`, `--muted-foreground`, `--border`).
     - Collapses 401 (unauthenticated / session expired) and 403 (insufficient permissions / unassigned branch) into a single generic error.
     - Lacks Next.js 16 App Router error boundaries (`error.tsx`, `not-found.tsx`, `unauthorized.tsx`, `forbidden.tsx`).

2. **Backend Error Responses** (`api-helper.ts:39–51`):
   - 401: `{ error: "Unauthorized. Please log in first." }` (HTTP 401).
   - 403: `{ error: "Forbidden. You do not have the required permissions for this action." }` (HTTP 403).

3. **Phase 1 UI/UX Requirements**:
   - **401 Unauthorized Screen / Modal**:
     - *Trigger*: Unauthenticated request, expired session, revoked token, inactive user.
     - *Surface*: Centered Porcelain card (`bg-card border border-border rounded-2xl p-6 shadow-sm max-w-md mx-auto text-center`).
     - *Badge / Icon*: Lock icon in Ochre Pending badge (`bg-[#FDF5E7] text-[#946000] border border-[#EDD7AD] p-3 rounded-full inline-flex`).
     - *Typography*: Headline in Espresso (`text-foreground font-bold text-lg`), description in Warm gray (`text-muted-foreground text-xs`).
     - *Action*: Primary Burgundy Button (`bg-primary text-primary-foreground font-bold text-xs uppercase tracking-wider rounded-xl py-2.5 px-4 shadow-sm`): "Sign In to RestroInn" (redirecting to `/auth/login`).
   - **403 Forbidden Screen / Modal**:
     - *Trigger*: Authenticated user attempting route or mutation disallowed by role (e.g. Cashier accessing inventory adjustments or financial reports) or unassigned branch.
     - *Surface*: Centered Porcelain card (`bg-card border border-border rounded-2xl p-6 shadow-sm max-w-md mx-auto text-center`).
     - *Badge / Icon*: ShieldAlert icon in Red Urgent badge (`bg-[#FAEAEC] text-[#B33432] border border-[#E9B6B7] p-3 rounded-full inline-flex`).
     - *Typography*: Headline "Access Restricted" in Espresso (`text-foreground font-bold text-lg`). Detailed explanation indicating whether restriction is Role-based ("Cashier accounts cannot modify inventory") or Branch-based ("You are not assigned to branch X").
     - *Action*: Dual actions: Secondary Button ("Return to POS / Dashboard") and if multi-branch, a branch switcher dropdown ("Switch to Assigned Branch").

---

### 1.4 Test Environment & Runners (PostgreSQL `127.0.0.1:55439`)
Inspection of `scripts/restro-env.mjs`, `scripts/database-verification.mjs`, `scripts/run-db-tests.mjs`, and `vitest.config.mts`:

1. **Isolation Target Lockdown** (`scripts/database-verification.mjs:1–9`):
   - Target database URL MUST strictly match `postgresql://restro_dev:<password>@127.0.0.1:55439/restro_test`.
   - Hostname must be `127.0.0.1`, port `55439`, pathname `/restro_test`, username `restro_dev`.
   - Rejects any remote host, non-55439 port, query params, or hash fragments to guarantee production and development data cannot be touched.

2. **Runner Scripts**:
   - `node scripts/restro-env.mjs init`: Generates `.env.restro.local` with isolated random credentials.
   - `node scripts/restro-env.mjs db`: Spawns Docker container `prayassh-restro` via `compose.restro.yml`.
   - `node scripts/restro-env.mjs migrate`: Validates baseline adoption and deploys Prisma migrations.
   - `node scripts/restro-env.mjs integration`: Calls `scripts/run-db-tests.mjs`.
   - `scripts/run-db-tests.mjs`:
     - Sets `RESTRO_REQUIRE_DATABASE_TESTS="true"`, `RESTRO_OBSERVE_RACES="false"`.
     - Spawns Vitest with `tests/commerce.integration.test.ts`.
     - Asserts at least 14 passed cases with 0 skips via `assertDatabaseReport`.
   - `vitest.config.mts`: Runs with Node environment, single-file parallelism disabled (`fileParallelism: false`) to prevent race collisions on the test database.

3. **Current Live Verification Execution**:
   - Executed `node scripts/restro-env.mjs integration`: **14 tests passed, 0 skipped, exit code 0** (2.88s duration).
   - Executed `npm.cmd run typecheck`: **0 errors, exit code 0**.
   - Executed Vitest unit test suite: **30 tests passed across 6 test files, exit code 0** (1.66s duration).

---

### 1.5 Adversarial Test Cases Required by `PHASE_1_SECURITY_AUTHORITY.md`
Examining `PHASE_1_SECURITY_AUTHORITY.md` (§3, §4), `IMPLEMENTATION_PLAN.md` (lines 148, 169), and `tests/commerce.integration.test.ts`:

1. **Cross-Tenant Rejection**:
   - Must attempt operations with arbitrary entity IDs belonging to another tenant (`otherBusiness`).
   - Asserts that direct API access returns `403 Forbidden` or `404 Not Found`, with zero side effects or data leakage.
   - *Current Coverage*: `commerce.integration.test.ts:97–101` tests cross-tenant branch rejection on sales checkout. Needs expansion to all catalog, report, and ledger endpoints.

2. **Unassigned Branch Rejection**:
   - Multi-branch or single-branch staff attempting mutation in a branch not in their assigned `UserBranchMembership`.
   - Asserts `403 Forbidden` ("Branch access denied").
   - *Current Coverage*: `commerce.integration.test.ts:98–99` tests single-branch user on `otherBranchId`. Needs expansion to test multi-branch `UserBranchMembership` filtering and branch transfer restrictions.

3. **Forged JWT / Expired / Stale Claims**:
   - Client sends forged JWT claims claiming `role: "OWNER"` or `branchId: foreignBranch`.
   - Server re-derives identity from database (`db.user.findUnique`) and rejects elevated privileges.
   - *Current Coverage*: `session.test.ts:8–18` and `commerce.integration.test.ts:187–192` verify JWT callback ignores updates and reads current DB authority.

4. **Inactive / Deleted User & Business Fail-Closed**:
   - When `user.isActive === false`, `user.deletedAt !== null`, or `business.deletedAt !== null`.
   - Must immediately return `401 Unauthorized`, aborting before any domain or database mutation occurs.
   - *Current Coverage*: `commerce.integration.test.ts:193–198` verifies inactive/deleted user returns 401.

5. **Atomic Rollback on Audit Logging Failure**:
   - `AuditEvent` written in the same transaction as domain effects.
   - Synthetic PostgreSQL trigger raises an exception on audit insert (`tests/commerce.integration.test.ts:219–241`).
   - Must verify complete transaction rollback: zero sales, zero payments, zero stock movement, zero sequence increment.

6. **Concurrency and Invariant Testing**:
   - Concurrent checkout replay with same `Idempotency-Key` returns 201 duplicate replay with 1 sale/payment effect (`tests/commerce.integration.test.ts:109–125`).
   - Different payload with reused key returns `409 Conflict`.
   - Negative stock policy: `preventNegativeStock: true` sells last unit once and returns 400 for concurrent second request (`commerce.integration.test.ts:126–136`).
   - Rejection of invalid non-cash references and unverified client payment provider claims (`commerce.integration.test.ts:102–108`, `210–218`).

---

## 2. Logic Chain

1. **Observation**: `uiuxskills.md` mandates RestroInn's design philosophy ("Refined Hospitality Ergonomics"), banning gradients, floating halos, and decorative clutter, while establishing strict status tokens (Ready: Forest `#28634B`, Pending: Ochre `#946000`, Cancelled: Red `#B33432`, Informational: Blue `#315F85`).
   **Inference**: The current `AccessDenied` component in `protected.tsx` directly violates these rules by rendering an orange-red gradient (`from-red-50 to-orange-50`) with un-tokenized gray text. It must be refactored into two dedicated, token-compliant states: a 401 Unauthorized card (Ochre Pending icon, Espresso typography, Burgundy sign-in button) and a 403 Forbidden card (Red Cancelled icon, detailed role/branch restriction reason, return/switch actions).

2. **Observation**: In `dashboard-shell-client.tsx`, branch switching is restricted to `OWNER` and `SUPER_ADMIN`. Non-owners receive a static read-only badge. When owners switch branches, the code calls `update({ branchId })`, which `auth.config.ts` and `session.test.ts` discard.
   **Inference**: The existing branch switcher is both non-functional for session persistence and incompatible with multi-branch staff. With Phase 1 introducing `UserBranchMembership`, staff can belong to multiple branches. The branch selector must dynamically render a dropdown for any user (Owner or Staff) with >1 assigned branch, a static badge for exactly 1 branch, and fail-closed for 0 branches. Active branch state must be persisted via a server-validated session preference.

3. **Observation**: `scripts/database-verification.mjs` enforces loopback isolation on `127.0.0.1:55439/restro_test` and requires at least 14 passed tests in `assertDatabaseReport`.
   **Inference**: All Phase 1 adversarial integration tests must be executed via `node scripts/restro-env.mjs integration` against this container. The suite currently exercises checkout atomicity, audit rollback, and basic branch rejection, but must be expanded to test `UserBranchMembership`, `AuditEvent` schema additions, composite tenant foreign keys `(businessId, id)`, and role-based capability flags.

---

## 3. Caveats

1. **Prisma Schema Drift**: `UserBranchMembership`, `AuditEvent`, and composite tenant foreign keys `(businessId, id)` are specified in `PHASE_1_SECURITY_AUTHORITY.md` and `IMPLEMENTATION_PLAN.md`, but have not yet been applied to `packages/db/prisma/schema.prisma`.
2. **Next.js 16 Error Boundaries**: App Router error pages (`unauthorized.tsx` / `forbidden.tsx`) require careful coordination with NextAuth session handling so client components and server route handlers handle 401/403 consistently without infinite redirect loops.
3. **Database Migration Strategy**: As established in Phase 0, migrations must follow expand/backfill/validate/contract without destructive baseline recreation.

---

## 4. Conclusion & Discovered Specifications

### Features Discovered

| # | Category | Feature | Description | Inputs | Outputs | Error Behavior | Discovered Via |
|---|----------|---------|-------------|--------|---------|----------------|----------------|
| 1 | UI/UX Design | RestroInn Color Tokens | Brand tokens: Burgundy `#6B2837`, Ivory `#F7F3EC`, Porcelain `#FFFCF7`, Stone `#EEE7DD`, Espresso `#292320`, Sandstone `#D8CEC1`, Brass `#A77B38` | CSS Variables in `globals.css` | High-density ergonomic canvas | Arbitrary hex codes prohibited | `uiuxskills.md:9-35`, `globals.css:7-50` |
| 2 | UI/UX Design | Operational Status Tokens | Strict isolated tokens for Ready (`#28634B`), Pending (`#946000`), Cancelled (`#B33432`), Info (`#315F85`) | Component status props | Status badges & indicators | Status swapping prohibited | `uiuxskills.md:25-35`, `globals.css:155-176` |
| 3 | UI/UX Navigation | Staff Branch Selector | Header dropdown for multi-branch staff/owners; static badge for single branch | `branches: BranchMeta[]`, active branch state | Dropdown menu or read-only badge | Hidden for SUPER_ADMIN; fail-closed if 0 branches | `dashboard-shell-client.tsx:518-568`, `layout-context:15-21` |
| 4 | UI/UX Navigation | Branch State Persistence | Server-validated active branch selection | Selected `branchId` | Server-synced active branch cookie/session | Client-forged branch rejected | `session.test.ts:8-13`, `commerce-policy.ts:17-26` |
| 5 | UI/UX Security | 401 Unauthorized State | Porcelain card with Ochre Pending icon, Espresso typography, Burgundy Sign-In button | 401 response / expired session | Full-screen or modal sign-in prompt | Redirects unauthenticated requests to `/auth/login` | `api-helper.ts:39-44`, `protected.tsx:20-25` |
| 6 | UI/UX Security | 403 Forbidden State | Porcelain card with Red Cancelled icon, explicit role/branch explanation, return/switch actions | 403 response / RBAC violation | Contextual forbidden view | Blocks access; logs authorization denial | `api-helper.ts:46-51`, `protected.tsx:38-66` |
| 7 | Security Authority | Current Database Authority | Server resolves user role, branch, and status from DB on every mutation, ignoring client JWT claims | Auth request header | `SessionContext` with verified authority | Fails closed on mismatch, inactive, or deleted user | `api-helper.ts:12-37`, `auth.config.ts:68-77` |
| 8 | Security Authority | Multi-Branch Membership | Explicit mapping between users and allowed branches via `UserBranchMembership` | `userId`, `branchId`, `businessId` | Permitted branch list | Mutation in unassigned branch returns 403 | `PHASE_1_SECURITY_AUTHORITY.md:13`, `commerce-policy.ts:17-26` |
| 9 | Security Authority | Composite Tenant Integrity | Composite foreign keys `(businessId, id)` on branch-scoped records | `businessId`, entity `id` | Tenant isolation guarantee | Cross-tenant reference returns 403/404 | `stack.md:51`, `PHASE_1_SECURITY_AUTHORITY.md:8` |
| 10 | Security Authority | Atomic Audit Logging | `AuditEvent` committed within the same transaction as business mutation | `AuditEvent` payload | Persisted audit record | Audit failure forces complete domain rollback | `PHASE_1_SECURITY_AUTHORITY.md:14,25`, `commerce.integration.test.ts:219-241` |
| 11 | Testing Harness | Isolated PostgreSQL Runner | Enforces loopback container `127.0.0.1:55439/restro_test` with `restro_dev` credentials | `TEST_DATABASE_URL` | Automated integration execution | Rejects any non-isolated database URL | `database-verification.mjs:1-9`, `run-db-tests.mjs:1-16` |
| 12 | Testing Harness | Real Contention Race Suite | Tests PostgreSQL concurrent transactions using real connection PIDs and row locks | Parallel requests + Idempotency-Key | Deterministic single mutation execution | Reused key with different payload returns 409 | `commerce.integration.test.ts:109-125,179-186` |

---

### Edge Cases

| # | Feature | Input | Observed Behavior |
|---|---------|-------|-------------------|
| 1 | Branch Selector | User assigned to 0 branches (branchless staff) | Fails closed immediately: `getSessionContext()` returns `null`, API returns 401/403, UI presents unassigned error |
| 2 | Branch Selector | Staff assigned to exactly 1 branch | Renders static, read-only branch badge without dropdown arrow or hover interaction |
| 3 | Branch Selector | Staff assigned to 3 branches in `UserBranchMembership` | Renders dropdown listing all 3 permitted branches, excluding foreign branches |
| 4 | JWT Session Update | Client calls `update({ role: "OWNER", branchId: "foreign" })` | NextAuth `jwt` callback strips modifications, preserving original token claims |
| 5 | Cross-Tenant Query | User in Tenant A submits query with Branch ID from Tenant B | Rejected with `403 Forbidden` (`Branch access denied`) without DB side effects |
| 6 | Unassigned Branch Mutation | Manager assigned to Branch 1 attempts stock transfer in Branch 2 | Rejected with `403 Forbidden` (`Branch access denied`) |
| 7 | Stale Active User | User deactivated (`isActive: false`) or soft-deleted (`deletedAt: now`) during active session | Server re-reads DB, revokes session, and returns `401 Unauthorized` |
| 8 | Soft-Deleted Tenant | Business soft-deleted (`business.deletedAt: now`) | Server rejects all endpoints for all users within that business with `401 Unauthorized` |
| 9 | Audit System Failure | DB trigger raises synthetic exception on `AuditEvent`/`AuditLog` insert | Entire transaction aborts; stock, invoice sequence, customer ledger, and payments roll back |
| 10 | Concurrent Checkout Replay | Two identical requests sent simultaneously with identical `Idempotency-Key` | Only one sale and payment row created; second request returns identical response |
| 11 | Idempotency Key Conflict | Same `Idempotency-Key` sent with altered cart/price body | Server returns `409 Conflict` ("Idempotency key reused with different request") |
| 12 | Negative Stock Prevention | Two concurrent checkouts for last 1 unit with `preventNegativeStock: true` | Exactly 1 checkout succeeds (201); second returns `400 Bad Request` ("Insufficient stock") |

---

## 5. Verification Method

To independently verify these findings, execute the following commands in `c:\projects\pos`:

1. **Verify Unit Test Suites**:
   ```powershell
   node node_modules/vitest/vitest.mjs run --exclude tests/commerce.integration.test.ts --exclude tests/recovery.integration.test.ts
   ```
   *Expected Output*: 6 test files passed, 30 tests passed, exit code 0.

2. **Verify TypeScript Typechecking**:
   ```powershell
   npm.cmd run typecheck
   ```
   *Expected Output*: Zero errors for both `backend` and `frontend`, exit code 0.

3. **Verify PostgreSQL Integration & Adversarial Suite**:
   ```powershell
   node scripts/restro-env.mjs integration
   ```
   *Expected Output*: 14 passed tests in `tests/commerce.integration.test.ts` on `127.0.0.1:55439`, zero skipped, exit code 0.

4. **Inspect Source Files**:
   - Palette and tokens: `c:\projects\pos\.agent\skill\uiuxskills.md` & `c:\projects\pos\frontend\src\app\globals.css`.
   - Branch selector: `c:\projects\pos\frontend\src\components\dashboard-shell-client.tsx` (lines 518–568).
   - Error states: `c:\projects\pos\frontend\src\components\protected.tsx` (lines 38–66).
   - Test harness: `c:\projects\pos\scripts\restro-env.mjs` & `c:\projects\pos\scripts\database-verification.mjs`.
