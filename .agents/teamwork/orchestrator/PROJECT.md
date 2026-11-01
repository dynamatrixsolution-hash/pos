# Project: Restro POS & Hospitality Management System

## Architecture
- Monorepo containing Next.js 16 (App Router), React 19, Tailwind CSS v4, Prisma ORM 5, PostgreSQL 15.
- Multi-tenant architecture with composite unique keys `(businessId, id)`.
- Isolation: Guarded loopback PostgreSQL environments (`127.0.0.1:55439/restro_test` and `127.0.0.1:55440/restro_restore`).

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | Baseline Container Isolation | Dedicated PostgreSQL containers and loopback verification | Phase 0 | PHASE_0_FOUNDATION_RECOVERY.md |
| 2 | Live Overwrite Elimination | Disable destructive in-place restore with HTTP 409 in API/UI | Phase 0 | PHASE_0_FOUNDATION_RECOVERY.md |
| 3 | Authenticated Backup Envelope | AES-256-GCM v2 format with SHA-256 schema hash & migration lineage | Phase 0 | PHASE_0_FOUNDATION_RECOVERY.md |
| 4 | Disposable DR Rehearsal | 41-check automated reconciliation on 127.0.0.1:55440 | Phase 0 | PHASE_0_FOUNDATION_RECOVERY.md |
| 5 | Recovery Integration Test Suite | 8-case PostgreSQL integration test suite (R1–R8) | Phase 0 | PHASE_0_FOUNDATION_RECOVERY.md |
| 6 | UserBranchMembership & Roles | Security foundation and tenant isolation | Phase 1 | IMPLEMENTATION_PLAN.md |
| 7 | Server-Derived Authority | Auth.js v5 authority without client-supplied businessId | Phase 1 | IMPLEMENTATION_PLAN.md |
| 8 | Decimal Financial Migration | True decimal currency storage replacing Float | Phase 2 | IMPLEMENTATION_PLAN.md |
| 9 | Layer 1 Cluster Backup / PITR | Continuous WAL archiving & cluster base backups | Phase 8 Pre-req | RECOVERY_STATUS.md |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| 0 | Foundation Recovery | Live restore elimination, encrypted envelope, 41-check rehearsal | none | DONE |
| 1 | Security Foundation & Authority | UserBranchMembership, composite keys, server-derived auth | Phase 0 | READY_TO_START |
| 2 | Financial Core & Decimal Migration | Prisma Decimal, ledger balancing, tax engine | Phase 1 | PLANNED |
| 3 | Restaurant Operations MVP | POS 70/30 layout, table management, order lifecycle | Phase 2 | PLANNED |
| 4 | Kitchen Display & Recipe Engine | KDS tickets, station routing, recipe costing | Phase 3 | PLANNED |
| 5 | Hotel Rooms & Stay Management | Room matrix, GiST exclusion constraints, check-in | Phase 2 | PLANNED |
| 6 | Guest Folio & Settlement | Combined billing, split payments, invoice generation | Phase 5 | PLANNED |
| 7 | Guest QR & Digital Ordering | Self-service ordering, payment gateway integration | Phase 3 | PLANNED |
| 8 | Production Rollout & Operator Runbooks | Layer 1 PITR, KMS key escrow, pilot deployment | Phase 0-7 | BLOCKED_ON_PITR |

## Code Layout
- `backend/src/`: Next.js backend, API routes, Prisma client, services
- `frontend/src/`: Next.js frontend, UI pages, dashboard, components
- `scripts/`: Operational scripts, database management, rehearsal harness
- `tests/`: Integration and unit test suites
- `docs/hospitality/`: Architecture, hardening, status, and milestone specifications
