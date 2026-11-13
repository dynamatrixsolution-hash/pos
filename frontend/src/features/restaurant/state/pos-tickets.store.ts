/**
 * POS Tickets & Multi-Order State Store
 * Manages all active tickets across tables, takeaways, deliveries, and ticket switching.
 * Clean MVVM ViewModel for Order management.
 */

import { create } from "zustand";
import {
  ActiveTicket,
  SpaceTable,
  ExistingRound,
  TableCancellationTarget,
  LineAdjustmentTarget,
} from "../models/pos.types";
import { restaurantPosRepository } from "../repositories/restaurant-pos.repository";
import { usePosUiStore } from "./pos-ui.store";
import { usePosCatalogStore } from "./pos-catalog.store";

interface PosTicketsState {
  activeAllOrders: any[];
  activeOrderId: string;
  orderNumber: string;
  existingRounds: ExistingRound[];
  existingOrderTotal: string;

  // Table Inspection Modal
  inspectingTable: SpaceTable | null;
  inspectingOrderData: any | null;
  isInspectingLoading: boolean;

  // Cancellation Modal
  cancellingTable: TableCancellationTarget | null;
  isCancellingTable: boolean;

  // Line Adjustment Modal
  adjustingLine: LineAdjustmentTarget | null;
  isUpdatingLine: boolean;

  // Actions
  fetchActiveOrders: () => Promise<void>;
  fetchTableOrders: (tableId: string) => Promise<any>;
  setActiveOrder: (order: any | null) => void;
  openTableInspection: (table: SpaceTable) => Promise<void>;
  closeTableInspection: () => void;
  setCancellingTable: (target: TableCancellationTarget | null) => void;
  submitCancelTable: (reason: string) => Promise<boolean>;
  setAdjustingLine: (target: LineAdjustmentTarget | null) => void;
  submitAdjustLine: (action: "CANCEL" | "ADJUST_QTY", reason?: string, quantity?: number) => Promise<boolean>;
  selectOccupiedSpace: (table: SpaceTable, orderData?: any) => void;
  selectTakeawayOrDelivery: (order: any) => void;
}

