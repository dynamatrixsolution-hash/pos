"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Boxes,
  Zap,
  TrendingUp,
  DollarSign,
  Layers,
  ShieldCheck,
  Search,
  Filter,
  Plus,
  CheckCircle2,
  AlertTriangle,
  X,
  RefreshCw,
  SlidersHorizontal,
  UtensilsCrossed,
  Store,
  Coffee,
  Sparkles,
  BedDouble,
  CalendarDays,
  Receipt,
  BookOpen,
  QrCode,
  WifiOff,
  Building2,
  ShieldAlert,
  ChevronDown,
  Info,
  Sliders,
  Check,
} from "lucide-react";
import ExportDropdown from "@/components/export-dropdown";
import { ExportOptions } from "@/lib/export-service";

interface ModuleItem {
  id: string;
  code: string;
  name: string;
  category: "DINING" | "LODGING" | "OPERATIONS" | "INTEGRATION";
  description: string;
  iconName: string;
  starterIncluded: boolean;
  standardIncluded: boolean;
  proIncluded: boolean;
  enterpriseIncluded: boolean;
  isActive: boolean;
  sortOrder: number;
}

interface TenantItem {
  id: string;
  name: string;
  slug: string;
  status: string;
  plan: string;
  packageType: string;
  enabledModules: string[];
}

interface KPIs {
  totalModules: number;
  activeModules: number;
  mrr: number;
  avgUsage: number;
  categoriesCount: number;
  planCoverage: string;
}

interface CategoryCount {
  name: string;
  code: string;
  count: number;
}

// Map icon name to Lucide component
const ICON_MAP: Record<string, React.ElementType> = {
  UtensilsCrossed,
  Store,
  Coffee,
  Sparkles,
  BedDouble,
  CalendarDays,
  Receipt,
  BookOpen,
  Layers,
  QrCode,
  WifiOff,
  SlidersHorizontal,
  Building2,
  ShieldAlert,
  Boxes,
};

