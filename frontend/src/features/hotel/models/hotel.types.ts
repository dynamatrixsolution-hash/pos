/**
 * Hotel Feature Domain Models & Types
 * Clean Architecture Model Layer
 */

export interface RoomType {
  id: string;
  name: string;
  code: string;
  description?: string | null;
  baseRate: number | string;
  maxOccupancy: number;
  amenities?: string[];
}

export interface Allocation {
  id: string;
  roomId: string;
  allocationType: "RESERVATION" | "STAY" | "MAINTENANCE";
  startDate: string;
  endDate: string;
  isBlocking: boolean;
  reservation?: {
    id: string;
    reservationNumber: string;
    guestName: string;
    status: string;
  } | null;
  stay?: {
    id: string;
    stayNumber: string;
    guestName: string;
    status: string;
  } | null;
  maintenanceTicket?: {
    id: string;
    title: string;
    priority: string;
    status: string;
  } | null;
}

export interface ActiveStay {
  id: string;
  stayNumber: string;
  guestName: string;
  guestPhone?: string | null;
  checkInTime: string;
  expectedCheckOut: string;
  ratePerNight: number | string;
  totalCharges: number | string;
  paidAmount: number | string;
}

export interface HotelFloor {
  id: string;
  name: string;
  displayOrder: number;
  branchId?: string;
}

export type RoomStatus =
  | "VACANT_CLEAN"
  | "VACANT_DIRTY"
  | "OCCUPIED_CLEAN"
  | "OCCUPIED_DIRTY"
  | "MAINTENANCE"
  | "OUT_OF_SERVICE";

export interface HotelRoom {
  id: string;
  roomNumber: string;
  roomTypeId: string;
  floorId?: string | null;
  floor?: {
    id: string;
    name: string;
    displayOrder: number;
  } | null;
  capacity: number;
  status: RoomStatus;
  notes?: string | null;
  roomType: RoomType;
  allocations?: Allocation[];
  activeStay?: ActiveStay | null;
}

export interface TapeChartStats {
  total: number;
  vacantClean: number;
  vacantDirty: number;
  occupied: number;
  maintenance: number;
}

export type HotelViewMode = "FLOOR_VIEW" | "ROOM_RACK" | "TAPE_CHART" | "ROOM_TYPES" | "FLOORS";

export interface FloorRoomGroup {
  floorId: string | null;
  floorName: string;
  displayOrder: number;
  rooms: HotelRoom[];
}

export type StayStatus = "ACTIVE" | "EXTENDED" | "TRANSFERRED" | "CHECKED_OUT";

export interface HotelStay {
  id: string;
  stayNumber: string;
  guestName: string;
  guestPhone?: string | null;
  guestEmail?: string | null;
  guestIdType?: string | null;
  guestIdNumber?: string | null;
  roomId: string;
  checkInTime: string;
  expectedCheckOut: string;
  actualCheckOut?: string | null;
  status: StayStatus;
  ratePerNight: number | string;
  totalCharges: number | string;
  paidAmount: number | string;
  notes?: string | null;
  room?: HotelRoom;
  folios?: HotelFolio[];
}

export type FolioStatus = "OPEN" | "SETTLED" | "CLOSED" | "VOID";
export type FolioEntryCategory = "ROOM_NIGHT" | "RESTAURANT" | "MINIBAR" | "LAUNDRY" | "DAMAGE" | "PAYMENT" | "OTHER";

export interface FolioEntry {
  id: string;
  folioId: string;
  date: string;
  description: string;
  category: FolioEntryCategory;
  entryType: "DEBIT" | "CREDIT";
  amount: number;
  isReversed?: boolean;
  reverseReason?: string | null;
  notes?: string | null;
}

export interface HotelFolio {
  id: string;
  folioNumber: string;
  guestName: string;
  guestPhone?: string | null;
  roomNumber?: string;
  stayId?: string | null;
  status: FolioStatus;
  totalDebits: number;
  totalCredits: number;
  balance: number;
  createdAt: string;
  updatedAt: string;
  entries?: FolioEntry[];
  stay?: HotelStay | null;
}

export interface FolioPaymentSplit {
  id: string;
  method: "CASH" | "CARD" | "KHALTI" | "FONEPAY" | "BANK_TRANSFER" | "ROOM_CHARGE";
  amount: number;
  notes?: string;
}

export interface HotelReservation {
  id: string;
  reservationNumber: string;
  guestName: string;
  guestPhone?: string | null;
  guestEmail?: string | null;
  roomTypeId: string;
  roomId?: string | null;
  checkInDate: string;
  checkOutDate: string;
  nights: number;
  adults: number;
  children: number;
  status: "CONFIRMED" | "CHECKED_IN" | "CHECKED_OUT" | "CANCELLED" | "NO_SHOW";
  ratePlan: string;
  nightlyRate: number | string;
  totalEstimated: number | string;
  depositAmount: number | string;
  specialRequests?: string | null;
  roomType?: RoomType;
  room?: HotelRoom | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface HousekeepingTask {
  id: string;
  roomId: string;
  taskType: string;
  status: "DIRTY" | "IN_PROGRESS" | "CLEAN" | "INSPECTED";
  priority: string;
  scheduledDate: string;
  completedAt?: string | null;
  notes?: string | null;
  room?: HotelRoom;
}

export interface MaintenanceTicket {
  id: string;
  roomId: string;
  title: string;
  description?: string | null;
  priority: string;
  status: "OPEN" | "IN_PROGRESS" | "RESOLVED" | "CLOSED";
  startDate: string;
  endDate?: string | null;
  resolvedAt?: string | null;
  room?: HotelRoom;
}

export interface HotelQrLocationRecord {
  id: string;
  publicCode: string;
  locationType: "ROOM" | "TABLE";
  roomId?: string | null;
  tableId?: string | null;
  label: string;
  isActive: boolean;
  rotationCount: number;
  createdAt: string;
  updatedAt: string;
  room?: HotelRoom | null;
  table?: any | null;
}

export interface ServiceRequestItem {
  id: string;
  requestNumber: string;
  requestType: string;
  category: "RESTAURANT" | "HOUSEKEEPING" | "FRONT_DESK" | "CONCIERGE" | string;
  priority: "URGENT" | "HIGH" | "NORMAL" | string;
  status: "OPEN" | "ACKNOWLEDGED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
  notes?: string | null;
  resolutionNotes?: string | null;
  requestedAt: string;
  acknowledgedAt?: string | null;
  resolvedAt?: string | null;
  qrLocation?: HotelQrLocationRecord | null;
}



