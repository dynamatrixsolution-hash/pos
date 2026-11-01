-- Migration: 202611010003_phase5_hotel_stays_rooms
-- Description: Add 8 Phase 5 hotel hospitality models, btree_gist extension, and mathematical GiST exclusion constraint on RoomAllocation.

-- ==============================================================================
-- 1. PREREQUISITE: ENABLE btree_gist EXTENSION
-- ==============================================================================
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- ==============================================================================
-- 2. CREATE 8 PHASE 5 HOTEL TABLES
-- ==============================================================================

-- 1. CreateTable: RoomType
CREATE TABLE "RoomType" (
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
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RoomType_pkey" PRIMARY KEY ("id")
);

-- 2. CreateTable: Room
CREATE TABLE "Room" (
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
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Room_pkey" PRIMARY KEY ("id")
);

-- 3. CreateTable: Reservation
CREATE TABLE "Reservation" (
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
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Reservation_pkey" PRIMARY KEY ("id")
);

-- 4. CreateTable: ReservationGuest
CREATE TABLE "ReservationGuest" (
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
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReservationGuest_pkey" PRIMARY KEY ("id")
);

-- 5. CreateTable: Stay
CREATE TABLE "Stay" (
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
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Stay_pkey" PRIMARY KEY ("id")
);

-- 6. CreateTable: MaintenanceTicket
CREATE TABLE "MaintenanceTicket" (
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
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MaintenanceTicket_pkey" PRIMARY KEY ("id")
);

-- 7. CreateTable: RoomAllocation
CREATE TABLE "RoomAllocation" (
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
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RoomAllocation_pkey" PRIMARY KEY ("id")
);

-- 8. CreateTable: HousekeepingTask
CREATE TABLE "HousekeepingTask" (
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
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HousekeepingTask_pkey" PRIMARY KEY ("id")
);

-- ==============================================================================
-- 3. CREATE INDEXES AND COMPOSITE TENANT KEYS
-- ==============================================================================

-- RoomType Indexes
CREATE UNIQUE INDEX "RoomType_businessId_id_key" ON "RoomType"("businessId", "id");
CREATE UNIQUE INDEX "RoomType_businessId_branchId_code_key" ON "RoomType"("businessId", "branchId", "code");
CREATE INDEX "RoomType_businessId_branchId_isActive_idx" ON "RoomType"("businessId", "branchId", "isActive");

-- Room Indexes
CREATE UNIQUE INDEX "Room_businessId_id_key" ON "Room"("businessId", "id");
CREATE UNIQUE INDEX "Room_businessId_branchId_roomNumber_key" ON "Room"("businessId", "branchId", "roomNumber");
CREATE INDEX "Room_businessId_branchId_status_idx" ON "Room"("businessId", "branchId", "status");
CREATE INDEX "Room_businessId_roomTypeId_idx" ON "Room"("businessId", "roomTypeId");
CREATE INDEX "Room_businessId_floorId_idx" ON "Room"("businessId", "floorId");

-- Reservation Indexes
CREATE UNIQUE INDEX "Reservation_businessId_id_key" ON "Reservation"("businessId", "id");
CREATE UNIQUE INDEX "Reservation_businessId_branchId_reservationNumber_key" ON "Reservation"("businessId", "branchId", "reservationNumber");
CREATE INDEX "Reservation_businessId_branchId_status_idx" ON "Reservation"("businessId", "branchId", "status");
CREATE INDEX "Reservation_businessId_roomTypeId_idx" ON "Reservation"("businessId", "roomTypeId");
CREATE INDEX "Reservation_businessId_roomId_idx" ON "Reservation"("businessId", "roomId");
CREATE INDEX "Reservation_businessId_checkInDate_checkOutDate_idx" ON "Reservation"("businessId", "checkInDate", "checkOutDate");

-- ReservationGuest Indexes
CREATE UNIQUE INDEX "ReservationGuest_businessId_id_key" ON "ReservationGuest"("businessId", "id");
CREATE INDEX "ReservationGuest_businessId_reservationId_idx" ON "ReservationGuest"("businessId", "reservationId");

-- Stay Indexes
CREATE UNIQUE INDEX "Stay_businessId_id_key" ON "Stay"("businessId", "id");
CREATE UNIQUE INDEX "Stay_businessId_branchId_stayNumber_key" ON "Stay"("businessId", "branchId", "stayNumber");
CREATE INDEX "Stay_businessId_branchId_status_idx" ON "Stay"("businessId", "branchId", "status");
CREATE INDEX "Stay_businessId_roomId_status_idx" ON "Stay"("businessId", "roomId", "status");
CREATE INDEX "Stay_businessId_reservationId_idx" ON "Stay"("businessId", "reservationId");

-- MaintenanceTicket Indexes
CREATE UNIQUE INDEX "MaintenanceTicket_businessId_id_key" ON "MaintenanceTicket"("businessId", "id");
CREATE UNIQUE INDEX "MaintenanceTicket_businessId_branchId_ticketNumber_key" ON "MaintenanceTicket"("businessId", "branchId", "ticketNumber");
CREATE INDEX "MaintenanceTicket_businessId_branchId_status_idx" ON "MaintenanceTicket"("businessId", "branchId", "status");
CREATE INDEX "MaintenanceTicket_businessId_roomId_status_idx" ON "MaintenanceTicket"("businessId", "roomId", "status");
CREATE INDEX "MaintenanceTicket_businessId_assignedToId_idx" ON "MaintenanceTicket"("businessId", "assignedToId");

