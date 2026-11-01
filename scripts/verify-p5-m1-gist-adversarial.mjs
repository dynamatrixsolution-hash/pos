import { createRequire } from "node:module";
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// 1. Load isolated database environment
const envPath = resolve(__dirname, "../.env.restro.local");
if (!existsSync(envPath)) {
  console.error("FATAL: .env.restro.local not found");
  process.exit(1);
}

const env = Object.fromEntries(
  readFileSync(envPath, "utf8")
    .split(/\r?\n/)
    .filter((line) => line.trim() && !line.trimStart().startsWith("#"))
    .map((line) => {
      const idx = line.indexOf("=");
      return [line.slice(0, idx), line.slice(idx + 1)];
    })
);

const dbUrl = env.TEST_DATABASE_URL || env.DATABASE_URL;
if (!dbUrl || !dbUrl.includes("55439")) {
  console.error("FATAL: Target database URL must be on isolated port 55439. Found:", dbUrl);
  process.exit(1);
}

const require = createRequire(import.meta.url);
const { PrismaClient } = require("../packages/db/client");
const prisma = new PrismaClient({ datasourceUrl: dbUrl });

const suiteTag = `adv-script-${Date.now()}-${randomUUID().slice(0, 4)}`;
const createdBusinessIds = [];

const results = [];

function recordResult(section, testName, passed, details = "") {
  results.push({ section, testName, passed, details });
  const status = passed ? "\x1b[32mPASS\x1b[0m" : "\x1b[31mFAIL\x1b[0m";
  console.log(`[${status}] [${section}] ${testName} ${details ? `(${details})` : ""}`);
}

