/**
 * Core Global API Client
 * Centralized service class for all API endpoints in RestroInn
 * Follows Clean Architecture: Repositories interact exclusively through this typed client.
 */

export class ApiError extends Error {
  statusCode: number;
  data: any;

  constructor(message: string, statusCode: number = 500, data?: any) {
    super(message);
    this.name = "ApiError";
    this.statusCode = statusCode;
    this.data = data;
  }
}

class BaseApiClient {
  protected async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const headers = new Headers(options.headers || {});
    if (!headers.has("Content-Type") && !(options.body instanceof FormData)) {
      headers.set("Content-Type", "application/json");
    }
    headers.set("Accept", "application/json");

    const res = await fetch(endpoint, {
      ...options,
      headers,
    });

    let data: any = null;
    const contentType = res.headers.get("content-type");
    if (contentType && contentType.includes("application/json")) {
      try {
        data = await res.json();
      } catch {
        data = null;
      }
    }

    if (!res.ok) {
      const errorMessage = data?.error || data?.message || `Request failed with status ${res.status}`;
      throw new ApiError(errorMessage, res.status, data);
    }

    return data as T;
  }
}

// ==========================================
// 1. Restaurant Endpoints
// ==========================================
export class RestaurantEndpoints extends BaseApiClient {
  // 1. Floors & Spaces
  async getFloors() {
    return this.request<{ floors: any[] }>("/api/v1/restaurant/floors");
  }

