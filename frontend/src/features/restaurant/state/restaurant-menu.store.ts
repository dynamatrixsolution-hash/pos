/**
 * Restaurant Menu State Store
 * Clean MVVM ViewModel for Menu Items, Categories, Addons, and Recipes
 */

import { create } from "zustand";
import {
  MenuItemDetail,
  MenuSection,
  ModifierGroup,
} from "../models/pos.types";
import { restaurantPosRepository } from "../repositories/restaurant-pos.repository";
import { apiClient } from "@/core/api/api-client";

type MenuTab = "ITEMS" | "CATEGORIES" | "ADDONS" | "RECIPES";

interface RestaurantMenuState {
  activeTab: MenuTab;
  items: MenuItemDetail[];
  sections: MenuSection[];
  modifierGroups: ModifierGroup[];
  rawStockProducts: any[];

  isLoading: boolean;
  isSaving: boolean;
  error: string | null;

  // Modals & Selected items
  editingItem: MenuItemDetail | null;
  editingSection: MenuSection | null;
  editingModifierGroup: ModifierGroup | null;
  activeRecipeItem: MenuItemDetail | null;

  isItemModalOpen: boolean;
  isSectionModalOpen: boolean;
  isModifierModalOpen: boolean;
  isRecipeModalOpen: boolean;

  // Actions
  setActiveTab: (tab: MenuTab) => void;
  loadMenuData: () => Promise<void>;

  openCreateItemModal: () => void;
  openEditItemModal: (item: MenuItemDetail) => void;
  closeItemModal: () => void;
  saveItem: (payload: any) => Promise<boolean>;
  deleteItem: (id: string) => Promise<boolean>;
  toggleAvailability: (id: string, isAvailable: boolean) => Promise<boolean>;

  openCreateSectionModal: () => void;
  openEditSectionModal: (section: MenuSection) => void;
  closeSectionModal: () => void;
  saveSection: (payload: { name: string; displayOrder?: number }) => Promise<boolean>;
  deleteSection: (id: string) => Promise<boolean>;

  openCreateModifierModal: () => void;
  openEditModifierModal: (group: ModifierGroup) => void;
  closeModifierModal: () => void;
  saveModifierGroup: (payload: any) => Promise<boolean>;
  deleteModifierGroup: (id: string) => Promise<boolean>;

  openRecipeModal: (item: MenuItemDetail) => void;
  closeRecipeModal: () => void;
  saveRecipeVersion: (itemId: string, payload: any) => Promise<boolean>;
}

