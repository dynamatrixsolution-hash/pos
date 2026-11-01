import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { PrismaClient } from "../packages/db/client";
import { randomUUID } from "node:crypto";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

// Load isolated environment if not set
if (!process.env.DATABASE_URL) {
  const envPath = resolve(__dirname, "../.env.restro.local");
  if (existsSync(envPath)) {
    const lines = readFileSync(envPath, "utf8").split(/\r?\n/);
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith("#") && trimmed.includes("=")) {
        const idx = trimmed.indexOf("=");
        const key = trimmed.slice(0, idx);
        const val = trimmed.slice(idx + 1);
        if (!process.env[key]) {
          process.env[key] = val;
        }
      }
    }
  }
}

const dbUrl = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL;

describe("Adversarial GiST Exclusion Constraint Verification Suite (Phase 5 Milestone 1)", () => {
  let prisma: PrismaClient;
  const suiteId = randomUUID().slice(0, 8);
  const createdBusinessIds: string[] = [];

  beforeAll(async () => {
    expect(dbUrl).toBeDefined();
    prisma = new PrismaClient({ datasourceUrl: dbUrl });
    await prisma.$connect();
  });

  afterAll(async () => {
    // Clean up all businesses and cascading records created during tests
    if (createdBusinessIds.length > 0) {
      await prisma.business.deleteMany({
        where: { id: { in: createdBusinessIds } },
      }).catch(() => undefined);
    }
    await prisma.$disconnect();
  });

  // Helper to create test business fixture
  async function createFixture(tag: string) {
    const businessId = `biz-${suiteId}-${tag}-${randomUUID().slice(0, 6)}`;
    const branchId = `br-${suiteId}-${tag}-${randomUUID().slice(0, 6)}`;
    const roomTypeId = `rt-${suiteId}-${tag}-${randomUUID().slice(0, 6)}`;
    createdBusinessIds.push(businessId);

    const biz = await prisma.business.create({
      data: {
        id: businessId,
        name: `Adversarial Test Business ${tag}`,
        slug: `adv-slug-${suiteId}-${tag}-${randomUUID().slice(0, 6)}`,
      },
    });

    const br = await prisma.branch.create({
      data: {
        id: branchId,
        businessId: biz.id,
        name: `Branch ${tag}`,
      },
    });

    const rt = await prisma.roomType.create({
      data: {
        id: roomTypeId,
        businessId: biz.id,
        branchId: br.id,
        name: `Room Type ${tag}`,
        code: `RT-${randomUUID().slice(0, 6).toUpperCase()}`,
        baseRate: 150,
      },
    });

    return {
      biz,
      br,
      rt,
      createRoom: async (roomNum: string) => {
        const roomId = `rm-${suiteId}-${tag}-${randomUUID().slice(0, 6)}`;
        return prisma.room.create({
          data: {
            id: roomId,
            businessId: biz.id,
            branchId: br.id,
            roomTypeId: rt.id,
            roomNumber: roomNum,
          },
        });
      },
    };
  }

  // =========================================================================
  // a) Boundary conditions: adjacent bookings [t1, t2) and [t2, t3) MUST succeed
  // =========================================================================
  describe("a) Boundary Conditions: Half-open interval [t1, t2) and [t2, t3)", () => {
    it("permits consecutive adjacent bookings touching at the exact same second", async () => {
      const fixture = await createFixture("boundary-fwd");
      const room = await fixture.createRoom("101");

      const t1 = new Date("2026-06-01T14:00:00.000Z");
      const t2 = new Date("2026-06-05T11:00:00.000Z"); // Checkout of booking 1 / check-in of booking 2
      const t3 = new Date("2026-06-10T11:00:00.000Z");

      // Booking 1: [t1, t2)
      const b1 = await prisma.roomAllocation.create({
        data: {
          id: `alloc-b1-${randomUUID().slice(0, 6)}`,
          businessId: fixture.biz.id,
          branchId: fixture.br.id,
          roomId: room.id,
          startDate: t1,
          endDate: t2,
          isBlocking: true,
        },
      });

      // Booking 2: [t2, t3)
      const b2 = await prisma.roomAllocation.create({
        data: {
          id: `alloc-b2-${randomUUID().slice(0, 6)}`,
          businessId: fixture.biz.id,
          branchId: fixture.br.id,
          roomId: room.id,
          startDate: t2,
          endDate: t3,
          isBlocking: true,
        },
      });

      expect(b1.id).toBeDefined();
      expect(b2.id).toBeDefined();

      const allocations = await prisma.roomAllocation.findMany({
        where: { roomId: room.id },
        orderBy: { startDate: "asc" },
      });
      expect(allocations).toHaveLength(2);
      expect(allocations[0].endDate).toEqual(allocations[1].startDate);
    });

    it("permits adjacent bookings regardless of insertion sequence (reverse insertion order)", async () => {
      const fixture = await createFixture("boundary-rev");
      const room = await fixture.createRoom("102");

      const t1 = new Date("2026-07-01T14:00:00.000Z");
      const t2 = new Date("2026-07-05T11:00:00.000Z");
      const t3 = new Date("2026-07-10T11:00:00.000Z");

      // Insert future booking [t2, t3) first
      const b2 = await prisma.roomAllocation.create({
        data: {
          id: `alloc-rev2-${randomUUID().slice(0, 6)}`,
          businessId: fixture.biz.id,
          branchId: fixture.br.id,
          roomId: room.id,
          startDate: t2,
          endDate: t3,
          isBlocking: true,
        },
      });

      // Insert earlier adjacent booking [t1, t2) second
      const b1 = await prisma.roomAllocation.create({
        data: {
          id: `alloc-rev1-${randomUUID().slice(0, 6)}`,
          businessId: fixture.biz.id,
          branchId: fixture.br.id,
          roomId: room.id,
          startDate: t1,
          endDate: t2,
          isBlocking: true,
        },
      });

      expect(b2.id).toBeDefined();
      expect(b1.id).toBeDefined();
    });

    it("supports multi-day chained bookings: 4 consecutive adjacent turns without gaps", async () => {
      const fixture = await createFixture("boundary-chain");
      const room = await fixture.createRoom("103");

      const dates = [
        new Date("2026-08-01T10:00:00.000Z"),
        new Date("2026-08-02T10:00:00.000Z"),
        new Date("2026-08-03T10:00:00.000Z"),
        new Date("2026-08-04T10:00:00.000Z"),
        new Date("2026-08-05T10:00:00.000Z"),
      ];

      for (let i = 0; i < dates.length - 1; i++) {
        await prisma.roomAllocation.create({
          data: {
            id: `chain-${i}-${randomUUID().slice(0, 6)}`,
            businessId: fixture.biz.id,
            branchId: fixture.br.id,
            roomId: room.id,
            startDate: dates[i],
            endDate: dates[i + 1],
            isBlocking: true,
          },
        });
      }

      const count = await prisma.roomAllocation.count({ where: { roomId: room.id } });
      expect(count).toBe(4);
    });
  });

  // =========================================================================
  // b) Concurrency collision: overlapping blocking intervals MUST fail with 23P01
  // =========================================================================
  describe("b) Concurrency Collision: Overlapping blocking intervals fail with SQL 23P01", () => {
    it("rejects partial trailing overlap [t1, t3) vs [t2, t4) with 23P01", async () => {
      const fixture = await createFixture("overlap-trail");
      const room = await fixture.createRoom("201");

      // Booking 1: June 1 14:00 - June 5 11:00
      await prisma.roomAllocation.create({
        data: {
          id: `alloc-trail1-${randomUUID().slice(0, 6)}`,
          businessId: fixture.biz.id,
          branchId: fixture.br.id,
          roomId: room.id,
          startDate: new Date("2026-06-01T14:00:00.000Z"),
          endDate: new Date("2026-06-05T11:00:00.000Z"),
          isBlocking: true,
        },
      });

      // Booking 2: June 4 14:00 - June 8 11:00 (overlaps on June 4-5)
      let caughtError: any = null;
      try {
        await prisma.roomAllocation.create({
          data: {
            id: `alloc-trail2-${randomUUID().slice(0, 6)}`,
            businessId: fixture.biz.id,
            branchId: fixture.br.id,
            roomId: room.id,
            startDate: new Date("2026-06-04T14:00:00.000Z"),
            endDate: new Date("2026-06-08T11:00:00.000Z"),
            isBlocking: true,
          },
        });
      } catch (err: any) {
        caughtError = err;
      }

      expect(caughtError).not.toBeNull();
      expect(caughtError.message).toMatch(/23P01|conflicting key value violates exclusion constraint/i);
    });

    it("rejects total inner containment [t1, t4) vs [t2, t3) with 23P01", async () => {
      const fixture = await createFixture("overlap-contain");
      const room = await fixture.createRoom("202");

      // Outer booking: June 1 - June 10
      await prisma.roomAllocation.create({
        data: {
          id: `alloc-outer-${randomUUID().slice(0, 6)}`,
          businessId: fixture.biz.id,
          branchId: fixture.br.id,
          roomId: room.id,
          startDate: new Date("2026-06-01T14:00:00.000Z"),
          endDate: new Date("2026-06-10T11:00:00.000Z"),
          isBlocking: true,
        },
      });

      // Inner booking: June 3 - June 6
      let caughtError: any = null;
      try {
        await prisma.roomAllocation.create({
          data: {
            id: `alloc-inner-${randomUUID().slice(0, 6)}`,
            businessId: fixture.biz.id,
            branchId: fixture.br.id,
            roomId: room.id,
            startDate: new Date("2026-06-03T14:00:00.000Z"),
            endDate: new Date("2026-06-06T11:00:00.000Z"),
            isBlocking: true,
          },
        });
      } catch (err: any) {
        caughtError = err;
      }

      expect(caughtError).not.toBeNull();
      expect(caughtError.message).toMatch(/23P01|conflicting key value violates exclusion constraint/i);
    });

    it("rejects identical interval collisions [t1, t2) vs [t1, t2) with 23P01", async () => {
      const fixture = await createFixture("overlap-exact");
      const room = await fixture.createRoom("203");

      const start = new Date("2026-09-01T14:00:00.000Z");
      const end = new Date("2026-09-05T11:00:00.000Z");

      await prisma.roomAllocation.create({
        data: {
          id: `alloc-exact1-${randomUUID().slice(0, 6)}`,
          businessId: fixture.biz.id,
          branchId: fixture.br.id,
          roomId: room.id,
          startDate: start,
          endDate: end,
          isBlocking: true,
        },
      });

      let caughtError: any = null;
      try {
        await prisma.roomAllocation.create({
          data: {
            id: `alloc-exact2-${randomUUID().slice(0, 6)}`,
            businessId: fixture.biz.id,
            branchId: fixture.br.id,
            roomId: room.id,
            startDate: start,
            endDate: end,
            isBlocking: true,
          },
        });
      } catch (err: any) {
        caughtError = err;
      }

      expect(caughtError).not.toBeNull();
      expect(caughtError.message).toMatch(/23P01|conflicting key value violates exclusion constraint/i);
    });

    it("rejects 1-second boundary overlap (t2 - 1s) with 23P01", async () => {
      const fixture = await createFixture("overlap-1sec");
      const room = await fixture.createRoom("204");

      const t1 = new Date("2026-10-01T14:00:00.000Z");
      const t2 = new Date("2026-10-05T11:00:00.000Z");
      // Starts 1 second before t2 checkout
      const t2Minus1Sec = new Date("2026-10-05T10:59:59.000Z");
      const t3 = new Date("2026-10-10T11:00:00.000Z");

      await prisma.roomAllocation.create({
        data: {
          id: `alloc-sec1-${randomUUID().slice(0, 6)}`,
          businessId: fixture.biz.id,
          branchId: fixture.br.id,
          roomId: room.id,
          startDate: t1,
          endDate: t2,
          isBlocking: true,
        },
      });

      let caughtError: any = null;
      try {
        await prisma.roomAllocation.create({
          data: {
            id: `alloc-sec2-${randomUUID().slice(0, 6)}`,
            businessId: fixture.biz.id,
            branchId: fixture.br.id,
            roomId: room.id,
            startDate: t2Minus1Sec,
            endDate: t3,
            isBlocking: true,
          },
        });
      } catch (err: any) {
        caughtError = err;
      }

      expect(caughtError).not.toBeNull();
      expect(caughtError.message).toMatch(/23P01|conflicting key value violates exclusion constraint/i);
    });

    it("handles 10 parallel concurrent overlapping requests: exactly 1 wins, 9 fail with 23P01", async () => {
      const fixture = await createFixture("concurrency-burst");
      const room = await fixture.createRoom("205");

      const start = new Date("2026-11-01T14:00:00.000Z");
      const end = new Date("2026-11-05T11:00:00.000Z");

      const attempts = 10;
      const promises = Array.from({ length: attempts }, (_, i) =>
        prisma.roomAllocation.create({
          data: {
            id: `burst-${i}-${randomUUID().slice(0, 6)}`,
            businessId: fixture.biz.id,
            branchId: fixture.br.id,
            roomId: room.id,
            startDate: start,
            endDate: end,
            isBlocking: true,
          },
        })
      );

      const results = await Promise.allSettled(promises);
      const fulfilled = results.filter(r => r.status === "fulfilled");
      const rejected = results.filter(r => r.status === "rejected");

      expect(fulfilled).toHaveLength(1);
      expect(rejected).toHaveLength(9);

      for (const rej of rejected) {
        const reason = (rej as PromiseRejectedResult).reason;
        expect(reason.message).toMatch(/23P01|conflicting key value violates exclusion constraint/i);
      }

      // Live DB row count verification
      const count = await prisma.roomAllocation.count({ where: { roomId: room.id } });
      expect(count).toBe(1);
    });
  });

  // =========================================================================
  // c) Soft holds: overlapping non-blocking intervals (isBlocking = false) MUST succeed
  // =========================================================================
  describe("c) Soft Holds: Overlapping non-blocking intervals (isBlocking = false)", () => {
    it("allows multiple overlapping non-blocking allocations on the same room and same dates", async () => {
      const fixture = await createFixture("soft-multi");
      const room = await fixture.createRoom("301");

      const start = new Date("2026-12-01T14:00:00.000Z");
      const end = new Date("2026-12-05T11:00:00.000Z");

      // Soft hold 1: Inquiry A
      const h1 = await prisma.roomAllocation.create({
        data: {
          id: `hold-1-${randomUUID().slice(0, 6)}`,
          businessId: fixture.biz.id,
          branchId: fixture.br.id,
          roomId: room.id,
          startDate: start,
          endDate: end,
          isBlocking: false,
          status: "INQUIRY",
        },
      });

      // Soft hold 2: Inquiry B (exact same room and dates)
      const h2 = await prisma.roomAllocation.create({
        data: {
          id: `hold-2-${randomUUID().slice(0, 6)}`,
          businessId: fixture.biz.id,
          branchId: fixture.br.id,
          roomId: room.id,
          startDate: start,
          endDate: end,
          isBlocking: false,
          status: "INQUIRY",
        },
      });

      expect(h1.id).toBeDefined();
      expect(h2.id).toBeDefined();

      const count = await prisma.roomAllocation.count({ where: { roomId: room.id } });
      expect(count).toBe(2);
    });

    it("allows a non-blocking allocation to coexist with an overlapping blocking allocation", async () => {
      const fixture = await createFixture("soft-blocking-mix");
      const room = await fixture.createRoom("302");

      const start = new Date("2026-12-10T14:00:00.000Z");
      const end = new Date("2026-12-15T11:00:00.000Z");

      // 1. Confirmed blocking booking
      const blocking = await prisma.roomAllocation.create({
        data: {
          id: `alloc-block-${randomUUID().slice(0, 6)}`,
          businessId: fixture.biz.id,
          branchId: fixture.br.id,
          roomId: room.id,
          startDate: start,
          endDate: end,
          isBlocking: true,
          status: "CONFIRMED",
        },
      });

      // 2. Overlapping non-blocking tentative hold
      const nonBlocking = await prisma.roomAllocation.create({
        data: {
          id: `alloc-tentative-${randomUUID().slice(0, 6)}`,
          businessId: fixture.biz.id,
          branchId: fixture.br.id,
          roomId: room.id,
          startDate: start,
          endDate: end,
          isBlocking: false,
          status: "TENTATIVE",
        },
      });

      expect(blocking.id).toBeDefined();
      expect(nonBlocking.id).toBeDefined();
    });

    it("rejects upgrading a soft hold to isBlocking = true when it collides with an existing blocking allocation", async () => {
      const fixture = await createFixture("soft-upgrade-fail");
      const room = await fixture.createRoom("303");

      const start = new Date("2026-12-20T14:00:00.000Z");
      const end = new Date("2026-12-25T11:00:00.000Z");

      // 1. Existing blocking booking
      await prisma.roomAllocation.create({
        data: {
          id: `alloc-upg-block-${randomUUID().slice(0, 6)}`,
          businessId: fixture.biz.id,
          branchId: fixture.br.id,
          roomId: room.id,
          startDate: start,
          endDate: end,
          isBlocking: true,
        },
      });

      // 2. Existing non-blocking hold
      const softHold = await prisma.roomAllocation.create({
        data: {
          id: `alloc-upg-soft-${randomUUID().slice(0, 6)}`,
          businessId: fixture.biz.id,
          branchId: fixture.br.id,
          roomId: room.id,
          startDate: start,
          endDate: end,
          isBlocking: false,
        },
      });

      // 3. Attempting to convert soft hold to blocking MUST trigger 23P01
      let caughtError: any = null;
      try {
        await prisma.roomAllocation.update({
          where: { id: softHold.id },
          data: { isBlocking: true },
        });
      } catch (err: any) {
        caughtError = err;
      }

      expect(caughtError).not.toBeNull();
      expect(caughtError.message).toMatch(/23P01|conflicting key value violates exclusion constraint/i);
    });
  });

  // =========================================================================
  // d) Tenant isolation: overlapping intervals for different businessId MUST succeed
  // =========================================================================
  describe("d) Tenant Isolation: Overlapping intervals across different businesses", () => {
    it("allows identical date intervals for two different tenants with distinct rooms", async () => {
      const fixtureTenantA = await createFixture("tenant-a");
      const fixtureTenantB = await createFixture("tenant-b");

      const roomA = await fixtureTenantA.createRoom("Suite-100");
      const roomB = await fixtureTenantB.createRoom("Suite-100"); // Same room number string, different tenant/business

      const start = new Date("2027-01-10T14:00:00.000Z");
      const end = new Date("2027-01-15T11:00:00.000Z");

      // Tenant A booking
      const allocA = await prisma.roomAllocation.create({
        data: {
          id: `tenant-a-alloc-${randomUUID().slice(0, 6)}`,
          businessId: fixtureTenantA.biz.id,
          branchId: fixtureTenantA.br.id,
          roomId: roomA.id,
          startDate: start,
          endDate: end,
          isBlocking: true,
        },
      });

      // Tenant B booking on identical interval
      const allocB = await prisma.roomAllocation.create({
        data: {
          id: `tenant-b-alloc-${randomUUID().slice(0, 6)}`,
          businessId: fixtureTenantB.biz.id,
          branchId: fixtureTenantB.br.id,
          roomId: roomB.id,
          startDate: start,
          endDate: end,
          isBlocking: true,
        },
      });

      expect(allocA.id).toBeDefined();
      expect(allocB.id).toBeDefined();

      // Ensure tenant query isolation
      const tenantAAllocations = await prisma.roomAllocation.findMany({
        where: { businessId: fixtureTenantA.biz.id },
      });
      expect(tenantAAllocations).toHaveLength(1);
      expect(tenantAAllocations[0].id).toBe(allocA.id);

      const tenantBAllocations = await prisma.roomAllocation.findMany({
        where: { businessId: fixtureTenantB.biz.id },
      });
      expect(tenantBAllocations).toHaveLength(1);
      expect(tenantBAllocations[0].id).toBe(allocB.id);
    });
  });

  // =========================================================================
  // e) Different room: overlapping intervals for different roomId in same business MUST succeed
  // =========================================================================
  describe("e) Different Rooms: Overlapping intervals across different rooms in same business", () => {
    it("allows concurrent blocking bookings across separate rooms within the same property", async () => {
      const fixture = await createFixture("same-biz-diff-rooms");
      const room1 = await fixture.createRoom("Room-401");
      const room2 = await fixture.createRoom("Room-402");

      const start = new Date("2027-02-01T14:00:00.000Z");
      const end = new Date("2027-02-05T11:00:00.000Z");

      // Room 1 booking
      const alloc1 = await prisma.roomAllocation.create({
        data: {
          id: `alloc-rm1-${randomUUID().slice(0, 6)}`,
          businessId: fixture.biz.id,
          branchId: fixture.br.id,
          roomId: room1.id,
          startDate: start,
          endDate: end,
          isBlocking: true,
        },
      });

      // Room 2 booking (exact same dates, same business)
      const alloc2 = await prisma.roomAllocation.create({
        data: {
          id: `alloc-rm2-${randomUUID().slice(0, 6)}`,
          businessId: fixture.biz.id,
          branchId: fixture.br.id,
          roomId: room2.id,
          startDate: start,
          endDate: end,
          isBlocking: true,
        },
      });

      expect(alloc1.id).toBeDefined();
      expect(alloc2.id).toBeDefined();

      const businessAllocations = await prisma.roomAllocation.findMany({
        where: { businessId: fixture.biz.id },
      });
      expect(businessAllocations).toHaveLength(2);
    });
  });
});
