import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { isolatedDatabaseUrl } from "../scripts/database-verification.mjs";

const target = process.env.TEST_DATABASE_URL;
if (!target && process.env.RESTRO_REQUIRE_DATABASE_TESTS === "true") {
  throw new Error("Phase 1 security integration verification requires isolated PostgreSQL");
}
if (target) {
  isolatedDatabaseUrl(target);
  process.env.DATABASE_URL = target;
  process.env.DIRECT_URL = target;
}

const identity = vi.hoisted(() => ({ user: {} as Record<string, unknown> }));
vi.mock("@/auth", () => ({ auth: async () => ({ user: identity.user }) }));

import { verifyBranchAccess, verifyBusinessAccess } from "../backend/src/lib/api-auth";
import { createAuditEvent, sanitizeAuditData } from "../backend/src/lib/audit-event";
import { hasPermission } from "../backend/src/lib/rbac";

describe.skipIf(!target)("Phase 1: Security Foundation & Multi-Tenant Authority", () => {
  let db: import("@dynapos/db").PrismaClient;
  const businessAId = randomUUID();
  const businessBId = randomUUID();
  const branchA1Id = randomUUID();
  const branchA2Id = randomUUID();
  const branchB1Id = randomUUID();
  const staffUserId = randomUUID();
  const ownerUserId = randomUUID();

  beforeAll(async () => {
    const { PrismaClient } = await import("@dynapos/db");
    db = new PrismaClient({ datasourceUrl: target, log: [] });
    await db.$connect();

    // Setup Tenant A
    await db.business.create({
      data: {
        id: businessAId,
        slug: `tenant-a-${randomUUID().slice(0, 8)}`,
        name: "Tenant Alpha Security Test",
      },
    });

    // Setup Tenant B
    await db.business.create({
      data: {
        id: businessBId,
        slug: `tenant-b-${randomUUID().slice(0, 8)}`,
        name: "Tenant Beta Security Test",
      },
    });

    // Create Branches in Tenant A
    await db.branch.create({
      data: {
        id: branchA1Id,
        businessId: businessAId,
        name: "Alpha Main Branch",
      },
    });

    await db.branch.create({
      data: {
        id: branchA2Id,
        businessId: businessAId,
        name: "Alpha Secondary Branch",
      },
    });

    // Create Branch in Tenant B
    await db.branch.create({
      data: {
        id: branchB1Id,
        businessId: businessBId,
        name: "Beta Main Branch",
      },
    });

    // Create Staff User in Tenant A (primary branch: branchA1)
    await db.user.create({
      data: {
        id: staffUserId,
        businessId: businessAId,
        branchId: branchA1Id,
        email: `staff-${randomUUID().slice(0, 8)}@example.com`,
        passwordHash: "hashed_dummy_password",
        name: "Alpha Staff Member",
        role: "CASHIER",
        isActive: true,
      },
    });

    // Create Owner User in Tenant A
    await db.user.create({
      data: {
        id: ownerUserId,
        businessId: businessAId,
        branchId: branchA1Id,
        email: `owner-${randomUUID().slice(0, 8)}@example.com`,
        passwordHash: "hashed_dummy_password",
        name: "Alpha Owner",
        role: "OWNER",
        isActive: true,
      },
    });
  });

  afterAll(async () => {
    if (!db) return;
    try {
      await db.auditEvent.deleteMany({
        where: { businessId: { in: [businessAId, businessBId] } },
      });
      await (db as any).userBranchMembership.deleteMany({
        where: { businessId: { in: [businessAId, businessBId] } },
      });
      await db.user.deleteMany({
        where: { businessId: { in: [businessAId, businessBId] } },
      });
      await db.branch.deleteMany({
        where: { businessId: { in: [businessAId, businessBId] } },
      });
      await db.business.deleteMany({
        where: { id: { in: [businessAId, businessBId] } },
      });
    } finally {
      await db.$disconnect();
    }
  });

  describe("1. Branch Authority & UserBranchMembership Isolation", () => {
    it("allows staff to access their assigned primary branch", async () => {
      const canAccess = await verifyBranchAccess(staffUserId, branchA1Id);
      expect(canAccess).toBe(true);
    });

    it("denies staff from accessing an unassigned branch within same business", async () => {
      const canAccess = await verifyBranchAccess(staffUserId, branchA2Id);
      expect(canAccess).toBe(false);
    });

    it("denies staff from accessing a branch belonging to another tenant", async () => {
      const canAccess = await verifyBranchAccess(staffUserId, branchB1Id);
      expect(canAccess).toBe(false);
    });

    it("grants staff access to secondary branch once explicit UserBranchMembership is granted", async () => {
      // Grant membership
      await (db as any).userBranchMembership.create({
        data: {
          id: randomUUID(),
          businessId: businessAId,
          userId: staffUserId,
          branchId: branchA2Id,
          role: "CASHIER",
          isActive: true,
        },
      });

      const canAccess = await verifyBranchAccess(staffUserId, branchA2Id);
      expect(canAccess).toBe(true);
    });

    it("revokes access immediately if UserBranchMembership is marked inactive", async () => {
      await (db as any).userBranchMembership.updateMany({
        where: { userId: staffUserId, branchId: branchA2Id },
        data: { isActive: false },
      });

      const canAccess = await verifyBranchAccess(staffUserId, branchA2Id);
      expect(canAccess).toBe(false);
    });

    it("owner has access to all active branches within their business", async () => {
      const canAccessA1 = await verifyBranchAccess(ownerUserId, branchA1Id);
      const canAccessA2 = await verifyBranchAccess(ownerUserId, branchA2Id);
      expect(canAccessA1).toBe(true);
      expect(canAccessA2).toBe(true);

      // But owner cannot access other business's branch
      const canAccessB1 = await verifyBranchAccess(ownerUserId, branchB1Id);
      expect(canAccessB1).toBe(false);
    });

    it("fails closed if the user account is deactivated", async () => {
      const inactiveUserId = randomUUID();
      await db.user.create({
        data: {
          id: inactiveUserId,
          businessId: businessAId,
          branchId: branchA1Id,
          email: `inactive-${randomUUID().slice(0, 8)}@example.com`,
          passwordHash: "hashed_dummy_password",
          name: "Inactive Staff",
          role: "CASHIER",
          isActive: false, // Inactive
        },
      });

      const canAccess = await verifyBranchAccess(inactiveUserId, branchA1Id);
      expect(canAccess).toBe(false);

      await db.user.delete({ where: { id: inactiveUserId } });
    });
  });

  describe("2. Cross-Tenant Isolation & Verification", () => {
    it("confirms user belongs to their own business and not another", async () => {
      const isAlpha = await verifyBusinessAccess(staffUserId, businessAId);
      const isBeta = await verifyBusinessAccess(staffUserId, businessBId);
      expect(isAlpha).toBe(true);
      expect(isBeta).toBe(false);
    });
  });

  describe("3. Audit Trail Sanitization & Atomic Transaction Rollback", () => {
    it("sanitizes passwords, secrets, tokens, and authorization credentials from audit logs", () => {
      const dirty = {
        username: "admin_test",
        password: "SuperSecretPassword123!",
        passwordHash: "argon2id$v=19$m=65536,t=3,p=4$...",
        nested: {
          apiToken: "tok_secret_9999",
          clientSecret: "shhh_secret",
          normalField: "visibleValue",
        },
        list: [
          { authHeader: "Bearer eyJhbGciOi...", id: 1 },
        ],
      };

      const clean = sanitizeAuditData(dirty);

      expect(clean.password).toBe("[REDACTED]");
      expect(clean.passwordHash).toBe("[REDACTED]");
      expect(clean.nested.apiToken).toBe("[REDACTED]");
      expect(clean.nested.clientSecret).toBe("[REDACTED]");
      expect(clean.nested.normalField).toBe("visibleValue");
      expect(clean.list[0].authHeader).toBe("[REDACTED]");
      expect(clean.list[0].id).toBe(1);
    });

    it("commits AuditEvent atomically inside successful transaction", async () => {
      const testCustomerId = randomUUID();

      await db.$transaction(async (tx) => {
        await tx.customer.create({
          data: {
            id: testCustomerId,
            businessId: businessAId,
            name: "Audit Test Customer",
          },
        });

        await createAuditEvent(
          {
            businessId: businessAId,
            userId: staffUserId,
            action: "CUSTOMER_CREATE",
            entity: "Customer",
            entityId: testCustomerId,
            newValue: { name: "Audit Test Customer" },
          },
          tx
        );
      });

      // Verify both persisted
      const customer = await db.customer.findUnique({ where: { id: testCustomerId } });
      const audit = await db.auditEvent.findFirst({
        where: { businessId: businessAId, entityId: testCustomerId },
      });

      expect(customer).not.toBeNull();
      expect(audit).not.toBeNull();
      expect(audit?.action).toBe("CUSTOMER_CREATE");

      // Cleanup
      await db.customer.delete({ where: { id: testCustomerId } });
      if (audit) await db.auditEvent.delete({ where: { id: audit.id } });
    });

    it("aborts customer mutation if audit logging or downstream step fails in transaction", async () => {
      const failingCustomerId = randomUUID();

      await expect(
        db.$transaction(async (tx) => {
          await tx.customer.create({
            data: {
              id: failingCustomerId,
              businessId: businessAId,
              name: "Rollback Test Customer",
            },
          });

          await createAuditEvent(
            {
              businessId: businessAId,
              userId: staffUserId,
              action: "CUSTOMER_CREATE",
              entity: "Customer",
              entityId: failingCustomerId,
            },
            tx
          );

          // Simulate intentional crash
          throw new Error("Simulated transactional failure during mutation processing");
        })
      ).rejects.toThrow("Simulated transactional failure during mutation processing");

      // Verify neither customer nor audit event was persisted
      const customer = await db.customer.findUnique({ where: { id: failingCustomerId } });
      const audit = await db.auditEvent.findFirst({
        where: { businessId: businessAId, entityId: failingCustomerId },
      });

      expect(customer).toBeNull();
      expect(audit).toBeNull();
    });
  });

  describe("4. Role-Based Permissions (RBAC)", () => {
    it("enforces cashier cannot modify system settings or delete users", () => {
      expect(hasPermission("CASHIER" as any, "settings", "update")).toBe(false);
      expect(hasPermission("CASHIER" as any, "users", "delete")).toBe(false);
    });

    it("allows cashier to create POS sales and view catalog", () => {
      expect(hasPermission("CASHIER" as any, "pos", "create")).toBe(true);
      expect(hasPermission("CASHIER" as any, "products", "view")).toBe(true);
    });

    it("allows owner full management capabilities", () => {
      expect(hasPermission("OWNER" as any, "settings", "update")).toBe(true);
      expect(hasPermission("OWNER" as any, "users", "create")).toBe(true);
      expect(hasPermission("OWNER" as any, "reports", "view")).toBe(true);
    });
  });
});