export const useRestaurantMenuStore = create<RestaurantMenuState>((set, get) => ({
  activeTab: "ITEMS",
  items: [],
  sections: [],
  modifierGroups: [],
  rawStockProducts: [],

  isLoading: false,
  isSaving: false,
  error: null,

  editingItem: null,
  editingSection: null,
  editingModifierGroup: null,
  activeRecipeItem: null,

  isItemModalOpen: false,
  isSectionModalOpen: false,
  isModifierModalOpen: false,
  isRecipeModalOpen: false,

  setActiveTab: (activeTab) => set({ activeTab }),

  loadMenuData: async () => {
    set({ isLoading: true, error: null });
    try {
      const [items, sections, modifierGroups, productsRes] = await Promise.all([
        restaurantPosRepository.fetchMenuItems(),
        restaurantPosRepository.fetchMenuSections(),
        restaurantPosRepository.fetchModifierGroups(),
        apiClient.product.getProducts(),
      ]);

      const rawStock = Array.isArray(productsRes)
        ? productsRes
        : productsRes?.products || [];

      set({
        items,
        sections,
        modifierGroups,
        rawStockProducts: rawStock,
        isLoading: false,
      });
    } catch (err: any) {
      set({ error: err.message || "Failed to load restaurant menu data", isLoading: false });
    }
  },

  openCreateItemModal: () => set({ editingItem: null, isItemModalOpen: true }),
  openEditItemModal: (item) => set({ editingItem: item, isItemModalOpen: true }),
  closeItemModal: () => set({ editingItem: null, isItemModalOpen: false }),

  saveItem: async (payload) => {
    const { editingItem } = get();
    set({ isSaving: true, error: null });
    try {
      if (editingItem) {
        await restaurantPosRepository.updateMenuItem(editingItem.id, payload);
      } else {
        await restaurantPosRepository.createMenuItem(payload);
      }
      await get().loadMenuData();
      set({ isSaving: false, isItemModalOpen: false, editingItem: null });
      return true;
    } catch (err: any) {
      set({ isSaving: false, error: err.message || "Failed to save menu item" });
      return false;
    }
  },

  deleteItem: async (id) => {
    set({ error: null });
    try {
      await restaurantPosRepository.deleteMenuItem(id);
      set((state) => ({ items: state.items.filter((i) => i.id !== id) }));
      return true;
    } catch (err: any) {
      set({ error: err.message || "Failed to delete item" });
      return false;
    }
  },

  toggleAvailability: async (id, isAvailable) => {
    try {
      await restaurantPosRepository.updateMenuItem(id, { isAvailable });
      set((state) => ({
        items: state.items.map((i) => (i.id === id ? { ...i, isAvailable } : i)),
      }));
      return true;
    } catch {
      return false;
    }
  },

  openCreateSectionModal: () => set({ editingSection: null, isSectionModalOpen: true }),
  openEditSectionModal: (section) => set({ editingSection: section, isSectionModalOpen: true }),
  closeSectionModal: () => set({ editingSection: null, isSectionModalOpen: false }),

  saveSection: async (payload) => {
    const { editingSection } = get();
    set({ isSaving: true, error: null });
    try {
      if (editingSection) {
        await restaurantPosRepository.updateMenuSection(editingSection.id, payload);
      } else {
        await restaurantPosRepository.createMenuSection(payload);
      }
      await get().loadMenuData();
      set({ isSaving: false, isSectionModalOpen: false, editingSection: null });
      return true;
    } catch (err: any) {
      set({ isSaving: false, error: err.message || "Failed to save category section" });
      return false;
    }
  },

  deleteSection: async (id) => {
    set({ error: null });
    try {
      await restaurantPosRepository.deleteMenuSection(id);
      set((state) => ({ sections: state.sections.filter((s) => s.id !== id) }));
      return true;
    } catch (err: any) {
      set({ error: err.message || "Failed to delete category section" });
      return false;
    }
  },

  openCreateModifierModal: () => set({ editingModifierGroup: null, isModifierModalOpen: true }),
  openEditModifierModal: (group) => set({ editingModifierGroup: group, isModifierModalOpen: true }),
  closeModifierModal: () => set({ editingModifierGroup: null, isModifierModalOpen: false }),

  saveModifierGroup: async (payload) => {
    const { editingModifierGroup } = get();
    set({ isSaving: true, error: null });
    try {
      if (editingModifierGroup) {
        await restaurantPosRepository.updateModifierGroup(editingModifierGroup.id, payload);
      } else {
        await restaurantPosRepository.createModifierGroup(payload);
      }
      await get().loadMenuData();
      set({ isSaving: false, isModifierModalOpen: false, editingModifierGroup: null });
      return true;
    } catch (err: any) {
      set({ isSaving: false, error: err.message || "Failed to save modifier group" });
      return false;
    }
  },

  deleteModifierGroup: async (id) => {
    set({ error: null });
    try {
      await restaurantPosRepository.deleteModifierGroup(id);
      set((state) => ({ modifierGroups: state.modifierGroups.filter((g) => g.id !== id) }));
      return true;
    } catch (err: any) {
      set({ error: err.message || "Failed to delete modifier group" });
      return false;
    }
  },

  openRecipeModal: (item) => set({ activeRecipeItem: item, isRecipeModalOpen: true }),
  closeRecipeModal: () => set({ activeRecipeItem: null, isRecipeModalOpen: false }),

  saveRecipeVersion: async (itemId, payload) => {
    set({ isSaving: true, error: null });
    try {
      await apiClient.product.saveRecipe({ productId: itemId, ingredients: payload.ingredients || [] });
      await get().loadMenuData();
      set({ isSaving: false, isRecipeModalOpen: false });
      return true;
    } catch (err: any) {
      set({ isSaving: false, error: err.message || "Failed to save recipe version" });
      return false;
    }
  },
}));
