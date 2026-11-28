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
import { toast } from "@/components/toast";

interface PosTicketsState {
  activeAllOrders: any[];
  activeOrderId: string;
  orderNumber: string;
  existingRounds: ExistingRound[];
  existingOrderSubtotal: string;
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
  submitAdjustLine: (
    action: "CANCEL" | "ADJUST_QTY" | "UPDATE_NOTES",
    reason?: string,
    quantity?: number,
    notes?: string
  ) => Promise<boolean>;
  convertActiveOrderType: (targetType: "TAKEAWAY" | "DELIVERY", deliveryInfo?: any) => Promise<boolean>;
  selectOccupiedSpace: (table: SpaceTable, orderData?: any) => void;
  selectTakeawayOrDelivery: (order: any) => void;
}

function buildOrderSnapshot(order: any): {
  activeOrderId: string;
  orderNumber: string;
  existingRounds: ExistingRound[];
  existingOrderSubtotal: string;
  existingOrderTotal: string;
} {
  if (!order) {
    return {
      activeOrderId: "",
      orderNumber: "",
      existingRounds: [],
      existingOrderSubtotal: "0.00",
      existingOrderTotal: "0.00",
    };
  }

  let preTaxSum = 0;
  let hasLinePrices = false;
  const rounds: ExistingRound[] = (order.rounds || []).map((r: any) => ({
    id: r.id,
    roundNumber: r.roundNumber,
    notes: r.notes || "",
    lines: (r.lines || []).map((l: any) => {
      const isCancelled =
        l.acceptanceStatus === "REJECTED" || l.fulfillmentStatus === "CANCELLED";
      if (!isCancelled && l.unitPrice != null) {
        hasLinePrices = true;
        preTaxSum += (Number(l.unitPrice) || 0) * (Number(l.quantity) || 0);
      }
      return {
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
      };
    }),
  }));

  const resolvedSubtotal = hasLinePrices
    ? preTaxSum.toFixed(2)
    : order.subtotal?.toString() || "0.00";

  return {
    activeOrderId: order.id,
    orderNumber: order.orderNumber || "",
    existingRounds: rounds,
    existingOrderSubtotal: resolvedSubtotal,
    existingOrderTotal: order.totalAmount?.toString() || "0.00",
  };
}

const inFlightTableOrders = new Map<string, Promise<any>>();

