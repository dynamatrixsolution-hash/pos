import { createRequire } from "node:module";
import { readFileSync } from "node:fs";

const require = createRequire(import.meta.url);
const { PrismaClient } = require("../../../packages/db/client");

const primaryUrl = "postgresql://restro_dev:3e0c38bc16116ed5e530270067a32f28ab59656a39dddd60@127.0.0.1:55439/restro_test";
const restoreUrl = "postgresql://restro_restore:c3715989c485297c164d312328b32aaa815a160d0067ad0d@127.0.0.1:55440/restro_restore";

const phase5Tables = [
  "RoomType",
  "Room",
  "Reservation",
  "ReservationGuest",
  "Stay",
  "MaintenanceTicket",
  "RoomAllocation",
  "HousekeepingTask",
];

async function inspectDatabase(name, url) {
  console.log(`\n======================================================`);
  console.log(`INSPECTING DATABASE: ${name} (${url.split("@")[1]})`);
  console.log(`======================================================`);

  const client = new PrismaClient({ datasourceUrl: url });
  try {
    // 1. Migrations
    const migrations = await client.$queryRaw`
      SELECT migration_name, checksum, applied_steps_count, finished_at
      FROM _prisma_migrations
      ORDER BY finished_at ASC;
    `;
    console.log(`\n[1] Migrations in _prisma_migrations (${migrations.length} total):`);
    for (const m of migrations) {
      console.log(` - ${m.migration_name} | steps: ${m.applied_steps_count} | checksum: ${m.checksum} | finished: ${m.finished_at}`);
    }

    // 2. Tables verification
    const existingTables = await client.$queryRaw`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = ANY(${phase5Tables});
    `;
    const foundTableNames = existingTables.map(t => t.table_name);
    console.log(`\n[2] Phase 5 Tables in public schema (${foundTableNames.length}/${phase5Tables.length}):`);
    for (const table of phase5Tables) {
      const exists = foundTableNames.includes(table);
      console.log(` - ${table}: ${exists ? "EXISTS (PASS)" : "MISSING (FAIL)"}`);
    }

    // 3. btree_gist extension
    const extensions = await client.$queryRaw`
      SELECT extname, extversion
      FROM pg_extension
      WHERE extname = 'btree_gist';
    `;
    console.log(`\n[3] btree_gist extension:`);
    if (extensions.length > 0) {
      console.log(` - btree_gist version ${extensions[0].extversion} is ACTIVE (PASS)`);
    } else {
      console.log(` - btree_gist extension NOT FOUND (FAIL)`);
    }

    // 4. GiST exclusion constraint on RoomAllocation
    const constraints = await client.$queryRaw`
      SELECT
        conname,
        contype,
        pg_get_constraintdef(c.oid) AS def
      FROM pg_constraint c
      JOIN pg_class t ON c.conrelid = t.oid
      WHERE t.relname = 'RoomAllocation'
        AND c.conname = 'RoomAllocation_room_period_overlap_excl';
    `;
    console.log(`\n[4] GiST Exclusion Constraint on RoomAllocation:`);
    if (constraints.length > 0) {
      console.log(` - Name: ${constraints[0].conname}`);
      console.log(` - Type: ${constraints[0].contype} ('x' = exclusion) (PASS)`);
      console.log(` - Definition: ${constraints[0].def}`);
    } else {
      console.log(` - Constraint 'RoomAllocation_room_period_overlap_excl' NOT FOUND (FAIL)`);
    }

    // 5. Total table count in public schema
    const totalTables = await client.$queryRaw`
      SELECT count(*)::int AS count
      FROM information_schema.tables
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE';
    `;
    console.log(`\n[5] Total Base Tables in public schema: ${totalTables[0].count}`);

    return {
      name,
      migrationCount: migrations.length,
      hasPhase5Migration: migrations.some(m => m.migration_name.includes("phase5_hotel_stays_rooms")),
      tablesFound: foundTableNames.length,
      hasBtreeGist: extensions.length > 0,
      hasExclusionConstraint: constraints.length > 0 && constraints[0].contype === "x",
      totalBaseTables: totalTables[0].count,
    };
  } finally {
    await client.$disconnect();
  }
}