  async createFloor(payload: { name: string; displayOrder?: number }) {
    return this.request<{ success: boolean; floor: any }>("/api/v1/restaurant/floors", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  async updateFloor(id: string, payload: { name?: string; displayOrder?: number }) {
    return this.request<{ success: boolean; floor: any }>(`/api/v1/restaurant/floors/${id}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
  }

  async deleteFloor(id: string) {
    return this.request<{ success: boolean }>(`/api/v1/restaurant/floors/${id}`, {
      method: "DELETE",
    });
  }

  async getTables(params?: { floorId?: string; status?: string }) {
    const query = new URLSearchParams();
    if (params?.floorId && params.floorId !== "ALL") query.set("floorId", params.floorId);
    if (params?.status && params.status !== "ALL") query.set("status", params.status);
    const qs = query.toString();
    return this.request<{ tables: any[] }>(`/api/v1/restaurant/tables${qs ? `?${qs}` : ""}`);
  }

  async createTable(payload: any) {
    return this.request<{ success: boolean; table: any }>("/api/v1/restaurant/tables", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  async updateTable(id: string, payload: any) {
    return this.request<{ success: boolean; table: any }>(`/api/v1/restaurant/tables/${id}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
  }

  async deleteTable(id: string) {
    return this.request<{ success: boolean }>(`/api/v1/restaurant/tables/${id}`, {
      method: "DELETE",
    });
  }

  // 1b. Menu Items, Sections & Modifiers
  async getMenuItems() {
    return this.request<{ items: any[] }>("/api/v1/restaurant/items");
  }

  async createMenuItem(payload: any) {
    return this.request<{ success: boolean; item: any }>("/api/v1/restaurant/items", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  async updateMenuItem(id: string, payload: any) {
    return this.request<{ success: boolean; item: any }>(`/api/v1/restaurant/items/${id}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
  }

  async deleteMenuItem(id: string) {
    return this.request<{ success: boolean }>(`/api/v1/restaurant/items/${id}`, {
      method: "DELETE",
    });
  }

  async getMenuSections() {
    return this.request<{ sections: any[] }>("/api/v1/restaurant/sections");
  }

  async createMenuSection(payload: { name: string; displayOrder?: number }) {
    return this.request<{ success: boolean; section: any }>("/api/v1/restaurant/sections", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  async updateMenuSection(id: string, payload: { name?: string; displayOrder?: number }) {
    return this.request<{ success: boolean; section: any }>(`/api/v1/restaurant/sections/${id}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
  }

  async deleteMenuSection(id: string) {
    return this.request<{ success: boolean }>(`/api/v1/restaurant/sections/${id}`, {
      method: "DELETE",
    });
  }

  async getModifierGroups() {
    return this.request<{ modifierGroups: any[] }>("/api/v1/restaurant/modifiers");
  }

  async createModifierGroup(payload: any) {
    return this.request<{ success: boolean; modifierGroup: any }>("/api/v1/restaurant/modifiers", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  async updateModifierGroup(id: string, payload: any) {
    return this.request<{ success: boolean; modifierGroup: any }>(`/api/v1/restaurant/modifiers/${id}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
  }

  async deleteModifierGroup(id: string) {
    return this.request<{ success: boolean }>(`/api/v1/restaurant/modifiers/${id}`, {
      method: "DELETE",
    });
  }

  async seatGuests(tableId: string, payload: { guestCount: number; notes?: string }) {
    return this.request<{ success: boolean; session: any; table: any }>(
      `/api/v1/restaurant/tables/${tableId}/seat`,
      {
        method: "POST",
        body: JSON.stringify(payload),
      }
    );
  }

  async moveTable(payload: { sourceTableId: string; targetTableId: string; reason?: string }) {
    return this.request<{ success: boolean; targetTable: any }>(
      "/api/v1/restaurant/tables/move",
      {
        method: "POST",
        body: JSON.stringify(payload),
      }
    );
  }

  async mergeTables(payload: { sourceTableIds: string[]; targetTableId: string; reason?: string }) {
    return this.request<{ success: boolean; targetTable: any }>(
      "/api/v1/restaurant/tables/merge",
      {
        method: "POST",
        body: JSON.stringify(payload),
      }
    );
  }

  // 2. Menu Catalog
  async getMenuCatalog() {
    return this.request<{ catalog: any[]; categories: any[]; subcategories: any[] }>(
      "/api/v1/restaurant/menu/catalog"
    );
  }

  // 3. Orders & Active Sessions
  async getOrders(params?: { status?: string; tableId?: string }) {
    const query = new URLSearchParams();
    if (params?.status) query.set("status", params.status);
    if (params?.tableId) query.set("tableId", params.tableId);
    const qs = query.toString();
    return this.request<{ orders: any[] }>(`/api/v1/restaurant/orders${qs ? `?${qs}` : ""}`);
  }

  async getTableOrders(tableId: string) {
    return this.request<{
      table: any;
      activeSession: any;
      activeOrder: any;
      historicalOrders?: any[];
    }>(`/api/v1/restaurant/tables/${tableId}/orders`);
  }

  async createOrder(payload: {
    orderType: string;
    tableId?: string;
    tableSessionId?: string;
    items: any[];
    notes?: string;
    autoRouteToKitchen?: boolean;
    deliveryInfo?: any;
    roomServiceInfo?: any;
  }) {
    return this.request<{ success: boolean; order: any; round: any; tickets: any[] }>(
      "/api/v1/restaurant/orders",
      {
        method: "POST",
        body: JSON.stringify(payload),
      }
    );
  }

  async addOrderRound(orderId: string, payload: { items: any[]; notes?: string }) {
    return this.request<{ success: boolean; round: any; tickets: any[] }>(
      `/api/v1/restaurant/orders/${orderId}/rounds`,
      {
        method: "POST",
        body: JSON.stringify(payload),
      }
    );
  }

  async cancelOrder(orderId: string, reason: string) {
    return this.request<{ success: boolean; message: string }>(
      `/api/v1/restaurant/orders/${orderId}/cancel`,
      {
        method: "POST",
        body: JSON.stringify({ reason }),
      }
    );
  }

  async closeSession(sessionId: string, reason?: string) {
    return this.request<{ success: boolean; session: any }>(
      `/api/v1/restaurant/sessions/${sessionId}/close`,
      {
        method: "POST",
        body: JSON.stringify({ reason }),
      }
    );
  }

  async updateOrderLineStatus(
    orderId: string,
    lineId: string,
    payload: { action: "CANCEL" | "ADJUST_QTY"; reason?: string; quantity?: number }
  ) {
    return this.request<{ success: boolean; line?: any }>(
      `/api/v1/restaurant/orders/${orderId}/lines/${lineId}/status`,
      {
        method: "PATCH",
        body: JSON.stringify(payload),
      }
    );
  }

  // 4. Billing & Settlement
  async settleOrder(
    orderId: string,
    payload: {
      payments: Array<{
        method: "CASH" | "CARD" | "QR" | "BANK_TRANSFER" | "CREDIT" | "ROOM_CHARGE" | "OTHER";
        amount: number;
        reference?: string;
      }>;
      discountType?: "FLAT" | "PERCENT";
      discountValue?: number;
      serviceChargeRate?: number;
      vatRate?: number;
      customerId?: string;
      customerName?: string;
      customerPhone?: string;
      customerPan?: string;
    }
  ) {
    return this.request<{ success: boolean; order: any; invoice?: any }>(
      `/api/v1/restaurant/orders/${orderId}/settle`,
      {
        method: "POST",
        body: JSON.stringify(payload),
      }
    );
  }

  // 5. Kitchen Display & Stations
  async getKitchenTickets(stationId?: string) {
    const qs = stationId && stationId !== "ALL" ? `?stationId=${stationId}` : "";
    return this.request<{ tickets: any[]; served: any[] }>(`/api/v1/restaurant/kitchen-tickets${qs}`);
  }

  async getKitchenStations() {
    return this.request<{ stations: any[] }>("/api/v1/restaurant/kitchen-stations");
  }

  async updateKitchenTicketStatus(ticketId: string, status: string) {
    return this.request<any>(`/api/v1/restaurant/kitchen-tickets/${ticketId}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    });
  }

  async updateKitchenTicketLineStatus(
    ticketId: string,
    lineId: string,
    payload: { status: string; reason?: string }
  ) {
    return this.request<any>(
      `/api/v1/restaurant/kitchen-tickets/${ticketId}/lines/${lineId}/status`,
      {
        method: "PATCH",
        body: JSON.stringify(payload),
      }
    );
  }

  // 6. Restaurant Reports & Void Reconciliation
  async getRestaurantReports(params?: { startDate?: string; endDate?: string }) {
    const query = new URLSearchParams();
    if (params?.startDate) query.set("startDate", params.startDate);
    if (params?.endDate) query.set("endDate", params.endDate);
    const qs = query.toString();
    return this.request<any>(`/api/v1/restaurant/reports${qs ? `?${qs}` : ""}`);
  }

  async getVoidReconciliationReport(params?: { startDate?: string; endDate?: string }) {
    const query = new URLSearchParams();
    if (params?.startDate) query.set("startDate", params.startDate);
    if (params?.endDate) query.set("endDate", params.endDate);
    const qs = query.toString();
    return this.request<any>(`/api/v1/restaurant/reports/reconciliation${qs ? `?${qs}` : ""}`);
  }
}

// ==========================================
// 2. Hotel Endpoints
// ==========================================
export class HotelEndpoints extends BaseApiClient {
  async getTapeChart(startDate: string, endDate: string, roomTypeId?: string) {
    const query = new URLSearchParams({ startDate, endDate });
    if (roomTypeId && roomTypeId !== "ALL") query.set("roomTypeId", roomTypeId);
    return this.request<{ rooms: any[]; dates: string[]; stats: any }>(
      `/api/v1/hotel/tape-chart?${query.toString()}`
    );
  }

  async getRoomTypes() {
    return this.request<{ roomTypes: any[] }>("/api/v1/hotel/room-types");
  }

  async createRoomType(payload: {
    name: string;
    code: string;
    baseRate: number;
    maxOccupancy: number;
    description?: string;
  }) {
    return this.request<{ roomType: any }>("/api/v1/hotel/room-types", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  async updateRoomType(id: string, payload: {
    name?: string;
    code?: string;
    baseRate?: number;
    maxOccupancy?: number;
    description?: string;
  }) {
    return this.request<{ roomType: any }>(`/api/v1/hotel/room-types/${id}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
  }

  async deleteRoomType(id: string) {
    return this.request<{ success: boolean; message: string }>(`/api/v1/hotel/room-types/${id}`, {
      method: "DELETE",
    });
  }

  async getFloors() {
    return this.request<{ floors: any[] }>("/api/v1/restaurant/floors");
  }

  async createFloor(payload: { name: string; displayOrder?: number }) {
    return this.request<{ floor: any }>("/api/v1/restaurant/floors", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  async updateFloor(id: string, payload: { name: string; displayOrder?: number }) {
    return this.request<{ floor: any }>(`/api/v1/restaurant/floors/${id}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
  }

  async deleteFloor(id: string) {
    return this.request<{ success: boolean; message: string }>(`/api/v1/restaurant/floors/${id}`, {
      method: "DELETE",
    });
  }

  async getRooms() {
    return this.request<{ rooms: any[] }>("/api/v1/hotel/rooms");
  }

  async createRoom(payload: {
    roomNumber: string;
    roomTypeId: string;
    floorId?: string;
    capacity?: number;
    notes?: string;
  }) {
    return this.request<{ room: any }>("/api/v1/hotel/rooms", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  async updateRoom(id: string, payload: {
    roomNumber?: string;
    roomTypeId?: string;
    floorId?: string | null;
    capacity?: number;
    status?: string;
    notes?: string | null;
  }) {
    return this.request<{ room: any }>(`/api/v1/hotel/rooms/${id}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
  }

  async deleteRoom(id: string) {
    return this.request<{ success: boolean; message: string }>(`/api/v1/hotel/rooms/${id}`, {
      method: "DELETE",
    });
  }

  async getActiveStays() {
    return this.request<{ stays: any[] }>("/api/v1/hotel/stays?status=CHECKED_IN");
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
    return this.request<{ success: boolean; stay: any; folio: any }>("/api/v1/hotel/stays/check-in", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  async checkOutStay(stayId: string, payload?: { paymentMethod?: string; paidAmount?: number }) {
    return this.request<{ success: boolean; message: string }>(`/api/v1/hotel/stays/${stayId}/check-out`, {
      method: "POST",
      body: JSON.stringify(payload || {}),
    });
  }

  async getStays(status?: string) {
    const query = new URLSearchParams();
    if (status && status !== "ALL") query.set("status", status);
    const qs = query.toString();
    return this.request<{ stays: any[] }>(`/api/v1/hotel/stays${qs ? `?${qs}` : ""}`);
  }

  async extendStay(stayId: string, payload: { newExpectedCheckOut: string; additionalPaidAmount?: number; notes?: string }) {
    return this.request<{ success: boolean; stay: any }>(`/api/v1/hotel/stays/${stayId}/extend`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  async transferStay(stayId: string, payload: { targetRoomId: string; reason?: string }) {
    return this.request<{ success: boolean; stay: any }>(`/api/v1/hotel/stays/${stayId}/transfer`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  async getFolios(params?: { status?: string; search?: string }) {
    const query = new URLSearchParams();
    if (params?.status && params.status !== "ALL") query.set("status", params.status);
    if (params?.search) query.set("search", params.search);
    const qs = query.toString();
    return this.request<{ folios: any[] }>(`/api/v1/hotel/folios${qs ? `?${qs}` : ""}`);
  }

  async getFolio(id: string) {
    return this.request<{ folio: any }>(`/api/v1/hotel/folios/${id}`);
  }

  async postFolioCharge(folioId: string, payload: { description: string; amount: number; category?: string; entryType?: string; notes?: string }) {
    return this.request<{ success: boolean; entry: any }>(`/api/v1/hotel/folios/${folioId}/charges`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  async settleFolio(folioId: string, payload: { payments: Array<{ method: string; amount: number; notes?: string }> }) {
    return this.request<{ success: boolean; folio: any; receiptNumber?: string }>(`/api/v1/hotel/folios/${folioId}/settle`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  async reverseFolioEntry(folioId: string, entryId: string, reason: string) {
    return this.request<{ success: boolean }>(`/api/v1/hotel/folios/${folioId}/entries/${entryId}/reverse`, {
      method: "POST",
      body: JSON.stringify({ reason }),
    });
  }

  async transferFolioEntry(folioId: string, entryId: string, targetFolioId: string, reason: string) {
    return this.request<{ success: boolean }>(`/api/v1/hotel/folios/${folioId}/entries/${entryId}/transfer`, {
      method: "POST",
      body: JSON.stringify({ targetFolioId, reason }),
    });
  }

  async getQrLocation(payload: { locationType: string; roomId?: string; label: string }) {
    return this.request<{ qrLocation: any }>("/api/v1/hotel/qr-locations", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  async getReservations(params?: { status?: string; search?: string }) {
    const query = new URLSearchParams();
    if (params?.status && params.status !== "ALL") query.set("status", params.status);
    if (params?.search) query.set("search", params.search);
    const qs = query.toString();
    return this.request<{ reservations: any[] }>(`/api/v1/hotel/reservations${qs ? `?${qs}` : ""}`);
  }

  async createReservation(payload: any) {
    return this.request<{ reservation: any }>("/api/v1/hotel/reservations", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  async updateReservation(id: string, payload: any) {
    return this.request<{ reservation: any }>(`/api/v1/hotel/reservations/${id}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
  }

  async getHousekeepingTasks(params?: { status?: string; floorId?: string }) {
    const query = new URLSearchParams();
    if (params?.status && params.status !== "ALL") query.set("status", params.status);
    if (params?.floorId && params.floorId !== "ALL") query.set("floorId", params.floorId);
    const qs = query.toString();
    return this.request<{ tasks: any[] }>(`/api/v1/hotel/housekeeping${qs ? `?${qs}` : ""}`);
  }

  async createHousekeepingTask(payload: any) {
    return this.request<{ task: any }>("/api/v1/hotel/housekeeping", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  async updateHousekeepingTask(id: string, payload: any) {
    return this.request<{ task: any }>(`/api/v1/hotel/housekeeping/${id}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
  }

  async getMaintenanceTickets() {
    return this.request<{ tickets: any[] }>("/api/v1/hotel/maintenance");
  }

  async createMaintenanceTicket(payload: any) {
    return this.request<{ ticket: any }>("/api/v1/hotel/maintenance", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  async updateMaintenanceTicket(id: string, payload: any) {
    return this.request<{ ticket: any }>(`/api/v1/hotel/maintenance/${id}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
  }

  async getServiceRequests(params?: { status?: string; category?: string }) {
    const query = new URLSearchParams();
    if (params?.status && params.status !== "ALL") query.set("status", params.status);
    if (params?.category && params.category !== "ALL") query.set("category", params.category);
    const qs = query.toString();
    return this.request<{ requests: any[] }>(`/api/v1/hotel/service-requests${qs ? `?${qs}` : ""}`);
  }

  async updateServiceRequest(id: string, payload: any) {
    return this.request<{ request: any }>(`/api/v1/hotel/service-requests/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
  }

  async getQrLocations() {
    return this.request<{ locations: any[] }>("/api/v1/hotel/qr-locations");
  }

  async createQrLocation(payload: any) {
    return this.request<{ location: any }>("/api/v1/hotel/qr-locations", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  async rotateQrLocation(id: string) {
    return this.request<{ location: any }>(`/api/v1/hotel/qr-locations/${id}/rotate`, {
      method: "POST",
    });
  }

  async getPilotFeatureFlags() {
    return this.request<any>("/api/v1/hotel/pilot/feature-flags");
  }

  async updatePilotFeatureFlags(payload: any) {
    return this.request<any>("/api/v1/hotel/pilot/feature-flags", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  async getPilotPrintJobs() {
    return this.request<any>("/api/v1/hotel/pilot/print-jobs");
  }

  async createPilotPrintJob(payload: any) {
    return this.request<any>("/api/v1/hotel/pilot/print-jobs", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  async retryPilotPrintJob(id: string) {
    return this.request<any>(`/api/v1/hotel/pilot/print-jobs/${id}/retry`, {
      method: "POST",
    });
  }

  async getPilotOfflineSync() {
    return this.request<any>("/api/v1/hotel/pilot/offline-sync");
  }

  async triggerPilotOfflineSync(payload: any) {
    return this.request<any>("/api/v1/hotel/pilot/offline-sync", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  async getPilotReconciliation() {
    return this.request<any>("/api/v1/hotel/pilot/reconciliation");
  }

  async resolvePilotReconciliation(payload: any) {
    return this.request<any>("/api/v1/hotel/pilot/reconciliation", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  async getPilotHealth() {
    return this.request<any>("/api/v1/hotel/pilot/health");
  }
}

// ==========================================
// 3. Inventory Endpoints
// ==========================================
export class InventoryEndpoints extends BaseApiClient {
  async getInventory(params?: { search?: string; lowStock?: boolean; branchId?: string }) {
    const query = new URLSearchParams();
    if (params?.search) query.set("search", params.search);
    if (params?.lowStock) query.set("lowStock", "true");
    if (params?.branchId) query.set("branchId", params.branchId);
    const qs = query.toString();
    return this.request<{
      inventory: any[];
      metrics: { totalValuation: number; lowStockCount: number; totalItems: number };
      branches: any[];
      userRole: string;
      isOwner: boolean;
    }>(`/api/v1/inventory${qs ? `?${qs}` : ""}`);
  }

  async getCurrentStock(params?: { search?: string; categoryId?: string; lowStock?: boolean; branchId?: string }) {
    const query = new URLSearchParams();
    if (params?.search) query.set("search", params.search);
    if (params?.categoryId && params.categoryId !== "ALL") query.set("categoryId", params.categoryId);
    if (params?.lowStock) query.set("lowStock", "true");
    if (params?.branchId) query.set("branchId", params.branchId);
    const qs = query.toString();
    return this.request<any>(`/api/v1/inventory/current-stock${qs ? `?${qs}` : ""}`);
  }

  async getStockMovements(params?: { search?: string; type?: string; limit?: number; days?: number }) {
    const query = new URLSearchParams();
    if (params?.search) query.set("search", params.search);
    if (params?.type && params.type !== "ALL") query.set("type", params.type);
    if (params?.limit) query.set("limit", String(params.limit));
    if (params?.days) query.set("days", String(params.days));
    const qs = query.toString();
    return this.request<any>(`/api/v1/inventory/stock-movements${qs ? `?${qs}` : ""}`);
  }

  async adjustStock(payload: {
    productId: string;
    branchId?: string;
    type: "STOCK_IN" | "STOCK_OUT" | "DAMAGE" | "CORRECTION";
    quantity: number;
    notes?: string;
  }) {
    return this.request<{ success: boolean; message?: string }>("/api/v1/inventory", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  // Opening Stock
  async getOpeningStock(params?: { branchId?: string; status?: string; search?: string }) {
    const query = new URLSearchParams();
    if (params?.branchId) query.set("branchId", params.branchId);
    if (params?.status) query.set("status", params.status);
    if (params?.search) query.set("search", params.search);
    const qs = query.toString();
    return this.request<any>(`/api/v1/inventory/opening${qs ? `?${qs}` : ""}`);
  }

  async createOpeningStock(payload: any) {
    return this.request<any>("/api/v1/inventory/opening", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  async updateOpeningStock(id: string, payload: any) {
    return this.request<any>(`/api/v1/inventory/opening/${id}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
  }

  async deleteOpeningStock(id: string) {
    return this.request<any>(`/api/v1/inventory/opening/${id}`, {
      method: "DELETE",
    });
  }

  // Stock Transfers
  async getTransfers(params?: { status?: string }) {
    const query = new URLSearchParams();
    if (params?.status) query.set("status", params.status);
    const qs = query.toString();
    return this.request<any>(`/api/v1/inventory/transfer${qs ? `?${qs}` : ""}`);
  }

  async createTransfer(payload: any) {
    return this.request<any>("/api/v1/inventory/transfer", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  async updateTransferStatus(id: string, payload: any) {
    return this.request<any>(`/api/v1/inventory/transfer/${id}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
  }

  async getBatchStock(params?: { branchId?: string; search?: string; expiringSoon?: boolean }) {
    const query = new URLSearchParams();
    if (params?.branchId) query.set("branchId", params.branchId);
    if (params?.search) query.set("search", params.search);
    if (params?.expiringSoon) query.set("expiringSoon", "true");
    const qs = query.toString();
    return this.request<any>(`/api/v1/inventory/batch-stock${qs ? `?${qs}` : ""}`);
  }

  async getDamageExpiry(params?: { branchId?: string; type?: string; search?: string }) {
    const query = new URLSearchParams();
    if (params?.branchId) query.set("branchId", params.branchId);
    if (params?.type && params.type !== "ALL") query.set("type", params.type);
    if (params?.search) query.set("search", params.search);
    const qs = query.toString();
    return this.request<any>(`/api/v1/inventory/damage-expiry${qs ? `?${qs}` : ""}`);
  }

  async recordDamageExpiry(payload: any) {
    return this.request<any>("/api/v1/inventory/damage-expiry", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  async getMovementHistory(params?: { branchId?: string; productId?: string; type?: string; search?: string; days?: number }) {
    const query = new URLSearchParams();
    if (params?.branchId) query.set("branchId", params.branchId);
    if (params?.productId) query.set("productId", params.productId);
    if (params?.type && params.type !== "ALL") query.set("type", params.type);
    if (params?.search) query.set("search", params.search);
    if (params?.days) query.set("days", String(params.days));
    const qs = query.toString();
    return this.request<any>(`/api/v1/inventory/movement-history${qs ? `?${qs}` : ""}`);
  }

  async getAdjustmentsHistory(params?: { branchId?: string; search?: string; type?: string; days?: number }) {
    const query = new URLSearchParams();
    if (params?.branchId) query.set("branchId", params.branchId);
    if (params?.search) query.set("search", params.search);
    if (params?.type && params.type !== "ALL") query.set("type", params.type);
    if (params?.days) query.set("days", String(params.days));
    const qs = query.toString();
    return this.request<any>(`/api/v1/inventory/adjustments-history${qs ? `?${qs}` : ""}`);
  }

  async getStockValue(params?: { branchId?: string; categoryId?: string; sortBy?: string }) {
    const query = new URLSearchParams();
    if (params?.branchId) query.set("branchId", params.branchId);
    if (params?.categoryId && params.categoryId !== "ALL") query.set("categoryId", params.categoryId);
    if (params?.sortBy) query.set("sortBy", params.sortBy);
    const qs = query.toString();
    return this.request<any>(`/api/v1/inventory/stock-value${qs ? `?${qs}` : ""}`);
  }
}

// ==========================================
// 4. Products Endpoints
// ==========================================
export class ProductEndpoints extends BaseApiClient {
  async getProducts(params?: { search?: string; categoryId?: string; subcategoryId?: string; status?: string; limit?: number }) {
    const query = new URLSearchParams();
    if (params?.limit) query.set("limit", params.limit.toString());
    if (params?.search) query.set("search", params.search);
    if (params?.categoryId && params.categoryId !== "ALL") query.set("categoryId", params.categoryId);
    if (params?.subcategoryId && params.subcategoryId !== "ALL") query.set("subcategoryId", params.subcategoryId);
    if (params?.status && params.status !== "ALL") query.set("status", params.status);
    const qs = query.toString();
    return this.request<any>(`/api/v1/products${qs ? `?${qs}` : ""}`);
  }

  async createProduct(payload: any) {
    return this.request<any>("/api/v1/products", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  async updateProduct(id: string, payload: any) {
    return this.request<any>(`/api/v1/products/${id}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    });
  }

  async deleteProduct(id: string) {
    return this.request<{ success: boolean }>(`/api/v1/products/${id}`, {
      method: "DELETE",
    });
  }

  async getCategories() {
    return this.request<any>("/api/v1/categories");
  }

  async createCategory(payload: any) {
    return this.request<any>("/api/v1/categories", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  async updateCategory(id: string, payload: any) {
    return this.request<any>(`/api/v1/categories/${id}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    });
  }

  async deleteCategory(id: string) {
    return this.request<any>(`/api/v1/categories/${id}`, {
      method: "DELETE",
    });
  }

  async getSubcategories() {
    return this.request<any>("/api/v1/subcategories");
  }

  async createSubcategory(payload: any) {
    return this.request<any>("/api/v1/subcategories", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  async updateSubcategory(id: string, payload: any) {
    return this.request<any>(`/api/v1/subcategories/${id}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    });
  }

  async deleteSubcategory(id: string) {
    return this.request<any>(`/api/v1/subcategories/${id}`, {
      method: "DELETE",
    });
  }

  async getBranches() {
    return this.request<any>("/api/v1/branches");
  }

  async getUnits() {
    return this.request<any>("/api/v1/units");
  }

  async createUnit(payload: any) {
    return this.request<any>("/api/v1/units", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  async updateUnit(id: string, payload: any) {
    return this.request<any>(`/api/v1/units/${id}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    });
  }

  async deleteUnit(id: string) {
    return this.request<any>(`/api/v1/units/${id}`, {
      method: "DELETE",
    });
  }

  async getRecipe(productId: string) {
    return this.request<any>(`/api/v1/restaurant/recipes?productId=${productId}`);
  }

  async saveRecipe(payload: { productId: string; ingredients: any[] }) {
    return this.request<any>("/api/v1/restaurant/recipes", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  async adjustStock(payload: {
    productId: string;
    branchId: string;
    type: string;
    quantity: number;
    reason?: string;
  }) {
    return this.request<any>("/api/v1/inventory/adjustments", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  async importProducts(products: any[]) {
    return this.request<any>("/api/v1/products/import", {
      method: "POST",
      body: JSON.stringify({ products }),
    });
  }
}

// ==========================================
// 5. Customer Endpoints
// ==========================================
export class CustomerEndpoints extends BaseApiClient {
  async searchCustomers(search?: string) {
    const query = new URLSearchParams();
    if (search) query.set("search", search);
    const qs = query.toString();
    return this.request<{ customers: any[] }>(`/api/v1/customers${qs ? `?${qs}` : ""}`);
  }

  async createCustomer(payload: { name: string; phone?: string; email?: string; address?: string }) {
    return this.request<{ customer: any }>(
      "/api/v1/customers",
      {
        method: "POST",
        body: JSON.stringify(payload),
      }
    );
  }

  async updateCustomer(id: string, payload: any) {
    return this.request<{ customer: any }>(`/api/v1/customers/${id}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    });
  }

  async deleteCustomer(id: string) {
    return this.request<{ success: boolean }>(`/api/v1/customers/${id}`, {
      method: "DELETE",
    });
  }

  async getSuppliers(params?: { search?: string; limit?: number }) {
    const query = new URLSearchParams();
    if (params?.search) query.set("search", params.search);
    if (params?.limit) query.set("limit", String(params.limit));
    const qs = query.toString();
    return this.request<{ suppliers: any[] }>(`/api/v1/suppliers${qs ? `?${qs}` : ""}`);
  }

  async createSupplier(payload: { name: string; phone?: string; email?: string; address?: string; panVat?: string }) {
    return this.request<{ supplier: any }>(
      "/api/v1/suppliers",
      {
        method: "POST",
        body: JSON.stringify(payload),
      }
    );
  }

  async updateSupplier(id: string, payload: any) {
    return this.request<{ supplier: any }>(`/api/v1/suppliers/${id}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    });
  }

  async deleteSupplier(id: string) {
    return this.request<{ success: boolean }>(`/api/v1/suppliers/${id}`, {
      method: "DELETE",
    });
  }
}

// ==========================================
// 6. Financial & Commerce Endpoints
// ==========================================
export class FinancialEndpoints extends BaseApiClient {
  async getSales(params?: {
    search?: string;
    branchId?: string;
    startDate?: string;
    endDate?: string;
    page?: number;
    limit?: number;
  }) {
    const query = new URLSearchParams();
    if (params?.search) query.set("search", params.search);
    if (params?.branchId) query.set("branchId", params.branchId);
    if (params?.startDate) query.set("startDate", params.startDate);
    if (params?.endDate) query.set("endDate", params.endDate);
    if (params?.page) query.set("page", String(params.page));
    if (params?.limit) query.set("limit", String(params.limit));
    const qs = query.toString();
    return this.request<any>(`/api/v1/sales${qs ? `?${qs}` : ""}`);
  }

  async createSale(payload: any) {
    return this.request<any>("/api/v1/sales", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  async getPurchases(params?: {
    search?: string;
    supplierId?: string;
    branchId?: string;
    startDate?: string;
    endDate?: string;
    page?: number;
    limit?: number;
  }) {
    const query = new URLSearchParams();
    if (params?.search) query.set("search", params.search);
    if (params?.supplierId) query.set("supplierId", params.supplierId);
    if (params?.branchId) query.set("branchId", params.branchId);
    if (params?.startDate) query.set("startDate", params.startDate);
    if (params?.endDate) query.set("endDate", params.endDate);
    if (params?.page) query.set("page", String(params.page));
    if (params?.limit) query.set("limit", String(params.limit));
    const qs = query.toString();
    return this.request<any>(`/api/v1/purchases${qs ? `?${qs}` : ""}`);
  }

  async createPurchase(payload: any) {
    return this.request<any>("/api/v1/purchases", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  async getExpenses(params?: {
    search?: string;
    categoryId?: string;
    branchId?: string;
    startDate?: string;
    endDate?: string;
    page?: number;
    limit?: number;
  }) {
    const query = new URLSearchParams();
    if (params?.search) query.set("search", params.search);
    if (params?.categoryId) query.set("categoryId", params.categoryId);
    if (params?.branchId) query.set("branchId", params.branchId);
    if (params?.startDate) query.set("startDate", params.startDate);
    if (params?.endDate) query.set("endDate", params.endDate);
    if (params?.page) query.set("page", String(params.page));
    if (params?.limit) query.set("limit", String(params.limit));
    const qs = query.toString();
    return this.request<any>(`/api/v1/expenses${qs ? `?${qs}` : ""}`);
  }

  async createExpense(payload: any) {
    return this.request<any>("/api/v1/expenses", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  async getPayments(params?: {
    type: "RECEIVED" | "SENT";
    search?: string;
    customerId?: string;
    supplierId?: string;
    branchId?: string;
    method?: string;
    page?: number;
    limit?: number;
  }) {
    const query = new URLSearchParams();
    if (params?.type) query.set("type", params.type);
    if (params?.search) query.set("search", params.search);
    if (params?.customerId) query.set("customerId", params.customerId);
    if (params?.supplierId) query.set("supplierId", params.supplierId);
    if (params?.branchId) query.set("branchId", params.branchId);
    if (params?.method) query.set("method", params.method);
    if (params?.page) query.set("page", String(params.page));
    if (params?.limit) query.set("limit", String(params.limit));
    const qs = query.toString();
    return this.request<any>(`/api/v1/payments${qs ? `?${qs}` : ""}`);
  }

  async createPayment(payload: any) {
    return this.request<any>("/api/v1/payments", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  async reversePayment(id: string, reason?: string) {
    return this.request<any>(`/api/v1/payments/${id}/reverse`, {
      method: "POST",
      body: JSON.stringify({ reason }),
    });
  }
}

// ==========================================
// 7. Super-Admin Multi-Tenant Endpoints
// ==========================================
export class SuperAdminEndpoints extends BaseApiClient {
  async getDashboard() {
    return this.request<any>("/api/v1/super-admin/dashboard");
  }

  async approveRequest(requestId: string, payload?: any) {
    return this.request<any>(`/api/v1/super-admin/requests/${requestId}/approve`, {
      method: "POST",
      body: payload ? JSON.stringify(payload) : undefined,
    });
  }

  async rejectRequest(requestId: string, payload?: any) {
    return this.request<any>(`/api/v1/super-admin/requests/${requestId}/reject`, {
      method: "POST",
      body: payload ? JSON.stringify(payload) : undefined,
    });
  }

  async requestChanges(requestId: string, payload?: any) {
    return this.request<any>(`/api/v1/super-admin/requests/${requestId}/request-changes`, {
      method: "POST",
      body: payload ? JSON.stringify(payload) : undefined,
    });
  }

  // Businesses / Tenants
  async getBusinesses(params?: { search?: string; status?: string; plan?: string; page?: number; limit?: number }) {
    const query = new URLSearchParams();
    if (params?.search) query.set("search", params.search);
    if (params?.status && params.status !== "ALL") query.set("status", params.status);
    if (params?.plan && params.plan !== "ALL") query.set("plan", params.plan);
    if (params?.page) query.set("page", String(params.page));
    if (params?.limit) query.set("limit", String(params.limit));
    const qs = query.toString();
    return this.request<any>(`/api/v1/super-admin/businesses${qs ? `?${qs}` : ""}`);
  }

  async getBusinessById(id: string) {
    return this.request<any>(`/api/v1/super-admin/businesses/${id}`);
  }

  async createBusiness(payload: any) {
    return this.request<any>("/api/v1/super-admin/businesses", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  async updateBusiness(id: string, payload: any, method: "PUT" | "PATCH" = "PUT") {
    return this.request<any>(`/api/v1/super-admin/businesses/${id}`, {
      method,
      body: JSON.stringify(payload),
    });
  }

  async deleteBusiness(id: string) {
    return this.request<any>(`/api/v1/super-admin/businesses/${id}`, {
      method: "DELETE",
    });
  }

  async getBusinessesExpiring(params?: { timeframe?: string; search?: string }) {
    const query = new URLSearchParams();
    if (params?.timeframe) query.set("timeframe", params.timeframe);
    if (params?.search) query.set("search", params.search);
    const qs = query.toString();
    return this.request<any>(`/api/v1/super-admin/businesses/expiring${qs ? `?${qs}` : ""}`);
  }

  async sendExpiringAction(payload: any) {
    return this.request<any>("/api/v1/super-admin/businesses/expiring", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  async getOnboardingRequests(params?: { status?: string; search?: string }) {
    const query = new URLSearchParams();
    if (params?.status && params.status !== "ALL") query.set("status", params.status);
    if (params?.search) query.set("search", params.search);
    const qs = query.toString();
    return this.request<any>(`/api/v1/super-admin/onboarding${qs ? `?${qs}` : ""}`);
  }

  async updateSupportTicket(payload: any) {
    return this.request<any>("/api/v1/super-admin/support", {
      method: "PUT",
      body: JSON.stringify(payload),
    });
  }

  async updateNotice(payload: any) {
    return this.request<any>("/api/v1/super-admin/notices", {
      method: "PUT",
      body: JSON.stringify(payload),
    });
  }

  async deleteNotice(id: string) {
    return this.request<any>(`/api/v1/super-admin/notices?id=${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
  }

  async broadcastNotification(payload: any) {
    return this.request<any>("/api/v1/super-admin/notifications", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  async manageUser(payload: any) {
    return this.request<any>("/api/v1/super-admin/users", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  async updateChat(payload: any) {
    return this.request<any>("/api/v1/super-admin/chat", {
      method: "PUT",
      body: JSON.stringify(payload),
    });
  }

  // Subscriptions & Licenses
  async getSubscriptions(params?: { status?: string; plan?: string; cycle?: string; search?: string; page?: number; limit?: number }) {
    const query = new URLSearchParams();
    if (params?.status && params.status !== "ALL") query.set("status", params.status);
    if (params?.plan && params.plan !== "ALL") query.set("plan", params.plan);
    if (params?.cycle && params.cycle !== "ALL") query.set("cycle", params.cycle);
    if (params?.search) query.set("search", params.search);
    if (params?.page) query.set("page", String(params.page));
    if (params?.limit) query.set("limit", String(params.limit));
    const qs = query.toString();
    return this.request<any>(`/api/v1/super-admin/subscriptions${qs ? `?${qs}` : ""}`);
  }

  async createSubscription(payload: any) {
    return this.request<any>("/api/v1/super-admin/subscriptions", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  async updateSubscription(id: string, payload: any) {
    return this.request<any>(`/api/v1/super-admin/subscriptions/${id}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
  }

  // Modules & Features
  async getModules() {
    return this.request<any>("/api/v1/super-admin/modules");
  }

  async createModule(payload: any) {
    return this.request<any>("/api/v1/super-admin/modules", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  async updateModule(payload: any) {
    return this.request<any>("/api/v1/super-admin/modules", {
      method: "PUT",
      body: JSON.stringify(payload),
    });
  }

  async toggleBusinessModule(payload: { businessId: string; moduleKey: string; enabled: boolean }) {
    return this.request<any>("/api/v1/super-admin/modules/toggle", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  // Platform Monitoring, Revenue & Logs
  async getRevenueMetrics(params?: { range?: string }) {
    const query = new URLSearchParams();
    if (params?.range) query.set("range", params.range);
    const qs = query.toString();
    return this.request<any>(`/api/v1/super-admin/revenue${qs ? `?${qs}` : ""}`);
  }

  async recordRevenueSettlement(payload: any) {
    return this.request<any>("/api/v1/super-admin/revenue", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  async getMonitoring() {
    return this.request<any>("/api/v1/super-admin/monitoring");
  }

  async triggerMonitoringTest(payload: any) {
    return this.request<any>("/api/v1/super-admin/monitoring", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  async getActivityLogs(params?: { page?: number; limit?: number; search?: string }) {
    const query = new URLSearchParams();
    if (params?.page) query.set("page", String(params.page));
    if (params?.limit) query.set("limit", String(params.limit));
    if (params?.search) query.set("search", params.search);
    const qs = query.toString();
    return this.request<any>(`/api/v1/super-admin/activity-logs${qs ? `?${qs}` : ""}`);
  }

  // Support & Notices
  async getSupportTickets(params?: { status?: string }) {
    const query = new URLSearchParams();
    if (params?.status && params.status !== "ALL") query.set("status", params.status);
    const qs = query.toString();
    return this.request<any>(`/api/v1/super-admin/support${qs ? `?${qs}` : ""}`);
  }

  async replySupportTicket(id: string, payload: { message: string; status?: string }) {
    return this.request<any>(`/api/v1/super-admin/support/${id}/reply`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  async getNotices() {
    return this.request<any>("/api/v1/super-admin/notices");
  }

  async createNotice(payload: any) {
    return this.request<any>("/api/v1/super-admin/notices", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  async getRequests(params?: { status?: string; search?: string }) {
    const query = new URLSearchParams();
    if (params?.status && params.status !== "ALL") query.set("status", params.status);
    if (params?.search) query.set("search", params.search);
    const qs = query.toString();
    return this.request<any>(`/api/v1/super-admin/requests${qs ? `?${qs}` : ""}`);
  }

  async getNotifications() {
    return this.request<any>("/api/v1/super-admin/notifications");
  }

  async getReports(params?: any) {
    const query = new URLSearchParams(params || {});
    const qs = query.toString();
    return this.request<any>(`/api/v1/super-admin/reports${qs ? `?${qs}` : ""}`);
  }

  async getPlatformSettings() {
    return this.request<any>("/api/v1/super-admin/settings");
  }

  async updatePlatformSettings(payload: any) {
    return this.request<any>("/api/v1/super-admin/settings", {
      method: "PUT",
      body: JSON.stringify(payload),
    });
  }

  async getPlans() {
    return this.request<any>("/api/v1/super-admin/subscriptions/plans");
  }

  async createPlan(payload: any) {
    return this.request<any>("/api/v1/super-admin/subscriptions/plans", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  async updatePlan(id: string, payload: any) {
    return this.request<any>(`/api/v1/super-admin/subscriptions/plans/${id}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
  }

  async getChat(params?: { userId?: string; ownerId?: string; search?: string }) {
    const query = new URLSearchParams(params || {});
    const qs = query.toString();
    return this.request<any>(`/api/v1/super-admin/chat${qs ? `?${qs}` : ""}`);
  }

  async sendChatMessage(payload: any) {
    return this.request<any>("/api/v1/super-admin/chat", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  async getSuperAdminUsers(params?: { search?: string; role?: string; businessId?: string; status?: string; page?: number; limit?: number }) {
    const query = new URLSearchParams();
    if (params?.search) query.set("search", params.search);
    if (params?.role && params.role !== "ALL") query.set("role", params.role);
    if (params?.businessId && params.businessId !== "ALL") query.set("businessId", params.businessId);
    if (params?.status && params.status !== "ALL") query.set("status", params.status);
    if (params?.page) query.set("page", String(params.page));
    if (params?.limit) query.set("limit", String(params.limit));
    const qs = query.toString();
    return this.request<any>(`/api/v1/super-admin/users${qs ? `?${qs}` : ""}`);
  }
}

// ==========================================
// 8. Reports Endpoints
// ==========================================
export class ReportEndpoints extends BaseApiClient {
  async getDashboardMetrics(params?: { range?: string; branchId?: string }) {
    const query = new URLSearchParams();
    if (params?.range) query.set("range", params.range);
    if (params?.branchId) query.set("branchId", params.branchId);
    const qs = query.toString();
    return this.request<any>(`/api/v1/reports/dashboard${qs ? `?${qs}` : ""}`);
  }

  async getReports(params?: { startDate?: string; endDate?: string; branchId?: string }) {
    const query = new URLSearchParams();
    if (params?.startDate) query.set("startDate", params.startDate);
    if (params?.endDate) query.set("endDate", params.endDate);
    if (params?.branchId) query.set("branchId", params.branchId);
    const qs = query.toString();
    return this.request<any>(`/api/v1/reports${qs ? `?${qs}` : ""}`);
  }

  async getComplianceReport(params?: Record<string, string>) {
    const query = new URLSearchParams(params || {});
    const qs = query.toString();
    return this.request<any>(`/api/v1/reports/compliance${qs ? `?${qs}` : ""}`);
  }

  async getFiscalYear() {
    return this.request<any>("/api/v1/settings/fiscal-year");
  }

  async getReconciliationReport() {
    return this.request<any>("/api/v1/restaurant/reports/reconciliation");
  }

  async createReconciliationNote(payload: any) {
    return this.request<any>("/api/v1/restaurant/reports/reconciliation", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }
}

// ==========================================
// 9. Settings & Branches Endpoints
// ==========================================
export class SettingsEndpoints extends BaseApiClient {
  async getLayoutContext(cookieHeader?: string) {
    const headers: Record<string, string> = {};
    if (cookieHeader) headers["Cookie"] = cookieHeader;
    return this.request<any>("/api/v1/layout-context", {
      headers: Object.keys(headers).length > 0 ? headers : undefined,
      cache: "no-store",
    });
  }

  async getSettings() {
    return this.request<any>("/api/v1/settings");
  }

  async updateSettings(payload: any) {
    return this.request<any>("/api/v1/settings", {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
  }

  async getIrdConfig() {
    return this.request<any>("/api/v1/settings/ird");
  }

  async updateIrdConfig(payload: any) {
    return this.request<any>("/api/v1/settings/ird", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  async testIrdConnection() {
    return this.request<any>("/api/v1/settings/ird/test", { method: "POST" });
  }

  async getAuditLogs(params?: { limit?: number; page?: number; search?: string }) {
    const query = new URLSearchParams();
    if (params?.limit) query.set("limit", String(params.limit));
    if (params?.page) query.set("page", String(params.page));
    if (params?.search) query.set("search", params.search);
    const qs = query.toString();
    return this.request<any>(`/api/v1/settings/audit-logs${qs ? `?${qs}` : ""}`);
  }

  async getBranches() {
    return this.request<{ branches: any[] }>("/api/v1/branches");
  }

  async createBranch(payload: any) {
    return this.request<any>("/api/v1/branches", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  async updateBranch(id: string, payload: any) {
    return this.request<any>(`/api/v1/branches/${id}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
  }

  async deleteBranch(id: string) {
    return this.request<any>(`/api/v1/branches/${id}`, {
      method: "DELETE",
    });
  }

  async getCbmsConfig() {
    return this.request<any>("/api/v1/compliance/cbms");
  }

  async updateCbmsConfig(payload: any) {
    return this.request<any>("/api/v1/compliance/cbms", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  async getFiscalYear() {
    return this.request<any>("/api/v1/settings/fiscal-year");
  }

  async updateFiscalYear(payload: any) {
    return this.request<any>("/api/v1/settings/fiscal-year", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  async getSubscription() {
    return this.request<any>("/api/v1/subscriptions");
  }

  async updateSubscription(payload: { plan: string }) {
    return this.request<any>("/api/v1/subscriptions", {
      method: "PUT",
      body: JSON.stringify(payload),
    });
  }

  async getBackups() {
    return this.request<any[]>("/api/v1/settings/backup");
  }

  async triggerBackup(payload: { action: string }) {
    return this.request<any>("/api/v1/settings/backup", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  async getBroadcasts() {
    return this.request<{ broadcasts: any[] }>("/api/v1/notifications/broadcasts");
  }

  async search(query: string) {
    return this.request<any>(`/api/v1/search?q=${encodeURIComponent(query)}`);
  }
}

// ==========================================
// 10. Users & Roles Endpoints
// ==========================================
export class UserEndpoints extends BaseApiClient {
  async getUsers(params?: { role?: string; search?: string }) {
    const query = new URLSearchParams();
    if (params?.role) query.set("role", params.role);
    if (params?.search) query.set("search", params.search);
    const qs = query.toString();
    return this.request<{ users: any[] }>(`/api/v1/users${qs ? `?${qs}` : ""}`);
  }

  async createUser(payload: any) {
    return this.request<any>("/api/v1/users", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  async updateUser(id: string, payload: any) {
    return this.request<any>(`/api/v1/users/${id}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
  }

  async deleteUser(id: string) {
    return this.request<any>(`/api/v1/users/${id}`, {
      method: "DELETE",
    });
  }

  async getRoles() {
    return this.request<any>("/api/v1/roles");
  }

  async createRole(payload: any) {
    return this.request<any>("/api/v1/roles", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  async updateRole(id: string, payload: any) {
    return this.request<any>(`/api/v1/roles/${id}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
  }

  async deleteRole(id: string) {
    return this.request<any>(`/api/v1/roles/${id}`, {
      method: "DELETE",
    });
  }

  async getDevices() {
    return this.request<any>("/api/v1/users/devices");
  }

  async revokeDevice(id: string) {
    return this.request<any>(`/api/v1/users/devices/${id}`, {
      method: "DELETE",
    });
  }

  async getUserActivity(params?: { search?: string; userId?: string; branchId?: string; page?: number; limit?: number }) {
    const query = new URLSearchParams();
    if (params?.search) query.set("search", params.search);
    if (params?.userId) query.set("userId", params.userId);
    if (params?.branchId) query.set("branchId", params.branchId);
    if (params?.page) query.set("page", String(params.page));
    if (params?.limit) query.set("limit", String(params.limit));
    const qs = query.toString();
    return this.request<any>(`/api/v1/users/activity${qs ? `?${qs}` : ""}`);
  }

  async getProfile() {
    return this.request<any>("/api/v1/users/profile");
  }

  async updateProfile(payload: any) {
    return this.request<any>("/api/v1/users/profile", {
      method: "PUT",
      body: JSON.stringify(payload),
    });
  }
}

// ==========================================
// 11. Auth Endpoints
// ==========================================
export class AuthEndpoints extends BaseApiClient {
  async checkDevice(payload: { email: string; deviceId?: string; deviceFingerprint?: string; deviceName?: string; browserInfo?: string }) {
    return this.request<any>("/api/v1/auth/device-check", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  async registerRequest(payload: any) {
    return this.request<any>("/api/v1/auth/register-request", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  async getRegisterRequestStatus(params: { id?: string; code?: string }) {
    const query = new URLSearchParams();
    if (params.id) query.set("id", params.id);
    if (params.code) query.set("code", params.code);
    return this.request<any>(`/api/v1/auth/register-request?${query.toString()}`);
  }

  async updateRegisterRequest(payload: any) {
    return this.request<any>("/api/v1/auth/register-request", {
      method: "PUT",
      body: JSON.stringify(payload),
    });
  }
}

// ==========================================
// 12. Guest & QR Endpoints
// ==========================================
export class GuestEndpoints extends BaseApiClient {
  async getPublicQr(publicCode: string) {
    return this.request<any>(`/api/v1/guest/qr/${encodeURIComponent(publicCode)}`, {
      cache: "no-store",
    });
  }

  async getSession(token: string) {
    return this.request<any>("/api/v1/guest/session", {
      headers: {
        "x-guest-session-token": token,
      },
    });
  }

  async verify(payload: any) {
    return this.request<any>("/api/v1/guest/verify", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  async createOrder(payload: any, token?: string) {
    return this.request<any>("/api/v1/guest/orders", {
      method: "POST",
      headers: token ? { "x-guest-session-token": token } : undefined,
      body: JSON.stringify(payload),
    });
  }

  async createServiceRequest(payload: any, token?: string, idempotencyKey?: string) {
    const headers: Record<string, string> = {};
    if (token) headers["x-guest-session-token"] = token;
    if (idempotencyKey) headers["Idempotency-Key"] = idempotencyKey;
    return this.request<any>("/api/v1/guest/service-requests", {
      method: "POST",
      headers: Object.keys(headers).length > 0 ? headers : undefined,
      body: JSON.stringify(payload),
    });
  }
}

/**
 * Global API Client Singleton
 */
export class ApiClient {
  public readonly restaurant: RestaurantEndpoints;
  public readonly hotel: HotelEndpoints;
  public readonly inventory: InventoryEndpoints;
  public readonly product: ProductEndpoints;
  public readonly customer: CustomerEndpoints;
  public readonly financials: FinancialEndpoints;
  public readonly superAdmin: SuperAdminEndpoints;
  public readonly reports: ReportEndpoints;
  public readonly settings: SettingsEndpoints;
  public readonly users: UserEndpoints;
  public readonly auth: AuthEndpoints;
  public readonly guest: GuestEndpoints;

  constructor() {
    this.restaurant = new RestaurantEndpoints();
    this.hotel = new HotelEndpoints();
    this.inventory = new InventoryEndpoints();
    this.product = new ProductEndpoints();
    this.customer = new CustomerEndpoints();
    this.financials = new FinancialEndpoints();
    this.superAdmin = new SuperAdminEndpoints();
    this.reports = new ReportEndpoints();
    this.settings = new SettingsEndpoints();
    this.users = new UserEndpoints();
    this.auth = new AuthEndpoints();
    this.guest = new GuestEndpoints();
  }
}

export const apiClient = new ApiClient();
