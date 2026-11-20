/**
 * POS Cart & Draft Round Store
 * Manages item additions, modifiers, quantities, and sending orders to kitchen.
 * Clean MVVM ViewModel for Draft Items.
 */

import { create } from "zustand";
import {
  DraftLine,
  MenuItemWithModifiers,
  SelectedModifier,
} from "../models/pos.types";
import { restaurantPosRepository } from "../repositories/restaurant-pos.repository";
import { usePosUiStore } from "./pos-ui.store";
import { usePosTicketsStore } from "./pos-tickets.store";
import { usePosCatalogStore } from "./pos-catalog.store";
import { toast } from "@/components/toast";
import { createIdempotencyKey } from "@/core/api/api-client";

const draftSubmissionKeys = new Map<string, string>();

interface PosCartState {
  draftLines: DraftLine[];
  orderNotes: string;
  packagingCharge: number;
  deliveryCharge: number;
  isSubmitting: boolean;

  // Multi-table draft storage so no table draft ever vanishes on navigation/switching
  draftsByTarget: Record<string, { lines: DraftLine[]; notes: string }>;

  // Selected modifier in-flight
  activeCustomizingItem: MenuItemWithModifiers | null;

  // Actions
  syncDraftForTarget: (targetKey?: string) => void;
  addToDraft: (
    item: MenuItemWithModifiers,
    quantity?: number,
    modifiers?: SelectedModifier[],
    notes?: string,
    servingType?: "DINE_IN_PLATE" | "TAKEAWAY_PARCEL"
  ) => void;
  updateDraftQty: (index: number, delta: number) => void;
  removeDraftLine: (index: number) => void;
  toggleDraftServingType: (index: number) => void;
  migrateDraftToTarget: (
    fromKey: string,
    toKey: string,
    forceServingType?: "DINE_IN_PLATE" | "TAKEAWAY_PARCEL"
  ) => void;
  clearDraft: () => void;
  setOrderNotes: (notes: string) => void;
  setPackagingCharge: (fee: number) => void;
  setDeliveryCharge: (fee: number) => void;
  setActiveCustomizingItem: (item: MenuItemWithModifiers | null) => void;
  submitKitchenRound: () => Promise<boolean>;
}

function resolveTargetKey(overrideKey?: string): string {
  if (overrideKey) return overrideKey;
  const ui = usePosUiStore.getState();
  const tickets = usePosTicketsStore.getState();
  if (ui.orderType === "DINE_IN" && ui.selectedTableId) {
    return `table_${ui.selectedTableId}`;
  }
  if (tickets.activeOrderId) {
    return `order_${tickets.activeOrderId}`;
  }
  return `type_${ui.orderType}`;
}

