"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Search, Plus, Trash2, Tag, Percent, Barcode, Boxes, Edit, Camera, FileSpreadsheet, Upload, Download, Loader2, AlertTriangle, Info } from "lucide-react";
import { useSettings } from "@/components/settings-provider";
import dynamic from "next/dynamic";
import { createPortal } from "react-dom";
import * as XLSX from "xlsx";

const BarcodeScannerModal = dynamic(() => import("@/components/barcode-scanner-modal"), {
  ssr: false,
});

interface ProductItem {
  id: string;
  name: string;
  sku: string;
  barcode: string;
  costPrice: number;
  sellingPrice: number;
  wholesalePrice: number;
  alertQuantity: number;
  categoryId: string | null;
  category?: { name: string } | null;
  subcategoryId?: string | null;
  subcategory?: { name: string } | null;
  description?: string | null;
  image?: string | null;
}

interface CategoryItem {
  id: string;
  name: string;
}

interface SubcategoryItem {
  id: string;
  name: string;
  categoryId: string;
}

const productSchema = z.object({
  name: z.string().min(2, "Product name must be at least 2 characters"),
  sku: z.string().optional(),
  barcode: z.string().optional(),
  costPrice: z.number().nonnegative(),
  sellingPrice: z.number().nonnegative(),
  wholesalePrice: z.number().nonnegative(),
  alertQuantity: z.number().int().nonnegative(),
  categoryId: z.string().uuid().optional().nullable().or(z.literal("")),
  subcategoryId: z.string().uuid().optional().nullable().or(z.literal("")),
  initialStock: z.number().nonnegative(),
  mfgDate: z.string().optional().nullable().or(z.literal("")),
  expiryDate: z.string().optional().nullable().or(z.literal("")),
  image: z.string().optional().nullable().or(z.literal("")),
});

type ProductInputs = z.infer<typeof productSchema>;

