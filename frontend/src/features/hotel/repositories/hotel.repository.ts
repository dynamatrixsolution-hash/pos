/**
 * Hotel Feature Repository
 * Interacts exclusively with the global ApiClient singleton
 */

import { apiClient } from "@/core/api/api-client";
import {
  HotelRoom,
  RoomType,
  HotelFloor,
  TapeChartStats,
  HotelStay,
  HotelFolio,
  HotelReservation,
  HousekeepingTask,
  MaintenanceTicket,
  ServiceRequestItem,
  HotelQrLocationRecord,
} from "../models/hotel.types";

export class HotelRepository {
  async fetchTapeChart(startDate: string, endDate: string, roomTypeId?: string): Promise<{
    rooms: HotelRoom[];
    dates: string[];
    stats: TapeChartStats;
  }> {
    const data = await apiClient.hotel.getTapeChart(startDate, endDate, roomTypeId);
    return {
      rooms: data.rooms || [],
      dates: data.dates || [],
      stats: data.stats || {
        total: 0,
        vacantClean: 0,
        vacantDirty: 0,
        occupied: 0,
        maintenance: 0,
      },
    };
  }

  async fetchRoomTypes(): Promise<RoomType[]> {
    const data = await apiClient.hotel.getRoomTypes();
    return data.roomTypes || [];
  }

  async createRoomType(payload: {
    name: string;
    code: string;
    baseRate: number;
    maxOccupancy: number;
    description?: string;
  }): Promise<RoomType> {
    const data = await apiClient.hotel.createRoomType(payload);
    return data.roomType;
  }

  async updateRoomType(id: string, payload: {
    name?: string;
    code?: string;
    baseRate?: number;
    maxOccupancy?: number;
    description?: string;
  }): Promise<RoomType> {
    const data = await apiClient.hotel.updateRoomType(id, payload);
    return data.roomType;
  }

  async deleteRoomType(id: string): Promise<boolean> {
    const res = await apiClient.hotel.deleteRoomType(id);
    return res.success;
  }

  async fetchFloors(): Promise<HotelFloor[]> {
    const data = await apiClient.hotel.getFloors();
    return data.floors || [];
  }

  async createFloor(payload: { name: string; displayOrder?: number }): Promise<HotelFloor> {
    const data = await apiClient.hotel.createFloor(payload);
    return data.floor;
  }

  async updateFloor(id: string, payload: { name: string; displayOrder?: number }): Promise<HotelFloor> {
    const data = await apiClient.hotel.updateFloor(id, payload);
    return data.floor;
  }

  async deleteFloor(id: string): Promise<boolean> {
    const res = await apiClient.hotel.deleteFloor(id);
    return res.success;
  }

  async createRoom(payload: {
    roomNumber: string;
    roomTypeId: string;
    floorId?: string;
    capacity?: number;
    notes?: string;
  }): Promise<HotelRoom> {
    const data = await apiClient.hotel.createRoom(payload);
    return data.room;
  }

  async updateRoom(id: string, payload: {
    roomNumber?: string;
    roomTypeId?: string;
    floorId?: string | null;
    capacity?: number;
    status?: string;
    notes?: string | null;
  }): Promise<HotelRoom> {
    const data = await apiClient.hotel.updateRoom(id, payload);
    return data.room;
  }

  async deleteRoom(id: string): Promise<boolean> {
    const res = await apiClient.hotel.deleteRoom(id);
    return res.success;
  }

  async fastCheckIn(payload: {
    roomId: string;
    guestName: string;
    guestPhone?: string;
    guestEmail?: string;
    guestIdType?: string;
    guestIdNumber?: string;
    expectedCheckOut: string;
    ratePerNight: number;
    paidAmount?: number;
    notes?: string;
  }) {
    return await apiClient.hotel.fastCheckIn(payload);
  }

  async checkOutStay(stayId: string, payload?: { paymentMethod?: string; paidAmount?: number }) {
    return await apiClient.hotel.checkOutStay(stayId, payload);
  }

  async fetchStays(status?: string): Promise<HotelStay[]> {
    const data = await apiClient.hotel.getStays(status);
    return data.stays || [];
  }

  async extendStay(stayId: string, payload: { newExpectedCheckOut: string; additionalPaidAmount?: number; notes?: string }) {
    return await apiClient.hotel.extendStay(stayId, payload);
  }

  async transferStay(stayId: string, payload: { targetRoomId: string; reason?: string }) {
    return await apiClient.hotel.transferStay(stayId, payload);
  }

  async fetchFolios(params?: { status?: string; search?: string }): Promise<HotelFolio[]> {
    const data = await apiClient.hotel.getFolios(params);
    return data.folios || [];
  }

  async fetchFolioById(id: string): Promise<HotelFolio | null> {
    const data = await apiClient.hotel.getFolio(id);
    return data.folio || null;
  }

