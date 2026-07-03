"use client";

import React, { useState, useEffect } from "react";
import { Plus, Edit, Trash2, Loader2, Layers, Tag, Ruler, AlertTriangle, Info } from "lucide-react";

type Category = { id: string; name: string; _count?: { products: number } };
type Subcategory = { id: string; name: string; categoryId: string; category?: { id: string; name: string }; _count?: { products: number } };
type Unit = { id: string; name: string };

export default function CategoriesClient() {
  const [activeTab, setActiveTab] = useState<"categories" | "subcategories" | "units">("categories");

  const [categories, setCategories] = useState<Category[]>([]);
  const [subcategories, setSubcategories] = useState<Subcategory[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formName, setFormName] = useState("");
  const [formCategoryId, setFormCategoryId] = useState("");

  // Custom Alert / Confirm popup state
  interface AlertModalState {
    open: boolean;
    title: string;
    message: string;
    type: "info" | "error" | "confirm";
    onConfirm?: () => void | Promise<void>;
  }
  const [alertModal, setAlertModal] = useState<AlertModalState>({
    open: false,
    title: "",
    message: "",
    type: "info",
  });
  const [alertModalLoading, setAlertModalLoading] = useState(false);

  const showAlert = (title: string, message: string, type: "info" | "error" = "info") => {
    setAlertModal({
      open: true,
      title,
      message,
      type,
    });
  };

  const showConfirm = (title: string, message: string, onConfirm: () => void) => {
    setAlertModal({
      open: true,
      title,
      message,
      type: "confirm",
      onConfirm,
    });
  };

  useEffect(() => {
    fetchData();
  }, [activeTab]);

  const fetchData = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/v1/${activeTab}`);
      if (!res.ok) throw new Error("Failed to fetch data");
      const data = await res.json();
      if (activeTab === "categories") setCategories(data);
      else if (activeTab === "subcategories") {
        setSubcategories(data);
        // Also fetch categories so user can assign parent category in modal
        const catRes = await fetch("/api/v1/categories");
        if (catRes.ok) {
          const catData = await catRes.json();
          setCategories(catData);
        }
      }
      else setUnits(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const openModal = (id?: string, name?: string, categoryId?: string) => {
    setEditingId(id || null);
    setFormName(name || "");
    setFormCategoryId(categoryId || (categories.length > 0 ? categories[0].id : ""));
    setIsModalOpen(true);
    setError("");
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingId(null);
    setFormName("");
    setFormCategoryId("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) {
      setError("Name is required");
      return;
    }
    if (activeTab === "subcategories" && !formCategoryId) {
      setError("Parent Category is required");
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      const url = editingId 
        ? `/api/v1/${activeTab}/${editingId}` 
        : `/api/v1/${activeTab}`;
      
      const method = editingId ? "PUT" : "POST";

      const bodyData: any = { name: formName };
      if (activeTab === "subcategories") {
        bodyData.categoryId = formCategoryId;
      }

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bodyData),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to save");
      }

      await fetchData();
      closeModal();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    const label = activeTab === "categories" ? "category" : activeTab === "subcategories" ? "subcategory" : "unit";
    showConfirm(
      "Confirm Delete",
      `Are you sure you want to permanently delete this ${label}? This action cannot be undone.`,
      async () => {
        try {
          const res = await fetch(`/api/v1/${activeTab}/${id}`, { method: "DELETE" });
          if (!res.ok) {
            const data = await res.json();
            throw new Error(data.error || "Failed to delete");
          }
          await fetchData();
          setAlertModal((prev) => ({ ...prev, open: false }));
        } catch (err: any) {
          showAlert("Error", err.message, "error");
        }
      }
    );
  };

  const getTabLabel = () => {
    if (activeTab === "categories") return "Category";
    if (activeTab === "subcategories") return "Subcategory";
    return "Unit";
  };

  return (
    <div className="space-y-6">
      {/* Tabs */}
      <div className="flex space-x-2 border-b border-border/50 pb-2">
        <button
          onClick={() => setActiveTab("categories")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
            activeTab === "categories" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:bg-secondary"
          }`}
        >
          <Layers className="h-4 w-4" />
          Categories
        </button>
        <button
          onClick={() => setActiveTab("subcategories")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
            activeTab === "subcategories" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:bg-secondary"
          }`}
        >
          <Tag className="h-4 w-4" />
          Subcategories
        </button>
        <button
          onClick={() => setActiveTab("units")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
            activeTab === "units" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:bg-secondary"
          }`}
        >
          <Ruler className="h-4 w-4" />
          Units
        </button>
      </div>

      {/* Header Actions */}
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold capitalize">{activeTab}</h2>
        <button
          onClick={() => openModal()}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-bold shadow-sm hover:opacity-90 transition-opacity"
        >
          <Plus className="h-4 w-4" />
          Add {getTabLabel()}
        </button>
      </div>

      {/* Data Table */}
      <div className="glass-card rounded-2xl overflow-hidden border border-border/50">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-secondary/50 text-xs uppercase text-muted-foreground font-semibold">
              <tr>
                <th className="px-6 py-4">Name</th>
                {activeTab === "subcategories" && <th className="px-6 py-4">Parent Category</th>}
                {(activeTab === "categories" || activeTab === "subcategories") && <th className="px-6 py-4">Products</th>}
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {loading ? (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center text-muted-foreground">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
                    Loading {activeTab}...
                  </td>
                </tr>
              ) : activeTab === "categories" && categories.length === 0 ? (
                <tr><td colSpan={3} className="px-6 py-8 text-center text-muted-foreground">No categories found.</td></tr>
              ) : activeTab === "subcategories" && subcategories.length === 0 ? (
                <tr><td colSpan={4} className="px-6 py-8 text-center text-muted-foreground">No subcategories found.</td></tr>
              ) : activeTab === "units" && units.length === 0 ? (
                <tr><td colSpan={3} className="px-6 py-8 text-center text-muted-foreground">No units found.</td></tr>
              ) : activeTab === "categories" ? (
                categories.map((c) => (
                  <tr key={c.id} className="hover:bg-secondary/20 transition-colors">
                    <td className="px-6 py-4 font-medium">{c.name}</td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center justify-center bg-blue-500/10 text-blue-500 text-[10px] font-bold px-2 py-1 rounded-full">
                        {c._count?.products || 0} items
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button onClick={() => openModal(c.id, c.name)} className="p-2 text-muted-foreground hover:text-primary transition-colors">
                        <Edit className="h-4 w-4" />
                      </button>
                      <button onClick={() => handleDelete(c.id)} className="p-2 text-muted-foreground hover:text-destructive transition-colors">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))
              ) : activeTab === "subcategories" ? (
                subcategories.map((sc) => (
                  <tr key={sc.id} className="hover:bg-secondary/20 transition-colors">
                    <td className="px-6 py-4 font-medium">{sc.name}</td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-semibold bg-secondary text-secondary-foreground">
                        {sc.category?.name || "Unassigned"}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center justify-center bg-blue-500/10 text-blue-500 text-[10px] font-bold px-2 py-1 rounded-full">
                        {sc._count?.products || 0} items
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button onClick={() => openModal(sc.id, sc.name, sc.categoryId)} className="p-2 text-muted-foreground hover:text-primary transition-colors">
                        <Edit className="h-4 w-4" />
                      </button>
                      <button onClick={() => handleDelete(sc.id)} className="p-2 text-muted-foreground hover:text-destructive transition-colors">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                units.map((u) => (
                  <tr key={u.id} className="hover:bg-secondary/20 transition-colors">
                    <td className="px-6 py-4 font-medium">{u.name}</td>
                    <td className="px-6 py-4 text-right">
                      <button onClick={() => openModal(u.id, u.name)} className="p-2 text-muted-foreground hover:text-primary transition-colors">
                        <Edit className="h-4 w-4" />
                      </button>
                      <button onClick={() => handleDelete(u.id)} className="p-2 text-muted-foreground hover:text-destructive transition-colors">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="glass-card rounded-2xl w-full max-w-md p-6 shadow-2xl border border-border/50 animate-in zoom-in-95 duration-200">
            <h3 className="text-xl font-bold mb-4">
              {editingId ? "Edit" : "Add"} {getTabLabel()}
            </h3>
            
            {error && <div className="p-3 mb-4 text-sm bg-destructive/10 text-destructive rounded-lg font-medium border border-destructive/20">{error}</div>}

            <form onSubmit={handleSubmit} className="space-y-4">
              {activeTab === "subcategories" && (
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1">Parent Category</label>
                  <select
                    value={formCategoryId}
                    onChange={(e) => setFormCategoryId(e.target.value)}
                    className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
                  >
                    <option value="" disabled>Select parent category</option>
                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1">Name</label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
                  placeholder={`Enter ${getTabLabel().toLowerCase()} name`}
                  autoFocus
                />
              </div>
              
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={closeModal}
                  className="flex-1 px-4 py-2 rounded-lg text-sm font-semibold hover:bg-secondary transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-bold shadow-md hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center"
                >
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Custom Alert/Confirm Popup Modal */}
      {alertModal.open && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="bg-card border border-border rounded-3xl p-6 w-full max-w-sm shadow-2xl flex flex-col gap-4 animate-in zoom-in-95 duration-200">
            <div className="flex flex-col items-center text-center gap-3">
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${
                alertModal.type === "error"
                  ? "bg-destructive/10 text-destructive"
                  : alertModal.type === "confirm"
                  ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                  : "bg-primary/10 text-primary"
              }`}>
                {alertModal.type === "error" ? (
                  <AlertTriangle className="h-6 w-6 stroke-[2.5]" />
                ) : alertModal.type === "confirm" ? (
                  <AlertTriangle className="h-6 w-6 stroke-[2.5]" />
                ) : (
                  <Info className="h-6 w-6 stroke-[2.5]" />
                )}
              </div>
              <div className="space-y-1.5">
                <h4 className="text-base font-black text-foreground">{alertModal.title}</h4>
                <p className="text-xs text-muted-foreground leading-relaxed font-semibold">
                  {alertModal.message}
                </p>
              </div>
            </div>
            <div className="flex gap-2.5 mt-2">
              {alertModal.type === "confirm" ? (
                <>
                  <button
                    type="button"
                    disabled={alertModalLoading}
                    onClick={() => setAlertModal((prev) => ({ ...prev, open: false }))}
                    className="flex-1 py-2.5 border border-border text-xs rounded-xl hover:bg-secondary font-bold transition-all cursor-pointer text-slate-700 dark:text-slate-350 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={alertModalLoading}
                    onClick={async () => {
                      if (alertModal.onConfirm) {
                        setAlertModalLoading(true);
                        try {
                          await alertModal.onConfirm();
                        } catch (err) {
                          console.error(err);
                        } finally {
                          setAlertModalLoading(false);
                        }
                      } else {
                        setAlertModal((prev) => ({ ...prev, open: false }));
                      }
                    }}
                    className="flex-1 py-2.5 bg-primary hover:bg-primary/90 text-primary-foreground font-extrabold text-xs rounded-xl shadow-md transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
                  >
                    {alertModalLoading ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      "Confirm"
                    )}
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => setAlertModal((prev) => ({ ...prev, open: false }))}
                  className="w-full py-2.5 bg-primary hover:bg-primary/90 text-primary-foreground font-extrabold text-xs rounded-xl shadow-md transition-colors cursor-pointer"
                >
                  OK
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
