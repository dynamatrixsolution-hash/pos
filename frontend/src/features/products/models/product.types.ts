/**
 * Product & Master Catalog Domain Models
 * Clean Architecture Model Layer for Products Feature
 */

export type FormMode = "MENU_DISH" | "KITCHEN_STOCK" | "RETAIL";
export type ProductTypeFilter = "ALL" | "RETAIL" | "RESTAURANT" | "INGREDIENTS";
export type StockAdjustmentType = "INCREASE" | "DECREASE" | "CORRECTION" | "DAMAGE" | "RESTOCK";

export const KITCHEN_UNITS = [
  { value: "kg", label: "Kilogram (kg)" },
  { value: "g", label: "Gram (g)" },
  { value: "L", label: "Liter (L)" },
  { value: "ml", label: "Milliliter (ml)" },
  { value: "pcs", label: "Pieces (pcs)" },
  { value: "packet", label: "Packet (pkt)" },
  { value: "can", label: "Can / Tin" },
  { value: "box", label: "Box / Carton" },
  { value: "portion", label: "Portion / Plate" },
] as const;

export const KITCHEN_STATIONS = [
  "Main Kitchen",
  "Tandoor & Grill",
  "Coffee & Bakery",
  "Bar & Beverages",
  "Salad & Cold Station",
  "Dessert Counter",
] as const;

export interface ProductStockItem {
  quantity: number;
  branchId?: string;
  branch?: {
    id: string;
    name: string;
  };
}

export interface MenuItemLink {
  id: string;
  name: string;
  prepTimeMinutes?: number | null;
  kitchenStation?: string | null;
  category?: {
    id: string;
    name: string;
  } | null;
}

export interface RecipeIngredientLink {
  id: string;
  recipeDishId: string;
  quantity: number;
  unit: string;
  wastagePercent: number;
}

export interface ProductItem {
  id: string;
  name: string;
  sku: string;
  barcode: string;
  costPrice: number;
  sellingPrice: number;
  wholesalePrice: number;
  alertQuantity: number;
  isVatItem: boolean;
  categoryId: string | null;
  category?: { id: string; name: string } | null;
  subcategoryId?: string | null;
  subcategory?: { id: string; name: string } | null;
  description?: string | null;
  image?: string | null;
  unitId?: string | null;
  unit?: { id: string; name: string } | null;
  productStocks?: ProductStockItem[];
  menuItems?: MenuItemLink[];
  recipeIngredients?: RecipeIngredientLink[];
}

export interface CategoryItem {
  id: string;
  name: string;
}

export interface SubcategoryItem {
  id: string;
  name: string;
  categoryId: string;
}

export interface BranchItem {
  id: string;
  name: string;
  isMain?: boolean;
}

export interface UnitItem {
  id: string;
  name: string;
}

export interface BomIngredient {
  productId: string;
  productName: string;
  quantity: number;
  unit: string;
  costPrice: number;
  wastagePercent: number;
}

export interface ProductFormData {
  name: string;
  sku?: string;
  barcode?: string;
  costPrice: number;
  sellingPrice: number;
  wholesalePrice?: number;
  alertQuantity?: number;
  categoryId?: string;
  subcategoryId?: string;
  initialStock?: number;
  isVatItem: boolean;
  image?: string;
  isRestaurantDish: boolean;
  unitName?: string;
  description?: string;
  prepTimeMinutes?: number | null;
  kitchenStation?: string | null;
}

export interface StockAdjustmentPayload {
  productId: string;
  branchId: string;
  type: StockAdjustmentType;
  quantity: number;
  reason?: string;
}

export interface ParsedCsvProduct {
  name: string;
  sku?: string;
  barcode?: string;
  costPrice: number;
  sellingPrice: number;
  wholesalePrice?: number;
  alertQuantity?: number;
  categoryName?: string;
  unitName?: string;
  initialStock?: number;
  isVatItem: boolean;
  description?: string;
}

