/**
 * Restaurant POS Repository
 * Clean Architecture Repository Layer
 * Interacts with global ApiClient and formats domain models.
 */

import { apiClient } from "@/core/api/api-client";
import {
  Floor,
  SpaceTable,
  MenuItemWithModifiers,
  OrderType,
  DeliveryDetails,
} from "../models/pos.types";

export class RestaurantPosRepository {
  async fetchInitialData(): Promise<{
    floors: Floor[];
    tables: SpaceTable[];
    catalog: MenuItemWithModifiers[];
    rawCategories: any[];
  }> {
    const [floorRes, tableRes, catRes] = await Promise.all([
      apiClient.restaurant.getFloors(),
      apiClient.restaurant.getTables(),
      apiClient.restaurant.getMenuCatalog(),
    ]);

    const floors: Floor[] = (floorRes.floors || []).map((f: any) => ({
      id: f.id,
      name: f.name,
      level: f.level || 0,
    }));

    const tables: SpaceTable[] = (tableRes.tables || []).map((t: any) => ({
      id: t.id,
      tableNumber: t.tableNumber,
      capacity: t.capacity,
      status: t.status,
      floorId: t.floorId,
      floor: t.floor,
      currentSessionId: t.currentSessionId,
      tableSessions: t.tableSessions,
      metadata: t.metadata,
    }));

    // Process catalog items from restaurant menus (catRes.catalog) and fallback categories
    const rawItems: any[] = [];
    const uiCategoriesMap = new Map<string, { id: string; name: string; subcategories: any[] }>();

    // 1. Primary: Extract restaurant menus -> sections -> items from catRes.catalog
    const menus = Array.isArray(catRes.catalog) ? catRes.catalog : [];
    menus.forEach((menu: any) => {
      (menu.sections || []).forEach((sec: any) => {
        if (!uiCategoriesMap.has(sec.name)) {
          uiCategoriesMap.set(sec.name, {
            id: sec.id,
            name: sec.name,
            subcategories: [],
          });
        }
        (sec.items || []).forEach((item: any) => {
          rawItems.push({
            id: item.id,
            name: item.name,
            code: item.code || "",
            description: item.description || "",
            basePrice: item.basePrice,
            imageUrl: item.imageUrl || null,
            categoryName: sec.name,
            subcategoryId: sec.id,
            hasModifiers: Boolean(item.modifierGroups && item.modifierGroups.length > 0),
            modifierGroups: (item.modifierGroups || []).map((mgRel: any) => {
              const mg = mgRel.modifierGroup || mgRel;
              return {
                id: mg.id,
                name: mg.name,
                minSelections: mg.minSelections || 0,
                maxSelections: mg.maxSelections || 1,
                isRequired: mg.isRequired || false,
                options: (mg.options || []).map((opt: any) => ({
                  id: opt.id,
                  name: opt.name,
                  priceDelta: Number(opt.priceDelta || 0),
                  isDefault: opt.isDefault || false,
                })),
              };
            }),
            stationId: item.stationId,
          });
        });
      });
    });

    // 2. Secondary: If catalog has raw categories with items
    if (Array.isArray(catRes.categories)) {
      catRes.categories.forEach((cat: any) => {
        if (!uiCategoriesMap.has(cat.name)) {
          uiCategoriesMap.set(cat.name, {
            id: cat.id,
            name: cat.name,
            subcategories: cat.subcategories || [],
          });
        }
        (cat.menuItems || []).forEach((item: any) => {
          rawItems.push({
            id: item.id,
            name: item.name,
            code: item.code || "",
            description: item.description || "",
            basePrice: item.basePrice,
            imageUrl: item.imageUrl || null,
            categoryName: cat.name,
            subcategoryId: cat.id,
            hasModifiers: Boolean(item.modifierGroups && item.modifierGroups.length > 0),
            modifierGroups: (item.modifierGroups || []).map((mg: any) => ({
              id: mg.id,
              name: mg.name,
              minSelections: mg.minSelections || 0,
              maxSelections: mg.maxSelections || 1,
              isRequired: mg.isRequired || false,
              options: (mg.options || []).map((opt: any) => ({
                id: opt.id,
                name: opt.name,
                priceDelta: Number(opt.priceDelta || 0),
                isDefault: opt.isDefault || false,
              })),
            })),
            stationId: item.stationId,
          });
        });
      });
    }

    const catalog: MenuItemWithModifiers[] = rawItems;
    const rawCategories = Array.from(uiCategoriesMap.values());

    return { floors, tables, catalog, rawCategories };
  }

  async fetchActiveOrders(): Promise<any[]> {
    const res = await apiClient.restaurant.getOrders();
    return Array.isArray(res.orders) ? res.orders : [];
  }

  async fetchTableOrders(tableId: string): Promise<any> {
    return apiClient.restaurant.getTableOrders(tableId);
  }

  async seatGuests(tableId: string, guestCount: number, notes?: string): Promise<any> {
    return apiClient.restaurant.seatGuests(tableId, { guestCount, notes });
  }

  async transferTable(sourceTableId: string, targetTableId: string, reason?: string): Promise<any> {
    return apiClient.restaurant.moveTable({ sourceTableId, targetTableId, reason });
  }

  async mergeTables(sourceTableIds: string[], targetTableId: string, reason?: string): Promise<any> {
    return apiClient.restaurant.mergeTables({ sourceTableIds, targetTableId, reason });
  }

  async submitNewOrder(payload: {
    orderType: OrderType;
    tableId?: string;
    tableSessionId?: string;
    roomServiceInfo?: any;
    deliveryInfo?: any;
    items: any[];
    notes?: string;
  }): Promise<any> {
    return apiClient.restaurant.createOrder(payload);
  }

