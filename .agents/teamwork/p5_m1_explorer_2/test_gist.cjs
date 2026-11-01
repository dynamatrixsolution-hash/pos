const { readFileSync } = require('fs');
const { PrismaClient } = require('../../../packages/db/client/index.js');

async function testGist() {
  const env = Object.fromEntries(
    readFileSync('.env.restro.local', 'utf8')
      .split(/\r?\n/)
      .filter(l => l.trim() && !l.startsWith('#'))
      .map(l => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)])
  );
  const prisma = new PrismaClient({ datasources: { db: { url: env.DATABASE_URL } } });

  console.log('Testing btree_gist and GiST exclusion constraint on 55439...');

  try {
    // 1. Enable btree_gist
    await prisma.$executeRawUnsafe(`CREATE EXTENSION IF NOT EXISTS btree_gist;`);
    console.log('1. btree_gist extension created/verified.');

    // 2. Create test table
    await prisma.$executeRawUnsafe(`DROP TABLE IF EXISTS "_test_RoomAllocation";`);
    await prisma.$executeRawUnsafe(`
      CREATE TABLE "_test_RoomAllocation" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "businessId" TEXT NOT NULL,
        "roomId" TEXT NOT NULL,
        "startDate" TIMESTAMP(3) NOT NULL,
        "endDate" TIMESTAMP(3) NOT NULL,
        "isBlocking" BOOLEAN NOT NULL DEFAULT true,
        CONSTRAINT "_test_RoomAllocation_overlap_excl"
        EXCLUDE USING gist (
          "businessId" WITH =,
          "roomId" WITH =,
          tsrange("startDate", "endDate", '[)') WITH &&
        ) WHERE ("isBlocking" = true)
      );
    `);
    console.log('2. Test table created with GiST exclusion constraint.');

    // 3. Test non-overlapping insert
    await prisma.$executeRawUnsafe(`
      INSERT INTO "_test_RoomAllocation" ("id", "businessId", "roomId", "startDate", "endDate", "isBlocking")
      VALUES ('alloc-1', 'biz-1', 'room-101', '2026-11-01 14:00:00', '2026-11-05 11:00:00', true);
    `);
    console.log('3. Inserted base allocation (Nov 1 14:00 to Nov 5 11:00).');

    // 4. Test back-to-back turnover (adjacent, exactly Nov 5 11:00 to Nov 8 11:00)
    await prisma.$executeRawUnsafe(`
      INSERT INTO "_test_RoomAllocation" ("id", "businessId", "roomId", "startDate", "endDate", "isBlocking")
      VALUES ('alloc-2', 'biz-1', 'room-101', '2026-11-05 11:00:00', '2026-11-08 11:00:00', true);
    `);
    console.log('4. Inserted adjacent back-to-back allocation (Nov 5 11:00 to Nov 8 11:00) - SUCCESS as expected by [) semantics.');

    // 5. Test different room (same dates)
    await prisma.$executeRawUnsafe(`
      INSERT INTO "_test_RoomAllocation" ("id", "businessId", "roomId", "startDate", "endDate", "isBlocking")
      VALUES ('alloc-3', 'biz-1', 'room-102', '2026-11-01 14:00:00', '2026-11-05 11:00:00', true);
    `);
    console.log('5. Inserted overlapping dates on DIFFERENT room (room-102) - SUCCESS as expected.');

    // 6. Test different businessId (same dates, same room)
    await prisma.$executeRawUnsafe(`
      INSERT INTO "_test_RoomAllocation" ("id", "businessId", "roomId", "startDate", "endDate", "isBlocking")
      VALUES ('alloc-4', 'biz-2', 'room-101', '2026-11-01 14:00:00', '2026-11-05 11:00:00', true);
    `);
    console.log('6. Inserted overlapping dates on DIFFERENT businessId (biz-2) - SUCCESS as expected for multi-tenant isolation.');

    // 7. Test non-blocking allocation overlapping (isBlocking = false)
    await prisma.$executeRawUnsafe(`
      INSERT INTO "_test_RoomAllocation" ("id", "businessId", "roomId", "startDate", "endDate", "isBlocking")
      VALUES ('alloc-5', 'biz-1', 'room-101', '2026-11-02 14:00:00', '2026-11-04 11:00:00', false);
    `);
    console.log('7. Inserted overlapping allocation with isBlocking = false - SUCCESS as expected.');

    // 8. Test overlapping blocking allocation on same room and businessId -> MUST FAIL WITH 23P01
    let failed = false;
    try {
      await prisma.$executeRawUnsafe(`
        INSERT INTO "_test_RoomAllocation" ("id", "businessId", "roomId", "startDate", "endDate", "isBlocking")
        VALUES ('alloc-fail', 'biz-1', 'room-101', '2026-11-03 14:00:00', '2026-11-06 11:00:00', true);
      `);
    } catch (err) {
      failed = true;
      console.log('8. Overlapping blocking allocation correctly REJECTED by PostgreSQL!');
      console.log('   Error Code:', err.code, 'Message snippet:', err.message.slice(0, 150));
      if (err.message.includes('23P01') || err.message.includes('conflicting key value violates exclusion constraint')) {
        console.log('   CONFIRMED: PostgreSQL 23P01 exclusion violation!');
      }
    }

    if (!failed) {
      throw new Error('FATAL: Overlapping blocking allocation was NOT rejected!');
    }

    // Clean up test table
    await prisma.$executeRawUnsafe(`DROP TABLE IF EXISTS "_test_RoomAllocation";`);
    console.log('Cleaned up test table. All GiST tests PASSED perfectly.');
  } finally {
    await prisma.$disconnect();
  }
}

testGist().catch(console.error);