  async postFolioCharge(folioId: string, payload: { description: string; amount: number; category?: string; entryType?: string; notes?: string }) {
    return await apiClient.hotel.postFolioCharge(folioId, payload);
  }

  async settleFolio(folioId: string, payload: { payments: Array<{ method: string; amount: number; notes?: string }> }) {
    return await apiClient.hotel.settleFolio(folioId, payload);
  }

  async reverseFolioEntry(folioId: string, entryId: string, reason: string) {
    return await apiClient.hotel.reverseFolioEntry(folioId, entryId, reason);
  }

  async transferFolioEntry(folioId: string, entryId: string, targetFolioId: string, reason: string) {
    return await apiClient.hotel.transferFolioEntry(folioId, entryId, targetFolioId, reason);
  }

  async getQrLocation(roomId: string, label: string) {
    const res = await apiClient.hotel.getQrLocation({
      locationType: "ROOM",
      roomId,
      label,
    });
    return res.qrLocation;
  }

  async fetchReservations(params?: { status?: string; search?: string }): Promise<HotelReservation[]> {
    const data = await apiClient.hotel.getReservations(params);
    return data.reservations || [];
  }

  async createReservation(payload: any): Promise<HotelReservation> {
    const data = await apiClient.hotel.createReservation(payload);
    return data.reservation;
  }

  async updateReservation(id: string, payload: any): Promise<HotelReservation> {
    const data = await apiClient.hotel.updateReservation(id, payload);
    return data.reservation;
  }

  async fetchHousekeepingTasks(params?: { status?: string; floorId?: string }): Promise<HousekeepingTask[]> {
    const data = await apiClient.hotel.getHousekeepingTasks(params);
    return data.tasks || [];
  }

  async createHousekeepingTask(payload: any): Promise<HousekeepingTask> {
    const data = await apiClient.hotel.createHousekeepingTask(payload);
    return data.task;
  }

  async updateHousekeepingTask(id: string, payload: any): Promise<HousekeepingTask> {
    const data = await apiClient.hotel.updateHousekeepingTask(id, payload);
    return data.task;
  }

  async fetchMaintenanceTickets(): Promise<MaintenanceTicket[]> {
    const data = await apiClient.hotel.getMaintenanceTickets();
    return data.tickets || [];
  }

  async createMaintenanceTicket(payload: any): Promise<MaintenanceTicket> {
    const data = await apiClient.hotel.createMaintenanceTicket(payload);
    return data.ticket;
  }

  async updateMaintenanceTicket(id: string, payload: any): Promise<MaintenanceTicket> {
    const data = await apiClient.hotel.updateMaintenanceTicket(id, payload);
    return data.ticket;
  }

  async fetchServiceRequests(params?: { status?: string; category?: string }): Promise<ServiceRequestItem[]> {
    const data = await apiClient.hotel.getServiceRequests(params);
    return data.requests || [];
  }

  async updateServiceRequest(id: string, payload: any): Promise<ServiceRequestItem> {
    const data = await apiClient.hotel.updateServiceRequest(id, payload);
    return data.request;
  }

  async fetchQrLocations(): Promise<HotelQrLocationRecord[]> {
    const data = await apiClient.hotel.getQrLocations();
    return data.locations || [];
  }

  async createQrLocation(payload: any): Promise<HotelQrLocationRecord> {
    const data = await apiClient.hotel.createQrLocation(payload);
    return data.location;
  }

  async rotateQrLocation(id: string): Promise<HotelQrLocationRecord> {
    const data = await apiClient.hotel.rotateQrLocation(id);
    return data.location;
  }

  async fetchPilotFeatureFlags() {
    return await apiClient.hotel.getPilotFeatureFlags();
  }

  async updatePilotFeatureFlags(payload: any) {
    return await apiClient.hotel.updatePilotFeatureFlags(payload);
  }

  async fetchPilotPrintJobs() {
    return await apiClient.hotel.getPilotPrintJobs();
  }

  async createPilotPrintJob(payload: any) {
    return await apiClient.hotel.createPilotPrintJob(payload);
  }

  async retryPilotPrintJob(id: string) {
    return await apiClient.hotel.retryPilotPrintJob(id);
  }

  async fetchPilotOfflineSync() {
    return await apiClient.hotel.getPilotOfflineSync();
  }

  async triggerPilotOfflineSync(payload: any) {
    return await apiClient.hotel.triggerPilotOfflineSync(payload);
  }

  async fetchPilotReconciliation() {
    return await apiClient.hotel.getPilotReconciliation();
  }

  async resolvePilotReconciliation(payload: any) {
    return await apiClient.hotel.resolvePilotReconciliation(payload);
  }

  async fetchRooms(): Promise<HotelRoom[]> {
    const data = await apiClient.hotel.getRooms();
    return data.rooms || [];
  }
}

export const hotelRepository = new HotelRepository();

