-- Prayassh POS & ERP - Cash Register & Shift Management Spec v1.0 Migration
-- Enforces DB-level partial unique index guaranteeing at most one OPEN shift per register

CREATE UNIQUE INDEX IF NOT EXISTS "uq_active_shift_per_register"
ON "CashierShift" ("registerId")
WHERE "status" = 'OPEN';