async function testExclusionConstraintEmpirically(url) {
  console.log(`\n======================================================`);
  console.log(`EMPIRICAL STRESS TEST OF GiST EXCLUSION CONSTRAINT`);
  console.log(`Target: ${url.split("@")[1]}`);
  console.log(`======================================================`);

  const client = new PrismaClient({ datasourceUrl: url });
  const testId = `aud-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
  const businessId = `biz-${testId}`;
  const branchId = `br-${testId}`;
  const roomTypeId = `rt-${testId}`;
  const roomId = `room-${testId}`;

  try {
    // Setup entities
    await client.business.create({
      data: { id: businessId, name: `Audit Hotel ${testId}`, slug: `slug-${testId}` },
    });
    await client.branch.create({
      data: { id: branchId, businessId, name: `Audit Branch ${testId}` },
    });
    await client.roomType.create({
      data: { id: roomTypeId, businessId, branchId, name: "Suite", code: `S-${testId.slice(-4)}`, baseRate: 200 },
    });
    await client.room.create({
      data: { id: roomId, businessId, branchId, roomTypeId, roomNumber: `AUD-${testId.slice(-4)}` },
    });

    console.log(`Created test fixture: business=${businessId}, room=${roomId}`);

    // Allocation 1: [2026-12-01 14:00, 2026-12-05 11:00) isBlocking=true
    await client.roomAllocation.create({
      data: {
        id: `alloc-1-${testId}`,
        businessId,
        branchId,
        roomId,
        startDate: new Date("2026-12-01T14:00:00.000Z"),
        endDate: new Date("2026-12-05T11:00:00.000Z"),
        isBlocking: true,
      },
    });
    console.log(`[Test 1] Booking A [2026-12-01 14:00 to 2026-12-05 11:00): SUCCESS (PASS)`);

    // Allocation 2 (Adjacent): [2026-12-05 11:00, 2026-12-08 11:00) isBlocking=true
    await client.roomAllocation.create({
      data: {
        id: `alloc-2-${testId}`,
        businessId,
        branchId,
        roomId,
        startDate: new Date("2026-12-05T11:00:00.000Z"),
        endDate: new Date("2026-12-08T11:00:00.000Z"),
        isBlocking: true,
      },
    });
    console.log(`[Test 2] Booking B adjacent [2026-12-05 11:00 to 2026-12-08 11:00): SUCCESS (PASS - Half-open interval allowed)`);

    // Allocation 3 (Overlap): [2026-12-03 14:00, 2026-12-06 11:00) isBlocking=true
    let caughtError = null;
    try {
      await client.roomAllocation.create({
        data: {
          id: `alloc-3-${testId}`,
          businessId,
          branchId,
          roomId,
          startDate: new Date("2026-12-03T14:00:00.000Z"),
          endDate: new Date("2026-12-06T11:00:00.000Z"),
          isBlocking: true,
        },
      });
    } catch (err) {
      caughtError = err;
    }

    if (caughtError && /23P01|conflicting key value violates exclusion constraint/i.test(caughtError.message)) {
      console.log(`[Test 3] Overlapping booking on same room threw expected SQL 23P01 exclusion violation:`);
      console.log(`         "${caughtError.message.split("\n").slice(-2).join(" ")}" (PASS)`);
    } else {
      console.log(`[Test 3] Overlapping booking DID NOT throw SQL 23P01:`, caughtError);
      throw new Error("GiST Exclusion Constraint failed to block overlapping allocation!");
    }

    // Allocation 4 (Non-blocking overlap): [2026-12-03 14:00, 2026-12-06 11:00) isBlocking=false
    // Should SUCCEED because constraint specifies WHERE ("isBlocking" = true)
    await client.roomAllocation.create({
      data: {
        id: `alloc-4-${testId}`,
        businessId,
        branchId,
        roomId,
        startDate: new Date("2026-12-03T14:00:00.000Z"),
        endDate: new Date("2026-12-06T11:00:00.000Z"),
        isBlocking: false,
      },
    });
    console.log(`[Test 4] Non-blocking allocation (isBlocking=false) overlapping [2026-12-03 to 2026-12-06): SUCCESS (PASS - WHERE filter respected)`);

  } finally {
    // Cleanup
    await client.business.deleteMany({ where: { id: businessId } }).catch(e => console.error("Cleanup error:", e));
    console.log(`Cleaned up test fixture businessId=${businessId}`);
    await client.$disconnect();
  }
}

async function main() {
  const r1 = await inspectDatabase("Primary Cluster (restro_test)", primaryUrl);
  const r2 = await inspectDatabase("Restore Cluster (restro_restore)", restoreUrl);

  await testExclusionConstraintEmpirically(primaryUrl);
  await testExclusionConstraintEmpirically(restoreUrl);

  console.log(`\n======================================================`);
  console.log(`SUMMARY OF DATABASE CHECKS:`);
  console.log(`Primary Cluster:`, r1);
  console.log(`Restore Cluster:`, r2);
  console.log(`======================================================\n`);
}

main().catch(err => {
  console.error("Verification failed:", err);
  process.exit(1);
});