export const usePosCartStore = create<PosCartState>((set, get) => ({
  draftLines: [],
  orderNotes: "",
  packagingCharge: 0,
  deliveryCharge: 0,
  isSubmitting: false,
  draftsByTarget: {},
  activeCustomizingItem: null,

  syncDraftForTarget: (targetKey) => {
    const key = resolveTargetKey(targetKey);
    const existing = get().draftsByTarget[key];
    set({
      draftLines: existing?.lines ? [...existing.lines] : [],
      orderNotes: existing?.notes || "",
    });
  },

  addToDraft: (item, quantity = 1, modifiers = [], notes = "", servingType) => {
    const ui = usePosUiStore.getState();
    const isTakeaway = ui.orderType === "TAKEAWAY" || ui.orderType === "DELIVERY";
    const defaultServing = servingType || (isTakeaway ? "TAKEAWAY_PARCEL" : "DINE_IN_PLATE");

    const base = Number(item.basePrice) || 0;
    const modTotal = modifiers.reduce((acc, m) => acc + (Number(m.priceDelta) || 0), 0);
    const unitPrice = base + modTotal;
    const totalPrice = unitPrice * quantity;
    const targetKey = resolveTargetKey();
    draftSubmissionKeys.delete(targetKey);

    set((state) => {
      const modKey = (mods: SelectedModifier[]) =>
        mods
          .map((m) => m.optionId)
          .sort()
          .join("-");

      const currentLines = state.draftLines;
      const existingIndex = currentLines.findIndex(
        (l) =>
          l.item.id === item.id &&
          l.servingType === defaultServing &&
          modKey(l.selectedModifiers) === modKey(modifiers) &&
          l.notes === notes
      );

      let updatedLines: DraftLine[];
      if (existingIndex >= 0) {
        updatedLines = [...currentLines];
        const existing = updatedLines[existingIndex];
        const newQty = existing.quantity + quantity;
        updatedLines[existingIndex] = {
          ...existing,
          quantity: newQty,
          totalPrice: unitPrice * newQty,
        };
      } else {
        updatedLines = [
          ...currentLines,
          {
            item,
            quantity,
            selectedModifiers: modifiers,
            notes,
            totalPrice,
            servingType: defaultServing,
          },
        ];
      }

      return {
        draftLines: updatedLines,
        draftsByTarget: {
          ...state.draftsByTarget,
          [targetKey]: {
            lines: updatedLines,
            notes: state.orderNotes,
          },
        },
      };
    });

    ui.setIsTicketDrawerOpen(true);
  },

  updateDraftQty: (index, delta) => {
    const targetKey = resolveTargetKey();
    draftSubmissionKeys.delete(targetKey);
    set((state) => {
      const lines = [...state.draftLines];
      const target = lines[index];
      if (!target) return state;

      const newQty = target.quantity + delta;
      if (newQty <= 0) {
        lines.splice(index, 1);
      } else {
        const base = Number(target.item.basePrice) || 0;
        const modTotal = target.selectedModifiers.reduce((acc, m) => acc + (Number(m.priceDelta) || 0), 0);
        const unit = base + modTotal;
        lines[index] = {
          ...target,
          quantity: newQty,
          totalPrice: unit * newQty,
        };
      }

      return {
        draftLines: lines,
        draftsByTarget: {
          ...state.draftsByTarget,
          [targetKey]: {
            lines,
            notes: state.orderNotes,
          },
        },
      };
    });
  },

  removeDraftLine: (index) => {
    const targetKey = resolveTargetKey();
    draftSubmissionKeys.delete(targetKey);
    set((state) => {
      const updatedLines = state.draftLines.filter((_, i) => i !== index);
      return {
        draftLines: updatedLines,
        draftsByTarget: {
          ...state.draftsByTarget,
          [targetKey]: {
            lines: updatedLines,
            notes: state.orderNotes,
          },
        },
      };
    });
  },

  toggleDraftServingType: (index) => {
    const targetKey = resolveTargetKey();
    draftSubmissionKeys.delete(targetKey);
    set((state) => {
      const lines = [...state.draftLines];
      const target = lines[index];
      if (!target) return state;

      const newServing =
        target.servingType === "TAKEAWAY_PARCEL" ? "DINE_IN_PLATE" : "TAKEAWAY_PARCEL";
      lines[index] = {
        ...target,
        servingType: newServing,
      };

      return {
        draftLines: lines,
        draftsByTarget: {
          ...state.draftsByTarget,
          [targetKey]: {
            lines,
            notes: state.orderNotes,
          },
        },
      };
    });
  },

  migrateDraftToTarget: (fromKey, toKey, forceServingType) => {
    draftSubmissionKeys.delete(fromKey);
    draftSubmissionKeys.delete(toKey);
    set((state) => {
      const source = state.draftsByTarget[fromKey] || {
        lines: state.draftLines,
        notes: state.orderNotes,
      };
      const migratedLines = forceServingType
        ? source.lines.map((l) => ({ ...l, servingType: forceServingType }))
        : [...source.lines];
      const nextDrafts = { ...state.draftsByTarget };
      if (fromKey !== toKey) {
        delete nextDrafts[fromKey];
      }
      if (migratedLines.length > 0 || source.notes) {
        nextDrafts[toKey] = {
          lines: migratedLines,
          notes: source.notes,
        };
      }
      return {
        draftLines: migratedLines,
        orderNotes: source.notes,
        draftsByTarget: nextDrafts,
      };
    });
  },

  clearDraft: () => {
    const targetKey = resolveTargetKey();
    draftSubmissionKeys.delete(targetKey);
    set((state) => {
      const updatedDrafts = { ...state.draftsByTarget };
      delete updatedDrafts[targetKey];
      return {
        draftLines: [],
        orderNotes: "",
        draftsByTarget: updatedDrafts,
      };
    });
  },

  setOrderNotes: (orderNotes) => {
    const targetKey = resolveTargetKey();
    draftSubmissionKeys.delete(targetKey);
    set((state) => ({
      orderNotes,
      draftsByTarget: {
        ...state.draftsByTarget,
        [targetKey]: {
          lines: state.draftLines,
          notes: orderNotes,
        },
      },
    }));
  },

  setPackagingCharge: (packagingCharge) => set({ packagingCharge }),
  setDeliveryCharge: (deliveryCharge) => set({ deliveryCharge }),
  setActiveCustomizingItem: (activeCustomizingItem) => set({ activeCustomizingItem }),

  submitKitchenRound: async () => {
    const { draftLines, orderNotes, isSubmitting } = get();
    if (isSubmitting || draftLines.length === 0) return false;

    const ui = usePosUiStore.getState();
    const tickets = usePosTicketsStore.getState();
    const targetKey = resolveTargetKey();
    const idempotencyKey =
      draftSubmissionKeys.get(targetKey) || createIdempotencyKey("pos_ord");
    draftSubmissionKeys.set(targetKey, idempotencyKey);

    set({ isSubmitting: true });
    try {
      // 1. Format item lines
      const itemsPayload = draftLines.map((line) => {
        let lineNotes = line.notes || "";
        if (line.servingType === "TAKEAWAY_PARCEL" || ui.orderType === "TAKEAWAY" || ui.orderType === "DELIVERY") {
          const tag = ui.orderType === "DELIVERY" ? "[DELIVERY]" : "[TAKEAWAY]";
          if (
            !lineNotes.toUpperCase().includes("PARCEL") &&
            !lineNotes.toUpperCase().includes("TAKEAWAY") &&
            !lineNotes.toUpperCase().includes("DELIVERY")
          ) {
            lineNotes = `${tag} ${lineNotes}`.trim();
          }
        } else {
          if (!lineNotes.toUpperCase().includes("DINE-IN") && !lineNotes.toUpperCase().includes("PLATE")) {
            lineNotes = `[DINE-IN] ${lineNotes}`.trim();
          }
        }

        return {
          menuItemId: line.item.id,
          itemName: line.item.name,
          basePrice: line.item.basePrice,
          quantity: line.quantity,
          selectedModifiers: line.selectedModifiers.map((m) => ({
            modifierGroupId: m.modifierGroupId,
            groupName: m.groupName,
            optionId: m.optionId,
            optionName: m.optionName,
            priceDelta: m.priceDelta,
          })),
          notes: lineNotes,
        };
      });

      // 2. Either append round to existing order, or create new order
      let createdOrder: any = null;
      if (tickets.activeOrderId) {
        const res = await restaurantPosRepository.submitAdditionalRound(
          tickets.activeOrderId,
          {
            items: itemsPayload,
            notes: orderNotes,
          },
          idempotencyKey
        );
        if (res?.order) {
          createdOrder = res.order;
        }
      } else {
        const res = await restaurantPosRepository.submitNewOrder(
          {
            orderType: ui.orderType,
            tableId: ui.orderType === "DINE_IN" ? ui.selectedTableId || undefined : undefined,
            tableSessionId: ui.orderType === "DINE_IN" ? ui.selectedSessionId || undefined : undefined,
            items: itemsPayload,
            notes: orderNotes,
          },
          idempotencyKey
        );
        if (res?.order) {
          createdOrder = res.order;
        }
      }

      // 3. Clear draft and reload fresh orders
      draftSubmissionKeys.delete(targetKey);
      set((state) => {
        const updatedDrafts = { ...state.draftsByTarget };
        delete updatedDrafts[targetKey];
        return { draftLines: [], orderNotes: "", draftsByTarget: updatedDrafts, isSubmitting: false };
      });
      if (ui.selectedTableId) {
        await tickets.fetchTableOrders(ui.selectedTableId);
      } else if (createdOrder) {
        tickets.setActiveOrder(createdOrder);
      }
      tickets.fetchActiveOrders();
      usePosCatalogStore.getState().loadInitialCatalog();
      toast.success("Order sent to kitchen");
      return true;
    } catch (err: any) {
      if (err?.statusCode >= 400 && err?.statusCode < 500) {
        draftSubmissionKeys.delete(targetKey);
      }
      set({ isSubmitting: false });
      toast.error(err?.message || "Failed to send order to kitchen");
      return false;
    }
  },
}));