  async submitAdditionalRound(orderId: string, payload: { items: any[]; notes?: string }): Promise<any> {
    return apiClient.restaurant.addOrderRound(orderId, payload);
  }

  async cancelOrder(orderId: string, reason?: string): Promise<any> {
    return apiClient.restaurant.cancelOrder(orderId, reason || "Order cancelled");
  }

  async closeTableSession(sessionId: string): Promise<any> {
    return apiClient.restaurant.closeSession(sessionId);
  }

  async updateOrderLine(
    orderId: string,
    lineId: string,
    action: "CANCEL" | "ADJUST_QTY",
    reason?: string,
    quantity?: number
  ): Promise<any> {
    return apiClient.restaurant.updateOrderLineStatus(orderId, lineId, { action, reason, quantity });
  }

  async settleOrder(orderId: string, payload: any): Promise<any> {
    return apiClient.restaurant.settleOrder(orderId, payload);
  }

  async fetchHotelStays(): Promise<any[]> {
    const res = await apiClient.hotel.getActiveStays();
    return Array.isArray(res.stays) ? res.stays : [];
  }

  async searchCustomers(query?: string): Promise<any[]> {
    const res = await apiClient.customer.searchCustomers(query);
    return Array.isArray(res.customers) ? res.customers : [];
  }

  async createCustomer(payload: { name: string; phone?: string; email?: string; address?: string }): Promise<any> {
    return apiClient.customer.createCustomer(payload);
  }

  // Floors CRUD
  async createFloor(payload: { name: string; displayOrder?: number }): Promise<any> {
    return apiClient.restaurant.createFloor(payload);
  }

  async updateFloor(id: string, payload: { name?: string; displayOrder?: number }): Promise<any> {
    return apiClient.restaurant.updateFloor(id, payload);
  }

  async deleteFloor(id: string): Promise<any> {
    return apiClient.restaurant.deleteFloor(id);
  }

  // Tables CRUD
  async createTable(payload: any): Promise<any> {
    return apiClient.restaurant.createTable(payload);
  }

  async updateTable(id: string, payload: any): Promise<any> {
    return apiClient.restaurant.updateTable(id, payload);
  }

  async deleteTable(id: string): Promise<any> {
    return apiClient.restaurant.deleteTable(id);
  }

  // Menu Items & Sections CRUD
  async fetchMenuItems(): Promise<any[]> {
    const res = await apiClient.restaurant.getMenuItems();
    return Array.isArray(res.items) ? res.items : [];
  }

  async createMenuItem(payload: any): Promise<any> {
    return apiClient.restaurant.createMenuItem(payload);
  }

  async updateMenuItem(id: string, payload: any): Promise<any> {
    return apiClient.restaurant.updateMenuItem(id, payload);
  }

  async deleteMenuItem(id: string): Promise<any> {
    return apiClient.restaurant.deleteMenuItem(id);
  }

  async fetchMenuSections(): Promise<any[]> {
    const res = await apiClient.restaurant.getMenuSections();
    return Array.isArray(res.sections) ? res.sections : [];
  }

  async createMenuSection(payload: { name: string; displayOrder?: number }): Promise<any> {
    return apiClient.restaurant.createMenuSection(payload);
  }

  async updateMenuSection(id: string, payload: { name?: string; displayOrder?: number }): Promise<any> {
    return apiClient.restaurant.updateMenuSection(id, payload);
  }

  async deleteMenuSection(id: string): Promise<any> {
    return apiClient.restaurant.deleteMenuSection(id);
  }

  async fetchModifierGroups(): Promise<any[]> {
    const res = await apiClient.restaurant.getModifierGroups();
    return Array.isArray(res.modifierGroups) ? res.modifierGroups : [];
  }

  async createModifierGroup(payload: any): Promise<any> {
    return apiClient.restaurant.createModifierGroup(payload);
  }

  async updateModifierGroup(id: string, payload: any): Promise<any> {
    return apiClient.restaurant.updateModifierGroup(id, payload);
  }

  async deleteModifierGroup(id: string): Promise<any> {
    return apiClient.restaurant.deleteModifierGroup(id);
  }

  // Kitchen Display & Tickets
  async fetchKitchenData(stationId?: string): Promise<{ tickets: any[]; served: any[]; stations: any[]; floors: any[] }> {
    const [tktRes, stnRes, flrRes] = await Promise.all([
      apiClient.restaurant.getKitchenTickets(stationId),
      apiClient.restaurant.getKitchenStations().catch(() => ({ stations: [] })),
      apiClient.restaurant.getFloors().catch(() => ({ floors: [] })),
    ]);
    return {
      tickets: tktRes.tickets || [],
      served: tktRes.served || [],
      stations: stnRes.stations || [],
      floors: flrRes.floors || [],
    };
  }

  async updateKitchenTicketStatus(ticketId: string, status: string): Promise<any> {
    return apiClient.restaurant.updateKitchenTicketStatus(ticketId, status);
  }

  async updateKitchenTicketLineStatus(ticketId: string, lineId: string, status: string, reason?: string): Promise<any> {
    return apiClient.restaurant.updateKitchenTicketLineStatus(ticketId, lineId, { status, reason });
  }

  async fetchRestaurantReports(params?: { startDate?: string; endDate?: string }): Promise<any> {
    const [reports, reconciliation] = await Promise.all([
      apiClient.restaurant.getRestaurantReports(params).catch(() => ({})),
      apiClient.restaurant.getVoidReconciliationReport(params).catch(() => ({})),
    ]);
    return { ...reports, reconciliation };
  }
}

export const restaurantPosRepository = new RestaurantPosRepository();

