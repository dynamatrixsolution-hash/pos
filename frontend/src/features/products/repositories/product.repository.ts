/**
 * Product Repository
 * Clean Architecture Repository Layer for Products Feature
 * Encapsulates all data access via the global ApiClient singleton.
 */

import { apiClient } from "@/core/api/api-client";
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

export class ProductRepository {
  /**
   * Fetch all products with optional filters
   */
  async getProducts(params?: {
    search?: string;
    categoryId?: string;
    subcategoryId?: string;
    status?: string;
  }): Promise<ProductItem[]> {
    const res = await apiClient.product.getProducts({
      limit: 200,
      search: params?.search,
      categoryId: params?.categoryId,
      subcategoryId: params?.subcategoryId,
      status: params?.status,
    });

    if (Array.isArray(res)) return res;
    if (res && Array.isArray(res.products)) return res.products;
    return [];
  }

  /**
   * Fetch categories
   */
  async getCategories(): Promise<CategoryItem[]> {
    const res = await apiClient.product.getCategories();
    if (Array.isArray(res)) return res;
    if (res && Array.isArray(res.categories)) return res.categories;
    return [];
  }

  /**
   * Fetch subcategories
   */
  async getSubcategories(): Promise<SubcategoryItem[]> {
    const res = await apiClient.product.getSubcategories();
    if (Array.isArray(res)) return res;
    if (res && Array.isArray(res.subcategories)) return res.subcategories;
    return [];
  }

  /**
   * Fetch branches
   */
  async getBranches(): Promise<BranchItem[]> {
    const res = await apiClient.product.getBranches();
    if (Array.isArray(res)) return res;
    if (res && Array.isArray(res.branches)) return res.branches;
    return [];
  }

  /**
   * Fetch measurement units
   */
  async getUnits(): Promise<UnitItem[]> {
    const res = await apiClient.product.getUnits();
    if (Array.isArray(res)) return res;
    if (res && Array.isArray(res.units)) return res.units;
    return [];
  }

  /**
   * Create a new product / dish / raw stock
   */
  async createProduct(payload: ProductFormData): Promise<ProductItem> {
    const res = await apiClient.product.createProduct(payload);
    return res.product || res;
  }

  /**
   * Update an existing product
   */
  async updateProduct(id: string, payload: Partial<ProductFormData>): Promise<ProductItem> {
    const res = await apiClient.product.updateProduct(id, payload);
    return res.product || res;
  }

  /**
   * Delete a product
   */
  async deleteProduct(id: string): Promise<boolean> {
    const res = await apiClient.product.deleteProduct(id);
    return res?.success !== false;
  }

  /**
   * Adjust stock for a branch
   */
  async adjustStock(payload: StockAdjustmentPayload): Promise<boolean> {
    const res = await apiClient.product.adjustStock(payload);
    return res?.success !== false;
  }

  /**
   * Fetch recipe BOM for a dish
   */
  async getRecipeBom(productId: string): Promise<BomIngredient[]> {
    const res = await apiClient.product.getRecipe(productId);
    const ingredients = res?.ingredients || res?.recipeIngredients || [];
    return ingredients.map((ing: any) => ({
      productId: ing.rawProductId || ing.productId,
      productName: ing.rawProduct?.name || ing.product?.name || ing.productName || "Unknown Item",
      quantity: Number(ing.quantity) || 0,
      unit: ing.unit || "kg",
      costPrice: Number(ing.rawProduct?.costPrice || ing.costPrice) || 0,
      wastagePercent: Number(ing.wastagePercent) || 0,
    }));
  }

  /**
   * Save recipe BOM for a dish
   */
  async saveRecipeBom(productId: string, ingredients: BomIngredient[]): Promise<boolean> {
    const res = await apiClient.product.saveRecipe({
      productId,
      ingredients: ingredients.map((ing) => ({
        rawProductId: ing.productId,
        quantity: ing.quantity,
        unit: ing.unit,
        wastagePercent: ing.wastagePercent,
      })),
    });
    return res?.success !== false;
  }

  /**
   * Batch import products from parsed CSV
   */
  async importProducts(products: any[]): Promise<{ importedCount: number; errors?: any[] }> {
    const res = await apiClient.product.importProducts(products);
    return {
      importedCount: res?.importedCount || res?.count || products.length,
      errors: res?.errors,
    };
  }
}

export const productRepository = new ProductRepository();

