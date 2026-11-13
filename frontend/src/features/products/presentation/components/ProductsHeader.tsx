"use client";

import React from "react";
import {
  Search,
  Plus,
  Upload,
  UtensilsCrossed,
  Package,
  ShoppingBag,
  SlidersHorizontal,
  LayoutGrid,
  List,
  AlertTriangle,
} from "lucide-react";
import { useProductsUiStore } from "../../state/products-ui.store";
import { useProductsStore } from "../../state/products.store";
import { ProductTypeFilter } from "../../models/product.types";

export const ProductsHeader: React.FC = () => {
  const search = useProductsUiStore((s) => s.search);
  const setSearch = useProductsUiStore((s) => s.setSearch);
  const selectedCategoryId = useProductsUiStore((s) => s.selectedCategoryId);
  const setSelectedCategoryId = useProductsUiStore((s) => s.setSelectedCategoryId);
  const productTypeFilter = useProductsUiStore((s) => s.productTypeFilter);
  const setProductTypeFilter = useProductsUiStore((s) => s.setProductTypeFilter);
  const onlyLowStock = useProductsUiStore((s) => s.onlyLowStock);
  const setOnlyLowStock = useProductsUiStore((s) => s.setOnlyLowStock);
  const viewMode = useProductsUiStore((s) => s.viewMode);
  const setViewMode = useProductsUiStore((s) => s.setViewMode);

  const openCreateModal = useProductsUiStore((s) => s.openCreateModal);
  const setIsImportModalOpen = useProductsUiStore((s) => s.setIsImportModalOpen);

  const categories = useProductsStore((s) => s.categories);
  const products = useProductsStore((s) => s.products);

  // Compute counts for filter pills
  const counts = React.useMemo(() => {
    let restaurant = 0;
    let ingredients = 0;
    let retail = 0;
    let lowStock = 0;

    for (const p of products) {
      const isDish = Boolean(p.menuItems && p.menuItems.length > 0);
      const isIng = Boolean(p.recipeIngredients && p.recipeIngredients.length > 0);
      if (isDish) restaurant++;
      if (isIng) ingredients++;
      if (!isDish && !isIng) retail++;

      const totalStock = (p.productStocks || []).reduce((acc, s) => acc + s.quantity, 0);
      if (p.alertQuantity && totalStock <= p.alertQuantity) lowStock++;
    }

    return { all: products.length, restaurant, ingredients, retail, lowStock };
  }, [products]);

  const filterTabs: Array<{ id: ProductTypeFilter; label: string; count: number; icon: React.ElementType }> = [
    { id: "RESTAURANT", label: "Menu Dishes", count: counts.restaurant, icon: UtensilsCrossed },
    { id: "INGREDIENTS", label: "Kitchen Raw Stock", count: counts.ingredients, icon: Package },
    { id: "RETAIL", label: "Retail Items", count: counts.retail, icon: ShoppingBag },
    { id: "ALL", label: "All Catalog", count: counts.all, icon: SlidersHorizontal },
  ];

  return (
    <div className="space-y-4">
      {/* Top Banner Row: Title + Primary Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-[#292320] tracking-tight">
            Products &amp; Master Catalog
          </h1>
          <p className="text-xs text-[#71675E] mt-0.5">
            Manage restaurant dishes, kitchen inventory raw stock, and retail merchandise
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => setIsImportModalOpen(true)}
            className="h-9 px-3 rounded-lg border border-[#D8CEC1] bg-[#FFFCF7] hover:bg-[#EEE7DD] text-xs font-semibold text-[#292320] flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
            title="Import products from CSV spreadsheet"
          >
            <Upload className="h-3.5 w-3.5 text-[#71675E]" />
            <span>Import CSV</span>
          </button>

          <button
            type="button"
            onClick={() => openCreateModal("MENU_DISH")}
            className="h-9 px-3.5 rounded-lg bg-[#6B2837] hover:bg-[#541E2A] text-white text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>+ Menu Dish</span>
          </button>

          <button
            type="button"
            onClick={() => openCreateModal("KITCHEN_STOCK")}
            className="h-9 px-3 rounded-lg border border-[#D8CEC1] bg-[#FFFCF7] hover:bg-[#EEE7DD] text-xs font-bold text-[#292320] flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
          >
            <Plus className="h-3.5 w-3.5 text-[#6B2837]" />
            <span>+ Raw Stock</span>
          </button>

          <button
            type="button"
            onClick={() => openCreateModal("RETAIL")}
            className="h-9 px-3 rounded-lg border border-[#D8CEC1] bg-[#FFFCF7] hover:bg-[#EEE7DD] text-xs font-bold text-[#292320] flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
          >
            <Plus className="h-3.5 w-3.5 text-[#6B2837]" />
            <span>+ Retail Item</span>
          </button>
        </div>
      </div>

      {/* Filter Tabs & Search Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 p-2 rounded-xl border border-[#D8CEC1] bg-[#FFFCF7] shadow-2xs">
        {/* Type Tabs */}
        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
          {filterTabs.map((tab) => {
            const Icon = tab.icon;
            const active = productTypeFilter === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setProductTypeFilter(tab.id)}
                className={`h-8 px-3 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 cursor-pointer ${
                  active
                    ? "bg-[#6B2837] text-white shadow-2xs"
                    : "text-[#71675E] hover:text-[#292320] hover:bg-[#F7F3EC]"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                <span>{tab.label}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full tabular-nums ${
                    active ? "bg-white/20 text-white" : "bg-[#EEE7DD] text-[#71675E]"
                  }`}
                >
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Search, Category Selector & View Toggle */}
        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
          {/* Search Input */}
          <div className="relative flex-1 sm:w-60">
            <Search className="h-3.5 w-3.5 text-[#71675E] absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by name, barcode, SKU..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full h-8 pl-8 pr-3 text-xs rounded-lg border border-[#D8CEC1] bg-[#F7F3EC] text-[#292320] focus:border-[#6B2837] focus:outline-none placeholder:text-[#71675E]"
            />
          </div>

          {/* Category Dropdown */}
          <select
            value={selectedCategoryId}
            onChange={(e) => setSelectedCategoryId(e.target.value)}
            className="h-8 px-2.5 rounded-lg border border-[#D8CEC1] bg-[#F7F3EC] text-xs font-semibold text-[#292320] focus:border-[#6B2837] focus:outline-none cursor-pointer"
          >
            <option value="ALL">All Categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>

          {/* Low Stock Toggle Button */}
          <button
            type="button"
            onClick={() => setOnlyLowStock(!onlyLowStock)}
            className={`h-8 px-2.5 rounded-lg border text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shrink-0 ${
              onlyLowStock
                ? "border-amber-400 bg-amber-50 text-amber-900"
                : "border-[#D8CEC1] bg-[#F7F3EC] text-[#71675E] hover:text-[#292320]"
            }`}
            title="Filter low stock items needing reorder"
          >
            <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
            <span className="hidden sm:inline">Low Stock</span>
            {counts.lowStock > 0 && (
              <span className="text-[10px] bg-amber-200/70 text-amber-900 px-1.5 py-0.2 rounded font-bold tabular-nums">
                {counts.lowStock}
              </span>
            )}
          </button>

          {/* Table / Grid Switcher */}
          <div className="h-8 p-0.5 rounded-lg border border-[#D8CEC1] bg-[#F7F3EC] flex items-center shrink-0">
            <button
              type="button"
              onClick={() => setViewMode("table")}
              className={`h-full px-2 rounded-md transition-all cursor-pointer ${
                viewMode === "table"
                  ? "bg-[#FFFCF7] text-[#6B2837] shadow-2xs"
                  : "text-[#71675E] hover:text-[#292320]"
              }`}
              title="Table view"
            >
              <List className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setViewMode("grid")}
              className={`h-full px-2 rounded-md transition-all cursor-pointer ${
                viewMode === "grid"
                  ? "bg-[#FFFCF7] text-[#6B2837] shadow-2xs"
                  : "text-[#71675E] hover:text-[#292320]"
              }`}
              title="Grid cards view"
            >
              <LayoutGrid className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

