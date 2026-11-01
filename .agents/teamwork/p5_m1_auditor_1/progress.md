# Progress — p5_m1_auditor_1

Last visited: 2026-11-01T06:05:00Z

- Status: Testing
- Current action: Re-running rehearse recovery (task-103)
- Findings so far:
  - schema.prisma defines 8 genuine hotel models with @@unique([businessId, id]) and scalar Room.currentStayId
  - migration.sql has btree_gist extension and GiST exclusion constraint on RoomAllocation
  - Both live PostgreSQL clusters (ports 55439 and 55440) have all 8 tables and active GiST exclusion constraints
  - Empirical exclusion violation test against both clusters raised SQL 23P01 on overlap and allowed adjacent half-open bookings