async function createFixture(tag) {
  const businessId = `biz-${suiteTag}-${tag}-${randomUUID().slice(0, 6)}`;
  const branchId = `br-${suiteTag}-${tag}-${randomUUID().slice(0, 6)}`;
  const roomTypeId = `rt-${suiteTag}-${tag}-${randomUUID().slice(0, 6)}`;
  createdBusinessIds.push(businessId);

  const biz = await prisma.business.create({
    data: {
      id: businessId,
      name: `Adversarial Test Business ${tag}`,
      slug: `slug-${suiteTag}-${tag}-${randomUUID().slice(0, 6)}`,
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
      baseRate: 120,
    },
  });

  return {
    biz,
    br,
    rt,
    createRoom: async (roomNum) => {
      const roomId = `rm-${suiteTag}-${tag}-${randomUUID().slice(0, 6)}`;
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

async function runAdversarialSuite() {
  console.log(`\n======================================================================`);
  console.log(`  STARTING EMPIRICAL ADVERSARIAL GIST EXCLUSION STRESS TEST SUITE`);
  console.log(`  Target: PostgreSQL on Port 55439 (restro_test)`);
  console.log(`  Suite Tag: ${suiteTag}`);
  console.log(`======================================================================\n`);

  const tStart = Date.now();

  try {
    // ------------------------------------------------------------------------
    // Part a: Boundary conditions
    // ------------------------------------------------------------------------
    console.log(`--- [Section a] Boundary Conditions: Half-Open Intervals [t1, t2) & [t2, t3) ---`);
    const fixA = await createFixture("sec-a");
    const roomA = await fixA.createRoom("101-Boundary");

    const t1 = new Date("2026-06-01T14:00:00.000Z");
    const t2 = new Date("2026-06-05T11:00:00.000Z");
    const t3 = new Date("2026-06-10T11:00:00.000Z");

    // a.1 Forward insertion adjacent bookings
    const allocA1 = await prisma.roomAllocation.create({
      data: {
        id: `alloc-a1-${randomUUID().slice(0, 6)}`,
        businessId: fixA.biz.id,
        branchId: fixA.br.id,
        roomId: roomA.id,
        startDate: t1,
        endDate: t2,
        isBlocking: true,
      },
    });
    const allocA2 = await prisma.roomAllocation.create({
      data: {
        id: `alloc-a2-${randomUUID().slice(0, 6)}`,
        businessId: fixA.biz.id,
        branchId: fixA.br.id,
        roomId: roomA.id,
        startDate: t2,
        endDate: t3,
        isBlocking: true,
      },
    });
    recordResult(
      "Section A",
      "a.1: Forward insertion of adjacent bookings [t1, t2) & [t2, t3) succeed",
      Boolean(allocA1.id && allocA2.id),
      `t2 exact touchpoint: ${t2.toISOString()}`
    );

    // a.2 Reverse insertion adjacent bookings
    const roomA2 = await fixA.createRoom("102-BoundaryRev");
    const allocA2_rev = await prisma.roomAllocation.create({
      data: {
        id: `alloc-a2rev-${randomUUID().slice(0, 6)}`,
        businessId: fixA.biz.id,
        branchId: fixA.br.id,
        roomId: roomA2.id,
        startDate: t2,
        endDate: t3,
        isBlocking: true,
      },
    });
    const allocA1_rev = await prisma.roomAllocation.create({
      data: {
        id: `alloc-a1rev-${randomUUID().slice(0, 6)}`,
        businessId: fixA.biz.id,
        branchId: fixA.br.id,
        roomId: roomA2.id,
        startDate: t1,
        endDate: t2,
        isBlocking: true,
      },
    });
    recordResult(
      "Section A",
      "a.2: Reverse insertion of adjacent bookings succeeds",
      Boolean(allocA1_rev.id && allocA2_rev.id)
    );

    // a.3 4-chain adjacent bookings
    const roomA3 = await fixA.createRoom("103-BoundaryChain");
    const chainDates = [
      new Date("2026-07-01T12:00:00.000Z"),
      new Date("2026-07-02T12:00:00.000Z"),
      new Date("2026-07-03T12:00:00.000Z"),
      new Date("2026-07-04T12:00:00.000Z"),
      new Date("2026-07-05T12:00:00.000Z"),
    ];
    for (let i = 0; i < chainDates.length - 1; i++) {
      await prisma.roomAllocation.create({
        data: {
          id: `chain-${i}-${randomUUID().slice(0, 6)}`,
          businessId: fixA.biz.id,
          branchId: fixA.br.id,
          roomId: roomA3.id,
          startDate: chainDates[i],
          endDate: chainDates[i + 1],
          isBlocking: true,
        },
      });
    }
    const chainCount = await prisma.roomAllocation.count({ where: { roomId: roomA3.id } });
    recordResult(
      "Section A",
      "a.3: Chained contiguous bookings (4-chain) all succeed",
      chainCount === 4,
      `persisted 4 contiguous intervals`
    );

    // ------------------------------------------------------------------------
    // Part b: Concurrency collisions
    // ------------------------------------------------------------------------
    console.log(`\n--- [Section b] Concurrency Collision & Exclusion Violations (SQL 23P01) ---`);
    const fixB = await createFixture("sec-b");
    const roomB1 = await fixB.createRoom("201-Overlap");

    // Baseline booking: June 1 14:00 to June 5 11:00
    await prisma.roomAllocation.create({
      data: {
        id: `alloc-b-base-${randomUUID().slice(0, 6)}`,
        businessId: fixB.biz.id,
        branchId: fixB.br.id,
        roomId: roomB1.id,
        startDate: new Date("2026-06-01T14:00:00.000Z"),
        endDate: new Date("2026-06-05T11:00:00.000Z"),
        isBlocking: true,
      },
    });

    // b.1 Trailing overlap: June 4 14:00 to June 8 11:00
    let b1Error = null;
    try {
      await prisma.roomAllocation.create({
        data: {
          id: `alloc-b-trail-${randomUUID().slice(0, 6)}`,
          businessId: fixB.biz.id,
          branchId: fixB.br.id,
          roomId: roomB1.id,
          startDate: new Date("2026-06-04T14:00:00.000Z"),
          endDate: new Date("2026-06-08T11:00:00.000Z"),
          isBlocking: true,
        },
      });
    } catch (e) {
      b1Error = e;
    }
    const b1Matches = Boolean(b1Error && /23P01|conflicting key value violates exclusion constraint/i.test(b1Error.message));
    recordResult(
      "Section B",
      "b.1: Partial trailing overlap rejected with 23P01",
      b1Matches,
      b1Matches ? "SQL 23P01 caught" : `Unexpected error: ${b1Error?.message}`
    );

    // b.2 Enclosing containment: May 30 to June 10
    let b2Error = null;
    try {
      await prisma.roomAllocation.create({
        data: {
          id: `alloc-b-enclosing-${randomUUID().slice(0, 6)}`,
          businessId: fixB.biz.id,
          branchId: fixB.br.id,
          roomId: roomB1.id,
          startDate: new Date("2026-05-30T14:00:00.000Z"),
          endDate: new Date("2026-06-10T11:00:00.000Z"),
          isBlocking: true,
        },
      });
    } catch (e) {
      b2Error = e;
    }
    const b2Matches = Boolean(b2Error && /23P01|conflicting key value violates exclusion constraint/i.test(b2Error.message));
    recordResult(
      "Section B",
      "b.2: Enclosing containment overlap rejected with 23P01",
      b2Matches,
      b2Matches ? "SQL 23P01 caught" : `Unexpected error: ${b2Error?.message}`
    );

    // b.3 Identical interval: June 1 14:00 to June 5 11:00
    let b3Error = null;
    try {
      await prisma.roomAllocation.create({
        data: {
          id: `alloc-b-identical-${randomUUID().slice(0, 6)}`,
          businessId: fixB.biz.id,
          branchId: fixB.br.id,
          roomId: roomB1.id,
          startDate: new Date("2026-06-01T14:00:00.000Z"),
          endDate: new Date("2026-06-05T11:00:00.000Z"),
          isBlocking: true,
        },
      });
    } catch (e) {
      b3Error = e;
    }
    const b3Matches = Boolean(b3Error && /23P01|conflicting key value violates exclusion constraint/i.test(b3Error.message));
    recordResult(
      "Section B",
      "b.3: Identical interval collision rejected with 23P01",
      b3Matches,
      b3Matches ? "SQL 23P01 caught" : `Unexpected error: ${b3Error?.message}`
    );

    // b.4 Sub-second boundary collision: Starts 1 millisecond before checkout
    let b4Error = null;
    try {
      await prisma.roomAllocation.create({
        data: {
          id: `alloc-b-subsec-${randomUUID().slice(0, 6)}`,
          businessId: fixB.biz.id,
          branchId: fixB.br.id,
          roomId: roomB1.id,
          startDate: new Date("2026-06-05T10:59:59.999Z"),
          endDate: new Date("2026-06-08T11:00:00.000Z"),
          isBlocking: true,
        },
      });
    } catch (e) {
      b4Error = e;
    }
    const b4Matches = Boolean(b4Error && /23P01|conflicting key value violates exclusion constraint/i.test(b4Error.message));
    recordResult(
      "Section B",
      "b.4: 1ms boundary overlap rejected with 23P01",
      b4Matches,
      b4Matches ? "SQL 23P01 caught" : `Unexpected error: ${b4Error?.message}`
    );

    // b.5 Concurrent burst: 10 simultaneous asynchronous requests
    const roomBurst = await fixB.createRoom("205-Burst");
    const burstStart = new Date("2026-09-01T14:00:00.000Z");
    const burstEnd = new Date("2026-09-05T11:00:00.000Z");
    const burstPromises = Array.from({ length: 10 }, (_, i) =>
      prisma.roomAllocation.create({
        data: {
          id: `burst-script-${i}-${randomUUID().slice(0, 6)}`,
          businessId: fixB.biz.id,
          branchId: fixB.br.id,
          roomId: roomBurst.id,
          startDate: burstStart,
          endDate: burstEnd,
          isBlocking: true,
        },
      })
    );
    const burstSettled = await Promise.allSettled(burstPromises);
    const burstWins = burstSettled.filter((r) => r.status === "fulfilled");
    const burstLosses = burstSettled.filter((r) => r.status === "rejected");
    const allLossesAre23P01 = burstLosses.every((r) =>
      /23P01|conflicting key value violates exclusion constraint/i.test(r.reason?.message)
    );
    const burstCount = await prisma.roomAllocation.count({ where: { roomId: roomBurst.id } });
    recordResult(
      "Section B",
      "b.5: 10-way asynchronous concurrent burst race (1 win, 9 fail with 23P01)",
      burstWins.length === 1 && burstLosses.length === 9 && allLossesAre23P01 && burstCount === 1,
      `Wins: ${burstWins.length}, Losses: ${burstLosses.length}, DB Count: ${burstCount}`
    );

    // ------------------------------------------------------------------------
    // Part c: Soft holds (isBlocking = false)
    // ------------------------------------------------------------------------
    console.log(`\n--- [Section c] Soft Holds & Non-Blocking Intervals (isBlocking = false) ---`);
    const fixC = await createFixture("sec-c");
    const roomC = await fixC.createRoom("301-Soft");

    const softStart = new Date("2026-10-01T14:00:00.000Z");
    const softEnd = new Date("2026-10-05T11:00:00.000Z");

    // c.1 Two soft holds on same room and dates
    const soft1 = await prisma.roomAllocation.create({
      data: {
        id: `soft1-${randomUUID().slice(0, 6)}`,
        businessId: fixC.biz.id,
        branchId: fixC.br.id,
        roomId: roomC.id,
        startDate: softStart,
        endDate: softEnd,
        isBlocking: false,
        status: "TENTATIVE_HOLD",
      },
    });
    const soft2 = await prisma.roomAllocation.create({
      data: {
        id: `soft2-${randomUUID().slice(0, 6)}`,
        businessId: fixC.biz.id,
        branchId: fixC.br.id,
        roomId: roomC.id,
        startDate: softStart,
        endDate: softEnd,
        isBlocking: false,
        status: "WAITLIST",
      },
    });
    recordResult(
      "Section C",
      "c.1: Multiple soft holds on exact same room and dates coexist",
      Boolean(soft1.id && soft2.id),
      "2 non-blocking holds active"
    );

    // c.2 Coexistence of soft hold with blocking booking
    const blockC = await prisma.roomAllocation.create({
      data: {
        id: `blockC-${randomUUID().slice(0, 6)}`,
        businessId: fixC.biz.id,
        branchId: fixC.br.id,
        roomId: roomC.id,
        startDate: softStart,
        endDate: softEnd,
        isBlocking: true,
        status: "CONFIRMED",
      },
    });
    recordResult(
      "Section C",
      "c.2: Blocking booking coexists with overlapping soft holds",
      Boolean(blockC.id),
      "1 blocking + 2 non-blocking active"
    );

    // c.3 Upgrading soft hold to blocking when conflicting triggers 23P01
    let upgradeError = null;
    try {
      await prisma.roomAllocation.update({
        where: { id: soft1.id },
        data: { isBlocking: true },
      });
    } catch (e) {
      upgradeError = e;
    }
    const upgradeMatches = Boolean(
      upgradeError && /23P01|conflicting key value violates exclusion constraint/i.test(upgradeError.message)
    );
    recordResult(
      "Section C",
      "c.3: Upgrading soft hold to isBlocking = true raises 23P01",
      upgradeMatches,
      upgradeMatches ? "23P01 caught on update" : `Error: ${upgradeError?.message}`
    );

    // ------------------------------------------------------------------------
    // Part d: Tenant isolation
    // ------------------------------------------------------------------------
    console.log(`\n--- [Section d] Multi-Tenant Isolation ---`);
    const fixD_Tenant1 = await createFixture("sec-d-tenant1");
    const fixD_Tenant2 = await createFixture("sec-d-tenant2");

    const roomD1 = await fixD_Tenant1.createRoom("100-OceanSuite");
    const roomD2 = await fixD_Tenant2.createRoom("100-OceanSuite"); // Same roomNumber, separate tenants

    const tenantStart = new Date("2026-11-15T14:00:00.000Z");
    const tenantEnd = new Date("2026-11-20T11:00:00.000Z");

    const allocD1 = await prisma.roomAllocation.create({
      data: {
        id: `tenant1-alloc-${randomUUID().slice(0, 6)}`,
        businessId: fixD_Tenant1.biz.id,
        branchId: fixD_Tenant1.br.id,
        roomId: roomD1.id,
        startDate: tenantStart,
        endDate: tenantEnd,
        isBlocking: true,
      },
    });
    const allocD2 = await prisma.roomAllocation.create({
      data: {
        id: `tenant2-alloc-${randomUUID().slice(0, 6)}`,
        businessId: fixD_Tenant2.biz.id,
        branchId: fixD_Tenant2.br.id,
        roomId: roomD2.id,
        startDate: tenantStart,
        endDate: tenantEnd,
        isBlocking: true,
      },
    });

    const tenant1Count = await prisma.roomAllocation.count({ where: { businessId: fixD_Tenant1.biz.id } });
    const tenant2Count = await prisma.roomAllocation.count({ where: { businessId: fixD_Tenant2.biz.id } });

    recordResult(
      "Section D",
      "d: Identical interval bookings for different businessId succeed without interference",
      Boolean(allocD1.id && allocD2.id && tenant1Count === 1 && tenant2Count === 1),
      `Tenant 1: ${tenant1Count} row, Tenant 2: ${tenant2Count} row`
    );

    // ------------------------------------------------------------------------
    // Part e: Different room in same business
    // ------------------------------------------------------------------------
    console.log(`\n--- [Section e] Different Room Isolation within Same Business ---`);
    const fixE = await createFixture("sec-e");
    const roomE1 = await fixE.createRoom("501-Penthouse");
    const roomE2 = await fixE.createRoom("502-Penthouse");

    const diffRoomStart = new Date("2026-12-01T14:00:00.000Z");
    const diffRoomEnd = new Date("2026-12-05T11:00:00.000Z");

    const allocE1 = await prisma.roomAllocation.create({
      data: {
        id: `diff-rm1-${randomUUID().slice(0, 6)}`,
        businessId: fixE.biz.id,
        branchId: fixE.br.id,
        roomId: roomE1.id,
        startDate: diffRoomStart,
        endDate: diffRoomEnd,
        isBlocking: true,
      },
    });
    const allocE2 = await prisma.roomAllocation.create({
      data: {
        id: `diff-rm2-${randomUUID().slice(0, 6)}`,
        businessId: fixE.biz.id,
        branchId: fixE.br.id,
        roomId: roomE2.id,
        startDate: diffRoomStart,
        endDate: diffRoomEnd,
        isBlocking: true,
      },
    });

    const sameBizAllocCount = await prisma.roomAllocation.count({ where: { businessId: fixE.biz.id } });
    recordResult(
      "Section E",
      "e: Identical interval bookings for different roomId in same business succeed",
      Boolean(allocE1.id && allocE2.id && sameBizAllocCount === 2),
      `Business holds 2 concurrent bookings across 2 rooms`
    );

  } finally {
    // Teardown all test fixtures
    console.log(`\nCleaning up ${createdBusinessIds.length} temporary test businesses...`);
    if (createdBusinessIds.length > 0) {
      await prisma.business.deleteMany({
        where: { id: { in: createdBusinessIds } },
      }).catch((e) => console.warn("Teardown warning:", e.message));
    }
    await prisma.$disconnect();
  }

  const durationMs = Date.now() - tStart;
  const passedCount = results.filter((r) => r.passed).length;
  const totalCount = results.length;

  console.log(`\n======================================================================`);
  console.log(`  EMPIRICAL ADVERSARIAL STRESS TEST SUMMARY`);
  console.log(`======================================================================`);
  console.log(`Total Invariants Tested: ${totalCount}`);
  console.log(`Passed: ${passedCount}`);
  console.log(`Failed: ${totalCount - passedCount}`);
  console.log(`Total Duration: ${durationMs} ms`);
  console.log(`VERDICT: ${passedCount === totalCount ? "APPROVE (All empirical invariants verified)" : "REQUEST_CHANGES"}`);
  console.log(`======================================================================\n`);

  if (passedCount !== totalCount) {
    process.exit(1);
  }
}

runAdversarialSuite().catch((err) => {
  console.error("Unhandled error during empirical adversarial verification:", err);
  process.exit(1);
});
