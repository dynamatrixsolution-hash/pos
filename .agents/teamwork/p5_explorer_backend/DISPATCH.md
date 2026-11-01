## 2026-11-01T05:20:18Z
[Message] timestamp=2026-11-01T05:20:18Z sender=35cca4ca-b4fa-46c8-b9ea-1c5b07e1cb84 priority=MESSAGE_PRIORITY_HIGH content=You are p5_explorer_backend.
Working directory: c:\projects\pos\.agents\teamwork\p5_explorer_backend\

MANDATORY INSTRUCTIONS:
1. You MUST read the original user request at: c:\projects\pos\.agents\teamwork\ORIGINAL_REQUEST.md
2. You MUST read the Phase 5 specification at: docs/hospitality/phases/PHASE_5_HOTEL_STAYS_ROOMS.md
3. Investigate the authoritative source of truth for backend services and APIs:
   - Existing services in backend/src/lib/services/ (examine transaction patterns, tenant isolation, concurrency/locking mechanisms, error handling, Zod validation)
   - Existing API routes in backend/src/app/api/v1/ (examine route handlers, auth/context resolution, response formats, status codes)
   - Existing tests in backend/ or packages/ to see testing patterns
4. Enumerate exact domain service and API requirements:
   - Room management & availability calendar service (interval overlaps, blocking allocations, room status tracking)
   - Reservation service (create, modify, cancel, no-show)
   - Check-in service (atomic allocation lock preventing double booking / race conditions, stay record creation, room status transition to OCCUPIED_CLEAN or OCCUPIED_DIRTY)
   - Room transfer service (atomic move of active allocation to a new room preserving stay identity)
   - Check-out service (releases occupancy, marks room as VACANT_DIRTY, creates HousekeepingTask)
   - Housekeeping & Maintenance service (update room cleaning status, create maintenance block)
   - API routes in backend/src/app/api/v1/hotel/ for rooms, room types, reservations, check-in, room transfer, stay extension, check-out, housekeeping, maintenance
   - Concurrency & race condition safety mechanisms (e.g., PostgreSQL advisory locks, transactions, serializable isolation or explicit overlap checks)
5. Keep a heartbeat in progress.md in your working directory.
6. Write your comprehensive survey report to c:\projects\pos\.agents\teamwork\p5_explorer_backend\handoff.md.
7. Send a completion message via send_message to your parent (orchestrator_phase5, conv ID: 35cca4ca-b4fa-46c8-b9ea-1c5b07e1cb84) referencing your handoff.md.
