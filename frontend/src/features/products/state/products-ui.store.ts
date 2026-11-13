/**
 * Products UI State Store
 * Controls view modes, search, filter criteria, and dialog visibilities.
 */

import { create } from "zustand";
import {
  FormMode,
  ProductTypeFilter,
  ProductItem,
} from "../models/product.types";

interface ProductsUiState {
  search: string;
  selectedCategoryId: string;
  selectedSubcategoryId: string;
  productTypeFilter: ProductTypeFilter;
  onlyLowStock: boolean;
  viewMode: "table" | "grid";

  // Modals & Drawers
  formMode: FormMode;
  isProductModalOpen: boolean;
  isAdjustModalOpen: boolean;
  isImportModalOpen: boolean;
  isBomModalOpen: boolean;
  isScannerOpen: boolean;

  // Selected Entities
  editingProduct: ProductItem | null;
  adjustProduct: ProductItem | null;
  activeBomProduct: ProductItem | null;

  // Actions
  setSearch: (search: string) => void;
  setSelectedCategoryId: (catId: string) => void;
  setSelectedSubcategoryId: (subId: string) => void;
  setProductTypeFilter: (filter: ProductTypeFilter) => void;
  setOnlyLowStock: (onlyLowStock: boolean) => void;
  setViewMode: (viewMode: "table" | "grid") => void;

  openCreateModal: (mode: FormMode) => void;
  openEditModal: (product: ProductItem) => void;
  closeProductModal: () => void;

  openAdjustModal: (product: ProductItem) => void;
  closeAdjustModal: () => void;

  openBomModal: (product: ProductItem) => void;
  closeBomModal: () => void;

  setIsImportModalOpen: (open: boolean) => void;
  setIsScannerOpen: (open: boolean) => void;
  setFormMode: (mode: FormMode) => void;
}

export const useProductsUiStore = create<ProductsUiState>((set) => ({
  search: "",
  selectedCategoryId: "ALL",
  selectedSubcategoryId: "ALL",
  productTypeFilter: "RESTAURANT",
  onlyLowStock: false,
  viewMode: "table",

  formMode: "MENU_DISH",
  isProductModalOpen: false,
  isAdjustModalOpen: false,
  isImportModalOpen: false,
  isBomModalOpen: false,
  isScannerOpen: false,

  editingProduct: null,
  adjustProduct: null,
  activeBomProduct: null,

  setSearch: (search) => set({ search }),
  setSelectedCategoryId: (selectedCategoryId) => set({ selectedCategoryId, selectedSubcategoryId: "ALL" }),
  setSelectedSubcategoryId: (selectedSubcategoryId) => set({ selectedSubcategoryId }),
  setProductTypeFilter: (productTypeFilter) => set({ productTypeFilter }),
  setOnlyLowStock: (onlyLowStock) => set({ onlyLowStock }),
  setViewMode: (viewMode) => set({ viewMode }),

  openCreateModal: (mode) =>
    set({
      formMode: mode,
      editingProduct: null,
      isProductModalOpen: true,
    }),

  openEditModal: (product) => {
    let mode: FormMode = "RETAIL";
    if (product.menuItems && product.menuItems.length > 0) {
      mode = "MENU_DISH";
    } else if (product.recipeIngredients && product.recipeIngredients.length > 0) {
      mode = "KITCHEN_STOCK";
    }
    set({
      formMode: mode,
      editingProduct: product,
      isProductModalOpen: true,
    });
  },

  closeProductModal: () => set({ isProductModalOpen: false, editingProduct: null }),

  openAdjustModal: (product) => set({ adjustProduct: product, isAdjustModalOpen: true }),
  closeAdjustModal: () => set({ adjustProduct: null, isAdjustModalOpen: false }),

  openBomModal: (product) => set({ activeBomProduct: product, isBomModalOpen: true }),
  closeBomModal: () => set({ activeBomProduct: null, isBomModalOpen: false }),

  setIsImportModalOpen: (isImportModalOpen) => set({ isImportModalOpen }),
  setIsScannerOpen: (isScannerOpen) => set({ isScannerOpen }),
  setFormMode: (formMode) => set({ formMode }),
}));