export const usePosTicketsStore = create<PosTicketsState>((set, get) => ({
  activeAllOrders: [],
  activeOrderId: "",
  orderNumber: "",
  existingRounds: [],
  existingOrderTotal: "0.00",

  inspectingTable: null,
  inspectingOrderData: null,
  isInspectingLoading: false,

  cancellingTable: null,
  isCancellingTable: false,

  adjustingLine: null,
  isUpdatingLine: false,

  fetchActiveOrders: async () => {
    try {
      const orders = await restaurantPosRepository.fetchActiveOrders();
      set({ activeAllOrders: orders });
    } catch {
      // transient network poll dropouts handled silently
    }
  },

  fetchTableOrders: async (tableId: string) => {
    if (!tableId) return null;
    try {
      const data = await restaurantPosRepository.fetchTableOrders(tableId);
      if (data?.activeOrder) {
        const order = data.activeOrder;
        const rounds: ExistingRound[] = (order.rounds || []).map((r: any) => ({
          id: r.id,
          roundNumber: r.roundNumber,
          notes: r.notes || "",
          lines: (r.lines || []).map((l: any) => ({
            id: l.id,
            itemName: l.itemName,
            quantity: l.quantity,
            unitPrice: l.unitPrice?.toString() || "0.00",
            total: l.total?.toString() || "0.00",
            acceptanceStatus: l.acceptanceStatus,
            fulfillmentStatus: l.fulfillmentStatus,
            rejectionReason: l.rejectionReason,
            notes: l.notes,
            appliedModifiers: l.appliedModifiers || [],
          })),
        }));

        set({
          activeOrderId: order.id,
          existingOrderTotal: order.totalAmount?.toString() || "0.00",
          orderNumber: order.orderNumber || "",
          existingRounds: rounds,
        });
        return order;
      } else {
        set({
          activeOrderId: "",
          existingOrderTotal: "0.00",
          orderNumber: "",
          existingRounds: [],
        });
        return null;
      }
    } catch {
      return null;
    }
  },

  setActiveOrder: (order) => {
    if (!order) {
      set({
        activeOrderId: "",
        existingOrderTotal: "0.00",
        orderNumber: "",
        existingRounds: [],
      });
      return;
    }

    const rounds: ExistingRound[] = (order.rounds || []).map((r: any) => ({
      id: r.id,
      roundNumber: r.roundNumber,
      notes: r.notes || "",
      lines: (r.lines || []).map((l: any) => ({
        id: l.id,
        itemName: l.itemName,
        quantity: l.quantity,
        unitPrice: l.unitPrice?.toString() || "0.00",
        total: l.total?.toString() || "0.00",
        acceptanceStatus: l.acceptanceStatus,
        fulfillmentStatus: l.fulfillmentStatus,
        rejectionReason: l.rejectionReason,
        notes: l.notes,
        appliedModifiers: l.appliedModifiers || [],
      })),
    }));

    set({
      activeOrderId: order.id,
      existingOrderTotal: order.totalAmount?.toString() || "0.00",
      orderNumber: order.orderNumber || "",
      existingRounds: rounds,
    });
  },

  openTableInspection: async (table: SpaceTable) => {
    set({ inspectingTable: table, isInspectingLoading: true });
    try {
      const data = await restaurantPosRepository.fetchTableOrders(table.id);
      set({ inspectingOrderData: data, isInspectingLoading: false });
    } catch {
      set({ inspectingOrderData: null, isInspectingLoading: false });
    }
  },

  closeTableInspection: () => {
    set({ inspectingTable: null, inspectingOrderData: null });
  },

  setCancellingTable: (cancellingTable) => set({ cancellingTable }),

  submitCancelTable: async (reason: string) => {
    const target = get().cancellingTable;
    if (!target) return false;

    set({ isCancellingTable: true });
    try {
      // 1. If an order exists, void/cancel it
      if (target.orderId) {
        await restaurantPosRepository.cancelOrder(target.orderId, reason);
      }

      // 2. Close session to free the table
      if (target.sessionId) {
        await restaurantPosRepository.closeTableSession(target.sessionId);
      }

      // 3. Update table in catalog store to AVAILABLE immediately
      usePosCatalogStore.getState().updateTableStatusLocally(target.tableId, "AVAILABLE", null);

      // 4. If current active table was cancelled, clear active selection
      if (usePosUiStore.getState().selectedTableId === target.tableId) {
        usePosUiStore.getState().setSelectedTable("");
        get().setActiveOrder(null);
      }

      set({ cancellingTable: null, isCancellingTable: false, inspectingTable: null, inspectingOrderData: null });
      usePosCatalogStore.getState().loadInitialCatalog();
      get().fetchActiveOrders();
      return true;
    } catch {
      set({ isCancellingTable: false });
      return false;
    }
  },

  setAdjustingLine: (adjustingLine) => set({ adjustingLine }),

  submitAdjustLine: async (action, reason, quantity) => {
    const target = get().adjustingLine;
    if (!target) return false;

    set({ isUpdatingLine: true });
    try {
      await restaurantPosRepository.updateOrderLine(target.orderId, target.lineId, action, reason, quantity);
      const selTableId = usePosUiStore.getState().selectedTableId;
      if (selTableId) await get().fetchTableOrders(selTableId);
      const inspTable = get().inspectingTable;
      if (inspTable) await get().openTableInspection(inspTable);
      get().fetchActiveOrders();
      set({ adjustingLine: null, isUpdatingLine: false });
      return true;
    } catch {
      set({ isUpdatingLine: false });
      return false;
    }
  },

  selectOccupiedSpace: (table, orderData) => {
    // 1. Resolve active order either from argument, activeAllOrders, or table sessions
    const isOrderForCurrentSession = (o: any) =>
      o.tableId === table.id &&
      o.settlementStatus !== "PAID" &&
      o.fulfillmentStatus !== "CANCELLED" &&
      (!table.currentSessionId || o.tableSessionId === table.currentSessionId) &&
      (!o.tableSession || o.tableSession.status === "ACTIVE" || o.tableSession.status === "BILLED");

    let order = orderData?.activeOrder;
    if (!order) {
      order = get().activeAllOrders.find(isOrderForCurrentSession);
    }
    if (!order && table.tableSessions?.[0]?.restaurantOrders?.[0]) {
      const candidate = table.tableSessions[0].restaurantOrders[0];
      if (!table.currentSessionId || candidate.tableSessionId === table.currentSessionId) {
        order = candidate;
      }
    }

    // 2. Set UI table selection and view
    usePosUiStore.getState().setSelectedTable(table.id, table.currentSessionId || order?.tableSessionId || "");
    usePosUiStore.getState().setOrderType("DINE_IN");
    usePosUiStore.getState().syncUrlView("MENU_POS", table.id);
    usePosUiStore.getState().setIsTicketDrawerOpen(true);

    // 3. Set active order lines synchronously
    get().setActiveOrder(order || null);

    // 4. Restore any unsent draft items for this table
    import("./pos-cart.store").then(({ usePosCartStore }) => {
      usePosCartStore.getState().syncDraftForTarget(`table_${table.id}`);
    });

    // 5. Background fetch fresh data
    get().fetchTableOrders(table.id);
  },

  selectTakeawayOrDelivery: (order) => {
    usePosUiStore.getState().setSelectedTable("");
    usePosUiStore.getState().setOrderType(order.orderType);
    usePosUiStore.getState().syncUrlView("MENU_POS");
    usePosUiStore.getState().setIsTicketDrawerOpen(true);
    get().setActiveOrder(order);
    import("./pos-cart.store").then(({ usePosCartStore }) => {
      usePosCartStore.getState().syncDraftForTarget(`order_${order.id}`);
    });
  },
}));