export const usePosTicketsStore = create<PosTicketsState>((set, get) => ({
  activeAllOrders: [],
  activeOrderId: "",
  orderNumber: "",
  existingRounds: [],
  existingOrderSubtotal: "0.00",
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
    const existingReq = inFlightTableOrders.get(tableId);
    if (existingReq) return existingReq;

    const req = restaurantPosRepository
      .fetchTableOrders(tableId)
      .then((data) => {
        const order = data?.activeOrder || null;
        set(buildOrderSnapshot(order));
        return order;
      })
      .catch(() => null)
      .finally(() => {
        inFlightTableOrders.delete(tableId);
      });

    inFlightTableOrders.set(tableId, req);
    return req;
  },

  setActiveOrder: (order) => {
    set(buildOrderSnapshot(order));
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
      // 1. Void/cancel order (also releases table & closes session if idle); only close session directly if no order exists
      if (target.orderId) {
        await restaurantPosRepository.cancelOrder(target.orderId, reason);
      } else if (target.sessionId) {
        await restaurantPosRepository.closeTableSession(target.sessionId, reason);
      }

      // 2. Update table in catalog store to AVAILABLE immediately
      if (target.tableId) {
        usePosCatalogStore.getState().updateTableStatusLocally(target.tableId, "AVAILABLE", null);
      }

      // 3. If current active table or order was cancelled, clear selection cleanly
      const ui = usePosUiStore.getState();
      const isCancelledCurrentTable = Boolean(target.tableId && ui.selectedTableId === target.tableId);
      const isCancelledCurrentOrder = Boolean(target.orderId && get().activeOrderId === target.orderId);
      if (isCancelledCurrentTable || isCancelledCurrentOrder) {
        ui.setSelectedTable("");
        get().setActiveOrder(null);
        const { usePosCartStore } = await import("./pos-cart.store");
        usePosCartStore.getState().clearDraft();
        if (isCancelledCurrentTable) {
          ui.syncUrlView("SELECT_SPACE");
        }
      }

      set({ cancellingTable: null, isCancellingTable: false, inspectingTable: null, inspectingOrderData: null });
      usePosCatalogStore.getState().refreshTables();
      get().fetchActiveOrders();
      toast.success(target.tableNumber ? `Table ${target.tableNumber} order cancelled.` : "Order cancelled.");
      return true;
    } catch (err: any) {
      set({ isCancellingTable: false });
      toast.error(err?.message || "Failed to cancel order");
      return false;
    }
  },

  setAdjustingLine: (adjustingLine) => set({ adjustingLine }),

  submitAdjustLine: async (action, reason, quantity, notes) => {
    const target = get().adjustingLine;
    if (!target) return false;

    set({ isUpdatingLine: true });
    try {
      const res = await restaurantPosRepository.updateOrderLine(
        target.orderId,
        target.lineId,
        action,
        reason,
        quantity,
        notes
      );
      const selTableId = usePosUiStore.getState().selectedTableId;
      if (selTableId) await get().fetchTableOrders(selTableId);
      const inspTable = get().inspectingTable;
      if (inspTable) await get().openTableInspection(inspTable);
      await get().fetchActiveOrders();

      if (!selTableId && target.orderId) {
        const updatedOrder = get().activeAllOrders.find(
          (o) =>
            o.id === target.orderId &&
            o.settlementStatus !== "PAID" &&
            o.fulfillmentStatus !== "CANCELLED"
        );
        get().setActiveOrder(updatedOrder || null);
      }

      set({ adjustingLine: null, isUpdatingLine: false });
      toast.success(
        action === "CANCEL"
          ? res?.wasPreparing
            ? `${target.itemName} cancelled. Kitchen alerted immediately to stop preparation.`
            : `${target.itemName} cancelled and kitchen notified.`
          : action === "ADJUST_QTY"
          ? `${target.itemName} quantity updated and kitchen notified.`
          : `${target.itemName} serving note updated.`
      );
      return true;
    } catch (err: any) {
      set({ isUpdatingLine: false });
      toast.error(err?.message || "Failed to update dish");
      return false;
    }
  },

  convertActiveOrderType: async (targetType, deliveryInfo) => {
    const ui = usePosUiStore.getState();
    const activeOrderId = get().activeOrderId;
    const oldTableId = ui.selectedTableId;
    const fromKey =
      ui.orderType === "DINE_IN" && oldTableId
        ? `table_${oldTableId}`
        : activeOrderId
        ? `order_${activeOrderId}`
        : `type_${ui.orderType}`;

    try {
      const { usePosCartStore } = await import("./pos-cart.store");

      if (activeOrderId) {
        const res = await restaurantPosRepository.convertOrderType(activeOrderId, {
          orderType: targetType,
          deliveryInfo,
        });
        usePosCartStore
          .getState()
          .migrateDraftToTarget(fromKey, `order_${res.order.id}`, "TAKEAWAY_PARCEL");

        if (oldTableId) {
          usePosCatalogStore.getState().updateTableStatusLocally(oldTableId, "AVAILABLE", null);
        }
        ui.setSelectedTable("");
        ui.setOrderType(targetType);
        ui.syncUrlView("MENU_POS");
        get().setActiveOrder(res.order);
        usePosCatalogStore.getState().refreshTables();
        get().fetchActiveOrders();
      } else {
        usePosCartStore
          .getState()
          .migrateDraftToTarget(fromKey, `type_${targetType}`, "TAKEAWAY_PARCEL");
        ui.setSelectedTable("");
        ui.setOrderType(targetType);
        ui.syncUrlView("MENU_POS");
      }

      toast.success(
        targetType === "DELIVERY"
          ? "Order converted to Delivery."
          : "Order converted to Takeaway Parcel."
      );
      return true;
    } catch (err: any) {
      toast.error(err?.message || "Failed to convert order");
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
    const custMatch =
      notes.match(/\[TAKEAWAY(?:\s+to)?\s+([^(\]|•]+?)(?:\s*\(([^)]*)\))?/i) ||
      notes.match(/Customer:\s*([^|•\]]+)/i) ||
      notes.match(/Takeaway(?:\s+for)?:\s*([^|•\]]+)/i);

    const rawCust = custMatch ? custMatch[1].trim() : "";
    const custName = rawCust && rawCust.toLowerCase() !== "customer" ? rawCust : "";
    const phone = custMatch?.[2]?.trim() || "";
    const isCurrent = dineInView === "MENU_POS" && currentOrderId === o.id;
    let count = 0;
    if (Array.isArray(o.rounds)) {
      o.rounds.forEach((r: any) => {
        if (Array.isArray(r.lines)) {
          count += r.lines.filter(
            (l: any) => l.acceptanceStatus !== "REJECTED" && l.fulfillmentStatus !== "CANCELLED"
          ).length;
        }
      });
    }

    list.push({
      id: `takeaway_${o.id}`,
      ticketType: "TAKEAWAY",
      title: custName ? `Takeaway: ${custName}` : `Takeaway #${o.orderNumber || o.id.slice(0, 6)}`,
      subTitle: phone || o.orderNumber,
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
    const delivMatch = notes.match(
      /\[DELIVERY(?:\s+to)?\s+([^(\]|•\-]+?)(?:\s*\(([^)]*)\))?(?:\s*-\s*([^|\]•]+?))?(?:\s*via\s*([^|\]]+?))?(?:\s*\|.*)?\]/i
    );
    const legacyCustMatch = notes.match(/Customer:\s*([^|•\]]+)/i);
    const legacyAddrMatch = notes.match(/Address:\s*([^|•\]]+)/i);

    const rawCust = delivMatch ? delivMatch[1].trim() : legacyCustMatch ? legacyCustMatch[1].trim() : "";
    const custName = rawCust && rawCust.toLowerCase() !== "customer" ? rawCust : "";
    const phone = delivMatch?.[2]?.trim() || "";
    const address = delivMatch?.[3]?.trim() || (legacyAddrMatch ? legacyAddrMatch[1].trim() : "");
    const rider = delivMatch?.[4]?.trim() || "";

    const isCurrent = dineInView === "MENU_POS" && currentOrderId === o.id;
    let count = 0;
    if (Array.isArray(o.rounds)) {
      o.rounds.forEach((r: any) => {
        if (Array.isArray(r.lines)) {
          count += r.lines.filter(
            (l: any) => l.acceptanceStatus !== "REJECTED" && l.fulfillmentStatus !== "CANCELLED"
          ).length;
        }
      });
    }

    const subParts = [address, phone, rider].filter(Boolean);
    const subTitle = subParts.length > 0 ? subParts.join(" • ") : o.orderNumber;

    list.push({
      id: `delivery_${o.id}`,
      ticketType: "DELIVERY",
      title: custName ? `Delivery: ${custName}` : `Delivery #${o.orderNumber || o.id.slice(0, 6)}`,
      subTitle,
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