-- RoomAllocation Indexes
CREATE UNIQUE INDEX "RoomAllocation_businessId_id_key" ON "RoomAllocation"("businessId", "id");
CREATE INDEX "RoomAllocation_businessId_roomId_startDate_endDate_idx" ON "RoomAllocation"("businessId", "roomId", "startDate", "endDate");
CREATE INDEX "RoomAllocation_businessId_branchId_status_idx" ON "RoomAllocation"("businessId", "branchId", "status");
CREATE INDEX "RoomAllocation_businessId_reservationId_idx" ON "RoomAllocation"("businessId", "reservationId");
CREATE INDEX "RoomAllocation_businessId_stayId_idx" ON "RoomAllocation"("businessId", "stayId");
CREATE INDEX "RoomAllocation_businessId_maintenanceTicketId_idx" ON "RoomAllocation"("businessId", "maintenanceTicketId");

-- HousekeepingTask Indexes
CREATE UNIQUE INDEX "HousekeepingTask_businessId_id_key" ON "HousekeepingTask"("businessId", "id");
CREATE INDEX "HousekeepingTask_businessId_branchId_status_idx" ON "HousekeepingTask"("businessId", "branchId", "status");
CREATE INDEX "HousekeepingTask_businessId_roomId_status_idx" ON "HousekeepingTask"("businessId", "roomId", "status");
CREATE INDEX "HousekeepingTask_businessId_assignedToId_idx" ON "HousekeepingTask"("businessId", "assignedToId");

-- ==============================================================================
-- 4. ADD FOREIGN KEY CONSTRAINTS
-- ==============================================================================

-- RoomType Foreign Keys
ALTER TABLE "RoomType" ADD CONSTRAINT "RoomType_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RoomType" ADD CONSTRAINT "RoomType_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Room Foreign Keys
ALTER TABLE "Room" ADD CONSTRAINT "Room_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Room" ADD CONSTRAINT "Room_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Room" ADD CONSTRAINT "Room_roomTypeId_fkey" FOREIGN KEY ("roomTypeId") REFERENCES "RoomType"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Room" ADD CONSTRAINT "Room_floorId_fkey" FOREIGN KEY ("floorId") REFERENCES "Floor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Reservation Foreign Keys
ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_roomTypeId_fkey" FOREIGN KEY ("roomTypeId") REFERENCES "RoomType"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ReservationGuest Foreign Keys
ALTER TABLE "ReservationGuest" ADD CONSTRAINT "ReservationGuest_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ReservationGuest" ADD CONSTRAINT "ReservationGuest_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "Reservation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Stay Foreign Keys
ALTER TABLE "Stay" ADD CONSTRAINT "Stay_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Stay" ADD CONSTRAINT "Stay_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Stay" ADD CONSTRAINT "Stay_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "Reservation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Stay" ADD CONSTRAINT "Stay_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Stay" ADD CONSTRAINT "Stay_checkedInById_fkey" FOREIGN KEY ("checkedInById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Stay" ADD CONSTRAINT "Stay_checkedOutById_fkey" FOREIGN KEY ("checkedOutById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- MaintenanceTicket Foreign Keys
ALTER TABLE "MaintenanceTicket" ADD CONSTRAINT "MaintenanceTicket_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MaintenanceTicket" ADD CONSTRAINT "MaintenanceTicket_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MaintenanceTicket" ADD CONSTRAINT "MaintenanceTicket_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MaintenanceTicket" ADD CONSTRAINT "MaintenanceTicket_reportedById_fkey" FOREIGN KEY ("reportedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "MaintenanceTicket" ADD CONSTRAINT "MaintenanceTicket_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "MaintenanceTicket" ADD CONSTRAINT "MaintenanceTicket_resolvedById_fkey" FOREIGN KEY ("resolvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- RoomAllocation Foreign Keys
ALTER TABLE "RoomAllocation" ADD CONSTRAINT "RoomAllocation_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RoomAllocation" ADD CONSTRAINT "RoomAllocation_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RoomAllocation" ADD CONSTRAINT "RoomAllocation_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RoomAllocation" ADD CONSTRAINT "RoomAllocation_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "Reservation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RoomAllocation" ADD CONSTRAINT "RoomAllocation_stayId_fkey" FOREIGN KEY ("stayId") REFERENCES "Stay"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RoomAllocation" ADD CONSTRAINT "RoomAllocation_maintenanceTicketId_fkey" FOREIGN KEY ("maintenanceTicketId") REFERENCES "MaintenanceTicket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- HousekeepingTask Foreign Keys
ALTER TABLE "HousekeepingTask" ADD CONSTRAINT "HousekeepingTask_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "HousekeepingTask" ADD CONSTRAINT "HousekeepingTask_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "HousekeepingTask" ADD CONSTRAINT "HousekeepingTask_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "HousekeepingTask" ADD CONSTRAINT "HousekeepingTask_stayId_fkey" FOREIGN KEY ("stayId") REFERENCES "Stay"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "HousekeepingTask" ADD CONSTRAINT "HousekeepingTask_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "HousekeepingTask" ADD CONSTRAINT "HousekeepingTask_completedById_fkey" FOREIGN KEY ("completedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ==============================================================================
-- 5. POSTGRESQL GiST EXCLUSION CONSTRAINT
-- ==============================================================================
-- Enforces half-open interval double-booking prevention at the storage engine level.
-- Overlapping blocking allocations on the same room raise SQL 23P01 (exclusion_violation).
ALTER TABLE "RoomAllocation"
ADD CONSTRAINT "RoomAllocation_room_period_overlap_excl"
EXCLUDE USING gist (
  "roomId" WITH =,
  tsrange("startDate", "endDate", '[)') WITH &&
) WHERE ("isBlocking" = true);
