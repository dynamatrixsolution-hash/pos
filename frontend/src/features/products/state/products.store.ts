/**
 * Products & Master Catalog State Store
 * Clean MVVM ViewModel for Products feature
 */

import { create } from "zustand";
import {
  ProductItem,
  CategoryItem,
  SubcategoryItem,
  BranchItem,
  UnitItem,
  BomIngredient,
  ProductFormData,
  StockAdjustmentPayload,
} from "../models/product.types";
import { productRepository } from "../repositories/product.repository";
import { useProductsUiStore } from "./products-ui.store";

interface ProductsState {
  products: ProductItem[];
  categories: CategoryItem[];
  subcategories: SubcategoryItem[];
  branches: BranchItem[];
  units: UnitItem[];
  bomIngredients: BomIngredient[];

  isLoading: boolean;
  isSaving: boolean;
  isAdjusting: boolean;
  isLoadingBom: boolean;
  isSavingBom: boolean;
  isImporting: boolean;
  error: string | null;

  // Actions
  loadInitialData: () => Promise<void>;
  loadProducts: () => Promise<void>;
  createProduct: (payload: ProductFormData) => Promise<boolean>;
  updateProduct: (id: string, payload: Partial<ProductFormData>) => Promise<boolean>;
  deleteProduct: (id: string) => Promise<boolean>;
  adjustStock: (payload: StockAdjustmentPayload) => Promise<boolean>;
  loadBom: (productId: string) => Promise<void>;
  saveBom: (productId: string, ingredients: BomIngredient[]) => Promise<boolean>;
  importProducts: (products: any[]) => Promise<{ success: boolean; count: number; error?: string }>;
}

export const useProductsStore = create<ProductsState>((set, get) => ({
  products: [],
  categories: [],
  subcategories: [],
  branches: [],
  units: [],
  bomIngredients: [],

  isLoading: false,
  isSaving: false,
  isAdjusting: false,
  isLoadingBom: false,
  isSavingBom: false,
  isImporting: false,
  error: null,

  loadInitialData: async () => {
    set({ isLoading: true, error: null });
    try {
      const [products, categories, subcategories, branches, units] = await Promise.all([
        productRepository.getProducts(),
        productRepository.getCategories(),
        productRepository.getSubcategories(),
        productRepository.getBranches(),
        productRepository.getUnits(),
      ]);

      set({
        products,
        categories,
        subcategories,
        branches,
        units,
        isLoading: false,
      });
    } catch (err: any) {
      set({ error: err.message || "Failed to load catalog data", isLoading: false });
    }
  },

  loadProducts: async () => {
    const ui = useProductsUiStore.getState();
    set({ isLoading: true, error: null });
    try {
      const products = await productRepository.getProducts({
        search: ui.search || undefined,
        categoryId: ui.selectedCategoryId !== "ALL" ? ui.selectedCategoryId : undefined,
        subcategoryId: ui.selectedSubcategoryId !== "ALL" ? ui.selectedSubcategoryId : undefined,
      });
      set({ products, isLoading: false });
    } catch (err: any) {
      set({ error: err.message || "Failed to fetch products", isLoading: false });
    }
  },

  createProduct: async (payload) => {
    set({ isSaving: true, error: null });
    try {
      await productRepository.createProduct(payload);
      await get().loadProducts();
      set({ isSaving: false });
      useProductsUiStore.getState().closeProductModal();
      return true;
    } catch (err: any) {
      set({ isSaving: false, error: err.message || "Failed to create product" });
      return false;
    }
  },

  updateProduct: async (id, payload) => {
    set({ isSaving: true, error: null });
    try {
      await productRepository.updateProduct(id, payload);
      await get().loadProducts();
      set({ isSaving: false });
      useProductsUiStore.getState().closeProductModal();
      return true;
    } catch (err: any) {
      set({ isSaving: false, error: err.message || "Failed to update product" });
      return false;
    }
  },

  deleteProduct: async (id) => {
    set({ error: null });
    try {
      const ok = await productRepository.deleteProduct(id);
      if (ok) {
        set((state) => ({
          products: state.products.filter((p) => p.id !== id),
        }));
      }
      return ok;
    } catch (err: any) {
      set({ error: err.message || "Failed to delete product" });
      return false;
    }
  },

  adjustStock: async (payload) => {
    set({ isAdjusting: true, error: null });
    try {
      const ok = await productRepository.adjustStock(payload);
      if (ok) {
        await get().loadProducts();
        useProductsUiStore.getState().closeAdjustModal();
      }
      set({ isAdjusting: false });
      return ok;
    } catch (err: any) {
      set({ isAdjusting: false, error: err.message || "Failed to adjust stock" });
      return false;
    }
  },

  loadBom: async (productId) => {
    set({ isLoadingBom: true, bomIngredients: [] });
    try {
      const ingredients = await productRepository.getRecipeBom(productId);
      set({ bomIngredients: ingredients, isLoadingBom: false });
    } catch {
      set({ bomIngredients: [], isLoadingBom: false });
    }
  },

  saveBom: async (productId, ingredients) => {
    set({ isSavingBom: true, error: null });
    try {
      const ok = await productRepository.saveRecipeBom(productId, ingredients);
      if (ok) {
        set({ bomIngredients: ingredients });
        await get().loadProducts();
        useProductsUiStore.getState().closeBomModal();
      }
      set({ isSavingBom: false });
      return ok;
    } catch (err: any) {
      set({ isSavingBom: false, error: err.message || "Failed to save recipe BOM" });
      return false;
    }
  },

  importProducts: async (products) => {
    set({ isImporting: true, error: null });
    try {
      const res = await productRepository.importProducts(products);
      await get().loadProducts();
      set({ isImporting: false });
      useProductsUiStore.getState().setIsImportModalOpen(false);
      return { success: true, count: res.importedCount };
    } catch (err: any) {
      set({ isImporting: false, error: err.message || "Import failed" });
      return { success: false, count: 0, error: err.message || "Import failed" };
    }
  },
}));