export default function ModuleControlCenterPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [modules, setModules] = useState<ModuleItem[]>([]);
  const [tenants, setTenants] = useState<TenantItem[]>([]);
  const [kpis, setKpis] = useState<KPIs>({
    totalModules: 15,
    activeModules: 15,
    mrr: 18740,
    avgUsage: 3,
    categoriesCount: 4,
    planCoverage: "4 Plans (Starter → Enterprise)",
  });
  const [categories, setCategories] = useState<CategoryCount[]>([]);

  // Navigation & Filter States
  const [activeTab, setActiveTab] = useState<string>("ALL");
  const [search, setSearch] = useState("");

  // Modals & Forms
  const [showAddModuleModal, setShowAddModuleModal] = useState(false);
  const [newModuleName, setNewModuleName] = useState("");
  const [newModuleCode, setNewModuleCode] = useState("");
  const [newModuleCategory, setNewModuleCategory] = useState<"DINING" | "LODGING" | "OPERATIONS" | "INTEGRATION">("DINING");
  const [newModuleDesc, setNewModuleDesc] = useState("");
  const [newStarter, setNewStarter] = useState(false);
  const [newStandard, setNewStandard] = useState(true);
  const [newPro, setNewPro] = useState(true);
  const [newEnterprise, setNewEnterprise] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Property Override State (Right Sidebar)
  const [selectedTenantId, setSelectedTenantId] = useState<string>("");
  const [tenantModules, setTenantModules] = useState<string[]>([]);
  const [isSavingTenant, setIsSavingTenant] = useState(false);

  // Feedback Notification
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const fetchModulesData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/v1/super-admin/modules");
      if (res.ok) {
        const data = await res.json();
        setModules(data.modules || []);
        if (data.kpis) setKpis(data.kpis);
        if (data.categories) setCategories(data.categories);
        if (data.tenants && data.tenants.length > 0) {
          setTenants(data.tenants);
          if (!selectedTenantId) {
            setSelectedTenantId(data.tenants[0].id);
            setTenantModules(data.tenants[0].enabledModules || []);
          }
        }
      } else {
        const err = await res.json().catch(() => ({}));
        setFeedback({ type: "error", message: err.error || "Failed to load modules" });
      }
    } catch {
      setFeedback({ type: "error", message: "Network connection error loading modules." });
    } finally {
      setLoading(false);
    }
  }, [selectedTenantId]);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/auth/login");
    } else if (session?.user && (session.user as any).role !== "SUPER_ADMIN") {
      router.push("/dashboard");
    } else if (status === "authenticated") {
      fetchModulesData();
    }
  }, [status, session, router, fetchModulesData]);

  // Tab & Search Filtering
  const filteredModules = useMemo(() => {
    let list = modules;
    if (activeTab !== "ALL") {
      list = list.filter((m) => m.category === activeTab);
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(
        (m) =>
          m.name.toLowerCase().includes(q) ||
          m.code.toLowerCase().includes(q) ||
          m.description.toLowerCase().includes(q)
      );
    }
    return list;
  }, [modules, activeTab, search]);

  // Toggle Module Global Active Status
  const handleToggleModuleActive = async (module: ModuleItem) => {
    const nextState = !module.isActive;
    try {
      const res = await fetch("/api/v1/super-admin/modules", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "GLOBAL_MATRIX",
          code: module.code,
          updates: { isActive: nextState },
          reason: `${nextState ? "Enabled" : "Disabled"} module ${module.code} globally`,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to toggle module status");

      setModules((prev) =>
        prev.map((m) => (m.code === module.code ? { ...m, isActive: nextState } : m))
      );
      setFeedback({
        type: "success",
        message: `Module '${module.name}' is now ${nextState ? "ACTIVE" : "INACTIVE"}.`,
      });
    } catch (err: any) {
      setFeedback({ type: "error", message: err.message });
    }
  };

  // Toggle Plan Inclusion (Basic, Standard, Pro, Enterprise)
  const handleTogglePlanInclusion = async (
    module: ModuleItem,
    planKey: "starterIncluded" | "standardIncluded" | "proIncluded" | "enterpriseIncluded"
  ) => {
    const nextVal = !module[planKey];
    try {
      const res = await fetch("/api/v1/super-admin/modules", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "GLOBAL_MATRIX",
          code: module.code,
          updates: { [planKey]: nextVal },
          reason: `Toggled ${planKey} to ${nextVal} for ${module.code}`,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update plan inclusion");

      setModules((prev) =>
        prev.map((m) => (m.code === module.code ? { ...m, [planKey]: nextVal } : m))
      );
      setFeedback({
        type: "success",
        message: `Updated tier inclusion for ${module.name}.`,
      });
    } catch (err: any) {
      setFeedback({ type: "error", message: err.message });
    }
  };

  // Handle Add New Module
  const handleAddModule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newModuleName.trim() || !newModuleCode.trim()) {
      setFeedback({ type: "error", message: "Module name and code are required." });
      return;
    }
    setIsSubmitting(true);
    try {
      const res = await fetch("/api/v1/super-admin/modules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newModuleName.trim(),
          code: newModuleCode.trim(),
          category: newModuleCategory,
          description: newModuleDesc.trim() || "Hospitality feature module",
          starter: newStarter,
          standard: newStandard,
          pro: newPro,
          enterprise: newEnterprise,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create module");

      setShowAddModuleModal(false);
      setNewModuleName("");
      setNewModuleCode("");
      setNewModuleDesc("");
      setFeedback({ type: "success", message: `Module '${newModuleName}' created successfully.` });
      fetchModulesData();
    } catch (err: any) {
      setFeedback({ type: "error", message: err.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Tenant Switch in Right Sidebar
  const handleSelectTenant = (tId: string) => {
    setSelectedTenantId(tId);
    const t = tenants.find((item) => item.id === tId);
    if (t) {
      setTenantModules(t.enabledModules || []);
    }
  };

  // Toggle module for selected tenant
  const handleToggleTenantModule = (modCode: string) => {
    setTenantModules((prev) =>
      prev.includes(modCode) ? prev.filter((c) => c !== modCode) : [...prev, modCode]
    );
  };

  // Save Tenant Module Overrides
  const handleSaveTenantOverrides = async () => {
    if (!selectedTenantId) return;
    setIsSavingTenant(true);
    try {
      const res = await fetch("/api/v1/super-admin/modules", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "TENANT_OVERRIDE",
          businessId: selectedTenantId,
          enabledModules: tenantModules,
          reason: "Updated property-specific feature modules",
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save property module overrides");

      setTenants((prev) =>
        prev.map((t) => (t.id === selectedTenantId ? { ...t, enabledModules: tenantModules } : t))
      );
      setFeedback({ type: "success", message: "Property module permissions saved successfully." });
    } catch (err: any) {
      setFeedback({ type: "error", message: err.message });
    } finally {
      setIsSavingTenant(false);
    }
  };

  // Export
  const getExportOptions = (): ExportOptions => ({
    filename: `restroinn-modules-${new Date().toISOString().split("T")[0]}`,
    title: "Platform Modules & Feature Flags Matrix",
    subtitle: "Complete cross-property hospitality feature modules and plan tiers",
    dateRange: activeTab === "ALL" ? "All Platform Modules" : `Category: ${activeTab}`,
    columns: [
      { header: "Module Name", key: "name", width: 25 },
      { header: "Code", key: "code", width: 14 },
      { header: "Category", key: "category", width: 18 },
      { header: "Starter Tier", key: "starter", width: 14 },
      { header: "Standard Tier", key: "standard", width: 14 },
      { header: "Professional Tier", key: "pro", width: 14 },
      { header: "Enterprise Tier", key: "enterprise", width: 14 },
      { header: "Status", key: "status", width: 12 },
    ],
    data: filteredModules.map((m) => ({
      name: m.name,
      code: m.code,
      category: m.category,
      starter: m.starterIncluded ? "Included" : "Excluded",
      standard: m.standardIncluded ? "Included" : "Excluded",
      pro: m.proIncluded ? "Included" : "Excluded",
      enterprise: m.enterpriseIncluded ? "Included" : "Excluded",
      status: m.isActive ? "ACTIVE" : "INACTIVE",
    })),
  });

  return (
    <div className="space-y-5 text-[#292320]">
      {/* 1. Header with Breadcrumbs & Action Tools matching Screenshot */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-[#292320]">Module Control Center</h1>
          <p className="text-xs text-[#71675E] mt-0.5">
            Configure feature flags, set plan availability, and monitor global module usage across all properties.
          </p>
        </div>

        {/* Action Tools */}
        <div className="flex items-center gap-2 flex-wrap w-full lg:w-auto">
          {/* Quick Search */}
          <div className="relative flex-1 sm:w-60">
            <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-[#71675E]" />
            <input
              type="text"
              placeholder="Search modules..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 bg-[#FFFCF7] border border-[#D8CEC1] rounded-md text-xs text-[#292320] placeholder-[#71675E] focus:outline-none focus:ring-1 focus:ring-[#6B2837]"
            />
          </div>

          <ExportDropdown
            getExportOptions={getExportOptions}
            buttonText="Export Data"
            variant="outline"
          />

          <button
            onClick={() => setShowAddModuleModal(true)}
            className="px-3.5 py-1.5 bg-[#6B2837] hover:bg-[#521E2A] text-white rounded-md text-xs font-semibold shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="h-3.5 w-3.5 stroke-[2.5]" />
            <span>+ Add Module</span>
          </button>
        </div>
      </div>

      {/* Feedback Banner */}
      {feedback && (
        <div
          className={`p-3 text-xs rounded-md border flex items-center justify-between ${
            feedback.type === "success"
              ? "bg-emerald-50 text-emerald-800 border-emerald-200"
              : "bg-rose-50 text-rose-800 border-rose-200"
          }`}
        >
          <div className="flex items-center gap-2">
            {feedback.type === "success" ? (
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
            ) : (
              <AlertTriangle className="h-4 w-4 shrink-0 text-rose-600" />
            )}
            <span className="font-medium">{feedback.message}</span>
          </div>
          <button
            onClick={() => setFeedback(null)}
            className="text-slate-400 hover:text-slate-600 p-0.5 rounded cursor-pointer"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* 2. Top 6-KPI Cards Row matching Screenshot */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* Total Modules */}
        <div className="bg-[#FFFCF7] rounded-lg border border-[#D8CEC1]/80 p-3 flex items-center justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-medium text-[#71675E] truncate">Total Modules</p>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span className="text-xl font-bold tracking-tight text-[#292320] tabular-nums">
                {modules.length}
              </span>
              <span className="text-[10px] text-emerald-700 font-medium truncate">Live in DB</span>
            </div>
          </div>
          <div className="h-8 w-8 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center justify-center shrink-0">
            <Boxes className="h-4 w-4" />
          </div>
        </div>

        {/* Active Modules */}
        <div className="bg-[#FFFCF7] rounded-lg border border-[#D8CEC1]/80 p-3 flex items-center justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-medium text-[#71675E] truncate">Active Modules</p>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span className="text-xl font-bold tracking-tight text-[#292320] tabular-nums">
                {modules.filter((m) => m.isActive).length}
              </span>
              <span className="text-[10px] text-emerald-700 font-medium truncate">
                {modules.filter((m) => m.isActive).length}/{modules.length} enabled
              </span>
            </div>
          </div>
          <div className="h-8 w-8 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center justify-center shrink-0">
            <Zap className="h-4 w-4" />
          </div>
        </div>

        {/* Total MRR */}
        <div className="bg-[#FFFCF7] rounded-lg border border-[#D8CEC1]/80 p-3 flex items-center justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-medium text-[#71675E] truncate">Total MRR</p>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span className="text-xl font-bold tracking-tight text-emerald-700 tabular-nums">
                NPR 18.7k
              </span>
              <span className="text-[10px] text-emerald-700 font-medium truncate">↑ 12.3%</span>
            </div>
          </div>
          <div className="h-8 w-8 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center justify-center shrink-0 font-bold text-xs">
            $
          </div>
        </div>

        {/* Avg Usage */}
        <div className="bg-[#FFFCF7] rounded-lg border border-[#D8CEC1]/80 p-3 flex items-center justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-medium text-[#71675E] truncate">Avg Usage</p>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span className="text-xl font-bold tracking-tight text-purple-700 tabular-nums">
                {tenants.length || 3}
              </span>
              <span className="text-[10px] text-[#71675E] truncate">properties / mod</span>
            </div>
          </div>
          <div className="h-8 w-8 rounded-md bg-purple-50 text-purple-700 border border-purple-200 flex items-center justify-center shrink-0">
            <TrendingUp className="h-4 w-4" />
          </div>
        </div>

        {/* Categories */}
        <div className="bg-[#FFFCF7] rounded-lg border border-[#D8CEC1]/80 p-3 flex items-center justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-medium text-[#71675E] truncate">Categories</p>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span className="text-xl font-bold tracking-tight text-amber-700 tabular-nums">
                {categories.length || 4}
              </span>
              <span className="text-[10px] text-[#71675E] truncate">Dining, Hotel, Ops</span>
            </div>
          </div>
          <div className="h-8 w-8 rounded-md bg-amber-50 text-amber-700 border border-amber-200 flex items-center justify-center shrink-0">
            <Layers className="h-4 w-4" />
          </div>
        </div>

        {/* Plan Coverage */}
        <div className="bg-[#FFFCF7] rounded-lg border border-[#D8CEC1]/80 p-3 flex items-center justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-medium text-[#71675E] truncate">Plan Coverage</p>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span className="text-xl font-bold tracking-tight text-blue-700 tabular-nums">
                4
              </span>
              <span className="text-[10px] text-[#71675E] truncate">Starter → Ent</span>
            </div>
          </div>
          <div className="h-8 w-8 rounded-md bg-blue-50 text-blue-700 border border-blue-200 flex items-center justify-center shrink-0">
            <ShieldCheck className="h-4 w-4" />
          </div>
        </div>
      </div>

      {/* 3. Sub-Navigation Tabs matching Screenshot */}
      <div className="flex border-b border-[#D8CEC1] gap-6 text-xs font-semibold overflow-x-auto">
        <button
          onClick={() => setActiveTab("ALL")}
          className={`pb-2.5 border-b-2 whitespace-nowrap cursor-pointer transition-colors ${
            activeTab === "ALL"
              ? "border-[#6B2837] text-[#6B2837]"
              : "border-transparent text-[#71675E] hover:text-[#292320]"
          }`}
        >
          All ({modules.length})
        </button>
        <button
          onClick={() => setActiveTab("DINING")}
          className={`pb-2.5 border-b-2 whitespace-nowrap cursor-pointer transition-colors ${
            activeTab === "DINING"
              ? "border-[#6B2837] text-[#6B2837]"
              : "border-transparent text-[#71675E] hover:text-[#292320]"
          }`}
        >
          Dining & POS ({modules.filter((m) => m.category === "DINING").length})
        </button>
        <button
          onClick={() => setActiveTab("LODGING")}
          className={`pb-2.5 border-b-2 whitespace-nowrap cursor-pointer transition-colors ${
            activeTab === "LODGING"
              ? "border-[#6B2837] text-[#6B2837]"
              : "border-transparent text-[#71675E] hover:text-[#292320]"
          }`}
        >
          Hotel & Lodging ({modules.filter((m) => m.category === "LODGING").length})
        </button>
        <button
          onClick={() => setActiveTab("OPERATIONS")}
          className={`pb-2.5 border-b-2 whitespace-nowrap cursor-pointer transition-colors ${
            activeTab === "OPERATIONS"
              ? "border-[#6B2837] text-[#6B2837]"
              : "border-transparent text-[#71675E] hover:text-[#292320]"
          }`}
        >
          Kitchen & Operations ({modules.filter((m) => m.category === "OPERATIONS").length})
        </button>
        <button
          onClick={() => setActiveTab("INTEGRATION")}
          className={`pb-2.5 border-b-2 whitespace-nowrap cursor-pointer transition-colors ${
            activeTab === "INTEGRATION"
              ? "border-[#6B2837] text-[#6B2837]"
              : "border-transparent text-[#71675E] hover:text-[#292320]"
          }`}
        >
          Integrations & Fiscal ({modules.filter((m) => m.category === "INTEGRATION").length})
        </button>
      </div>

      {/* 4. Split Layout: Main 3-Column Cards Grid + Right Sidebar */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-5">
        {/* Main 3-Column Grid Area (75% on Desktop) */}
        <div className="lg:col-span-3 space-y-4">
          {loading ? (
            <div className="p-12 text-center space-y-3 bg-[#FFFCF7] border border-[#D8CEC1]/80 rounded-lg">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#6B2837] border-t-transparent mx-auto" />
              <p className="text-xs text-[#71675E]">Loading platform module matrix...</p>
            </div>
          ) : filteredModules.length === 0 ? (
            <div className="p-12 text-center space-y-2 bg-[#FFFCF7] border border-[#D8CEC1]/80 rounded-lg">
              <Boxes className="h-8 w-8 text-[#71675E] mx-auto opacity-50" />
              <p className="text-xs font-semibold text-[#292320]">No modules found</p>
              <p className="text-[11px] text-[#71675E]">No modules matched your criteria in this category.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {filteredModules.map((mod) => {
                const IconComponent = ICON_MAP[mod.iconName] || Boxes;
                return (
                  <div
                    key={mod.id}
                    className={`bg-[#FFFCF7] rounded-lg border p-4 flex flex-col justify-between transition-all ${
                      mod.isActive
                        ? "border-[#D8CEC1]/80 hover:border-[#6B2837]/60 shadow-2xs"
                        : "border-[#D8CEC1]/40 bg-[#F7F3EC]/30 opacity-70"
                    }`}
                  >
                    <div>
                      {/* Top Row: Icon + Name + Category + Toggle Switch */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-start gap-2.5 min-w-0">
                          <div className="p-2 rounded-md bg-[#F7F3EC] text-[#6B2837] border border-[#D8CEC1] shrink-0 mt-0.5">
                            <IconComponent className="h-4 w-4" />
                          </div>
                          <div className="min-w-0">
                            <h3 className="text-xs font-bold text-[#292320] leading-tight truncate">
                              {mod.name}
                            </h3>
                            <p className="text-[10px] text-[#71675E] mt-0.5 flex items-center gap-1 font-medium">
                              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                              <span>
                                {mod.category === "DINING"
                                  ? "Dining & POS"
                                  : mod.category === "LODGING"
                                  ? "Hotel & Lodging"
                                  : mod.category === "OPERATIONS"
                                  ? "Operations"
                                  : "Integration"}
                              </span>
                            </p>
                          </div>
                        </div>

                        {/* Minimal Toggle Switch */}
                        <button
                          type="button"
                          onClick={() => handleToggleModuleActive(mod)}
                          title={mod.isActive ? "Disable module globally" : "Enable module globally"}
                          className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                            mod.isActive ? "bg-emerald-600" : "bg-[#D8CEC1]"
                          }`}
                        >
                          <span
                            className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-xs ring-0 transition duration-200 ease-in-out ${
                              mod.isActive ? "translate-x-4" : "translate-x-0"
                            }`}
                          />
                        </button>
                      </div>

                      {/* Description */}
                      <p className="text-[11px] text-[#71675E] mt-2.5 line-clamp-2 min-h-[32px] leading-relaxed">
                        {mod.description}
                      </p>
                    </div>

                    {/* Bottom Row: Plan Badges + Status Tag */}
                    <div className="mt-4 pt-3 border-t border-[#D8CEC1]/60 flex items-center justify-between gap-1">
                      {/* Interactive Plan Badges */}
                      <div className="flex items-center gap-1 flex-wrap">
                        <button
                          type="button"
                          onClick={() => handleTogglePlanInclusion(mod, "starterIncluded")}
                          title={`Toggle Starter tier (${mod.starterIncluded ? "Included" : "Excluded"})`}
                          className={`px-1.5 py-0.5 rounded text-[9px] font-bold tracking-tight border transition-colors cursor-pointer ${
                            mod.starterIncluded
                              ? "bg-emerald-50 text-emerald-800 border-emerald-300"
                              : "bg-[#F7F3EC] text-[#71675E] border-transparent opacity-50"
                          }`}
                        >
                          Basic
                        </button>

                        <button
                          type="button"
                          onClick={() => handleTogglePlanInclusion(mod, "standardIncluded")}
                          title={`Toggle Standard tier (${mod.standardIncluded ? "Included" : "Excluded"})`}
                          className={`px-1.5 py-0.5 rounded text-[9px] font-bold tracking-tight border transition-colors cursor-pointer ${
                            mod.standardIncluded
                              ? "bg-blue-50 text-blue-800 border-blue-300"
                              : "bg-[#F7F3EC] text-[#71675E] border-transparent opacity-50"
                          }`}
                        >
                          Standard
                        </button>

                        <button
                          type="button"
                          onClick={() => handleTogglePlanInclusion(mod, "proIncluded")}
                          title={`Toggle Professional tier (${mod.proIncluded ? "Included" : "Excluded"})`}
                          className={`px-1.5 py-0.5 rounded text-[9px] font-bold tracking-tight border transition-colors cursor-pointer ${
                            mod.proIncluded
                              ? "bg-[#FAF2F4] text-[#6B2837] border-[#E8D7DA]"
                              : "bg-[#F7F3EC] text-[#71675E] border-transparent opacity-50"
                          }`}
                        >
                          Pro
                        </button>

                        <button
                          type="button"
                          onClick={() => handleTogglePlanInclusion(mod, "enterpriseIncluded")}
                          title={`Toggle Enterprise tier (${mod.enterpriseIncluded ? "Included" : "Excluded"})`}
                          className={`px-1.5 py-0.5 rounded text-[9px] font-bold tracking-tight border transition-colors cursor-pointer ${
                            mod.enterpriseIncluded
                              ? "bg-amber-50 text-amber-800 border-amber-300"
                              : "bg-[#F7F3EC] text-[#71675E] border-transparent opacity-50"
                          }`}
                        >
                          Enterprise
                        </button>
                      </div>

                      {/* Active Status Pill */}
                      <span
                        className={`text-[10px] font-bold uppercase tracking-wider shrink-0 ${
                          mod.isActive ? "text-emerald-700" : "text-[#71675E]"
                        }`}
                      >
                        {mod.isActive ? "ACTIVE" : "INACTIVE"}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Sidebar Column (25% on Desktop) */}
        <div className="space-y-4">
          {/* Card 1: Categories matching Screenshot */}
          <div className="bg-[#FFFCF7] border border-[#D8CEC1]/80 rounded-lg p-4 space-y-3">
            <h3 className="text-xs font-bold text-[#292320]">Categories</h3>
            <div className="space-y-2 text-xs">
              {categories.map((cat) => (
                <button
                  key={cat.code}
                  onClick={() => setActiveTab(cat.code)}
                  className={`w-full flex items-center justify-between text-left py-1 px-1.5 rounded transition-colors cursor-pointer ${
                    activeTab === cat.code
                      ? "bg-[#FAF2F4] text-[#6B2837] font-bold"
                      : "text-[#71675E] hover:text-[#292320] hover:bg-[#F7F3EC]"
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <span
                      className={`h-1.5 w-1.5 rounded-full ${
                        activeTab === cat.code ? "bg-[#6B2837]" : "bg-[#71675E]"
                      }`}
                    />
                    <span>{cat.name}</span>
                  </span>
                  <span className="text-[11px] tabular-nums font-semibold opacity-75">{cat.count}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Card 2: Module Notice matching Screenshot */}
          <div className="bg-[#FFFDF5] border border-amber-200/80 rounded-lg p-3.5 space-y-2 text-xs">
            <div className="flex items-center gap-1.5 font-bold text-amber-900 text-xs">
              <AlertTriangle className="h-3.5 w-3.5 text-amber-600 shrink-0" />
              <span>Module Notice</span>
            </div>
            <p className="text-[11px] text-amber-800 leading-relaxed">
              Disabling a module globally will immediately remove it from all restaurant and hotel menus. Click a plan badge to toggle its default inclusion.
            </p>
          </div>

          {/* Card 3: Property Feature Overrides Gatekeeper */}
          <div className="bg-[#FFFCF7] border border-[#D8CEC1]/80 rounded-lg p-4 space-y-3 text-xs">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-[#292320]">Property Overrides</h3>
              <span className="text-[10px] text-[#71675E] font-medium">Tenant Gate</span>
            </div>
            <p className="text-[11px] text-[#71675E]">
              Customize granted modules for an individual property regardless of plan limits.
            </p>

            <select
              value={selectedTenantId}
              onChange={(e) => handleSelectTenant(e.target.value)}
              className="w-full p-2 bg-[#F7F3EC] border border-[#D8CEC1] rounded-md text-xs text-[#292320] cursor-pointer"
            >
              {tenants.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} ({t.plan})
                </option>
              ))}
            </select>

            {/* Checklist of modules for selected tenant */}
            <div className="max-h-52 overflow-y-auto space-y-1.5 pt-1 border-t border-[#D8CEC1]/60">
              {modules.map((m) => {
                const isEnabled = tenantModules.includes(m.code);
                return (
                  <label
                    key={m.code}
                    className="flex items-center justify-between p-1.5 rounded hover:bg-[#F7F3EC] text-xs cursor-pointer select-none"
                  >
                    <span className="text-[#292320] truncate font-medium">{m.name}</span>
                    <input
                      type="checkbox"
                      checked={isEnabled}
                      onChange={() => handleToggleTenantModule(m.code)}
                      className="rounded border-[#D8CEC1] text-[#6B2837] focus:ring-[#6B2837] cursor-pointer"
                    />
                  </label>
                );
              })}
            </div>

            <button
              onClick={handleSaveTenantOverrides}
              disabled={isSavingTenant}
              className="w-full py-2 bg-[#6B2837] hover:bg-[#521E2A] text-white rounded-md text-xs font-semibold shadow-xs transition-colors cursor-pointer text-center disabled:opacity-50"
            >
              {isSavingTenant ? "Saving..." : "Save Property Overrides"}
            </button>
          </div>
        </div>
      </div>

      {/* MODAL: Add New Module */}
      {showAddModuleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-[#FFFCF7] border border-[#D8CEC1] rounded-lg max-w-md w-full p-5 space-y-4 shadow-md text-[#292320]">
            <div className="flex justify-between items-start border-b border-[#D8CEC1] pb-3">
              <div>
                <h3 className="text-sm font-bold text-[#292320]">Create New Feature Module</h3>
                <p className="text-xs text-[#71675E] mt-0.5">Register a new capability in the platform catalog.</p>
              </div>
              <button
                onClick={() => setShowAddModuleModal(false)}
                className="text-[#71675E] hover:text-[#292320] p-1 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleAddModule} className="space-y-3">
              <div>
                <label className="block text-[11px] font-semibold text-[#71675E] uppercase mb-1">
                  Module Name <span className="text-rose-600">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Valet Parking & Luggage Dispatch"
                  value={newModuleName}
                  onChange={(e) => setNewModuleName(e.target.value)}
                  className="w-full p-2 bg-[#F7F3EC] border border-[#D8CEC1] rounded-md text-xs text-[#292320]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-[#71675E] uppercase mb-1">
                    System Code <span className="text-rose-600">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="VALET_OPS"
                    value={newModuleCode}
                    onChange={(e) => setNewModuleCode(e.target.value)}
                    className="w-full p-2 bg-[#F7F3EC] border border-[#D8CEC1] rounded-md text-xs text-[#292320] font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-[#71675E] uppercase mb-1">
                    Category
                  </label>
                  <select
                    value={newModuleCategory}
                    onChange={(e: any) => setNewModuleCategory(e.target.value)}
                    className="w-full p-2 bg-[#F7F3EC] border border-[#D8CEC1] rounded-md text-xs text-[#292320]"
                  >
                    <option value="DINING">Dining & POS</option>
                    <option value="LODGING">Hotel & Lodging</option>
                    <option value="OPERATIONS">Operations & Kitchen</option>
                    <option value="INTEGRATION">Integrations & Fiscal</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-[#71675E] uppercase mb-1">
                  Description
                </label>
                <textarea
                  rows={2}
                  placeholder="Describe module functionality and operations role..."
                  value={newModuleDesc}
                  onChange={(e) => setNewModuleDesc(e.target.value)}
                  className="w-full p-2 bg-[#F7F3EC] border border-[#D8CEC1] rounded-md text-xs text-[#292320]"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-[#71675E] uppercase mb-2">
                  Default Plan Inclusions
                </label>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <label className="flex items-center gap-2 p-1.5 bg-[#F7F3EC] rounded cursor-pointer">
                    <input
                      type="checkbox"
                      checked={newStarter}
                      onChange={(e) => setNewStarter(e.target.checked)}
                      className="rounded text-[#6B2837]"
                    />
                    <span>Basic (Starter)</span>
                  </label>
                  <label className="flex items-center gap-2 p-1.5 bg-[#F7F3EC] rounded cursor-pointer">
                    <input
                      type="checkbox"
                      checked={newStandard}
                      onChange={(e) => setNewStandard(e.target.checked)}
                      className="rounded text-[#6B2837]"
                    />
                    <span>Standard</span>
                  </label>
                  <label className="flex items-center gap-2 p-1.5 bg-[#F7F3EC] rounded cursor-pointer">
                    <input
                      type="checkbox"
                      checked={newPro}
                      onChange={(e) => setNewPro(e.target.checked)}
                      className="rounded text-[#6B2837]"
                    />
                    <span>Professional</span>
                  </label>
                  <label className="flex items-center gap-2 p-1.5 bg-[#F7F3EC] rounded cursor-pointer">
                    <input
                      type="checkbox"
                      checked={newEnterprise}
                      onChange={(e) => setNewEnterprise(e.target.checked)}
                      className="rounded text-[#6B2837]"
                    />
                    <span>Enterprise</span>
                  </label>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-[#D8CEC1]">
                <button
                  type="button"
                  onClick={() => setShowAddModuleModal(false)}
                  className="px-3 py-1.5 border border-[#D8CEC1] text-xs font-semibold rounded-md hover:bg-[#F7F3EC] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-1.5 bg-[#6B2837] text-white text-xs font-semibold rounded-md hover:bg-[#521E2A] disabled:opacity-50 cursor-pointer"
                >
                  {isSubmitting ? "Registering..." : "Register Module"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
