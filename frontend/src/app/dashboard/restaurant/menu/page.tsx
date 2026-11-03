"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import Link from "next/link";
import { formatNPR } from "@/lib/currency";
import { Notify } from "@/lib/notify";
import {
  UtensilsCrossed,
  Plus,
  Search,
  Edit,
  Trash2,
  X,
  Check,
  Layers,
  Sparkles,
  Scale,
  Clock,
  ArrowRight,
  ShoppingCart,
  Image as ImageIcon,
  AlertTriangle,
  Flame,
  CheckCircle2,
  RefreshCw,
} from "lucide-react";

interface MenuSection {
  id: string;
  name: string;
  description?: string | null;
  displayOrder: number;
  items?: any[];
}

interface ModifierOption {
  id?: string;
  name: string;
  priceDelta: number | string;
  isAvailable?: boolean;
}

interface ModifierGroup {
  id: string;
  name: string;
  displayName?: string | null;
  minSelections: number;
  maxSelections: number;
  options: ModifierOption[];
  menuItemModifierGroups?: any[];
}

interface RecipeIngredient {
  id?: string;
  productId: string;
  product?: {
    id: string;
    name: string;
    sku: string;
    costPrice?: number | string;
    productStocks?: { quantity: number }[];
  };
  quantity: number | string;
  unit: string;
  wastagePercent: number | string;
}

interface RecipeVersion {
  id: string;
  versionNumber: number;
  yieldQuantity: number | string;
  yieldUnit: string;
  notes?: string | null;
  isActive: boolean;
  ingredients: RecipeIngredient[];
}

interface MenuItem {
  id: string;
  name: string;
  description?: string | null;
  basePrice: number | string;
  taxRate: number | string;
  imageUrl?: string | null;
  isAvailable: boolean;
  prepTimeMinutes?: number | null;
  sectionId: string;
  section?: { id: string; name: string };
  modifierGroups?: {
    modifierGroup: ModifierGroup;
  }[];
  recipeVersions?: RecipeVersion[];
}

interface InventoryProduct {
  id: string;
  name: string;
  sku: string;
  costPrice: number | string;
  unit?: { name: string } | null;
  productStocks?: { quantity: number }[];
}

type ActiveTab = "ITEMS" | "CATEGORIES" | "ADDONS" | "RECIPES";

