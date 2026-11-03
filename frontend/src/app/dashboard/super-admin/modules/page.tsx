"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Boxes,
  Zap,
  Layers,
  Search,
  Plus,
  X,
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
  SlidersHorizontal,
} from "lucide-react";
import { toast } from "@/components/toast";
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
        toast.error(err.error || "Failed to load modules");
      }
    } catch {
      toast.error("Network connection error loading modules.");
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
      toast.success(`Module '${module.name}' is now ${nextState ? "ACTIVE" : "INACTIVE"}.`);
    } catch (err: any) {
      toast.error(err.message);
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
      toast.success(`Updated tier inclusion for ${module.name}.`);
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  // Handle Add New Module
  const handleAddModule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newModuleName.trim() || !newModuleCode.trim()) {
      toast.error("Module name and code are required.");
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
      toast.success(`Module '${newModuleName}' created successfully.`);
      fetchModulesData();
    } catch (err: any) {
      toast.error(err.message);
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
      toast.success("Property module permissions saved successfully.");
    } catch (err: any) {
      toast.error(err.message);
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
    <div
      className="min-h-full bg-[#F7F3EC] text-[#292320]"
      style={{
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", "SF Pro", "San Francisco", "Helvetica Neue", Helvetica, Arial, sans-serif',
      }}
    >
      <div className="max-w-[1400px] mx-auto space-y-2">
        {/* 1. Header Block: Breadcrumb & Title grouped tightly */}
        <div className="space-y-0.5">
          <div className="flex items-center gap-1.5 text-xs text-[#71675E] font-normal leading-none">
            <Link href="/dashboard/super-admin" className="hover:text-[#292320]">
              Platform
            </Link>
            <span>/</span>
            <span className="text-[#292320]">Modules &amp; Feature Matrix</span>
          </div>

          <div className="flex items-center justify-between pt-0.5">
            <h1 className="text-xl font-bold tracking-tight text-[#292320] leading-tight">
              Module Control Center
            </h1>

            <div className="flex items-center gap-2">
              <button
                onClick={fetchModulesData}
                disabled={loading}
                className="px-3 py-1 bg-[#FFFCF7] border border-[#D8CEC1] text-[#292320] text-xs font-medium rounded hover:bg-[#EEE7DD] transition-colors cursor-pointer disabled:opacity-50"
              >
                {loading ? "Refreshing..." : "Refresh"}
              </button>

              <ExportDropdown
                getExportOptions={getExportOptions}
                buttonText="Export Matrix"
                className="!text-xs !py-1 !px-3"
              />

              <button
                onClick={() => setShowAddModuleModal(true)}
                className="px-3.5 py-1 bg-[#6B2837] hover:bg-[#521E2A] text-white text-xs font-medium rounded shadow-xs transition-colors flex items-center gap-1 cursor-pointer"
              >
                <Plus className="h-3 w-3 stroke-[2.5]" />
                <span>Add Module</span>
              </button>
            </div>
          </div>
        </div>

        {/* 2. Top Metric Bar (4-Column Connected Strip with compact <= 7px padding) */}
        <div className="bg-[#FFFCF7] border border-[#D8CEC1] rounded-lg grid grid-cols-2 md:grid-cols-4 divide-y md:divide-y-0 md:divide-x divide-[#D8CEC1]">
          {/* Total Modules */}
          <div className="px-3.5 py-1.5">
            <div className="text-xs text-[#71675E] leading-none">Total modules</div>
            <div className="flex items-baseline gap-1.5 mt-1">
              <span className="text-lg font-bold text-[#292320] tabular-nums leading-none">
                {modules.length}
              </span>
              <span className="text-[11px] font-medium text-[#057A55] leading-none">Catalog Live</span>
            </div>
          </div>

          {/* Active Modules */}
          <div className="px-3.5 py-1.5">
            <div className="text-xs text-[#71675E] leading-none">Active modules</div>
            <div className="flex items-baseline gap-1.5 mt-1">
              <span className="text-lg font-bold text-[#292320] tabular-nums leading-none">
                {modules.filter((m) => m.isActive).length}
              </span>
              <span className="text-[11px] text-[#71675E] leading-none">
                {modules.filter((m) => !m.isActive).length} disabled
              </span>
            </div>
          </div>

          {/* Module Categories */}
          <div className="px-3.5 py-1.5">
            <div className="text-xs text-[#71675E] leading-none">Categories</div>
            <div className="flex items-baseline gap-1.5 mt-1">
              <span className="text-lg font-bold text-[#292320] tabular-nums leading-none">
                {categories.length || 4}
              </span>
              <span className="text-[11px] text-[#71675E] leading-none">Dining, Hotel, Ops</span>
            </div>
          </div>

          {/* Plan Coverage */}
          <div className="px-3.5 py-1.5">
            <div className="text-xs text-[#71675E] leading-none">Plan coverage</div>
            <div className="flex items-baseline gap-1.5 mt-1">
              <span className="text-lg font-bold text-[#292320] tabular-nums leading-none">
                4 Tiers
              </span>
              <span className="text-[11px] text-[#71675E] leading-none">Starter → Ent</span>
            </div>
          </div>
        </div>

        {/* 3. Filter Bar & Category Tabs */}
        <div className="bg-[#FFFCF7] border border-[#D8CEC1] rounded-lg p-2 flex flex-col sm:flex-row items-center justify-between gap-2">
          {/* Category Tabs */}
          <div className="flex items-center gap-1 overflow-x-auto w-full sm:w-auto">
            <button
              onClick={() => setActiveTab("ALL")}
              className={`px-2.5 py-1 text-xs font-semibold rounded whitespace-nowrap transition-colors cursor-pointer ${
                activeTab === "ALL"
                  ? "bg-[#6B2837] text-white"
                  : "bg-[#FFFCF7] border border-[#D8CEC1] text-[#292320] hover:bg-[#EEE7DD]"
              }`}
            >
              All ({modules.length})
            </button>
            <button
              onClick={() => setActiveTab("DINING")}
              className={`px-2.5 py-1 text-xs font-semibold rounded whitespace-nowrap transition-colors cursor-pointer ${
                activeTab === "DINING"
                  ? "bg-[#6B2837] text-white"
                  : "bg-[#FFFCF7] border border-[#D8CEC1] text-[#292320] hover:bg-[#EEE7DD]"
              }`}
            >
              Dining &amp; POS ({modules.filter((m) => m.category === "DINING").length})
            </button>
            <button
              onClick={() => setActiveTab("LODGING")}
              className={`px-2.5 py-1 text-xs font-semibold rounded whitespace-nowrap transition-colors cursor-pointer ${
                activeTab === "LODGING"
                  ? "bg-[#6B2837] text-white"
                  : "bg-[#FFFCF7] border border-[#D8CEC1] text-[#292320] hover:bg-[#EEE7DD]"
              }`}
            >
              Hotel &amp; Rooms ({modules.filter((m) => m.category === "LODGING").length})
            </button>
            <button
              onClick={() => setActiveTab("OPERATIONS")}
              className={`px-2.5 py-1 text-xs font-semibold rounded whitespace-nowrap transition-colors cursor-pointer ${
                activeTab === "OPERATIONS"
                  ? "bg-[#6B2837] text-white"
                  : "bg-[#FFFCF7] border border-[#D8CEC1] text-[#292320] hover:bg-[#EEE7DD]"
              }`}
            >
              Kitchen &amp; Ops ({modules.filter((m) => m.category === "OPERATIONS").length})
            </button>
            <button
              onClick={() => setActiveTab("INTEGRATION")}
              className={`px-2.5 py-1 text-xs font-semibold rounded whitespace-nowrap transition-colors cursor-pointer ${
                activeTab === "INTEGRATION"
                  ? "bg-[#6B2837] text-white"
                  : "bg-[#FFFCF7] border border-[#D8CEC1] text-[#292320] hover:bg-[#EEE7DD]"
              }`}
            >
              Fiscal &amp; IRD ({modules.filter((m) => m.category === "INTEGRATION").length})
            </button>
          </div>

          {/* Search Input */}
          <div className="w-full sm:w-auto">
            <input
              type="text"
              placeholder="Search module name or code..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="px-2.5 py-1 border border-[#D8CEC1] rounded text-xs bg-[#FFFCF7] text-[#292320] focus:outline-none focus:border-[#6B2837] w-full sm:w-56"
            />
          </div>
        </div>

        {/* 4. Split Layout: Modules Matrix (Left) + Property Overrides (Right) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-2">
          {/* Main Modules Matrix Area (Left 9 cols) */}
          <div className="lg:col-span-8 xl:col-span-9">
            {loading ? (
              <div className="p-8 text-center bg-[#FFFCF7] border border-[#D8CEC1] rounded-lg text-xs text-[#71675E]">
                Loading platform modules...
              </div>
            ) : filteredModules.length === 0 ? (
              <div className="p-8 text-center bg-[#FFFCF7] border border-[#D8CEC1] rounded-lg text-xs text-[#71675E]">
                No modules match the selected filter.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2">
                {filteredModules.map((mod) => {
                  const IconComponent = ICON_MAP[mod.iconName] || Boxes;
                  return (
                    <div
                      key={mod.id}
                      className={`bg-[#FFFCF7] rounded-lg border p-2.5 flex flex-col justify-between transition-colors ${
                        mod.isActive
                          ? "border-[#D8CEC1] hover:border-[#6B2837]"
                          : "border-[#D8CEC1]/60 opacity-60 bg-[#F7F3EC]/50"
                      }`}
                    >
                      <div>
                        {/* Top Row: Icon + Name + Category + Toggle Switch */}
                        <div className="flex items-start justify-between gap-1.5">
                          <div className="flex items-start gap-2 min-w-0">
                            <div className="p-1.5 rounded bg-[#F7F3EC] text-[#6B2837] border border-[#D8CEC1] shrink-0 mt-0.5">
                              <IconComponent className="h-3.5 w-3.5" />
                            </div>
                            <div className="min-w-0">
                              <h3 className="text-xs font-semibold text-[#292320] leading-tight truncate">
                                {mod.name}
                              </h3>
                              <span className="text-[10px] text-[#71675E] font-mono leading-none">
                                {mod.code}
                              </span>
                            </div>
                          </div>

                          {/* Minimal Toggle Switch */}
                          <button
                            type="button"
                            onClick={() => handleToggleModuleActive(mod)}
                            title={mod.isActive ? "Disable globally" : "Enable globally"}
                            className={`relative inline-flex h-4 w-7 shrink-0 cursor-pointer rounded-full border border-transparent transition-colors duration-150 ease-in-out ${
                              mod.isActive ? "bg-[#057A55]" : "bg-[#D8CEC1]"
                            }`}
                          >
                            <span
                              className={`pointer-events-none inline-block h-3 w-3 transform rounded-full bg-white shadow-xs transition duration-150 ease-in-out ${
                                mod.isActive ? "translate-x-3" : "translate-x-0"
                              }`}
                            />
                          </button>
                        </div>

                        {/* Description */}
                        <p className="text-[11px] text-[#71675E] mt-1.5 line-clamp-2 leading-relaxed">
                          {mod.description}
                        </p>
                      </div>

                      {/* Bottom Row: Plan Badges */}
                      <div className="mt-2.5 pt-2 border-t border-[#D8CEC1] flex items-center justify-between">
                        <div className="flex items-center gap-1 flex-wrap">
                          <button
                            type="button"
                            onClick={() => handleTogglePlanInclusion(mod, "starterIncluded")}
                            title={`Toggle Starter tier (${mod.starterIncluded ? "Included" : "Excluded"})`}
                            className={`px-1.5 py-0.2 rounded text-[9px] font-semibold border transition-colors cursor-pointer ${
                              mod.starterIncluded
                                ? "bg-[#DEF7EC] text-[#03543F] border-[#BCF0DA]"
                                : "bg-[#F7F3EC] text-[#71675E] border-[#D8CEC1] opacity-50"
                            }`}
                          >
                            Starter
                          </button>

                          <button
                            type="button"
                            onClick={() => handleTogglePlanInclusion(mod, "standardIncluded")}
                            title={`Toggle Standard tier (${mod.standardIncluded ? "Included" : "Excluded"})`}
                            className={`px-1.5 py-0.2 rounded text-[9px] font-semibold border transition-colors cursor-pointer ${
                              mod.standardIncluded
                                ? "bg-[#DEF7EC] text-[#03543F] border-[#BCF0DA]"
                                : "bg-[#F7F3EC] text-[#71675E] border-[#D8CEC1] opacity-50"
                            }`}
                          >
                            Standard
                          </button>

                          <button
                            type="button"
                            onClick={() => handleTogglePlanInclusion(mod, "proIncluded")}
                            title={`Toggle Professional tier (${mod.proIncluded ? "Included" : "Excluded"})`}
                            className={`px-1.5 py-0.2 rounded text-[9px] font-semibold border transition-colors cursor-pointer ${
                              mod.proIncluded
                                ? "bg-[#FAF2F4] text-[#6B2837] border-[#E8D7DA]"
                                : "bg-[#F7F3EC] text-[#71675E] border-[#D8CEC1] opacity-50"
                            }`}
                          >
                            Pro
                          </button>

                          <button
                            type="button"
                            onClick={() => handleTogglePlanInclusion(mod, "enterpriseIncluded")}
                            title={`Toggle Enterprise tier (${mod.enterpriseIncluded ? "Included" : "Excluded"})`}
                            className={`px-1.5 py-0.2 rounded text-[9px] font-semibold border transition-colors cursor-pointer ${
                              mod.enterpriseIncluded
                                ? "bg-[#DEF7EC] text-[#03543F] border-[#BCF0DA]"
                                : "bg-[#F7F3EC] text-[#71675E] border-[#D8CEC1] opacity-50"
                            }`}
                          >
                            Ent
                          </button>
                        </div>

                        <span
                          className={`text-[9px] font-bold uppercase tracking-wider shrink-0 ${
                            mod.isActive ? "text-[#057A55]" : "text-[#71675E]"
                          }`}
                        >
                          {mod.isActive ? "ACTIVE" : "OFF"}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Right Sidebar: Property Feature Overrides Gatekeeper (Right 3 cols) */}
          <div className="lg:col-span-4 xl:col-span-3 space-y-2">
            <div className="bg-[#FFFCF7] border border-[#D8CEC1] rounded-lg p-3 space-y-2 text-xs">
              <div className="flex items-center justify-between pb-1.5 border-b border-[#D8CEC1]">
                <h3 className="text-xs font-bold text-[#292320]">Property Overrides</h3>
                <span className="text-[10px] text-[#71675E]">Tenant Gate</span>
              </div>

              <p className="text-[11px] text-[#71675E] leading-relaxed">
                Grant or revoke specific feature flags for a property regardless of default plan limits.
              </p>

              <div>
                <label className="block text-[10px] uppercase font-semibold text-[#71675E] mb-1">
                  Target Business
                </label>
                <select
                  value={selectedTenantId}
                  onChange={(e) => handleSelectTenant(e.target.value)}
                  className="w-full px-2 py-1 bg-[#FFFCF7] border border-[#D8CEC1] rounded text-xs text-[#292320] focus:outline-none"
                >
                  {tenants.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({t.plan})
                    </option>
                  ))}
                </select>
              </div>

              {/* Checklist of modules for selected tenant */}
              <div className="max-h-64 overflow-y-auto space-y-1 pt-1.5 border-t border-[#D8CEC1]">
                {modules.map((m) => {
                  const isEnabled = tenantModules.includes(m.code);
                  return (
                    <label
                      key={m.code}
                      className="flex items-center justify-between p-1 rounded hover:bg-[#F7F3EC] text-xs cursor-pointer select-none"
                    >
                      <span className="text-[#292320] truncate font-medium text-[11px]">
                        {m.name}
                      </span>
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
                className="w-full py-1.5 bg-[#6B2837] hover:bg-[#521E2A] text-white rounded text-xs font-semibold shadow-xs transition-colors cursor-pointer text-center disabled:opacity-50"
              >
                {isSavingTenant ? "Saving..." : "Save Property Overrides"}
              </button>
            </div>
          </div>
        </div>

        {/* MODAL: Add New Module */}
        {showAddModuleModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="bg-[#FFFCF7] border border-[#D8CEC1] rounded-lg max-w-md w-full p-4 space-y-3 shadow-md text-[#292320]">
              <div className="flex justify-between items-start border-b border-[#D8CEC1] pb-2">
                <div>
                  <h3 className="text-sm font-bold text-[#292320]">Create New Feature Module</h3>
                  <p className="text-xs text-[#71675E]">Register a new capability in the platform catalog.</p>
                </div>
                <button
                  onClick={() => setShowAddModuleModal(false)}
                  className="text-[#71675E] hover:text-[#292320] p-1 cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <form onSubmit={handleAddModule} className="space-y-2.5 text-xs">
                <div>
                  <label className="block text-[11px] font-semibold text-[#71675E] uppercase mb-1">
                    Module Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Valet Parking & Luggage Dispatch"
                    value={newModuleName}
                    onChange={(e) => setNewModuleName(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-[#FFFCF7] border border-[#D8CEC1] rounded text-xs text-[#292320] focus:outline-none focus:border-[#6B2837]"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] font-semibold text-[#71675E] uppercase mb-1">
                      System Code *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="VALET_OPS"
                      value={newModuleCode}
                      onChange={(e) => setNewModuleCode(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-[#FFFCF7] border border-[#D8CEC1] rounded text-xs text-[#292320] font-mono focus:outline-none focus:border-[#6B2837]"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-[#71675E] uppercase mb-1">
                      Category
                    </label>
                    <select
                      value={newModuleCategory}
                      onChange={(e: any) => setNewModuleCategory(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-[#FFFCF7] border border-[#D8CEC1] rounded text-xs text-[#292320] focus:outline-none"
                    >
                      <option value="DINING">Dining &amp; POS</option>
                      <option value="LODGING">Hotel &amp; Lodging</option>
                      <option value="OPERATIONS">Operations &amp; Kitchen</option>
                      <option value="INTEGRATION">Integrations &amp; Fiscal</option>
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
                    className="w-full px-2.5 py-1.5 bg-[#FFFCF7] border border-[#D8CEC1] rounded text-xs text-[#292320] focus:outline-none focus:border-[#6B2837]"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-[#71675E] uppercase mb-1.5">
                    Default Plan Inclusions
                  </label>
                  <div className="grid grid-cols-2 gap-1.5 text-xs">
                    <label className="flex items-center gap-2 p-1.5 bg-[#F7F3EC] rounded border border-[#D8CEC1] cursor-pointer">
                      <input
                        type="checkbox"
                        checked={newStarter}
                        onChange={(e) => setNewStarter(e.target.checked)}
                        className="rounded text-[#6B2837]"
                      />
                      <span>Starter</span>
                    </label>
                    <label className="flex items-center gap-2 p-1.5 bg-[#F7F3EC] rounded border border-[#D8CEC1] cursor-pointer">
                      <input
                        type="checkbox"
                        checked={newStandard}
                        onChange={(e) => setNewStandard(e.target.checked)}
                        className="rounded text-[#6B2837]"
                      />
                      <span>Standard</span>
                    </label>
                    <label className="flex items-center gap-2 p-1.5 bg-[#F7F3EC] rounded border border-[#D8CEC1] cursor-pointer">
                      <input
                        type="checkbox"
                        checked={newPro}
                        onChange={(e) => setNewPro(e.target.checked)}
                        className="rounded text-[#6B2837]"
                      />
                      <span>Professional</span>
                    </label>
                    <label className="flex items-center gap-2 p-1.5 bg-[#F7F3EC] rounded border border-[#D8CEC1] cursor-pointer">
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
                    className="px-3 py-1 border border-[#D8CEC1] text-xs font-semibold rounded hover:bg-[#F7F3EC] cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-4 py-1 bg-[#6B2837] text-white text-xs font-semibold rounded hover:bg-[#521E2A] disabled:opacity-50 cursor-pointer"
                  >
                    {isSubmitting ? "Registering..." : "Register Module"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