export default function ProductsPage() {
  const [products, setProducts] = React.useState<ProductItem[]>([]);
  const [categories, setCategories] = React.useState<CategoryItem[]>([]);
  const [subcategories, setSubcategories] = React.useState<SubcategoryItem[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [search, setSearch] = React.useState("");
  const [selectedCategory, setSelectedCategory] = React.useState<string>("");
  const [selectedSubcategory, setSelectedSubcategory] = React.useState<string>("");
  const [onlyLowStock, setOnlyLowStock] = React.useState<boolean>(false);
  
  const { currencySymbol } = useSettings();
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [modalOpen, setModalOpen] = React.useState(false);
  const [submitError, setSubmitError] = React.useState<string | null>(null);
  const [scannerOpen, setScannerOpen] = React.useState(false);
  const [mounted, setMounted] = React.useState(false);

  // Excel Import States
  const [importModalOpen, setImportModalOpen] = React.useState(false);
  const [importing, setImporting] = React.useState(false);
  const [importPreview, setImportPreview] = React.useState<any[]>([]);
  const [importError, setImportError] = React.useState<string | null>(null);
  const [importSuccess, setImportSuccess] = React.useState<string | null>(null);

  // Form submission and delete states
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [isDeleting, setIsDeleting] = React.useState(false);
  const isPending = isLoading || isSubmitting || isDeleting || importing;
  const isMutating = isSubmitting || isDeleting || importing;

  // Custom Alert / Confirm popup state
  interface AlertModalState {
    open: boolean;
    title: string;
    message: string;
    type: "info" | "error" | "confirm";
    onConfirm?: () => void | Promise<void>;
  }
  const [alertModal, setAlertModal] = React.useState<AlertModalState>({
    open: false,
    title: "",
    message: "",
    type: "info",
  });
  const [alertModalLoading, setAlertModalLoading] = React.useState(false);

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

  React.useEffect(() => {
    setMounted(true);
  }, []);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<ProductInputs>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      costPrice: 0,
      sellingPrice: 0,
      wholesalePrice: 0,
      alertQuantity: 5,
      initialStock: 10,
      mfgDate: "",
      expiryDate: "",
      image: "",
      categoryId: "",
      subcategoryId: "",
    },
  });

  const imageValue = watch("image");
  const watchedCategoryId = watch("categoryId");

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setValue("image", reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const clearImage = () => {
    setValue("image", "");
  };

  const loadData = React.useCallback(async () => {
    try {
      setIsLoading(true);
      let url = `/api/v1/products?limit=100&search=${search}`;
      if (selectedCategory && selectedCategory !== "all") {
        url += `&categoryId=${selectedCategory}`;
      }
      if (selectedSubcategory && selectedSubcategory !== "all") {
        url += `&subcategoryId=${selectedSubcategory}`;
      }
      if (onlyLowStock) {
        url += `&lowStock=true`;
      }

      const [prodRes, catRes, subCatRes] = await Promise.all([
        fetch(url),
        fetch("/api/v1/categories"),
        fetch("/api/v1/subcategories"),
      ]);
      
      if (prodRes.ok) {
        const data = await prodRes.json();
        setProducts(data.products || []);
      }
      if (catRes.ok) {
        const data = await catRes.json();
        setCategories(data || []);
      }
      if (subCatRes.ok) {
        const data = await subCatRes.json();
        setSubcategories(data || []);
      }
    } catch (err) {
      console.error("Failed to load products:", err);
    } finally {
      setIsLoading(false);
    }
  }, [search, selectedCategory, selectedSubcategory, onlyLowStock]);

  React.useEffect(() => {
    loadData();
  }, [loadData]);

  const handleEdit = (product: ProductItem) => {
    setEditingId(product.id);
    setSubmitError(null);
    setValue("name", product.name);
    setValue("sku", product.sku || "");
    setValue("barcode", product.barcode || "");
    setValue("costPrice", product.costPrice);
    setValue("sellingPrice", product.sellingPrice);
    setValue("wholesalePrice", product.wholesalePrice || 0);
    setValue("alertQuantity", product.alertQuantity);
    setValue("categoryId", product.categoryId || "");
    setValue("subcategoryId", product.subcategoryId || "");
    setValue("initialStock", 0);
    setValue("mfgDate", "");
    setValue("expiryDate", "");
    setValue("image", product.image || "");
    setModalOpen(true);
  };

  const onSubmit = async (data: ProductInputs) => {
    setSubmitError(null);
    setIsSubmitting(true);
    try {
      if (editingId) {
        const payload = {
          name: data.name,
          sku: data.sku || null,
          barcode: data.barcode || null,
          costPrice: data.costPrice,
          sellingPrice: data.sellingPrice,
          wholesalePrice: data.wholesalePrice,
          alertQuantity: data.alertQuantity,
          categoryId: data.categoryId || null,
          subcategoryId: data.subcategoryId || null,
          image: data.image || null,
        };

        const res = await fetch(`/api/v1/products/${editingId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        if (!res.ok) {
          const json = await res.json();
          setSubmitError(json.error || "Failed to update product");
          return;
        }
      } else {
        const payload = {
          ...data,
          categoryId: data.categoryId || null,
          subcategoryId: data.subcategoryId || null,
          manufacturingDate: data.mfgDate || null,
          expiryDate: data.expiryDate || null,
          image: data.image || null,
        };

        const res = await fetch("/api/v1/products", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        if (!res.ok) {
          const json = await res.json();
          setSubmitError(json.error || "Failed to create product");
          return;
        }
      }

      setModalOpen(false);
      setEditingId(null);
      reset();
      loadData();
    } catch (err) {
      setSubmitError("Failed to connect to API.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    showConfirm(
      "Confirm Delete",
      "Are you sure you want to permanently delete this product? This action cannot be undone.",
      async () => {
        setIsDeleting(true);
        try {
          const res = await fetch(`/api/v1/products/${id}`, {
            method: "DELETE",
          });

          if (res.ok) {
            loadData();
            setAlertModal((prev) => ({ ...prev, open: false }));
          } else {
            showAlert("Error", "Failed to delete product.", "error");
          }
        } catch (err) {
          showAlert("Error", "Error connecting to API.", "error");
        } finally {
          setIsDeleting(false);
        }
      }
    );
  };

  const handleExcelFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportError(null);
    setImportSuccess(null);

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = evt.target?.result;
        const workbook = XLSX.read(data, { type: "binary" });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const json: any[] = XLSX.utils.sheet_to_json(worksheet);

        if (!json || json.length === 0) {
          setImportError("The uploaded file is empty or formatted incorrectly.");
          setImportPreview([]);
          return;
        }

        const mapped = json
          .map((row) => {
            const name = String(
              row["Product Name"] || row.ProductName || row.Name || row.name || row.title || ""
            ).trim();
            if (!name) return null;

            const vatRaw = String(
              row["VAT Item"] || row["Is VAT Item"] || row["is_vat_item"] || row.VAT || row.vat || "Yes"
            ).trim().toLowerCase();
            const isVatItem = vatRaw === "yes" || vatRaw === "y" || vatRaw === "true" || vatRaw === "1";

            return {
              name,
              sku: String(row.SKU || row.sku || row["SKU Code"] || "").trim() || null,
              costPrice: Number(row["Cost Price"] || row.cost_price || row.Cost || row.cost) || 0,
              sellingPrice: Number(row["Selling Price"] || row.selling_price || row.Price || row.price) || 0,
              wholesalePrice: Number(row["Wholesale Price"] || row.wholesale_price || row.Wholesale) || 0,
              alertQuantity: Number(row["Alert Qty"] || row.alert_quantity || row.MinStock) || 5,
              initialStock: Number(row["Initial Stock"] || row.initial_stock || row.Stock || row.Qty || row.quantity) || 0,
              isVatItem,
              unitName: String(row["Unit Name"] || row.Unit || row["Unit"] || row.unit_name || row.unit || "").trim() || null,
              categoryName: String(row["Category Name"] || row.Category || row.category_name || "").trim() || null,
              subcategoryName: String(row["Subcategory Name"] || row.Subcategory || row.subcategory_name || "").trim() || null,
            };
          })
          .filter(Boolean);

        if (mapped.length === 0) {
          setImportError("No valid product rows could be extracted from the file.");
          setImportPreview([]);
          return;
        }

        setImportPreview(mapped);
      } catch (err: any) {
        setImportError("Failed to parse Excel file: " + err.message);
      }
    };
    reader.readAsBinaryString(file);
  };

  const handleBulkSubmit = async () => {
    if (importPreview.length === 0) return;
    setImporting(true);
    setImportError(null);

    try {
      const res = await fetch("/api/v1/products/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ products: importPreview }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to import products");
      }

      setImportSuccess(data.message || `Successfully imported ${data.count} products.`);
      setImportPreview([]);
      loadData();
      setTimeout(() => {
        setImportModalOpen(false);
        setImportSuccess(null);
      }, 1500);
    } catch (err: any) {
      setImportError(err.message);
    } finally {
      setImporting(false);
    }
  };

  const downloadSampleTemplate = () => {
    const sampleData = [
      {
        "Product Name": "Espresso Coffee Beans 1kg",
        SKU: "COF-ESP-001",
        "Cost Price": 12.5,
        "Selling Price": 22.0,
        "Wholesale Price": 18.5,
        "Alert Qty": 10,
        "Initial Stock": 50,
        "VAT Item": "Yes",
        "Unit Name": "kg",
        "Category Name": "Beverages",
        "Subcategory Name": "Coffee",
      },
      {
        "Product Name": "Organic Green Tea 250g",
        SKU: "TEA-GRN-002",
        "Cost Price": 6.0,
        "Selling Price": 11.5,
        "Wholesale Price": 9.0,
        "Alert Qty": 5,
        "Initial Stock": 30,
        "VAT Item": "No",
        "Unit Name": "packet",
        "Category Name": "Beverages",
        "Subcategory Name": "Tea",
      },
    ];

    const ws = XLSX.utils.json_to_sheet(sampleData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Product Template");
    XLSX.writeFile(wb, "dynapos_product_import_template.xlsx");
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-card border border-border p-5 rounded-2xl">
        <div>
          <h1 className="text-xl font-bold">Product Catalog</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Manage your store items, barcodes, prices, and alerts.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
          <button
            onClick={() => {
              setImportError(null);
              setImportSuccess(null);
              setImportPreview([]);
              setImportModalOpen(true);
            }}
            disabled={isPending}
            className="flex items-center gap-2 px-4 py-2.5 bg-secondary hover:bg-secondary/80 border border-border text-foreground rounded-xl text-xs font-bold transition-all cursor-pointer shadow-xs disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <FileSpreadsheet className="h-4.5 w-4.5 text-emerald-600 dark:text-emerald-400" />
            Import Excel
          </button>
          <button
            onClick={() => {
              setEditingId(null);
              setSubmitError(null);
              reset({
                name: "",
                sku: "",
                barcode: "",
                costPrice: 0,
                sellingPrice: 0,
                wholesalePrice: 0,
                alertQuantity: 5,
                initialStock: 10,
                mfgDate: "",
                expiryDate: "",
                image: "",
                categoryId: "",
                subcategoryId: "",
              });
              setModalOpen(true);
            }}
            disabled={isPending}
            className="flex items-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground hover:bg-primary/95 rounded-xl text-xs font-black shadow-lg shadow-primary/20 transition-all uppercase tracking-wider cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Plus className="h-4.5 w-4.5" />
            Add Product
          </button>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-6 items-start">
        {/* Main List Box */}
        <div className={`bg-card border border-border rounded-2xl p-5 space-y-4 w-full order-2 lg:order-1 transition-all duration-300 ${
          modalOpen ? "lg:w-2/3" : "lg:w-full"
        }`}>
        {/* Search & Filter Controls */}
        <div className="flex flex-col md:flex-row gap-3">
          {/* Search Bar */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 h-4.5 w-4.5 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search products by SKU, name, or barcode..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              disabled={isMutating}
              className="pl-10 w-full px-4 py-2 border border-border rounded-lg bg-background text-sm focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed"
              suppressHydrationWarning
            />
          </div>

          {/* Category Filter */}
          <div className="w-full md:w-48">
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              disabled={isMutating}
              className="w-full px-3 py-2 border border-border rounded-lg text-xs bg-background focus:outline-none focus:ring-1 focus:ring-primary h-[38px] font-semibold cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <option value="">All Categories</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          {/* Subcategory Filter */}
          <div className="w-full md:w-48">
            <select
              value={selectedSubcategory}
              onChange={(e) => setSelectedSubcategory(e.target.value)}
              disabled={isMutating}
              className="w-full px-3 py-2 border border-border rounded-lg text-xs bg-background focus:outline-none focus:ring-1 focus:ring-primary h-[38px] font-semibold cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <option value="">All Subcategories</option>
              {subcategories
                .filter((sc) => !selectedCategory || sc.categoryId === selectedCategory)
                .map((sc) => (
                  <option key={sc.id} value={sc.id}>
                    {sc.name}
                  </option>
                ))}
            </select>
          </div>

          {/* Low Stock Toggle */}
          <button
            onClick={() => setOnlyLowStock(!onlyLowStock)}
            disabled={isMutating}
            className={`px-4 py-2 border rounded-lg text-xs font-bold transition-all h-[38px] flex items-center justify-center gap-1.5 whitespace-nowrap cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
              onlyLowStock 
                ? "bg-destructive/10 text-destructive border-destructive/30" 
                : "border-border hover:bg-secondary text-muted-foreground"
            }`}
          >
            <Boxes className="h-4 w-4" />
            <span>Low Stock Alert</span>
          </button>
        </div>

        {/* Tabular list */}
        {products.length === 0 && !isLoading ? (
          <div className="py-12 text-center text-xs text-muted-foreground">No products found.</div>
        ) : (
          <>
            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-xs text-left border-collapse">
                <thead>
                  <tr className="border-b border-border text-muted-foreground font-semibold uppercase tracking-wider text-[10px]">
                    <th className="py-3 px-2">SKU / Barcode</th>
                    <th className="py-3 px-2">Name</th>
                    <th className="py-3 px-2">Category</th>
                    <th className="py-3 px-2 text-right">Cost Price</th>
                    <th className="py-3 px-2 text-right">Selling Price</th>
                    <th className="py-3 px-2 text-center">Alert Level</th>
                    <th className="py-3 px-2 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {isLoading ? (
                    Array.from({ length: 5 }).map((_, i) => (
                      <tr key={i} className="animate-pulse">
                        <td className="py-4 px-2">
                          <div className="h-4 bg-secondary dark:bg-slate-800 rounded w-20 mb-1" />
                          <div className="h-3 bg-secondary/60 dark:bg-slate-800/60 rounded w-16" />
                        </td>
                        <td className="py-4 px-2">
                          <div className="h-4 bg-secondary dark:bg-slate-800 rounded w-32" />
                        </td>
                        <td className="py-4 px-2">
                          <div className="h-4 bg-secondary dark:bg-slate-800 rounded w-24" />
                        </td>
                        <td className="py-4 px-2 text-right">
                          <div className="h-4 bg-secondary dark:bg-slate-800 rounded w-14 ml-auto" />
                        </td>
                        <td className="py-4 px-2 text-right">
                          <div className="h-4 bg-secondary dark:bg-slate-800 rounded w-14 ml-auto" />
                        </td>
                        <td className="py-4 px-2 text-center">
                          <div className="h-5 bg-secondary dark:bg-slate-800 rounded w-12 mx-auto" />
                        </td>
                        <td className="py-4 px-2 text-center">
                          <div className="h-6 bg-secondary dark:bg-slate-800 rounded w-12 mx-auto" />
                        </td>
                      </tr>
                    ))
                  ) : (
                    products.map((p) => (
                      <tr key={p.id} className="hover:bg-secondary/10">
                        <td className="py-3 px-2">
                          <div className="font-semibold text-primary">{p.sku || "GENERIC"}</div>
                          <div className="text-[10px] text-muted-foreground mt-0.5">{p.barcode || "No Barcode"}</div>
                        </td>
                        <td className="py-3 px-2 font-bold text-foreground">{p.name}</td>
                        <td className="py-3 px-2">
                          <div className="flex flex-col gap-1">
                            <span className="bg-secondary px-2 py-0.5 rounded text-[10px] w-fit font-semibold">
                              {p.category?.name || "Uncategorized"}
                            </span>
                            {p.subcategory && (
                              <span className="bg-primary/10 text-primary px-2 py-0.5 rounded text-[10px] w-fit font-bold">
                                {p.subcategory.name}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-2 text-right font-medium">{currencySymbol}{p.costPrice.toFixed(2)}</td>
                        <td className="py-3 px-2 text-right font-bold text-primary">{currencySymbol}{p.sellingPrice.toFixed(2)}</td>
                        <td className="py-3 px-2 text-center">
                          <span className="bg-destructive/10 text-destructive border border-destructive/20 px-2 py-0.5 rounded font-semibold text-[10px]">
                            Min: {p.alertQuantity}
                          </span>
                        </td>
                        <td className="py-3 px-2 text-center flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => handleEdit(p)}
                            disabled={isPending}
                            className="text-muted-foreground hover:text-primary p-1 rounded transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                            title="Edit Product"
                          >
                            <Edit className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(p.id)}
                            disabled={isPending}
                            className="text-muted-foreground hover:text-destructive p-1 rounded transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                            title="Delete Product"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards View */}
            <div className="block md:hidden space-y-3">
              {isLoading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="bg-card border border-border/80 rounded-xl p-4 space-y-3 shadow-xs animate-pulse">
                    <div className="flex justify-between items-start">
                      <div className="min-w-0 flex-1 pr-2 space-y-2">
                        <div className="h-4 bg-secondary dark:bg-slate-800 rounded w-2/3" />
                        <div className="h-3.5 bg-secondary/85 dark:bg-slate-800/85 rounded w-24" />
                      </div>
                      <div className="text-right flex-shrink-0 space-y-1">
                        <div className="h-4 bg-secondary dark:bg-slate-800 rounded w-16 ml-auto" />
                        <div className="h-3 bg-secondary/60 dark:bg-slate-800/60 rounded w-12 ml-auto" />
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2 border-y border-border/50 py-2.5">
                      <div className="space-y-1">
                        <div className="h-2.5 bg-secondary/50 dark:bg-slate-800/50 rounded w-10" />
                        <div className="h-3.5 bg-secondary dark:bg-slate-800 rounded w-12" />
                      </div>
                      <div className="space-y-1">
                        <div className="h-2.5 bg-secondary/50 dark:bg-slate-800/50 rounded w-12" />
                        <div className="h-3.5 bg-secondary dark:bg-slate-800 rounded w-14" />
                      </div>
                      <div className="space-y-1">
                        <div className="h-2.5 bg-secondary/50 dark:bg-slate-800/50 rounded w-10" />
                        <div className="h-3.5 bg-secondary dark:bg-slate-800 rounded w-12" />
                      </div>
                    </div>

                    <div className="flex justify-end gap-2 pt-1">
                      <div className="h-7.5 bg-secondary dark:bg-slate-800 rounded-lg w-16" />
                      <div className="h-7.5 bg-secondary dark:bg-slate-800 rounded-lg w-16" />
                    </div>
                  </div>
                ))
              ) : (
                products.map((p) => (
                  <div key={p.id} className="bg-card border border-border/80 rounded-xl p-4 space-y-3 shadow-xs">
                    <div className="flex justify-between items-start">
                      <div className="min-w-0 flex-1 pr-2">
                        <h4 className="font-bold text-sm text-foreground truncate">{p.name}</h4>
                        <div className="flex flex-wrap gap-1 mt-1">
                          <span className="bg-secondary px-2 py-0.5 rounded text-[10px] inline-block">
                            {p.category?.name || "Uncategorized"}
                          </span>
                          {p.subcategory && (
                            <span className="bg-primary/10 text-primary px-2 py-0.5 rounded text-[10px] inline-block font-bold">
                              {p.subcategory.name}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <div className="font-semibold text-primary">{p.sku || "GENERIC"}</div>
                        <div className="text-[10px] text-muted-foreground mt-0.5">{p.barcode || "No Barcode"}</div>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2 border-y border-border/50 py-2 text-[11px]">
                      <div>
                        <span className="text-muted-foreground block text-[9px] uppercase font-semibold">Cost Price</span>
                        <span className="font-bold">{currencySymbol}{p.costPrice.toFixed(2)}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground block text-[9px] uppercase font-semibold">Selling Price</span>
                        <span className="font-black text-primary">{currencySymbol}{p.sellingPrice.toFixed(2)}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground block text-[9px] uppercase font-semibold">Alert Level</span>
                        <span className="bg-destructive/10 text-destructive border border-destructive/20 px-1.5 py-0.5 rounded font-bold text-[9px] inline-block">
                          Min: {p.alertQuantity}
                        </span>
                      </div>
                    </div>

                    <div className="flex justify-end gap-2 pt-1">
                      <button
                        onClick={() => handleEdit(p)}
                        disabled={isPending}
                        className="flex items-center gap-1.5 px-3 py-1.5 border border-border hover:bg-secondary rounded-lg text-xs font-semibold cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <Edit className="h-3.5 w-3.5" />
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(p.id)}
                        disabled={isPending}
                        className="flex items-center gap-1.5 px-3 py-1.5 border border-destructive/20 hover:bg-destructive/10 text-destructive rounded-lg text-xs font-semibold cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Delete
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </>
        )}
        </div>

        {/* Inline Form Panel for Add/Edit Product */}
        {modalOpen && (
          <div className="w-full lg:w-1/3 bg-card border border-border rounded-2xl p-6 space-y-6 shadow-sm flex-shrink-0 order-1 lg:order-2 animate-in fade-in slide-in-from-top lg:slide-in-from-right-5 duration-200">
            <div className="flex justify-between items-start pb-3 border-b border-border/60">
              <div>
                <h3 className="text-base font-bold text-foreground">
                  {editingId ? "Edit Product" : "Add New Product"}
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {editingId ? "Modify product details." : "Register a new inventory item scoped to your business."}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                disabled={isPending}
                className="text-muted-foreground hover:text-foreground transition-colors p-1.5 hover:bg-secondary rounded-lg cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Plus className="h-5 w-5 rotate-45" />
              </button>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5 flex-1 mt-2">
              <fieldset disabled={isPending} className="space-y-5 flex-1 border-0 p-0 m-0">
              {/* SECTION 1: Basic Info */}
              <div className="space-y-4 bg-secondary/5 border border-border/40 p-4 rounded-2xl">
                <span className="text-[10px] font-black text-[#2563EB] uppercase tracking-wider block">
                  Primary Details
                </span>

                {/* Product Image Upload with Base64 Preview */}
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-muted-foreground uppercase tracking-wider block mb-1">
                    Product Image
                  </label>
                  <div className="flex items-center gap-4 mt-1">
                    {imageValue ? (
                      <div className="relative w-16 h-16 rounded-xl overflow-hidden border border-border bg-muted flex items-center justify-center shrink-0 shadow-xs">
                        <img src={imageValue} alt="Preview" className="w-full h-full object-cover" />
                        <button
                          type="button"
                          onClick={clearImage}
                          disabled={isPending}
                          className="absolute inset-0 bg-black/60 text-white flex items-center justify-center text-[10px] font-bold opacity-0 hover:opacity-100 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          Remove
                        </button>
                      </div>
                    ) : (
                      <div className="w-16 h-16 rounded-xl border border-dashed border-border/80 bg-muted/20 flex items-center justify-center shrink-0">
                        <Boxes className="h-6 w-6 text-muted-foreground/40" />
                      </div>
                    )}
                    <div className="flex-1">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleImageChange}
                        disabled={isPending}
                        className="hidden"
                        id="product-image-upload"
                      />
                      <label
                        htmlFor={isPending ? undefined : "product-image-upload"}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 border border-border rounded-xl text-[11px] font-bold transition-colors bg-background text-foreground ${
                          isPending 
                            ? "opacity-50 cursor-not-allowed" 
                            : "hover:bg-secondary cursor-pointer"
                        }`}
                      >
                        Choose Image File
                      </label>
                      <p className="text-[9px] text-muted-foreground mt-1 leading-normal">
                        PNG, JPG or WEBP. Image will be saved to the database.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black text-muted-foreground uppercase tracking-wider block mb-1">
                    Product Name
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Premium Coffee Beans"
                    {...register("name")}
                    className={`w-full h-10 px-3.5 border rounded-xl text-xs bg-background focus:outline-none focus:ring-2 focus:ring-primary/10 transition-all ${
                      errors.name ? "border-destructive focus:ring-destructive" : "border-border/80 focus:border-primary"
                    }`}
                  />
                  {errors.name && (
                    <span className="text-[10px] text-destructive font-semibold">{errors.name.message}</span>
                  )}
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black text-muted-foreground uppercase tracking-wider block mb-1">
                    Category
                  </label>
                  <select
                    {...register("categoryId")}
                    onChange={(e) => {
                      register("categoryId").onChange(e);
                      setValue("subcategoryId", "");
                    }}
                    className="w-full h-10 px-3.5 border border-border/80 rounded-xl text-xs bg-background focus:outline-none focus:ring-2 focus:ring-primary/10 transition-all cursor-pointer"
                  >
                    <option value="">Select Category</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black text-muted-foreground uppercase tracking-wider block mb-1">
                    Subcategory
                  </label>
                  <select
                    {...register("subcategoryId")}
                    className="w-full h-10 px-3.5 border border-border/80 rounded-xl text-xs bg-background focus:outline-none focus:ring-2 focus:ring-primary/10 transition-all cursor-pointer"
                  >
                    <option value="">Select Subcategory (Optional)</option>
                    {subcategories
                      .filter((sc) => !watchedCategoryId || sc.categoryId === watchedCategoryId)
                      .map((sc) => (
                        <option key={sc.id} value={sc.id}>
                          {sc.name}
                        </option>
                      ))}
                  </select>
                </div>
              </div>

              {/* SECTION 2: Inventory Codes & Tracking */}
              <div className="space-y-4 bg-secondary/5 border border-border/40 p-4 rounded-2xl">
                <span className="text-[10px] font-black text-[#2563EB] uppercase tracking-wider block">
                  Codes & Tracking
                </span>

                <div className="space-y-1">
                  <label className="text-[10px] font-black text-muted-foreground uppercase tracking-wider block mb-1">
                    SKU Code
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. BEA-COF-001"
                    {...register("sku")}
                    className="w-full h-10 px-3.5 border border-border/80 rounded-xl text-xs bg-background focus:outline-none focus:ring-2 focus:ring-primary/10 transition-all"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black text-muted-foreground uppercase tracking-wider block mb-1">
                    Barcode UPC/EAN
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="e.g. 880123456789"
                      {...register("barcode")}
                      className="flex-1 h-10 px-3.5 border border-border/80 rounded-xl text-xs bg-background focus:outline-none focus:ring-2 focus:ring-primary/10 transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setScannerOpen(true)}
                      disabled={isPending}
                      className="px-3.5 h-10 border border-border/80 rounded-xl bg-secondary hover:bg-secondary/80 text-foreground flex items-center justify-center cursor-pointer transition-all shadow-xs disabled:opacity-50 disabled:cursor-not-allowed"
                      title="Scan Barcode with Camera"
                    >
                      <Camera className="h-4.5 w-4.5 text-muted-foreground hover:text-foreground" />
                    </button>
                  </div>
                </div>

                {/* Manufacturing & Expiry Dates */}
                {!editingId && (
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-muted-foreground uppercase tracking-wider block mb-1">
                        Mfg Date
                      </label>
                      <input
                        type="date"
                        {...register("mfgDate")}
                        className="w-full h-10 px-3 border border-border/80 rounded-xl text-xs bg-background focus:outline-none focus:ring-2 focus:ring-primary/10 transition-all"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-muted-foreground uppercase tracking-wider block mb-1">
                        Expiry Date
                      </label>
                      <input
                        type="date"
                        {...register("expiryDate")}
                        className="w-full h-10 px-3 border border-border/80 rounded-xl text-xs bg-background focus:outline-none focus:ring-2 focus:ring-primary/10 transition-all"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* SECTION 3: Pricing & Stock Levels */}
              <div className="space-y-4 bg-secondary/5 border border-border/40 p-4 rounded-2xl">
                <span className="text-[10px] font-black text-[#2563EB] uppercase tracking-wider block">
                  Pricing & Stock
                </span>

                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-muted-foreground uppercase tracking-wider block mb-1">
                      Cost ({currencySymbol})
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      {...register("costPrice", { valueAsNumber: true })}
                      className="w-full h-10 px-2.5 border border-border/80 rounded-xl text-xs bg-background focus:outline-none focus:ring-2 focus:ring-primary/10 transition-all"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-muted-foreground uppercase tracking-wider block mb-1">
                      Selling ({currencySymbol})
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      {...register("sellingPrice", { valueAsNumber: true })}
                      className="w-full h-10 px-2.5 border border-border/80 rounded-xl text-xs bg-background focus:outline-none focus:ring-2 focus:ring-primary/10 transition-all"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-muted-foreground uppercase tracking-wider block mb-1">
                      Alert Qty
                    </label>
                    <input
                      type="number"
                      placeholder="5"
                      {...register("alertQuantity", { valueAsNumber: true })}
                      className="w-full h-10 px-2.5 border border-border/80 rounded-xl text-xs bg-background focus:outline-none focus:ring-2 focus:ring-primary/10 transition-all"
                    />
                  </div>
                </div>

                {!editingId && (
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-muted-foreground uppercase tracking-wider block mb-1">
                      Initial Stock (Branch)
                    </label>
                    <input
                      type="number"
                      placeholder="10"
                      {...register("initialStock", { valueAsNumber: true })}
                      className="w-full h-10 px-3.5 border border-border/80 rounded-xl text-xs bg-background focus:outline-none focus:ring-2 focus:ring-primary/10 transition-all"
                    />
                  </div>
                )}
              </div>

              {submitError && (
                <div className="text-xs text-destructive bg-destructive/10 border border-destructive/20 p-3 rounded-xl font-semibold leading-tight animate-in fade-in duration-200">
                  {submitError}
                </div>
              )}

              <div className="flex justify-end gap-2 border-t border-border/60 pt-4 mt-6">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="h-10 px-5 border border-border text-xs font-semibold rounded-xl hover:bg-secondary transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="h-10 px-6 bg-primary text-primary-foreground text-xs font-black rounded-xl hover:bg-primary/90 shadow-lg shadow-primary/20 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      {editingId ? "Saving..." : "Adding..."}
                    </>
                  ) : (
                    editingId ? "Save Changes" : "Add Product"
                  )}
                </button>
              </div>
              </fieldset>
            </form>
          </div>
        )}
      </div>
      <BarcodeScannerModal
        isOpen={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onScan={(code) => {
          setValue("barcode", code);
          setScannerOpen(false);
        }}
        title="Scan Product Barcode"
      />

      {/* Excel Import Modal */}
      {importModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="glass-card rounded-2xl w-full max-w-xl p-6 shadow-2xl border border-border/60 animate-in zoom-in-95 duration-200 space-y-5">
            <div className="flex justify-between items-start border-b border-border/60 pb-3">
              <div>
                <h3 className="text-lg font-bold flex items-center gap-2 text-foreground">
                  <FileSpreadsheet className="h-5 w-5 text-emerald-600" />
                  Bulk Product Import via Excel
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Upload an Excel (.xlsx, .xls) or CSV file to add multiple products into your inventory at once.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setImportModalOpen(false)}
                disabled={isPending}
                className="text-muted-foreground hover:text-foreground transition-colors p-1.5 hover:bg-secondary rounded-lg cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Plus className="h-5 w-5 rotate-45" />
              </button>
            </div>

            {importError && (
              <div className="p-3 text-xs bg-destructive/10 text-destructive rounded-xl font-semibold border border-destructive/20">
                {importError}
              </div>
            )}

            {importSuccess && (
              <div className="p-3 text-xs bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-xl font-bold border border-emerald-500/20">
                {importSuccess}
              </div>
            )}

            {/* Template Action */}
            <div className="flex justify-between items-center bg-secondary/20 p-3.5 rounded-xl border border-border/50 text-xs">
              <div>
                <span className="font-bold text-foreground block">Need a starting template?</span>
                <span className="text-[11px] text-muted-foreground">Download sample Excel file with correct columns</span>
              </div>
              <button
                type="button"
                onClick={downloadSampleTemplate}
                disabled={isPending}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-background hover:bg-secondary border border-border rounded-lg text-xs font-semibold cursor-pointer transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Download className="h-3.5 w-3.5" />
                Download Sample
              </button>
            </div>

            {/* File Upload Box */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-muted-foreground block">Select Excel / CSV File</label>
              <div className="border-2 border-dashed border-border hover:border-primary/50 rounded-2xl p-6 text-center transition-colors bg-muted/10">
                <Upload className="h-8 w-8 text-muted-foreground/50 mx-auto mb-2" />
                <input
                  type="file"
                  accept=".xlsx, .xls, .csv"
                  onChange={handleExcelFileSelect}
                  disabled={isPending}
                  className="hidden"
                  id="excel-file-input"
                />
                <label
                  htmlFor={isPending ? undefined : "excel-file-input"}
                  className={`inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground text-xs font-bold rounded-xl shadow-md transition-all ${
                    isPending 
                      ? "opacity-50 cursor-not-allowed" 
                      : "hover:opacity-90 cursor-pointer"
                  }`}
                >
                  Choose Excel File
                </label>
                <p className="text-[10px] text-muted-foreground mt-2">Supports .xlsx, .xls, and .csv formats</p>
              </div>
            </div>

            {/* Preview Section */}
            {importPreview.length > 0 && (
              <div className="space-y-3 pt-2">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-extrabold text-foreground">
                    Preview Ready ({importPreview.length} products found)
                  </span>
                  <span className="text-[10px] text-emerald-600 font-bold bg-emerald-500/10 px-2 py-0.5 rounded-full">
                    Validated
                  </span>
                </div>

                <div className="max-h-40 overflow-y-auto border border-border/60 rounded-xl divide-y divide-border/40 text-xs bg-background">
                  {importPreview.slice(0, 5).map((prod, idx) => (
                    <div key={idx} className="p-2.5 flex justify-between items-center">
                      <div>
                        <span className="font-bold text-foreground block">{prod.name}</span>
                        <span className="text-[10px] text-muted-foreground">
                          SKU: {prod.sku || "N/A"} | VAT: <strong className={prod.isVatItem ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600"}>{prod.isVatItem ? "Yes" : "No"}</strong> | Unit: {prod.unitName || "N/A"} | Category: {prod.categoryName || "Uncategorized"}
                        </span>
                      </div>
                      <span className="font-black text-primary">
                        {currencySymbol}{prod.sellingPrice.toFixed(2)}
                      </span>
                    </div>
                  ))}
                  {importPreview.length > 5 && (
                    <div className="p-2 text-center text-[10px] text-muted-foreground font-medium bg-secondary/20">
                      + {importPreview.length - 5} more products...
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="flex justify-end gap-3 pt-3 border-t border-border/60">
              <button
                type="button"
                onClick={() => setImportModalOpen(false)}
                disabled={isPending}
                className="px-4 py-2 rounded-xl text-xs font-semibold hover:bg-secondary transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleBulkSubmit}
                disabled={isPending || importPreview.length === 0}
                className="px-5 py-2 bg-primary text-primary-foreground text-xs font-bold rounded-xl shadow-md hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed"
              >
                {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : `Import ${importPreview.length} Products`}
              </button>
            </div>
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
