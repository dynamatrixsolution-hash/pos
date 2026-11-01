const { readFileSync } = require('fs');
const { PrismaClient } = require('../../../packages/db/client/index.js');

async function testDdl() {
  const env = Object.fromEntries(
    readFileSync('.env.restro.local', 'utf8')
      .split(/\r?\n/)
      .filter(l => l.trim() && !l.startsWith('#'))
      .map(l => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)])
  );
  const prisma = new PrismaClient({ datasources: { db: { url: env.DATABASE_URL } } });

  console.log('Testing full Phase 5 DDL inside an atomic transaction (will rollback)...');

  const client = prisma;

  // We can run a transaction via raw client or transaction block:
  // Using $executeRawUnsafe in sequence within a transaction
  try {
    await prisma.$transaction(async tx => {
      // 1. Enable extension
      await tx.$executeRawUnsafe(`CREATE EXTENSION IF NOT EXISTS btree_gist;`);

      // 2. Tables
      await tx.$executeRawUnsafe(`
        CREATE TABLE "_p5_RoomType" (
            "id" TEXT NOT NULL,
            "businessId" TEXT NOT NULL,
            "branchId" TEXT NOT NULL,
            "name" TEXT NOT NULL,
            "code" TEXT NOT NULL,
            "description" TEXT,
            "baseRate" DECIMAL(12,2) NOT NULL DEFAULT 0,
            "maxOccupancy" INTEGER NOT NULL DEFAULT 2,
            "amenities" JSONB,
            "images" JSONB,
            "displayOrder" INTEGER NOT NULL DEFAULT 0,
            "isActive" BOOLEAN NOT NULL DEFAULT true,
            "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            CONSTRAINT "_p5_RoomType_pkey" PRIMARY KEY ("id")
        );
      `);

      await tx.$executeRawUnsafe(`
        CREATE TABLE "_p5_Room" (
            "id" TEXT NOT NULL,
            "businessId" TEXT NOT NULL,
            "branchId" TEXT NOT NULL,
            "roomTypeId" TEXT NOT NULL,
            "floorId" TEXT,
            "roomNumber" TEXT NOT NULL,
            "capacity" INTEGER NOT NULL DEFAULT 2,
            "status" TEXT NOT NULL DEFAULT 'VACANT_CLEAN',
            "currentStayId" TEXT,
            "keyCardAlias" TEXT,
            "features" JSONB,
            "notes" TEXT,
            "isActive" BOOLEAN NOT NULL DEFAULT true,
            "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            CONSTRAINT "_p5_Room_pkey" PRIMARY KEY ("id")
        );
      `);

      await tx.$executeRawUnsafe(`
        CREATE TABLE "_p5_Reservation" (
            "id" TEXT NOT NULL,
            "businessId" TEXT NOT NULL,
            "branchId" TEXT NOT NULL,
            "reservationNumber" TEXT NOT NULL,
            "guestName" TEXT NOT NULL,
            "guestEmail" TEXT,
            "guestPhone" TEXT,
            "roomTypeId" TEXT NOT NULL,
            "roomId" TEXT,
            "checkInDate" TIMESTAMP(3) NOT NULL,
            "checkOutDate" TIMESTAMP(3) NOT NULL,
            "status" TEXT NOT NULL DEFAULT 'CONFIRMED',
            "adults" INTEGER NOT NULL DEFAULT 1,
            "children" INTEGER NOT NULL DEFAULT 0,
            "ratePlan" TEXT DEFAULT 'STANDARD',
            "nightlyRate" DECIMAL(12,2) NOT NULL DEFAULT 0,
            "totalAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
            "depositAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
            "specialRequests" TEXT,
            "notes" TEXT,
            "version" INTEGER NOT NULL DEFAULT 1,
            "createdById" TEXT,
            "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            CONSTRAINT "_p5_Reservation_pkey" PRIMARY KEY ("id")
        );
      `);

      await tx.$executeRawUnsafe(`
        CREATE TABLE "_p5_ReservationGuest" (
            "id" TEXT NOT NULL,
            "businessId" TEXT NOT NULL,
            "reservationId" TEXT NOT NULL,
            "name" TEXT NOT NULL,
            "email" TEXT,
            "phone" TEXT,
            "idType" TEXT,
            "idNumber" TEXT,
            "isPrimary" BOOLEAN NOT NULL DEFAULT false,
            "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            CONSTRAINT "_p5_ReservationGuest_pkey" PRIMARY KEY ("id")
        );
      `);

      await tx.$executeRawUnsafe(`
        CREATE TABLE "_p5_Stay" (
            "id" TEXT NOT NULL,
            "businessId" TEXT NOT NULL,
            "branchId" TEXT NOT NULL,
            "stayNumber" TEXT NOT NULL,
            "reservationId" TEXT,
            "roomId" TEXT NOT NULL,
            "guestName" TEXT NOT NULL,
            "guestEmail" TEXT,
            "guestPhone" TEXT,
            "guestIdType" TEXT,
            "guestIdNumber" TEXT,
            "checkInTime" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "checkOutTime" TIMESTAMP(3),
            "expectedCheckOut" TIMESTAMP(3) NOT NULL,
            "status" TEXT NOT NULL DEFAULT 'ACTIVE',
            "ratePerNight" DECIMAL(12,2) NOT NULL DEFAULT 0,
            "totalAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
            "paidAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
            "version" INTEGER NOT NULL DEFAULT 1,
            "checkedInById" TEXT,
            "checkedOutById" TEXT,
            "notes" TEXT,
            "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            CONSTRAINT "_p5_Stay_pkey" PRIMARY KEY ("id")
        );
      `);

      await tx.$executeRawUnsafe(`
        CREATE TABLE "_p5_MaintenanceTicket" (
            "id" TEXT NOT NULL,
            "businessId" TEXT NOT NULL,
            "branchId" TEXT NOT NULL,
            "roomId" TEXT NOT NULL,
            "ticketNumber" TEXT NOT NULL,
            "title" TEXT NOT NULL,
            "description" TEXT,
            "status" TEXT NOT NULL DEFAULT 'OPEN',
            "priority" TEXT NOT NULL DEFAULT 'MEDIUM',
            "startDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "endDate" TIMESTAMP(3),
            "reportedById" TEXT,
            "assignedToId" TEXT,
            "resolvedById" TEXT,
            "resolvedAt" TIMESTAMP(3),
            "resolutionNotes" TEXT,
            "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            CONSTRAINT "_p5_MaintenanceTicket_pkey" PRIMARY KEY ("id")
        );
      `);

      await tx.$executeRawUnsafe(`
        CREATE TABLE "_p5_RoomAllocation" (
            "id" TEXT NOT NULL,
            "businessId" TEXT NOT NULL,
            "branchId" TEXT NOT NULL,
            "roomId" TEXT NOT NULL,
            "reservationId" TEXT,
            "stayId" TEXT,
            "maintenanceTicketId" TEXT,
            "startDate" TIMESTAMP(3) NOT NULL,
            "endDate" TIMESTAMP(3) NOT NULL,
            "isBlocking" BOOLEAN NOT NULL DEFAULT true,
            "status" TEXT NOT NULL DEFAULT 'CONFIRMED',
            "notes" TEXT,
            "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            CONSTRAINT "_p5_RoomAllocation_pkey" PRIMARY KEY ("id")
        );
      `);

      await tx.$executeRawUnsafe(`
        CREATE TABLE "_p5_HousekeepingTask" (
            "id" TEXT NOT NULL,
            "businessId" TEXT NOT NULL,
            "branchId" TEXT NOT NULL,
            "roomId" TEXT NOT NULL,
            "stayId" TEXT,
            "taskType" TEXT NOT NULL DEFAULT 'DAILY_CLEANING',
            "status" TEXT NOT NULL DEFAULT 'DIRTY',
            "priority" TEXT NOT NULL DEFAULT 'MEDIUM',
            "assignedToId" TEXT,
            "scheduledDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "startedAt" TIMESTAMP(3),
            "completedAt" TIMESTAMP(3),
            "completedById" TEXT,
            "notes" TEXT,
            "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            CONSTRAINT "_p5_HousekeepingTask_pkey" PRIMARY KEY ("id")
        );
      `);

      // 3. Indexes
      await tx.$executeRawUnsafe(`CREATE UNIQUE INDEX "_p5_RoomType_businessId_id_key" ON "_p5_RoomType"("businessId", "id");`);
      await tx.$executeRawUnsafe(`CREATE UNIQUE INDEX "_p5_RoomType_businessId_branchId_code_key" ON "_p5_RoomType"("businessId", "branchId", "code");`);
      await tx.$executeRawUnsafe(`CREATE INDEX "_p5_RoomType_businessId_branchId_isActive_idx" ON "_p5_RoomType"("businessId", "branchId", "isActive");`);

      await tx.$executeRawUnsafe(`CREATE UNIQUE INDEX "_p5_Room_businessId_id_key" ON "_p5_Room"("businessId", "id");`);
      await tx.$executeRawUnsafe(`CREATE UNIQUE INDEX "_p5_Room_businessId_branchId_roomNumber_key" ON "_p5_Room"("businessId", "branchId", "roomNumber");`);
      await tx.$executeRawUnsafe(`CREATE INDEX "_p5_Room_businessId_branchId_status_idx" ON "_p5_Room"("businessId", "branchId", "status");`);
      await tx.$executeRawUnsafe(`CREATE INDEX "_p5_Room_businessId_roomTypeId_idx" ON "_p5_Room"("businessId", "roomTypeId");`);
      await tx.$executeRawUnsafe(`CREATE INDEX "_p5_Room_businessId_floorId_idx" ON "_p5_Room"("businessId", "floorId");`);

      await tx.$executeRawUnsafe(`CREATE UNIQUE INDEX "_p5_Reservation_businessId_id_key" ON "_p5_Reservation"("businessId", "id");`);
      await tx.$executeRawUnsafe(`CREATE UNIQUE INDEX "_p5_Reservation_businessId_branchId_reservationNumber_key" ON "_p5_Reservation"("businessId", "branchId", "reservationNumber");`);
      await tx.$executeRawUnsafe(`CREATE INDEX "_p5_Reservation_businessId_branchId_status_idx" ON "_p5_Reservation"("businessId", "branchId", "status");`);
      await tx.$executeRawUnsafe(`CREATE INDEX "_p5_Reservation_businessId_roomTypeId_idx" ON "_p5_Reservation"("businessId", "roomTypeId");`);
      await tx.$executeRawUnsafe(`CREATE INDEX "_p5_Reservation_businessId_roomId_idx" ON "_p5_Reservation"("businessId", "roomId");`);
      await tx.$executeRawUnsafe(`CREATE INDEX "_p5_Reservation_businessId_checkInDate_checkOutDate_idx" ON "_p5_Reservation"("businessId", "checkInDate", "checkOutDate");`);

      await tx.$executeRawUnsafe(`CREATE UNIQUE INDEX "_p5_ReservationGuest_businessId_id_key" ON "_p5_ReservationGuest"("businessId", "id");`);
      await tx.$executeRawUnsafe(`CREATE INDEX "_p5_ReservationGuest_businessId_reservationId_idx" ON "_p5_ReservationGuest"("businessId", "reservationId");`);

      await tx.$executeRawUnsafe(`CREATE UNIQUE INDEX "_p5_Stay_businessId_id_key" ON "_p5_Stay"("businessId", "id");`);
      await tx.$executeRawUnsafe(`CREATE UNIQUE INDEX "_p5_Stay_businessId_branchId_stayNumber_key" ON "_p5_Stay"("businessId", "branchId", "stayNumber");`);
      await tx.$executeRawUnsafe(`CREATE INDEX "_p5_Stay_businessId_branchId_status_idx" ON "_p5_Stay"("businessId", "branchId", "status");`);
      await tx.$executeRawUnsafe(`CREATE INDEX "_p5_Stay_businessId_roomId_status_idx" ON "_p5_Stay"("businessId", "roomId", "status");`);
      await tx.$executeRawUnsafe(`CREATE INDEX "_p5_Stay_businessId_reservationId_idx" ON "_p5_Stay"("businessId", "reservationId");`);

      await tx.$executeRawUnsafe(`CREATE UNIQUE INDEX "_p5_MaintenanceTicket_businessId_id_key" ON "_p5_MaintenanceTicket"("businessId", "id");`);
      await tx.$executeRawUnsafe(`CREATE UNIQUE INDEX "_p5_MaintenanceTicket_businessId_branchId_ticketNumber_key" ON "_p5_MaintenanceTicket"("businessId", "branchId", "ticketNumber");`);
      await tx.$executeRawUnsafe(`CREATE INDEX "_p5_MaintenanceTicket_businessId_branchId_status_idx" ON "_p5_MaintenanceTicket"("businessId", "branchId", "status");`);
      await tx.$executeRawUnsafe(`CREATE INDEX "_p5_MaintenanceTicket_businessId_roomId_status_idx" ON "_p5_MaintenanceTicket"("businessId", "roomId", "status");`);
      await tx.$executeRawUnsafe(`CREATE INDEX "_p5_MaintenanceTicket_businessId_assignedToId_idx" ON "_p5_MaintenanceTicket"("businessId", "assignedToId");`);

      await tx.$executeRawUnsafe(`CREATE UNIQUE INDEX "_p5_RoomAllocation_businessId_id_key" ON "_p5_RoomAllocation"("businessId", "id");`);
      await tx.$executeRawUnsafe(`CREATE INDEX "_p5_RoomAllocation_businessId_roomId_startDate_endDate_idx" ON "_p5_RoomAllocation"("businessId", "roomId", "startDate", "endDate");`);
      await tx.$executeRawUnsafe(`CREATE INDEX "_p5_RoomAllocation_businessId_branchId_status_idx" ON "_p5_RoomAllocation"("businessId", "branchId", "status");`);
      await tx.$executeRawUnsafe(`CREATE INDEX "_p5_RoomAllocation_businessId_reservationId_idx" ON "_p5_RoomAllocation"("businessId", "reservationId");`);
      await tx.$executeRawUnsafe(`CREATE INDEX "_p5_RoomAllocation_businessId_stayId_idx" ON "_p5_RoomAllocation"("businessId", "stayId");`);
      await tx.$executeRawUnsafe(`CREATE INDEX "_p5_RoomAllocation_businessId_maintenanceTicketId_idx" ON "_p5_RoomAllocation"("businessId", "maintenanceTicketId");`);

      await tx.$executeRawUnsafe(`CREATE UNIQUE INDEX "_p5_HousekeepingTask_businessId_id_key" ON "_p5_HousekeepingTask"("businessId", "id");`);
      await tx.$executeRawUnsafe(`CREATE INDEX "_p5_HousekeepingTask_businessId_branchId_status_idx" ON "_p5_HousekeepingTask"("businessId", "branchId", "status");`);
      await tx.$executeRawUnsafe(`CREATE INDEX "_p5_HousekeepingTask_businessId_roomId_status_idx" ON "_p5_HousekeepingTask"("businessId", "roomId", "status");`);
      await tx.$executeRawUnsafe(`CREATE INDEX "_p5_HousekeepingTask_businessId_assignedToId_idx" ON "_p5_HousekeepingTask"("businessId", "assignedToId");`);

      // 4. Foreign Keys
      await tx.$executeRawUnsafe(`ALTER TABLE "_p5_RoomType" ADD CONSTRAINT "_p5_RoomType_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;`);
      await tx.$executeRawUnsafe(`ALTER TABLE "_p5_RoomType" ADD CONSTRAINT "_p5_RoomType_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;`);

      await tx.$executeRawUnsafe(`ALTER TABLE "_p5_Room" ADD CONSTRAINT "_p5_Room_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;`);
      await tx.$executeRawUnsafe(`ALTER TABLE "_p5_Room" ADD CONSTRAINT "_p5_Room_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;`);
      await tx.$executeRawUnsafe(`ALTER TABLE "_p5_Room" ADD CONSTRAINT "_p5_Room_roomTypeId_fkey" FOREIGN KEY ("roomTypeId") REFERENCES "_p5_RoomType"("id") ON DELETE CASCADE ON UPDATE CASCADE;`);
      await tx.$executeRawUnsafe(`ALTER TABLE "_p5_Room" ADD CONSTRAINT "_p5_Room_floorId_fkey" FOREIGN KEY ("floorId") REFERENCES "Floor"("id") ON DELETE SET NULL ON UPDATE CASCADE;`);

      await tx.$executeRawUnsafe(`ALTER TABLE "_p5_Reservation" ADD CONSTRAINT "_p5_Reservation_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;`);
      await tx.$executeRawUnsafe(`ALTER TABLE "_p5_Reservation" ADD CONSTRAINT "_p5_Reservation_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;`);
      await tx.$executeRawUnsafe(`ALTER TABLE "_p5_Reservation" ADD CONSTRAINT "_p5_Reservation_roomTypeId_fkey" FOREIGN KEY ("roomTypeId") REFERENCES "_p5_RoomType"("id") ON DELETE CASCADE ON UPDATE CASCADE;`);
      await tx.$executeRawUnsafe(`ALTER TABLE "_p5_Reservation" ADD CONSTRAINT "_p5_Reservation_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "_p5_Room"("id") ON DELETE SET NULL ON UPDATE CASCADE;`);
      await tx.$executeRawUnsafe(`ALTER TABLE "_p5_Reservation" ADD CONSTRAINT "_p5_Reservation_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;`);

      await tx.$executeRawUnsafe(`ALTER TABLE "_p5_ReservationGuest" ADD CONSTRAINT "_p5_ReservationGuest_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;`);
      await tx.$executeRawUnsafe(`ALTER TABLE "_p5_ReservationGuest" ADD CONSTRAINT "_p5_ReservationGuest_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "_p5_Reservation"("id") ON DELETE CASCADE ON UPDATE CASCADE;`);

      await tx.$executeRawUnsafe(`ALTER TABLE "_p5_Stay" ADD CONSTRAINT "_p5_Stay_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;`);
      await tx.$executeRawUnsafe(`ALTER TABLE "_p5_Stay" ADD CONSTRAINT "_p5_Stay_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;`);
      await tx.$executeRawUnsafe(`ALTER TABLE "_p5_Stay" ADD CONSTRAINT "_p5_Stay_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "_p5_Reservation"("id") ON DELETE SET NULL ON UPDATE CASCADE;`);
      await tx.$executeRawUnsafe(`ALTER TABLE "_p5_Stay" ADD CONSTRAINT "_p5_Stay_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "_p5_Room"("id") ON DELETE CASCADE ON UPDATE CASCADE;`);
      await tx.$executeRawUnsafe(`ALTER TABLE "_p5_Stay" ADD CONSTRAINT "_p5_Stay_checkedInById_fkey" FOREIGN KEY ("checkedInById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;`);
      await tx.$executeRawUnsafe(`ALTER TABLE "_p5_Stay" ADD CONSTRAINT "_p5_Stay_checkedOutById_fkey" FOREIGN KEY ("checkedOutById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;`);

      await tx.$executeRawUnsafe(`ALTER TABLE "_p5_MaintenanceTicket" ADD CONSTRAINT "_p5_MaintenanceTicket_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;`);
      await tx.$executeRawUnsafe(`ALTER TABLE "_p5_MaintenanceTicket" ADD CONSTRAINT "_p5_MaintenanceTicket_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;`);
      await tx.$executeRawUnsafe(`ALTER TABLE "_p5_MaintenanceTicket" ADD CONSTRAINT "_p5_MaintenanceTicket_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "_p5_Room"("id") ON DELETE CASCADE ON UPDATE CASCADE;`);
      await tx.$executeRawUnsafe(`ALTER TABLE "_p5_MaintenanceTicket" ADD CONSTRAINT "_p5_MaintenanceTicket_reportedById_fkey" FOREIGN KEY ("reportedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;`);
      await tx.$executeRawUnsafe(`ALTER TABLE "_p5_MaintenanceTicket" ADD CONSTRAINT "_p5_MaintenanceTicket_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;`);
      await tx.$executeRawUnsafe(`ALTER TABLE "_p5_MaintenanceTicket" ADD CONSTRAINT "_p5_MaintenanceTicket_resolvedById_fkey" FOREIGN KEY ("resolvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;`);

      await tx.$executeRawUnsafe(`ALTER TABLE "_p5_RoomAllocation" ADD CONSTRAINT "_p5_RoomAllocation_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;`);
      await tx.$executeRawUnsafe(`ALTER TABLE "_p5_RoomAllocation" ADD CONSTRAINT "_p5_RoomAllocation_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;`);
      await tx.$executeRawUnsafe(`ALTER TABLE "_p5_RoomAllocation" ADD CONSTRAINT "_p5_RoomAllocation_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "_p5_Room"("id") ON DELETE CASCADE ON UPDATE CASCADE;`);
      await tx.$executeRawUnsafe(`ALTER TABLE "_p5_RoomAllocation" ADD CONSTRAINT "_p5_RoomAllocation_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "_p5_Reservation"("id") ON DELETE CASCADE ON UPDATE CASCADE;`);
      await tx.$executeRawUnsafe(`ALTER TABLE "_p5_RoomAllocation" ADD CONSTRAINT "_p5_RoomAllocation_stayId_fkey" FOREIGN KEY ("stayId") REFERENCES "_p5_Stay"("id") ON DELETE CASCADE ON UPDATE CASCADE;`);
      await tx.$executeRawUnsafe(`ALTER TABLE "_p5_RoomAllocation" ADD CONSTRAINT "_p5_RoomAllocation_maintenanceTicketId_fkey" FOREIGN KEY ("maintenanceTicketId") REFERENCES "_p5_MaintenanceTicket"("id") ON DELETE CASCADE ON UPDATE CASCADE;`);

      await tx.$executeRawUnsafe(`ALTER TABLE "_p5_HousekeepingTask" ADD CONSTRAINT "_p5_HousekeepingTask_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;`);
      await tx.$executeRawUnsafe(`ALTER TABLE "_p5_HousekeepingTask" ADD CONSTRAINT "_p5_HousekeepingTask_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;`);
      await tx.$executeRawUnsafe(`ALTER TABLE "_p5_HousekeepingTask" ADD CONSTRAINT "_p5_HousekeepingTask_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "_p5_Room"("id") ON DELETE CASCADE ON UPDATE CASCADE;`);
      await tx.$executeRawUnsafe(`ALTER TABLE "_p5_HousekeepingTask" ADD CONSTRAINT "_p5_HousekeepingTask_stayId_fkey" FOREIGN KEY ("stayId") REFERENCES "_p5_Stay"("id") ON DELETE SET NULL ON UPDATE CASCADE;`);
      await tx.$executeRawUnsafe(`ALTER TABLE "_p5_HousekeepingTask" ADD CONSTRAINT "_p5_HousekeepingTask_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;`);
      await tx.$executeRawUnsafe(`ALTER TABLE "_p5_HousekeepingTask" ADD CONSTRAINT "_p5_HousekeepingTask_completedById_fkey" FOREIGN KEY ("completedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;`);

      // 5. Exclusion constraint
      await tx.$executeRawUnsafe(`
        ALTER TABLE "_p5_RoomAllocation"
        ADD CONSTRAINT "_p5_RoomAllocation_room_period_overlap_excl"
        EXCLUDE USING gist (
          "businessId" WITH =,
          "roomId" WITH =,
          tsrange("startDate", "endDate", '[)') WITH &&
        ) WHERE ("isBlocking" = true);
      `);

      console.log('ALL DDL STATEMENTS EXECUTED SUCCESSFULLY!');
      // Force rollback
      throw new Error('INTENTIONAL_ROLLBACK');
    });
  } catch (err) {
    if (err.message === 'INTENTIONAL_ROLLBACK') {
      console.log('Transaction safely rolled back. Zero residue left in database.');
    } else {
      console.error('DDL Validation ERROR:', err);
      process.exit(1);
    }
  } finally {
    await prisma.$disconnect();
  }
}

testDdl().catch(console.error);