export default function RestaurantMenuManagementPage() {
  const [activeTab, setActiveTab] = useState<ActiveTab>("ITEMS");
  const [loading, setLoading] = useState(true);

  // Data states
  const [sections, setSections] = useState<MenuSection[]>([]);
  const [items, setItems] = useState<MenuItem[]>([]);
  const [modifierGroups, setModifierGroups] = useState<ModifierGroup[]>([]);
  const [inventoryProducts, setInventoryProducts] = useState<InventoryProduct[]>([]);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSectionFilter, setSelectedSectionFilter] = useState("ALL");

  // Modals state
  const [itemModalOpen, setItemModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [itemForm, setItemForm] = useState({
    name: "",
    description: "",
    sectionId: "",
    basePrice: "350",
    taxRate: "13",
    imageUrl: "",
    isAvailable: true,
    prepTimeMinutes: "15",
    modifierGroupIds: [] as string[],
  });

  const [sectionModalOpen, setSectionModalOpen] = useState(false);
  const [editingSection, setEditingSection] = useState<MenuSection | null>(null);
  const [sectionForm, setSectionForm] = useState({
    name: "",
    description: "",
    displayOrder: "0",
  });

  const [modifierModalOpen, setModifierModalOpen] = useState(false);
  const [editingModifier, setEditingModifier] = useState<ModifierGroup | null>(null);
  const [modifierForm, setModifierForm] = useState<{
    name: string;
    displayName: string;
    minSelections: string;
    maxSelections: string;
    options: { name: string; priceDelta: string }[];
  }>({
    name: "",
    displayName: "",
    minSelections: "0",
    maxSelections: "1",
    options: [{ name: "Standard", priceDelta: "0" }],
  });

  // Recipe BOM state
  const [selectedRecipeItemId, setSelectedRecipeItemId] = useState<string>("");
  const [recipeIngredients, setRecipeIngredients] = useState<
    { productId: string; quantity: string; unit: string; wastagePercent: string }[]
  >([]);
  const [recipeNotes, setRecipeNotes] = useState("");
  const [savingRecipe, setSavingRecipe] = useState(false);

  // Load all menu catalog data
  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [secRes, itemRes, modRes, prodRes] = await Promise.all([
        fetch("/api/v1/restaurant/sections"),
        fetch("/api/v1/restaurant/items"),
        fetch("/api/v1/restaurant/modifiers"),
        fetch("/api/v1/products?limit=100"),
      ]);

      if (secRes.ok) {
        const secData = await secRes.json();
        setSections(secData.sections || []);
      }
      if (itemRes.ok) {
        const itemData = await itemRes.json();
        setItems(itemData.items || []);
        if (itemData.items?.length > 0 && !selectedRecipeItemId) {
          setSelectedRecipeItemId(itemData.items[0].id);
        }
      }
      if (modRes.ok) {
        const modData = await modRes.json();
        setModifierGroups(modData.groups || []);
      }
      if (prodRes.ok) {
        const prodData = await prodRes.json();
        setInventoryProducts(prodData.products || []);
      }
    } catch (err: any) {
      console.error(err);
      Notify.failure("Failed to load restaurant menu data");
    } finally {
      setLoading(false);
    }
  }, [selectedRecipeItemId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Load active recipe when selectedRecipeItemId changes
  useEffect(() => {
    if (!selectedRecipeItemId) return;
    const item = items.find((it) => it.id === selectedRecipeItemId);
    const activeRec = item?.recipeVersions?.find((r) => r.isActive);
    if (activeRec && activeRec.ingredients) {
      setRecipeIngredients(
        activeRec.ingredients.map((ing) => ({
          productId: ing.productId,
          quantity: ing.quantity.toString(),
          unit: ing.unit || "kg",
          wastagePercent: (ing.wastagePercent || 0).toString(),
        }))
      );
      setRecipeNotes(activeRec.notes || "");
    } else {
      setRecipeIngredients([]);
      setRecipeNotes("");
    }
  }, [selectedRecipeItemId, items]);

  // Filtered Items
  const displayedItems = useMemo(() => {
    let list = items;
    if (selectedSectionFilter !== "ALL") {
      list = list.filter((it) => it.sectionId === selectedSectionFilter);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (it) =>
          it.name.toLowerCase().includes(q) ||
          (it.description && it.description.toLowerCase().includes(q))
      );
    }
    return list;
  }, [items, selectedSectionFilter, searchQuery]);

  // Handle Save Item
  const handleSaveItem = async () => {
    if (!itemForm.name.trim() || !itemForm.sectionId) {
      Notify.failure("Item name and category section are required");
      return;
    }

    try {
      const payload = {
        name: itemForm.name.trim(),
        description: itemForm.description.trim() || null,
        sectionId: itemForm.sectionId,
        basePrice: parseFloat(itemForm.basePrice) || 0,
        taxRate: parseFloat(itemForm.taxRate) || 0,
        imageUrl: itemForm.imageUrl.trim() || null,
        isAvailable: itemForm.isAvailable,
        prepTimeMinutes: itemForm.prepTimeMinutes ? parseInt(itemForm.prepTimeMinutes) : null,
        modifierGroupIds: itemForm.modifierGroupIds,
      };

      const url = editingItem
        ? `/api/v1/restaurant/items/${editingItem.id}`
        : "/api/v1/restaurant/items";
      const method = editingItem ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to save menu item");
      }

      Notify.success(editingItem ? "Menu item updated" : "New menu item created");
      setItemModalOpen(false);
      setEditingItem(null);
      await loadData();
    } catch (err: any) {
      Notify.failure(err.message);
    }
  };

  // Handle Delete Item
  const handleDeleteItem = async (item: MenuItem) => {
    if (!confirm(`Are you sure you want to delete "${item.name}"?`)) return;
    try {
      const res = await fetch(`/api/v1/restaurant/items/${item.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete item");
      Notify.success(`Deleted "${item.name}"`);
      await loadData();
    } catch (err: any) {
      Notify.failure(err.message);
    }
  };

  // Handle Save Section
  const handleSaveSection = async () => {
    if (!sectionForm.name.trim()) {
      Notify.failure("Category / Section name is required");
      return;
    }

    try {
      const payload = {
        name: sectionForm.name.trim(),
        description: sectionForm.description.trim() || null,
        displayOrder: parseInt(sectionForm.displayOrder) || 0,
      };

      const url = editingSection
        ? `/api/v1/restaurant/sections/${editingSection.id}`
        : "/api/v1/restaurant/sections";
      const method = editingSection ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to save category section");
      }

      Notify.success(editingSection ? "Category updated" : "Category created");
      setSectionModalOpen(false);
      setEditingSection(null);
      await loadData();
    } catch (err: any) {
      Notify.failure(err.message);
    }
  };

  // Handle Delete Section
  const handleDeleteSection = async (sec: MenuSection) => {
    if (!confirm(`Are you sure you want to delete category "${sec.name}"?`)) return;
    try {
      const res = await fetch(`/api/v1/restaurant/sections/${sec.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete category");
      Notify.success(`Category "${sec.name}" deleted`);
      await loadData();
    } catch (err: any) {
      Notify.failure(err.message);
    }
  };

  // Handle Save Modifier Group
  const handleSaveModifierGroup = async () => {
    if (!modifierForm.name.trim()) {
      Notify.failure("Addon group name is required");
      return;
    }

    try {
      const payload = {
        name: modifierForm.name.trim(),
        displayName: modifierForm.displayName.trim() || modifierForm.name.trim(),
        minSelections: parseInt(modifierForm.minSelections) || 0,
        maxSelections: parseInt(modifierForm.maxSelections) || 1,
        options: modifierForm.options
          .filter((opt) => opt.name.trim())
          .map((opt) => ({
            name: opt.name.trim(),
            priceDelta: parseFloat(opt.priceDelta) || 0,
          })),
      };

      if (payload.options.length === 0) {
        Notify.failure("At least one option is required");
        return;
      }

      const url = editingModifier
        ? `/api/v1/restaurant/modifiers/${editingModifier.id}`
        : "/api/v1/restaurant/modifiers";
      const method = editingModifier ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to save modifier group");
      }

      Notify.success(editingModifier ? "Addon group updated" : "Addon group created");
      setModifierModalOpen(false);
      setEditingModifier(null);
      await loadData();
    } catch (err: any) {
      Notify.failure(err.message);
    }
  };

  // Handle Delete Modifier Group
  const handleDeleteModifierGroup = async (group: ModifierGroup) => {
    if (!confirm(`Are you sure you want to delete addon group "${group.name}"?`)) return;
    try {
      const res = await fetch(`/api/v1/restaurant/modifiers/${group.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete addon group");
      Notify.success(`Deleted addon group "${group.name}"`);
      await loadData();
    } catch (err: any) {
      Notify.failure(err.message);
    }
  };

  // Handle Save Recipe BOM
  const handleSaveRecipeBOM = async () => {
    if (!selectedRecipeItemId) return;
    if (recipeIngredients.length === 0) {
      Notify.failure("Add at least one raw ingredient to the recipe");
      return;
    }

    try {
      setSavingRecipe(true);
      const payload = {
        menuItemId: selectedRecipeItemId,
        yieldQuantity: 1,
        yieldUnit: "PORTION",
        notes: recipeNotes.trim() || undefined,
        ingredients: recipeIngredients.map((ing) => ({
          productId: ing.productId,
          quantity: parseFloat(ing.quantity) || 0.1,
          unit: ing.unit,
          wastagePercent: parseFloat(ing.wastagePercent) || 0,
        })),
      };

      const res = await fetch("/api/v1/restaurant/recipes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to save recipe Bill of Materials");
      }

      Notify.success("Recipe Bill-of-Materials saved & active for kitchen inventory auto-depletion");
      await loadData();
    } catch (err: any) {
      Notify.failure(err.message);
    } finally {
      setSavingRecipe(false);
    }
  };

  // Calculate estimated portion cost from ingredients
  const currentRecipeItem = items.find((it) => it.id === selectedRecipeItemId);
  const calculatedPortionCost = useMemo(() => {
    return recipeIngredients.reduce((sum, ing) => {
      const prod = inventoryProducts.find((p) => p.id === ing.productId);
      const costPerUnit = prod ? parseFloat(prod.costPrice.toString()) || 0 : 0;
      const qty = parseFloat(ing.quantity) || 0;
      const wastageMult = 1 + (parseFloat(ing.wastagePercent) || 0) / 100;
      return sum + costPerUnit * qty * wastageMult;
    }, 0);
  }, [recipeIngredients, inventoryProducts]);

  return (
    <div className="p-4 sm:p-6 max-w-[1600px] mx-auto space-y-5 text-[#292320]">
      {/* Top Header: Title & Quick Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-[#D8CEC1] pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[#292320]">
              Menu, Addons &amp; Recipe Management
            </h1>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#EAF5EE] text-[#16A34A] border border-[#D1EAD8]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#16A34A]" />
              Active Catalog
            </span>
          </div>
          <p className="text-xs text-[#71675E] mt-1">
            Configure dishes, categories, modifier addons, and kitchen ingredient Bill of Materials
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => loadData()}
            disabled={loading}
            className="h-9 px-3 rounded-lg border border-[#D8CEC1] bg-[#FFFCF7] hover:bg-[#EEE7DD] text-xs font-semibold text-[#292320] transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 text-[#71675E] ${loading ? "animate-spin" : ""}`} />
            <span>Refresh</span>
          </button>
          <Link
            href="/dashboard/restaurant/pos"
            className="h-9 px-3.5 rounded-lg bg-[#6B2837] hover:bg-[#541E2A] text-xs font-semibold text-white transition-colors flex items-center gap-1.5 shadow-xs cursor-pointer"
          >
            <ShoppingCart className="h-4 w-4" />
            <span>Open POS</span>
          </Link>
          <Link
            href="/dashboard/restaurant/tables"
            className="h-9 px-3.5 rounded-lg border border-[#D8CEC1] bg-[#FFFCF7] hover:bg-[#EEE7DD] text-xs font-semibold text-[#292320] transition-colors"
          >
            Floor Plan
          </Link>
          <Link
            href="/dashboard/restaurant/reports"
            className="h-9 px-3.5 rounded-lg border border-[#D8CEC1] bg-[#FFFCF7] hover:bg-[#EEE7DD] text-xs font-semibold text-[#292320] transition-colors"
          >
            Financial Reports
          </Link>
        </div>
      </div>

      {/* Apple-style Segmented Navigation Bar */}
      <div className="flex items-center gap-1.5 border-b border-[#D8CEC1] pb-2 overflow-x-auto">
        {(
          [
            { id: "ITEMS", label: "Menu Items", count: items.length, icon: UtensilsCrossed },
            { id: "CATEGORIES", label: "Categories & Sections", count: sections.length, icon: Layers },
            { id: "ADDONS", label: "Addons & Options", count: modifierGroups.length, icon: Sparkles },
            { id: "RECIPES", label: "Recipe & Kitchen BOM", count: items.filter((it) => it.recipeVersions?.length).length, icon: Scale },
          ] as const
        ).map((tab) => {
          const Icon = tab.icon;
          const isSelected = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`h-9 px-3.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-2 border cursor-pointer shrink-0 ${
                isSelected
                  ? "bg-[#6B2837] border-[#6B2837] text-white shadow-xs"
                  : "bg-[#FFFCF7] border-[#D8CEC1] text-[#71675E] hover:text-[#292320] hover:bg-[#EEE7DD]"
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              <span>{tab.label}</span>
              <span
                className={`text-[10px] font-mono tabular-nums px-1.5 py-0.2 rounded ${
                  isSelected ? "bg-white/20 text-white" : "bg-[#EEE7DD] text-[#71675E]"
                }`}
              >
                {tab.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* TAB 1: MENU ITEMS */}
      {activeTab === "ITEMS" && (
        <div className="space-y-4">
          {/* Controls: Search, Filter, + Add Item */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-2 flex-1">
              <div className="relative w-full sm:w-72">
                <Search className="h-3.5 w-3.5 text-[#71675E] absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Filter menu items..."
                  className="h-9 w-full pl-9 pr-3 text-xs rounded-lg border border-[#D8CEC1] bg-[#FFFCF7] text-[#292320] placeholder:text-[#71675E] focus:outline-none focus:border-[#6B2837]"
                />
              </div>

              <select
                value={selectedSectionFilter}
                onChange={(e) => setSelectedSectionFilter(e.target.value)}
                className="h-9 px-3 text-xs font-semibold rounded-lg border border-[#D8CEC1] bg-[#FFFCF7] text-[#292320] focus:outline-none focus:border-[#6B2837] cursor-pointer"
              >
                <option value="ALL">All Categories ({items.length})</option>
                {sections.map((sec) => (
                  <option key={sec.id} value={sec.id}>
                    {sec.name}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              onClick={() => {
                setEditingItem(null);
                setItemForm({
                  name: "",
                  description: "",
                  sectionId: sections[0]?.id || "",
                  basePrice: "350",
                  taxRate: "13",
                  imageUrl: "",
                  isAvailable: true,
                  prepTimeMinutes: "15",
                  modifierGroupIds: [],
                });
                setItemModalOpen(true);
              }}
              className="h-9 px-4 rounded-lg bg-[#6B2837] hover:bg-[#541E2A] text-xs font-bold text-white transition-colors flex items-center justify-center gap-1.5 shadow-xs cursor-pointer shrink-0"
            >
              <Plus className="h-4 w-4" />
              <span>Add Menu Item</span>
            </button>
          </div>

          {/* Items Table / Cards */}
          <div className="rounded-lg border border-[#D8CEC1] bg-[#FFFCF7] overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#EEE7DD]/60 border-b border-[#D8CEC1] text-[#71675E] uppercase text-[10px] font-bold tracking-wider">
                  <tr>
                    <th className="py-3 px-4">Item &amp; Photo</th>
                    <th className="py-3 px-3">Category</th>
                    <th className="py-3 px-3 text-right">Selling Price</th>
                    <th className="py-3 px-3">Prep Time</th>
                    <th className="py-3 px-3">Addons</th>
                    <th className="py-3 px-3">Recipe BOM</th>
                    <th className="py-3 px-3">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#D8CEC1]/60 text-[#292320]">
                  {displayedItems.map((item) => {
                    const hasRecipe = Boolean(item.recipeVersions && item.recipeVersions.length > 0);
                    const ingredientCount = item.recipeVersions?.[0]?.ingredients?.length || 0;

                    return (
                      <tr key={item.id} className="hover:bg-[#F7F3EC]/50 transition-colors">
                        <td className="py-3 px-4 flex items-center gap-3">
                          <div className="h-10 w-10 rounded-md bg-[#EEE7DD] border border-[#D8CEC1] overflow-hidden flex items-center justify-center shrink-0">
                            {item.imageUrl ? (
                              <img
                                src={item.imageUrl}
                                alt={item.name}
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <UtensilsCrossed className="h-4 w-4 text-[#71675E]" />
                            )}
                          </div>
                          <div>
                            <span className="font-bold text-[#292320] block">{item.name}</span>
                            {item.description && (
                              <span className="text-[11px] text-[#71675E] line-clamp-1">
                                {item.description}
                              </span>
                            )}
                          </div>
                        </td>

                        <td className="py-3 px-3">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#EEE7DD] text-[#71675E]">
                            {item.section?.name || "Unassigned"}
                          </span>
                        </td>

                        <td className="py-3 px-3 text-right font-mono font-bold tabular-nums text-sm text-[#292320]">
                          {formatNPR(item.basePrice)}
                        </td>

                        <td className="py-3 px-3 font-mono tabular-nums text-xs text-[#71675E]">
                          {item.prepTimeMinutes ? `${item.prepTimeMinutes} min` : "—"}
                        </td>

                        <td className="py-3 px-3">
                          {item.modifierGroups && item.modifierGroups.length > 0 ? (
                            <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-[#FEF3C7] text-[#92400E] border border-[#FDE68A]">
                              {item.modifierGroups.length} Addon Group(s)
                            </span>
                          ) : (
                            <span className="text-[11px] text-[#71675E]">None</span>
                          )}
                        </td>

                        <td className="py-3 px-3">
                          {hasRecipe ? (
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedRecipeItemId(item.id);
                                setActiveTab("RECIPES");
                              }}
                              className="px-2 py-0.5 rounded text-[10px] font-semibold bg-[#EAF5EE] text-[#16A34A] border border-[#D1EAD8] hover:bg-[#D1EAD8] transition-colors cursor-pointer"
                            >
                              {ingredientCount} Ingredients
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedRecipeItemId(item.id);
                                setActiveTab("RECIPES");
                              }}
                              className="px-2 py-0.5 rounded text-[10px] font-medium border border-[#D8CEC1] text-[#71675E] hover:bg-[#EEE7DD] cursor-pointer"
                            >
                              + Link Recipe
                            </button>
                          )}
                        </td>

                        <td className="py-3 px-3">
                          <span
                            className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                              item.isAvailable
                                ? "bg-[#EAF5EE] text-[#16A34A] border-[#D1EAD8]"
                                : "bg-[#FDF2F2] text-[#DC2626] border-[#FBD5D5]"
                            }`}
                          >
                            <span
                              className={`h-1.5 w-1.5 rounded-full ${
                                item.isAvailable ? "bg-[#16A34A]" : "bg-[#DC2626]"
                              }`}
                            />
                            {item.isAvailable ? "Available" : "86'd / Hidden"}
                          </span>
                        </td>

                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => {
                                setEditingItem(item);
                                setItemForm({
                                  name: item.name,
                                  description: item.description || "",
                                  sectionId: item.sectionId,
                                  basePrice: item.basePrice.toString(),
                                  taxRate: item.taxRate.toString(),
                                  imageUrl: item.imageUrl || "",
                                  isAvailable: item.isAvailable,
                                  prepTimeMinutes: item.prepTimeMinutes?.toString() || "15",
                                  modifierGroupIds: (item.modifierGroups || []).map(
                                    (mg) => mg.modifierGroup.id
                                  ),
                                });
                                setItemModalOpen(true);
                              }}
                              className="h-7 w-7 rounded-md border border-[#D8CEC1] bg-[#FFFCF7] hover:bg-[#EEE7DD] flex items-center justify-center text-[#71675E] hover:text-[#292320] cursor-pointer"
                              title="Edit Item"
                            >
                              <Edit className="h-3 w-3" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteItem(item)}
                              className="h-7 w-7 rounded-md border border-[#FBD5D5] bg-[#FFFCF7] hover:bg-[#FDF2F2] flex items-center justify-center text-[#DC2626] cursor-pointer"
                              title="Delete Item"
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: CATEGORIES & SECTIONS */}
      {activeTab === "CATEGORIES" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-xs text-[#71675E]">
              Manage dining catalog sections and subcategories for kitchen stations &amp; POS menus
            </p>
            <button
              type="button"
              onClick={() => {
                setEditingSection(null);
                setSectionForm({ name: "", description: "", displayOrder: "0" });
                setSectionModalOpen(true);
              }}
              className="h-9 px-4 rounded-lg bg-[#6B2837] hover:bg-[#541E2A] text-xs font-bold text-white transition-colors flex items-center gap-1.5 shadow-xs cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              <span>Add Category Section</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {sections.map((sec) => {
              const secItemCount = items.filter((it) => it.sectionId === sec.id).length;
              return (
                <div
                  key={sec.id}
                  className="rounded-lg border border-[#D8CEC1] bg-[#FFFCF7] p-4 flex flex-col justify-between shadow-xs space-y-3"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="text-sm font-bold text-[#292320]">{sec.name}</h3>
                      {sec.description && (
                        <p className="text-xs text-[#71675E] mt-0.5">{sec.description}</p>
                      )}
                      <span className="mt-2 inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-bold bg-[#EEE7DD] text-[#71675E]">
                        <UtensilsCrossed className="h-3 w-3" />
                        {secItemCount} Dishes
                      </span>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingSection(sec);
                          setSectionForm({
                            name: sec.name,
                            description: sec.description || "",
                            displayOrder: sec.displayOrder.toString(),
                          });
                          setSectionModalOpen(true);
                        }}
                        className="h-7 w-7 rounded border border-[#D8CEC1] bg-[#FFFCF7] hover:bg-[#EEE7DD] flex items-center justify-center text-[#71675E] hover:text-[#292320] cursor-pointer"
                      >
                        <Edit className="h-3 w-3" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteSection(sec)}
                        className="h-7 w-7 rounded border border-[#FBD5D5] bg-[#FFFCF7] hover:bg-[#FDF2F2] flex items-center justify-center text-[#DC2626] cursor-pointer"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 3: ADDONS & MODIFIERS */}
      {activeTab === "ADDONS" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-xs text-[#71675E]">
              Configure modifier groups (preparation styles, spice levels, toppings) and extra prices
            </p>
            <button
              type="button"
              onClick={() => {
                setEditingModifier(null);
                setModifierForm({
                  name: "",
                  displayName: "",
                  minSelections: "0",
                  maxSelections: "1",
                  options: [{ name: "Standard", priceDelta: "0" }],
                });
                setModifierModalOpen(true);
              }}
              className="h-9 px-4 rounded-lg bg-[#6B2837] hover:bg-[#541E2A] text-xs font-bold text-white transition-colors flex items-center gap-1.5 shadow-xs cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              <span>Add Modifier Group</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {modifierGroups.map((group) => (
              <div
                key={group.id}
                className="rounded-lg border border-[#D8CEC1] bg-[#FFFCF7] p-4 flex flex-col justify-between shadow-xs space-y-3"
              >
                <div>
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="text-sm font-bold text-[#292320]">{group.name}</h3>
                      <p className="text-[11px] text-[#71675E]">
                        {group.minSelections > 0
                          ? `Mandatory (${group.minSelections} - ${group.maxSelections} choices)`
                          : `Optional (up to ${group.maxSelections} choices)`}
                      </p>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingModifier(group);
                          setModifierForm({
                            name: group.name,
                            displayName: group.displayName || group.name,
                            minSelections: group.minSelections.toString(),
                            maxSelections: group.maxSelections.toString(),
                            options: group.options.map((opt) => ({
                              name: opt.name,
                              priceDelta: opt.priceDelta.toString(),
                            })),
                          });
                          setModifierModalOpen(true);
                        }}
                        className="h-7 w-7 rounded border border-[#D8CEC1] bg-[#FFFCF7] hover:bg-[#EEE7DD] flex items-center justify-center text-[#71675E] hover:text-[#292320] cursor-pointer"
                      >
                        <Edit className="h-3 w-3" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteModifierGroup(group)}
                        className="h-7 w-7 rounded border border-[#FBD5D5] bg-[#FFFCF7] hover:bg-[#FDF2F2] flex items-center justify-center text-[#DC2626] cursor-pointer"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  </div>

                  <div className="mt-3 space-y-1.5 border-t border-[#D8CEC1]/60 pt-2.5">
                    <span className="text-[10px] uppercase font-bold text-[#71675E] block">
                      Options &amp; Prices
                    </span>
                    <div className="space-y-1">
                      {group.options.map((opt, i) => (
                        <div
                          key={i}
                          className="flex items-center justify-between text-xs text-[#292320]"
                        >
                          <span>{opt.name}</span>
                          <span className="font-mono tabular-nums font-semibold text-[#6B2837]">
                            {parseFloat(opt.priceDelta.toString()) > 0
                              ? `+${formatNPR(opt.priceDelta)}`
                              : "Free"}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 4: RECIPE & KITCHEN BOM */}
      {activeTab === "RECIPES" && (
        <div className="space-y-4">
          <div className="rounded-lg border border-[#D8CEC1] bg-[#FFFCF7] p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xs">
            <div>
              <h2 className="text-sm font-bold text-[#292320]">
                Recipe Bill-of-Materials &amp; Raw Inventory Engine
              </h2>
              <p className="text-xs text-[#71675E] mt-0.5">
                Link raw ingredients (meat keema, flour, vegetables, oil) to menu dishes for auto-stock depletion and 86'd out-of-stock prevention.
              </p>
            </div>

            {/* Select Dish Dropdown */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-[#292320] whitespace-nowrap">
                Select Dish:
              </span>
              <select
                value={selectedRecipeItemId}
                onChange={(e) => setSelectedRecipeItemId(e.target.value)}
                className="h-9 px-3 text-xs font-semibold rounded-lg border border-[#D8CEC1] bg-[#FFFCF7] text-[#292320] focus:border-[#6B2837] focus:outline-none cursor-pointer min-w-[220px]"
              >
                {items.map((it) => (
                  <option key={it.id} value={it.id}>
                    {it.name} ({formatNPR(it.basePrice)})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {currentRecipeItem && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* Left 2 Cols: Ingredients Table */}
              <div className="lg:col-span-2 rounded-lg border border-[#D8CEC1] bg-[#FFFCF7] p-4 space-y-4 shadow-xs">
                <div className="flex items-center justify-between border-b border-[#D8CEC1] pb-3">
                  <div>
                    <h3 className="text-sm font-bold text-[#292320]">
                      Ingredients for 1 Portion of {currentRecipeItem.name}
                    </h3>
                    <p className="text-xs text-[#71675E] font-mono tabular-nums">
                      Selling Price: {formatNPR(currentRecipeItem.basePrice)}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      if (inventoryProducts.length === 0) {
                        Notify.failure("No raw inventory products found to add");
                        return;
                      }
                      setRecipeIngredients((prev) => [
                        ...prev,
                        {
                          productId: inventoryProducts[0].id,
                          quantity: "0.10",
                          unit: "kg",
                          wastagePercent: "5",
                        },
                      ]);
                    }}
                    className="h-8 px-3 rounded-md bg-[#6B2837] hover:bg-[#541E2A] text-xs font-bold text-white transition-colors flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>Add Ingredient</span>
                  </button>
                </div>

                {recipeIngredients.length === 0 ? (
                  <div className="py-12 text-center text-xs text-[#71675E] space-y-2">
                    <Scale className="h-8 w-8 text-[#71675E] mx-auto stroke-1" />
                    <p className="font-semibold text-[#292320]">No recipe ingredients configured yet.</p>
                    <p>Click "Add Ingredient" to link raw materials from your kitchen inventory.</p>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {recipeIngredients.map((ing, idx) => {
                      const prod = inventoryProducts.find((p) => p.id === ing.productId);
                      const currentStock = (prod?.productStocks || []).reduce(
                        (sum, s) => sum + s.quantity,
                        0
                      );
                      const isDepleted = currentStock <= 0;

                      return (
                        <div
                          key={idx}
                          className="p-3 rounded-lg border border-[#D8CEC1] bg-[#F7F3EC]/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs"
                        >
                          <div className="flex-1">
                            <label className="text-[10px] font-bold text-[#71675E] uppercase tracking-wider block mb-1">
                              Raw Material
                            </label>
                            <select
                              value={ing.productId}
                              onChange={(e) => {
                                const newId = e.target.value;
                                setRecipeIngredients((prev) =>
                                  prev.map((item, i) => (i === idx ? { ...item, productId: newId } : item))
                                );
                              }}
                              className="h-8 w-full text-xs font-medium rounded-md border border-[#D8CEC1] bg-[#FFFCF7] px-2 text-[#292320] focus:border-[#6B2837] focus:outline-none"
                            >
                              {inventoryProducts.map((p) => (
                                <option key={p.id} value={p.id}>
                                  {p.name} [{p.sku}] — Cost: {formatNPR(p.costPrice)}
                                </option>
                              ))}
                            </select>
                            <div className="flex items-center gap-2 mt-1">
                              <span
                                className={`text-[10px] font-bold px-1.5 py-0.2 rounded font-mono tabular-nums ${
                                  isDepleted
                                    ? "bg-[#FDF2F2] text-[#DC2626] border border-[#FBD5D5]"
                                    : "bg-[#EAF5EE] text-[#16A34A] border border-[#D1EAD8]"
                                }`}
                              >
                                Stock on-hand: {currentStock} units
                              </span>
                            </div>
                          </div>

                          <div className="w-24">
                            <label className="text-[10px] font-bold text-[#71675E] uppercase tracking-wider block mb-1">
                              Qty / Portion
                            </label>
                            <input
                              type="number"
                              step="0.01"
                              value={ing.quantity}
                              onChange={(e) => {
                                const val = e.target.value;
                                setRecipeIngredients((prev) =>
                                  prev.map((item, i) => (i === idx ? { ...item, quantity: val } : item))
                                );
                              }}
                              className="h-8 w-full text-xs font-bold font-mono tabular-nums rounded-md border border-[#D8CEC1] bg-[#FFFCF7] px-2 text-right focus:border-[#6B2837] focus:outline-none"
                            />
                          </div>

                          <div className="w-20">
                            <label className="text-[10px] font-bold text-[#71675E] uppercase tracking-wider block mb-1">
                              Unit
                            </label>
                            <select
                              value={ing.unit}
                              onChange={(e) => {
                                const val = e.target.value;
                                setRecipeIngredients((prev) =>
                                  prev.map((item, i) => (i === idx ? { ...item, unit: val } : item))
                                );
                              }}
                              className="h-8 w-full text-xs font-medium rounded-md border border-[#D8CEC1] bg-[#FFFCF7] px-1 text-[#292320] focus:border-[#6B2837] focus:outline-none"
                            >
                              <option value="kg">kg</option>
                              <option value="g">g</option>
                              <option value="pcs">pcs</option>
                              <option value="ml">ml</option>
                              <option value="ltr">ltr</option>
                            </select>
                          </div>

                          <div className="w-20">
                            <label className="text-[10px] font-bold text-[#71675E] uppercase tracking-wider block mb-1">
                              Waste %
                            </label>
                            <input
                              type="number"
                              min="0"
                              max="100"
                              value={ing.wastagePercent}
                              onChange={(e) => {
                                const val = e.target.value;
                                setRecipeIngredients((prev) =>
                                  prev.map((item, i) => (i === idx ? { ...item, wastagePercent: val } : item))
                                );
                              }}
                              className="h-8 w-full text-xs font-mono tabular-nums rounded-md border border-[#D8CEC1] bg-[#FFFCF7] px-2 text-right focus:border-[#6B2837] focus:outline-none"
                            />
                          </div>

                          <button
                            type="button"
                            onClick={() => {
                              setRecipeIngredients((prev) => prev.filter((_, i) => i !== idx));
                            }}
                            className="h-8 w-8 rounded-md border border-[#FBD5D5] bg-[#FFFCF7] hover:bg-[#FDF2F2] flex items-center justify-center text-[#DC2626] self-end cursor-pointer"
                            title="Remove Ingredient"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Right Col: Cost Calculation & Profit Margins */}
              <div className="rounded-lg border border-[#D8CEC1] bg-[#FFFCF7] p-4 flex flex-col justify-between shadow-xs space-y-4">
                <div className="space-y-3">
                  <h3 className="text-sm font-bold text-[#292320] border-b border-[#D8CEC1] pb-2">
                    Portion Financials &amp; Margin
                  </h3>

                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between text-[#71675E]">
                      <span>Menu Selling Price:</span>
                      <span className="font-bold font-mono tabular-nums text-[#292320]">
                        {formatNPR(currentRecipeItem.basePrice)}
                      </span>
                    </div>

                    <div className="flex justify-between text-[#71675E]">
                      <span>Calculated Ingredient Cost:</span>
                      <span className="font-bold font-mono tabular-nums text-[#6B2837]">
                        {formatNPR(calculatedPortionCost.toFixed(2))}
                      </span>
                    </div>

                    <div className="flex justify-between font-bold text-xs pt-2 border-t border-[#D8CEC1]">
                      <span>Gross Profit per Portion:</span>
                      <span className="font-mono tabular-nums text-[#16A34A]">
                        {formatNPR(
                          Math.max(
                            0,
                            parseFloat(currentRecipeItem.basePrice.toString()) - calculatedPortionCost
                          ).toFixed(2)
                        )}
                      </span>
                    </div>

                    <div className="flex justify-between font-bold text-xs">
                      <span>Profit Margin %:</span>
                      <span className="font-mono tabular-nums text-[#16A34A]">
                        {parseFloat(currentRecipeItem.basePrice.toString()) > 0
                          ? `${Math.round(
                              ((parseFloat(currentRecipeItem.basePrice.toString()) - calculatedPortionCost) /
                                parseFloat(currentRecipeItem.basePrice.toString())) *
                                100
                            )}%`
                          : "0%"}
                      </span>
                    </div>
                  </div>

                  <div className="p-3 rounded-lg border border-[#D1EAD8] bg-[#EAF5EE] text-xs text-[#16A34A] space-y-1">
                    <div className="font-bold flex items-center gap-1.5">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      <span>Automatic 86'd Out-of-Stock Lock</span>
                    </div>
                    <p className="text-[11px] leading-tight text-[#16A34A]">
                      When any ingredient stock runs out in the kitchen inventory, POS automatically prevents cashiers and waitstaff from ordering this dish.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  disabled={savingRecipe || recipeIngredients.length === 0}
                  onClick={handleSaveRecipeBOM}
                  className="w-full h-10 rounded-lg bg-[#6B2837] hover:bg-[#541E2A] text-xs font-bold text-white transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-50"
                >
                  <Scale className="h-4 w-4" />
                  <span>{savingRecipe ? "Saving Recipe..." : "Save Recipe Bill-of-Materials"}</span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* MODAL: ADD / EDIT MENU ITEM */}
      {itemModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#292320]/45 backdrop-blur-[2px] p-4">
          <div className="w-full max-w-lg rounded-xl border border-[#D8CEC1] bg-[#FFFCF7] p-5 space-y-4 shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-[#D8CEC1] pb-3">
              <div>
                <h3 className="text-sm font-bold text-[#292320]">
                  {editingItem ? "Edit Menu Item" : "Create New Menu Item"}
                </h3>
                <p className="text-xs text-[#71675E] mt-0.5">
                  Configure dish pricing, category assignment, and preparation time
                </p>
              </div>
              <button
                type="button"
                onClick={() => setItemModalOpen(false)}
                className="h-8 w-8 rounded-lg flex items-center justify-center text-[#71675E] hover:text-[#292320] hover:bg-[#EEE7DD] cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold text-[#292320] block mb-1">
                  Dish / Item Name *
                </label>
                <input
                  type="text"
                  value={itemForm.name}
                  onChange={(e) => setItemForm({ ...itemForm, name: e.target.value })}
                  placeholder="e.g. Himalayan Jhol Momo, Mustang Alu"
                  className="h-9 w-full px-3 text-xs rounded-lg border border-[#D8CEC1] bg-[#FFFCF7] text-[#292320] focus:border-[#6B2837] focus:outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-[#292320] block mb-1">
                  Description
                </label>
                <textarea
                  rows={2}
                  value={itemForm.description}
                  onChange={(e) => setItemForm({ ...itemForm, description: e.target.value })}
                  placeholder="Appetizing description of ingredients, culinary style, and flavor profile..."
                  className="w-full p-2.5 text-xs rounded-lg border border-[#D8CEC1] bg-[#FFFCF7] text-[#292320] focus:border-[#6B2837] focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-[#292320] block mb-1">
                    Category Section *
                  </label>
                  <select
                    value={itemForm.sectionId}
                    onChange={(e) => setItemForm({ ...itemForm, sectionId: e.target.value })}
                    className="h-9 w-full px-2.5 text-xs font-semibold rounded-lg border border-[#D8CEC1] bg-[#FFFCF7] text-[#292320] focus:border-[#6B2837] focus:outline-none"
                  >
                    {sections.map((sec) => (
                      <option key={sec.id} value={sec.id}>
                        {sec.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-[#292320] block mb-1">
                    Selling Price (NPR) *
                  </label>
                  <input
                    type="number"
                    step="10"
                    value={itemForm.basePrice}
                    onChange={(e) => setItemForm({ ...itemForm, basePrice: e.target.value })}
                    className="h-9 w-full px-3 text-xs font-bold font-mono tabular-nums rounded-lg border border-[#D8CEC1] bg-[#FFFCF7] text-[#292320] focus:border-[#6B2837] focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-[#292320] block mb-1">
                    Prep Time (Minutes)
                  </label>
                  <input
                    type="number"
                    value={itemForm.prepTimeMinutes}
                    onChange={(e) => setItemForm({ ...itemForm, prepTimeMinutes: e.target.value })}
                    className="h-9 w-full px-3 text-xs font-mono tabular-nums rounded-lg border border-[#D8CEC1] bg-[#FFFCF7] text-[#292320] focus:border-[#6B2837] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-[#292320] block mb-1">
                    VAT Rate (%)
                  </label>
                  <input
                    type="number"
                    value={itemForm.taxRate}
                    onChange={(e) => setItemForm({ ...itemForm, taxRate: e.target.value })}
                    className="h-9 w-full px-3 text-xs font-mono tabular-nums rounded-lg border border-[#D8CEC1] bg-[#FFFCF7] text-[#292320] focus:border-[#6B2837] focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-[#292320] block mb-1">
                  Food Photo Image URL
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="url"
                    value={itemForm.imageUrl}
                    onChange={(e) => setItemForm({ ...itemForm, imageUrl: e.target.value })}
                    placeholder="https://example.com/photos/momo.jpg"
                    className="h-9 flex-1 px-3 text-xs rounded-lg border border-[#D8CEC1] bg-[#FFFCF7] text-[#292320] focus:border-[#6B2837] focus:outline-none"
                  />
                  {itemForm.imageUrl && (
                    <div className="h-9 w-9 rounded-md bg-[#EEE7DD] border border-[#D8CEC1] overflow-hidden shrink-0">
                      <img src={itemForm.imageUrl} alt="preview" className="h-full w-full object-cover" />
                    </div>
                  )}
                </div>
              </div>

              {/* Attach Modifier Groups */}
              {modifierGroups.length > 0 && (
                <div className="space-y-1.5 pt-1">
                  <label className="text-xs font-bold text-[#292320] block">
                    Attach Addon &amp; Modifier Groups
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {modifierGroups.map((mg) => {
                      const isChecked = itemForm.modifierGroupIds.includes(mg.id);
                      return (
                        <label
                          key={mg.id}
                          className={`p-2 rounded-lg border text-xs flex items-center gap-2 cursor-pointer transition-colors ${
                            isChecked
                              ? "bg-[#6B2837]/10 border-[#6B2837] text-[#6B2837] font-bold"
                              : "bg-[#F7F3EC] border-[#D8CEC1] text-[#292320]"
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setItemForm({
                                  ...itemForm,
                                  modifierGroupIds: [...itemForm.modifierGroupIds, mg.id],
                                });
                              } else {
                                setItemForm({
                                  ...itemForm,
                                  modifierGroupIds: itemForm.modifierGroupIds.filter((id) => id !== mg.id),
                                });
                              }
                            }}
                            className="rounded accent-[#6B2837]"
                          />
                          <span className="truncate">{mg.name}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Availability Toggle */}
              <label className="flex items-center gap-2.5 p-3 rounded-lg border border-[#D8CEC1] bg-[#F7F3EC] cursor-pointer">
                <input
                  type="checkbox"
                  checked={itemForm.isAvailable}
                  onChange={(e) => setItemForm({ ...itemForm, isAvailable: e.target.checked })}
                  className="h-4 w-4 accent-[#6B2837] rounded"
                />
                <div>
                  <span className="text-xs font-bold text-[#292320] block">
                    Available for Order
                  </span>
                  <span className="text-[11px] text-[#71675E]">
                    Uncheck to temporarily 86 / hide this item from restaurant POS and online ordering.
                  </span>
                </div>
              </label>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-[#D8CEC1]">
              <button
                type="button"
                onClick={() => setItemModalOpen(false)}
                className="h-10 px-4 rounded-lg text-xs font-semibold text-[#71675E] hover:text-[#292320] cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveItem}
                className="h-10 px-5 rounded-lg bg-[#6B2837] hover:bg-[#541E2A] text-xs font-bold text-white transition-colors cursor-pointer shadow-xs"
              >
                {editingItem ? "Update Menu Item" : "Create Item"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: ADD / EDIT CATEGORY SECTION */}
      {sectionModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#292320]/45 backdrop-blur-[2px] p-4">
          <div className="w-full max-w-md rounded-xl border border-[#D8CEC1] bg-[#FFFCF7] p-5 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-[#D8CEC1] pb-3">
              <h3 className="text-sm font-bold text-[#292320]">
                {editingSection ? "Edit Category Section" : "New Category Section"}
              </h3>
              <button
                type="button"
                onClick={() => setSectionModalOpen(false)}
                className="h-8 w-8 rounded-lg flex items-center justify-center text-[#71675E] hover:text-[#292320] hover:bg-[#EEE7DD] cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold text-[#292320] block mb-1">
                  Category Name *
                </label>
                <input
                  type="text"
                  value={sectionForm.name}
                  onChange={(e) => setSectionForm({ ...sectionForm, name: e.target.value })}
                  placeholder="e.g. Appetizers & Momos, Signature Thalis"
                  className="h-9 w-full px-3 text-xs rounded-lg border border-[#D8CEC1] bg-[#FFFCF7] text-[#292320] focus:border-[#6B2837] focus:outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-[#292320] block mb-1">
                  Description
                </label>
                <input
                  type="text"
                  value={sectionForm.description}
                  onChange={(e) => setSectionForm({ ...sectionForm, description: e.target.value })}
                  placeholder="Optional category description"
                  className="h-9 w-full px-3 text-xs rounded-lg border border-[#D8CEC1] bg-[#FFFCF7] text-[#292320] focus:border-[#6B2837] focus:outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-[#292320] block mb-1">
                  Display Order
                </label>
                <input
                  type="number"
                  value={sectionForm.displayOrder}
                  onChange={(e) => setSectionForm({ ...sectionForm, displayOrder: e.target.value })}
                  className="h-9 w-full px-3 text-xs font-mono tabular-nums rounded-lg border border-[#D8CEC1] bg-[#FFFCF7] text-[#292320] focus:border-[#6B2837] focus:outline-none"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-[#D8CEC1]">
              <button
                type="button"
                onClick={() => setSectionModalOpen(false)}
                className="h-10 px-4 rounded-lg text-xs font-semibold text-[#71675E] hover:text-[#292320] cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveSection}
                className="h-10 px-5 rounded-lg bg-[#6B2837] hover:bg-[#541E2A] text-xs font-bold text-white transition-colors cursor-pointer shadow-xs"
              >
                {editingSection ? "Update Category" : "Create Category"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: ADD / EDIT MODIFIER GROUP */}
      {modifierModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#292320]/45 backdrop-blur-[2px] p-4">
          <div className="w-full max-w-lg rounded-xl border border-[#D8CEC1] bg-[#FFFCF7] p-5 space-y-4 shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-[#D8CEC1] pb-3">
              <div>
                <h3 className="text-sm font-bold text-[#292320]">
                  {editingModifier ? "Edit Addon Group" : "New Addon / Modifier Group"}
                </h3>
                <p className="text-xs text-[#71675E] mt-0.5">
                  Options and additional price deltas for dishes
                </p>
              </div>
              <button
                type="button"
                onClick={() => setModifierModalOpen(false)}
                className="h-8 w-8 rounded-lg flex items-center justify-center text-[#71675E] hover:text-[#292320] hover:bg-[#EEE7DD] cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold text-[#292320] block mb-1">
                  Group Name *
                </label>
                <input
                  type="text"
                  value={modifierForm.name}
                  onChange={(e) => setModifierForm({ ...modifierForm, name: e.target.value })}
                  placeholder="e.g. Momo Preparation Style, Spice Level"
                  className="h-9 w-full px-3 text-xs rounded-lg border border-[#D8CEC1] bg-[#FFFCF7] text-[#292320] focus:border-[#6B2837] focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-[#292320] block mb-1">
                    Min Choices (0 = Optional)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={modifierForm.minSelections}
                    onChange={(e) => setModifierForm({ ...modifierForm, minSelections: e.target.value })}
                    className="h-9 w-full px-3 text-xs font-mono tabular-nums rounded-lg border border-[#D8CEC1] bg-[#FFFCF7] text-[#292320] focus:border-[#6B2837] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-[#292320] block mb-1">
                    Max Choices
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={modifierForm.maxSelections}
                    onChange={(e) => setModifierForm({ ...modifierForm, maxSelections: e.target.value })}
                    className="h-9 w-full px-3 text-xs font-mono tabular-nums rounded-lg border border-[#D8CEC1] bg-[#FFFCF7] text-[#292320] focus:border-[#6B2837] focus:outline-none"
                  />
                </div>
              </div>

              {/* Options List */}
              <div className="space-y-2 pt-2 border-t border-[#D8CEC1]/60">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[#292320]">
                    Options &amp; Extra Charges (NPR)
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setModifierForm({
                        ...modifierForm,
                        options: [...modifierForm.options, { name: "", priceDelta: "0" }],
                      })
                    }
                    className="text-xs font-bold text-[#6B2837] hover:underline cursor-pointer flex items-center gap-1"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>Add Option</span>
                  </button>
                </div>

                <div className="space-y-2">
                  {modifierForm.options.map((opt, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <input
                        type="text"
                        value={opt.name}
                        onChange={(e) => {
                          const val = e.target.value;
                          setModifierForm({
                            ...modifierForm,
                            options: modifierForm.options.map((item, idx) =>
                              idx === i ? { ...item, name: val } : item
                            ),
                          });
                        }}
                        placeholder="Option Name (e.g. Steamed, Fried)"
                        className="h-8 flex-1 px-2.5 text-xs rounded border border-[#D8CEC1] bg-[#FFFCF7] text-[#292320] focus:border-[#6B2837] focus:outline-none"
                      />
                      <div className="flex items-center gap-1 w-28">
                        <span className="text-xs text-[#71675E]">+NPR</span>
                        <input
                          type="number"
                          step="10"
                          value={opt.priceDelta}
                          onChange={(e) => {
                            const val = e.target.value;
                            setModifierForm({
                              ...modifierForm,
                              options: modifierForm.options.map((item, idx) =>
                                idx === i ? { ...item, priceDelta: val } : item
                              ),
                            });
                          }}
                          className="h-8 w-16 px-1.5 text-xs text-right font-mono tabular-nums font-bold rounded border border-[#D8CEC1] bg-[#FFFCF7] text-[#292320] focus:border-[#6B2837] focus:outline-none"
                        />
                      </div>
                      {modifierForm.options.length > 1 && (
                        <button
                          type="button"
                          onClick={() => {
                            setModifierForm({
                              ...modifierForm,
                              options: modifierForm.options.filter((_, idx) => idx !== i),
                            });
                          }}
                          className="h-8 w-8 rounded text-[#DC2626] hover:bg-[#FDF2F2] flex items-center justify-center cursor-pointer"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-[#D8CEC1]">
              <button
                type="button"
                onClick={() => setModifierModalOpen(false)}
                className="h-10 px-4 rounded-lg text-xs font-semibold text-[#71675E] hover:text-[#292320] cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveModifierGroup}
                className="h-10 px-5 rounded-lg bg-[#6B2837] hover:bg-[#541E2A] text-xs font-bold text-white transition-colors cursor-pointer shadow-xs"
              >
                {editingModifier ? "Update Addon Group" : "Create Addon Group"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