/**
 * Selector for Unified All Active Tickets across tables, takeaways, deliveries
 */
export function selectAllActiveTickets(
  tables: SpaceTable[],
  activeAllOrders: any[],
  currentTableId: string,
  currentOrderId: string,
  dineInView: "SELECT_SPACE" | "MENU_POS"
): ActiveTicket[] {
  const list: ActiveTicket[] = [];

  // 1. Occupied or Billed tables
  const occupied = tables.filter((t) => t.status === "OCCUPIED" || t.status === "BILLED");
  occupied.forEach((t) => {
    const activeOrder = activeAllOrders.find(
      (o) =>
        o.tableId === t.id &&
        o.settlementStatus !== "PAID" &&
        o.fulfillmentStatus !== "CANCELLED" &&
        (!t.currentSessionId || o.tableSessionId === t.currentSessionId) &&
        (!o.tableSession || o.tableSession.status === "ACTIVE" || o.tableSession.status === "BILLED")
    ) || t.tableSessions?.[0]?.restaurantOrders?.[0] || null;

    const isCurrent = dineInView === "MENU_POS" && t.id === currentTableId;
    const total = activeOrder?.totalAmount != null ? Number(activeOrder.totalAmount) : 0;
    let count = 0;
    if (Array.isArray(activeOrder?.rounds)) {
      activeOrder.rounds.forEach((r: any) => {
        if (Array.isArray(r.lines)) {
          count += r.lines.filter(
            (l: any) => l.acceptanceStatus !== "REJECTED" && l.fulfillmentStatus !== "CANCELLED"
          ).length;
        }
      });
    }
    const roundCount = Array.isArray(activeOrder?.rounds) ? activeOrder.rounds.length : 0;

    list.push({
      id: `table_${t.id}`,
      ticketType: "DINE_IN",
      title: `Table ${t.tableNumber}`,
      subTitle: `${t.floor?.name || "Floor"} • ${t.capacity} covers`,
      table: t,
      order: activeOrder,
      orderNumber: activeOrder?.orderNumber || "",
      itemCount: count,
      totalAmount: total,
      roundCount,
      status: t.status === "BILLED" ? "Billed" : "Occupied",
      isCurrent,
    });
  });

  // 2. Active Takeaways
  const takeaways = activeAllOrders.filter(
    (o) => o.orderType === "TAKEAWAY" && o.settlementStatus !== "PAID" && o.fulfillmentStatus !== "CANCELLED"
  );
  takeaways.forEach((o) => {
    const notes = o.notes || "";
    const custMatch = notes.match(/Customer:\s*([^|•\]]+)/i);
    const isCurrent = dineInView === "MENU_POS" && currentOrderId === o.id;
    let count = 0;
    if (Array.isArray(o.rounds)) {
      o.rounds.forEach((r: any) => {
        if (Array.isArray(r.lines)) count += r.lines.length;
      });
    }

    list.push({
      id: `takeaway_${o.id}`,
      ticketType: "TAKEAWAY",
      title: custMatch ? `Takeaway: ${custMatch[1].trim()}` : "Takeaway Order",
      subTitle: o.orderNumber,
      order: o,
      orderNumber: o.orderNumber,
      itemCount: count,
      totalAmount: Number(o.totalAmount || 0),
      roundCount: o.rounds?.length || 1,
      status: "Active",
      isCurrent,
    });
  });

  // 3. Active Deliveries
  const deliveries = activeAllOrders.filter(
    (o) => o.orderType === "DELIVERY" && o.settlementStatus !== "PAID" && o.fulfillmentStatus !== "CANCELLED"
  );
  deliveries.forEach((o) => {
    const notes = o.notes || "";
    const custMatch = notes.match(/Customer:\s*([^|•\]]+)/i);
    const addrMatch = notes.match(/Address:\s*([^|•\]]+)/i);
    const isCurrent = dineInView === "MENU_POS" && currentOrderId === o.id;
    let count = 0;
    if (Array.isArray(o.rounds)) {
      o.rounds.forEach((r: any) => {
        if (Array.isArray(r.lines)) count += r.lines.length;
      });
    }

    list.push({
      id: `delivery_${o.id}`,
      ticketType: "DELIVERY",
      title: custMatch ? `Delivery: ${custMatch[1].trim()}` : "Delivery Order",
      subTitle: addrMatch ? addrMatch[1].trim() : o.orderNumber,
      order: o,
      orderNumber: o.orderNumber,
      itemCount: count,
      totalAmount: Number(o.totalAmount || 0),
      roundCount: o.rounds?.length || 1,
      status: "Active",
      isCurrent,
    });
  });

  return list;
}

