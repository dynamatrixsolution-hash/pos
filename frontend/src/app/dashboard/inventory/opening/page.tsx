"use client";

import React, { useState, useEffect, useCallback } from "react";
import { 
  TrendingUp, Layers, Plus, FileSpreadsheet, Search, RefreshCw, Trash2, Edit2, 
  Check, X, FileText, Calendar, Filter, Archive, AlertTriangle, HelpCircle, 
  MapPin, UserCheck, ShieldAlert
} from "lucide-react";
import { useUser } from "@/lib/client-auth";
import { exportToExcel, exportToPDF } from "@/lib/export-helper";
import * as XLSX from "xlsx";
import { useSettings } from "@/components/settings-provider";

interface ProductItem {
  id: string;
  name: string;
  sku: string;
  barcode: string | null;
  costPrice: number;
  sellingPrice: number;
  categoryName?: string;
  brandName?: string;
  category?: { name: string };
  brand?: { name: string };
}

interface BranchItem {
  id: string;
  name: string;
}

interface SupplierItem {
  id: string;
  name: string;
}

interface OpeningStockEntry {
  id: string;
  quantity: number;
  unitType: string;
  purchaseRate: number;
  sellingPrice: number;
  mrp: number;
  totalValue: number;
  batchNumber: string | null;
  expiryDate: string | null;
  manufacturingDate: string | null;
  rackNumber: string | null;
  remarks: string | null;
  approvalStatus: string;
  createdAt: string;
  product: {
    name: string;
    sku: string | null;
    barcode: string | null;
    category?: { name: string } | null;
    brand?: { name: string } | null;
  };
  branch: { name: string };
  supplier: { name: string } | null;
  enteredBy: { name: string };
  approvedBy: { name: string } | null;
  productId: string;
  branchId: string;
  supplierId: string | null;
}

export default function OpeningStockPage() {
  const user = useUser();
  const { currencySymbol } = useSettings();
  const isManagerOrOwner = user && ["OWNER", "MANAGER"].includes(user.role);

  const [entries, setEntries] = useState<OpeningStockEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedBranch, setSelectedBranch] = useState("");
  const [selectedSupplier, setSelectedSupplier] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // Loaded Options
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [branches, setBranches] = useState<BranchItem[]>([]);
  const [suppliers, setSuppliers] = useState<SupplierItem[]>([]);

  // Page Mode tabs: "entries" or "reports"
  const [activeTab, setActiveTab] = useState<"entries" | "reports">("entries");
  const [selectedReport, setSelectedReport] = useState<"overall" | "batch" | "expiry" | "warehouse" | "supplier">("overall");

  // Form State
  const [showForm, setShowForm] = useState(false);
  const [editingEntry, setEditingEntry] = useState<OpeningStockEntry | null>(null);
  
  const [formData, setFormData] = useState({
    productId: "",
    branchId: "",
    quantity: 0,
    unitType: "pcs",
    purchaseRate: 0,
    sellingPrice: 0,
    mrp: 0,
    batchNumber: "",
    expiryDate: "",
    manufacturingDate: "",
    rackNumber: "",
    supplierId: "",
    remarks: "",
  });

  const unitTypes = ["pcs", "box", "strip", "tablet", "bottle", "kg", "gram", "liter", "ml"];

  // Fetch initial data
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch products
      const prodRes = await fetch("/api/v1/products?limit=500");
      if (prodRes.ok) {
        const pData = await prodRes.json();
        setProducts(pData.products || []);
      }

      // Fetch branches
      const branchRes = await fetch("/api/v1/branches");
      if (branchRes.ok) {
        const bData = await branchRes.json();
        setBranches(bData || []);
      }

      // Fetch suppliers
      const supplierRes = await fetch("/api/v1/suppliers?limit=500");
      if (supplierRes.ok) {
        const sData = await supplierRes.json();
        setSuppliers(sData.suppliers || []);
      }
    } catch (err) {
      console.error("Failed to fetch page choices:", err);
    }
  }, []);

  const fetchEntries = useCallback(async () => {
    try {
      let url = `/api/v1/inventory/opening?search=${search}`;
      if (selectedBranch) url += `&branchId=${selectedBranch}`;
      if (selectedSupplier) url += `&supplierId=${selectedSupplier}`;
      if (selectedStatus) url += `&approvalStatus=${selectedStatus}`;

      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setEntries(data.entries || []);
      }
    } catch (err) {
      console.error("Failed to load opening stocks:", err);
      setErrorMsg("Failed to load entries from the server");
    } finally {
      setLoading(false);
    }
  }, [search, selectedBranch, selectedSupplier, selectedStatus]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    const delayDebounce = setTimeout(() => {
      fetchEntries();
    }, 300);
    return () => clearTimeout(delayDebounce);
  }, [fetchEntries]);

  // Handle product change to auto-fill pricing info
  const handleProductChange = (prodId: string) => {
    const prod = products.find((p) => p.id === prodId);
    setFormData((prev) => ({
      ...prev,
      productId: prodId,
      purchaseRate: prod ? prod.costPrice : 0,
      sellingPrice: prod ? prod.sellingPrice : 0,
      mrp: prod ? prod.sellingPrice : 0,
    }));
  };

  // Create or Update Manual entry
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    setSuccessMsg("");

    const isEdit = !!editingEntry;
    const url = isEdit ? `/api/v1/inventory/opening/${editingEntry.id}` : "/api/v1/inventory/opening";
    const method = isEdit ? "PUT" : "POST";

    const payload = {
      ...formData,
      quantity: Number(formData.quantity),
      purchaseRate: Number(formData.purchaseRate),
      sellingPrice: Number(formData.sellingPrice),
      mrp: Number(formData.mrp),
      approvalStatus: isManagerOrOwner ? "APPROVED" : "PENDING",
    };

    try {
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        setSuccessMsg(isEdit ? "Opening stock updated successfully" : "Opening stock entry logged");
        setShowForm(false);
        setEditingEntry(null);
        setFormData({
          productId: "",
          branchId: "",
          quantity: 0,
          unitType: "pcs",
          purchaseRate: 0,
          sellingPrice: 0,
          mrp: 0,
          batchNumber: "",
          expiryDate: "",
          manufacturingDate: "",
          rackNumber: "",
          supplierId: "",
          remarks: "",
        });
        fetchEntries();
      } else {
        const err = await res.json();
        setErrorMsg(err.error || "Operation failed");
      }
    } catch (err) {
      console.error(err);
      setErrorMsg("Network error occurred");
    }
  };

  // Delete manual entry
  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this opening stock entry?")) return;
    setErrorMsg("");
    setSuccessMsg("");

    try {
      const res = await fetch(`/api/v1/inventory/opening/${id}`, { method: "DELETE" });
      if (res.ok) {
        setSuccessMsg("Opening stock deleted successfully");
        fetchEntries();
      } else {
        const err = await res.json();
        setErrorMsg(err.error || "Failed to delete entry");
      }
    } catch (err) {
      console.error(err);
      setErrorMsg("Network error occurred");
    }
  };

  // Process Approval / Rejection
  const handleApproval = async (id: string, status: "APPROVED" | "REJECTED") => {
    setErrorMsg("");
    setSuccessMsg("");

    try {
      const res = await fetch(`/api/v1/inventory/opening/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });

      if (res.ok) {
        setSuccessMsg(`Entry ${status.toLowerCase()} successfully`);
        fetchEntries();
      } else {
        const err = await res.json();
        setErrorMsg(err.error || "Failed to approve/reject entry");
      }
    } catch (err) {
      console.error(err);
      setErrorMsg("Network error occurred");
    }
  };

  // Edit action
  const handleEditClick = (entry: OpeningStockEntry) => {
    setEditingEntry(entry);
    setFormData({
      productId: entry.productId,
      branchId: entry.branchId,
      quantity: entry.quantity,
      unitType: entry.unitType,
      purchaseRate: entry.purchaseRate,
      sellingPrice: entry.sellingPrice,
      mrp: entry.mrp,
      batchNumber: entry.batchNumber || "",
      expiryDate: entry.expiryDate ? entry.expiryDate.split("T")[0] : "",
      manufacturingDate: entry.manufacturingDate ? entry.manufacturingDate.split("T")[0] : "",
      rackNumber: entry.rackNumber || "",
      supplierId: entry.supplierId || "",
      remarks: entry.remarks || "",
    });
    setShowForm(true);
  };

  // Excel Bulk Import File Upload
  const handleExcelUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setErrorMsg("");
    setSuccessMsg("");

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const data = evt.target?.result;
        const workbook = XLSX.read(data, { type: "binary" });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const json: any[] = XLSX.utils.sheet_to_json(sheet);

        if (json.length === 0) {
          setErrorMsg("The uploaded Excel sheet is empty");
          return;
        }

        // Map sheets values to payload
        const mapped = json.map((row) => {
          const skuVal = String(row.SKU || row.sku || row.ProductCode || row.product_code || "").trim();
          const nameVal = String(row.ProductName || row.name || row.ProductName || "").trim();
          
          const product = products.find((p) => 
            (skuVal && p.sku && p.sku.toLowerCase() === skuVal.toLowerCase()) || 
            (nameVal && p.name.toLowerCase() === nameVal.toLowerCase())
          );

          if (!product) {
            console.warn(`Product not resolved for row:`, row);
            return null;
          }

          const bName = String(row.Branch || row.branch || row.Warehouse || "").trim();
          const branch = branches.find((b) => bName && b.name.toLowerCase() === bName.toLowerCase()) || branches[0];

          const sName = String(row.Supplier || row.supplier || "").trim();
          const supplier = suppliers.find((s) => sName && s.name.toLowerCase() === sName.toLowerCase());

          return {
            productId: product.id,
            branchId: branch ? branch.id : user?.branchId,
            quantity: parseFloat(row.Quantity || row.quantity || row.Qty || 0),
            unitType: String(row.Unit || row.unitType || "pcs").toLowerCase().trim(),
            purchaseRate: parseFloat(row.PurchaseRate || row.purchaseRate || product.costPrice || 0),
            sellingPrice: parseFloat(row.SellingPrice || row.sellingPrice || product.sellingPrice || 0),
            mrp: parseFloat(row.MRP || row.mrp || product.sellingPrice || 0),
            batchNumber: row.BatchNumber || row.batch || null,
            expiryDate: row.ExpiryDate || row.expiry || null,
            manufacturingDate: row.MfgDate || row.manufacturing || null,
            rackNumber: row.Rack || row.rackNumber || null,
            supplierId: supplier ? supplier.id : null,
            remarks: row.Remarks || "Bulk Imported via Excel",
            approvalStatus: isManagerOrOwner ? "APPROVED" : "PENDING",
          };
        }).filter(Boolean);

        if (mapped.length === 0) {
          setErrorMsg("Could not map any products. Check if Product SKUs or Names match the catalog.");
          return;
        }

        const res = await fetch("/api/v1/inventory/opening", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(mapped),
        });

        if (res.ok) {
          setSuccessMsg(`Successfully imported ${mapped.length} opening stock records`);
          fetchEntries();
        } else {
          const err = await res.json();
          setErrorMsg(err.error || "Failed to process imported records");
        }
      } catch (err: any) {
        console.error(err);
        setErrorMsg("Failed to read the Excel file. Make sure it is a valid format.");
      }
    };
    reader.readAsBinaryString(file);
  };

  // EXPORT Reports
  const handleExportReportExcel = (title: string, headers: string[], rows: any[][]) => {
    const dataObjects = rows.map((row) => {
      const obj: any = {};
      headers.forEach((header, index) => {
        obj[header] = row[index];
      });
      return obj;
    });
    exportToExcel(dataObjects, title.toLowerCase().replace(/ /g, "_"));
  };

  const handleExportReportPDF = (title: string, headers: string[], rows: any[][]) => {
    exportToPDF(headers, rows, title, title.toLowerCase().replace(/ /g, "_"));
  };

  // Compile Report Data dynamically based on current entries
  const getOverallReport = () => {
    const headers = ["Product Name", "SKU", "Branch/Warehouse", "Qty", "Unit", "Purchase Rate", "Valuation", "Status"];
    const rows = entries.map((entry) => [
      entry.product.name,
      entry.product.sku || "N/A",
      entry.branch.name,
      entry.quantity,
      entry.unitType,
      `${currencySymbol}${entry.purchaseRate.toFixed(2)}`,
      `${currencySymbol}${entry.totalValue.toFixed(2)}`,
      entry.approvalStatus,
    ]);
    return { headers, rows, title: "Opening Stock Inventory Valuation Report" };
  };

  const getBatchReport = () => {
    const headers = ["Batch Number", "Product Name", "SKU", "Branch/Warehouse", "Rack", "Qty", "Supplier"];
    const rows = entries
      .filter((e) => e.batchNumber)
      .map((entry) => [
        entry.batchNumber,
        entry.product.name,
        entry.product.sku || "N/A",
        entry.branch.name,
        entry.rackNumber || "N/A",
        entry.quantity,
        entry.supplier?.name || "N/A",
      ]);
    return { headers, rows, title: "Batch-wise Tracking Report" };
  };

  const getExpiryReport = () => {
    const headers = ["Expiry Date", "Batch Number", "Product Name", "Branch/Warehouse", "Qty", "Days Left", "Alert"];
    const now = new Date();
    const rows = entries
      .filter((e) => e.expiryDate)
      .map((entry) => {
        const exp = new Date(entry.expiryDate!);
        const days = Math.ceil((exp.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
        let alert = "OK";
        if (days < 0) alert = "EXPIRED";
        else if (days <= 60) alert = "CRITICAL";
        else if (days <= 180) alert = "WARNING";

        return [
          exp.toLocaleDateString(),
          entry.batchNumber || "N/A",
          entry.product.name,
          entry.branch.name,
          entry.quantity,
          days < 0 ? `Expired (${Math.abs(days)}d ago)` : `${days} days`,
          alert,
        ];
      });
    return { headers, rows, title: "Batch Expiration Threat Analysis Report" };
  };

  const getWarehouseReport = () => {
    const headers = ["Branch/Warehouse", "Total Entries", "Total Quantity", "Valuation"];
    const map: Record<string, { count: number; qty: number; value: number }> = {};
    
    entries.forEach((e) => {
      const b = e.branch.name;
      if (!map[b]) map[b] = { count: 0, qty: 0, value: 0 };
      map[b].count++;
      map[b].qty += e.quantity;
      map[b].value += e.totalValue;
    });

    const rows = Object.entries(map).map(([branch, meta]) => [
      branch,
      meta.count,
      meta.qty,
      `${currencySymbol}${meta.value.toFixed(2)}`,
    ]);

    return { headers, rows, title: "Warehouse-wise Allocation Valuation Report" };
  };

  const getSupplierReport = () => {
    const headers = ["Supplier Name", "Total Entries Allocation", "Total Qty restocked", "Restock Valuation"];
    const map: Record<string, { count: number; qty: number; value: number }> = {};
    
    entries.forEach((e) => {
      const s = e.supplier?.name || "Unassigned/Self restock";
      if (!map[s]) map[s] = { count: 0, qty: 0, value: 0 };
      map[s].count++;
      map[s].qty += e.quantity;
      map[s].value += e.totalValue;
    });

    const rows = Object.entries(map).map(([sup, meta]) => [
      sup,
      meta.count,
      meta.qty,
      `${currencySymbol}${meta.value.toFixed(2)}`,
    ]);

    return { headers, rows, title: "Supplier-wise Restock Analysis Report" };
  };

  const currentReport = () => {
    switch (selectedReport) {
      case "overall": return getOverallReport();
      case "batch": return getBatchReport();
      case "expiry": return getExpiryReport();
      case "warehouse": return getWarehouseReport();
      case "supplier": return getSupplierReport();
    }
  };

  const totalOpeningValue = entries
    .filter((e) => e.approvalStatus === "APPROVED")
    .reduce((sum, e) => sum + e.totalValue, 0);

  return (
    <div className="space-y-6">
      {/* 1. Header Control Panel */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-card border border-border p-6 rounded-3xl shadow-sm bg-gradient-to-br from-primary/5 via-transparent to-transparent">
        <div>
          <h1 className="text-2xl font-black flex items-center gap-2">
            <Layers className="h-6 w-6 text-primary" />
            Opening Stock
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Initialize opening inventory levels, manage pharmacy batches, and track approvals.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <input
              type="file"
              accept=".xlsx,.xls"
              onChange={handleExcelUpload}
              className="hidden"
              id="excel-upload"
            />
            <label
              htmlFor="excel-upload"
              className="flex items-center gap-1.5 px-3 py-2 bg-secondary border border-border hover:bg-secondary/80 rounded-xl text-xs font-bold transition-all cursor-pointer"
            >
              <FileSpreadsheet className="h-4.5 w-4.5 text-emerald-600" />
              <span>Excel Import</span>
            </label>
          </div>
          <button
            onClick={() => {
              setEditingEntry(null);
              setFormData({
                productId: "",
                branchId: user?.branchId || "",
                quantity: 0,
                unitType: "pcs",
                purchaseRate: 0,
                sellingPrice: 0,
                mrp: 0,
                batchNumber: "",
                expiryDate: "",
                manufacturingDate: "",
                rackNumber: "",
                supplierId: "",
                remarks: "",
              });
              setShowForm(true);
            }}
            className="flex items-center gap-1 px-4 py-2 bg-primary text-primary-foreground hover:bg-primary/95 rounded-xl text-xs font-bold transition-all cursor-pointer"
          >
            <Plus className="h-4.5 w-4.5" />
            Add Entry
          </button>
        </div>
      </div>

      {/* Tabs Menu */}
      <div className="flex border-b border-border">
        <button
          onClick={() => setActiveTab("entries")}
          className={`px-5 py-2.5 font-bold text-xs border-b-2 transition-all cursor-pointer ${
            activeTab === "entries" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          Opening Stock Entries
        </button>
        <button
          onClick={() => setActiveTab("reports")}
          className={`px-5 py-2.5 font-bold text-xs border-b-2 transition-all cursor-pointer ${
            activeTab === "reports" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          Reports & Analytics
        </button>
      </div>

      {successMsg && (
        <div className="p-3 text-xs bg-emerald-500/10 text-emerald-600 rounded-xl font-bold border border-emerald-500/20">
          {successMsg}
        </div>
      )}
      {errorMsg && (
        <div className="p-3 text-xs bg-destructive/10 text-destructive rounded-xl font-bold border border-destructive/20">
          {errorMsg}
        </div>
      )}

      {activeTab === "entries" ? (
        <>
          {/* Filters Panel */}
          <div className="bg-card border border-border p-6 rounded-3xl shadow-sm grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search SKU, name, barcode..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 w-full px-3 py-2 border border-border rounded-lg bg-background text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            <select
              value={selectedBranch}
              onChange={(e) => setSelectedBranch(e.target.value)}
              className="px-3 py-2 border border-border rounded-lg bg-background text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="">All Branches</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>

            <select
              value={selectedSupplier}
              onChange={(e) => setSelectedSupplier(e.target.value)}
              className="px-3 py-2 border border-border rounded-lg bg-background text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="">All Suppliers</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>

            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="px-3 py-2 border border-border rounded-lg bg-background text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="">All Statuses</option>
              <option value="PENDING">Pending Approval</option>
              <option value="APPROVED">Approved</option>
              <option value="REJECTED">Rejected</option>
            </select>
          </div>

          {/* Value Indicator Banner */}
          <div className="bg-secondary/40 border border-border rounded-2xl p-4 flex justify-between items-center text-xs">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4.5 w-4.5 text-primary animate-pulse" />
              <span className="font-semibold text-muted-foreground">Approved Valuation:</span>
              <span className="font-bold text-foreground text-sm">{currencySymbol}{totalOpeningValue.toFixed(2)}</span>
            </div>
            <div className="text-muted-foreground font-semibold">
              {entries.length} Total Logs
            </div>
          </div>

          {/* Table List */}
          <div className="bg-card border border-border rounded-3xl p-6 shadow-sm">
            {loading ? (
              <div className="py-12 text-center text-xs text-muted-foreground">
                <RefreshCw className="h-6 w-6 animate-spin mx-auto text-primary mb-2" />
                Loading opening stock catalog...
              </div>
            ) : entries.length === 0 ? (
              <div className="py-12 text-center text-xs text-muted-foreground">
                <Archive className="h-10 w-10 mx-auto opacity-35 mb-2" />
                No opening stock entry logs recorded. Add a manual entry or load an Excel sheet.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left border-collapse">
                  <thead>
                    <tr className="border-b border-border text-muted-foreground font-semibold uppercase tracking-wider text-[10px]">
                      <th className="py-3 px-2">Product</th>
                      <th className="py-3 px-2">Branch / Wh</th>
                      <th className="py-3 px-2">Qty</th>
                      <th className="py-3 px-2">Pricing</th>
                      <th className="py-3 px-2">Valuation</th>
                      <th className="py-3 px-2">Batch / Expiry</th>
                      <th className="py-3 px-2">Remarks</th>
                      <th className="py-3 px-2">Status</th>
                      <th className="py-3 px-2 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50">
                    {entries.map((entry) => {
                      const isPending = entry.approvalStatus === "PENDING";
                      return (
                        <tr key={entry.id} className="hover:bg-secondary/20">
                          <td className="py-3 px-2">
                            <div className="font-bold text-foreground">{entry.product.name}</div>
                            <div className="text-[10px] text-muted-foreground font-mono uppercase">
                              SKU: {entry.product.sku || "N/A"} | Barcode: {entry.product.barcode || "N/A"}
                            </div>
                          </td>
                          <td className="py-3 px-2 font-semibold text-foreground">
                            {entry.branch.name}
                          </td>
                          <td className="py-3 px-2 font-bold text-foreground">
                            {entry.quantity} <span className="text-[10px] text-muted-foreground font-normal">{entry.unitType}</span>
                          </td>
                          <td className="py-3 px-2 whitespace-nowrap text-muted-foreground">
                            <div>PR: <span className="font-semibold text-foreground">{currencySymbol}{entry.purchaseRate.toFixed(2)}</span></div>
                            <div>SP: <span className="font-semibold text-foreground">{currencySymbol}{entry.sellingPrice.toFixed(2)}</span></div>
                          </td>
                          <td className="py-3 px-2 font-black text-primary whitespace-nowrap">
                            {currencySymbol}{entry.totalValue.toFixed(2)}
                          </td>
                          <td className="py-3 px-2">
                            {entry.batchNumber ? (
                              <div>
                                <div className="font-bold text-foreground">B: {entry.batchNumber}</div>
                                {entry.expiryDate && (
                                  <div className="text-[10px] text-muted-foreground">
                                    Exp: {new Date(entry.expiryDate).toLocaleDateString()}
                                  </div>
                                )}
                              </div>
                            ) : (
                              <span className="text-muted-foreground italic text-[10px]">None</span>
                            )}
                          </td>
                          <td className="py-3 px-2 max-w-xs truncate text-muted-foreground" title={entry.remarks || ""}>
                            {entry.remarks || "No remarks"}
                          </td>
                          <td className="py-3 px-2 whitespace-nowrap">
                            <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold border uppercase tracking-wider ${
                              entry.approvalStatus === "APPROVED" 
                                ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
                                : entry.approvalStatus === "REJECTED"
                                ? "bg-destructive/10 text-destructive border-destructive/20"
                                : "bg-amber-500/10 text-amber-600 border-amber-500/20"
                            }`}>
                              {entry.approvalStatus}
                            </span>
                          </td>
                          <td className="py-3 px-2 text-right whitespace-nowrap">
                            {isPending && (
                              <div className="flex justify-end gap-1.5">
                                {isManagerOrOwner && (
                                  <>
                                    <button
                                      onClick={() => handleApproval(entry.id, "APPROVED")}
                                      className="p-1.5 bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 rounded-lg transition-colors cursor-pointer"
                                      title="Approve"
                                    >
                                      <Check className="h-3.5 w-3.5" />
                                    </button>
                                    <button
                                      onClick={() => handleApproval(entry.id, "REJECTED")}
                                      className="p-1.5 bg-destructive/10 text-destructive hover:bg-destructive/20 rounded-lg transition-colors cursor-pointer"
                                      title="Reject"
                                    >
                                      <X className="h-3.5 w-3.5" />
                                    </button>
                                  </>
                                )}
                                <button
                                  onClick={() => handleEditClick(entry)}
                                  className="p-1.5 bg-secondary text-primary hover:bg-secondary/80 rounded-lg transition-colors cursor-pointer"
                                  title="Edit"
                                >
                                  <Edit2 className="h-3.5 w-3.5" />
                                </button>
                                <button
                                  onClick={() => handleDelete(entry.id)}
                                  className="p-1.5 bg-secondary text-destructive hover:bg-secondary/80 rounded-lg transition-colors cursor-pointer"
                                  title="Delete"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            )}
                            {!isPending && (
                              <span className="text-[10px] text-muted-foreground font-semibold flex items-center gap-1 justify-end">
                                <UserCheck className="h-3.5 w-3.5" /> Approved
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      ) : (
        /* Reports Sub-module */
        <div className="space-y-6">
          {/* Report selectors */}
          <div className="flex flex-wrap gap-2">
            {[
              { id: "overall", label: "Valuation Report" },
              { id: "batch", label: "Batch Report" },
              { id: "expiry", label: "Expiry Report" },
              { id: "warehouse", label: "Warehouse allocations" },
              { id: "supplier", label: "Supplier restocks" },
            ].map((rep) => (
              <button
                key={rep.id}
                onClick={() => setSelectedReport(rep.id as any)}
                className={`px-4 py-2 border rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  selectedReport === rep.id 
                    ? "bg-primary text-primary-foreground border-primary" 
                    : "bg-card text-foreground border-border hover:bg-secondary"
                }`}
              >
                {rep.label}
              </button>
            ))}
          </div>

          {/* Compiled report view card */}
          {(() => {
            const report = currentReport();
            if (!report) return null;
            return (
              <div className="bg-card border border-border p-6 rounded-3xl space-y-4 shadow-sm">
                <div className="flex justify-between items-center border-b border-border pb-4">
                  <div>
                    <h2 className="text-sm font-black text-foreground">{report.title}</h2>
                    <p className="text-[10px] text-muted-foreground mt-0.5">Scoped on current approved opening stock ledger balances.</p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleExportReportExcel(report.title, report.headers, report.rows)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-secondary border border-border hover:bg-secondary/80 rounded-xl text-xs font-bold text-foreground transition-all cursor-pointer"
                    >
                      <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
                      Excel Export
                    </button>
                    <button
                      onClick={() => handleExportReportPDF(report.title, report.headers, report.rows)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-secondary border border-border hover:bg-secondary/80 rounded-xl text-xs font-bold text-foreground transition-all cursor-pointer"
                    >
                      <FileText className="h-4 w-4 text-red-500" />
                      PDF Export
                    </button>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left border-collapse">
                    <thead>
                      <tr className="border-b border-border text-muted-foreground font-semibold">
                        {report.headers.map((h) => (
                          <th key={h} className="py-2.5 px-2">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/50">
                      {report.rows.length === 0 ? (
                        <tr>
                          <td colSpan={report.headers.length} className="py-6 text-center text-muted-foreground italic">
                            No report rows available for this scope.
                          </td>
                        </tr>
                      ) : (
                        report.rows.map((row, index) => (
                          <tr key={index} className="hover:bg-secondary/10">
                            {row.map((cell, cellIdx) => {
                              const isAlertCol = report.headers[cellIdx] === "Alert";
                              return (
                                <td key={cellIdx} className="py-2.5 px-2 font-medium">
                                  {isAlertCol ? (
                                    <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase ${
                                      cell === "EXPIRED" 
                                        ? "bg-red-500/10 text-red-600"
                                        : cell === "CRITICAL"
                                        ? "bg-orange-500/10 text-orange-600 animate-pulse"
                                        : cell === "WARNING"
                                        ? "bg-amber-500/10 text-amber-600"
                                        : "bg-emerald-500/10 text-emerald-600"
                                    }`}>
                                      {cell}
                                    </span>
                                  ) : (
                                    cell
                                  )}
                                </td>
                              );
                            })}
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* Manual Entry Dialog / Edit Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form
            onSubmit={handleSubmit}
            className="bg-card border border-border rounded-3xl max-w-3xl w-full max-h-[90vh] flex flex-col shadow-2xl animate-in fade-in zoom-in-95 duration-150"
          >
            <div className="p-6 border-b border-border/50 flex items-center justify-between">
              <h3 className="font-black text-foreground text-sm flex items-center gap-2">
                <Archive className="h-5 w-5 text-primary" />
                {editingEntry ? "Edit Opening Stock" : "Add Opening Stock Entry"}
              </h3>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="px-2.5 py-1 text-xs border border-border hover:bg-secondary rounded-xl font-semibold cursor-pointer"
              >
                Cancel
              </button>
            </div>

            <div className="p-6 overflow-y-auto grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
              {/* Product Select */}
              <div className="space-y-1">
                <label className="text-[10px] uppercase font-bold text-muted-foreground">Product *</label>
                <select
                  value={formData.productId}
                  onChange={(e) => handleProductChange(e.target.value)}
                  required
                  disabled={!!editingEntry}
                  className="w-full px-3 py-2 border border-border rounded-lg bg-background text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="">Select Product</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>{p.name} ({p.sku || "No SKU"})</option>
                  ))}
                </select>
              </div>

              {/* Branch Select */}
              <div className="space-y-1">
                <label className="text-[10px] uppercase font-bold text-muted-foreground">Branch / Warehouse *</label>
                <select
                  value={formData.branchId}
                  onChange={(e) => setFormData((prev) => ({ ...prev, branchId: e.target.value }))}
                  required
                  disabled={!!editingEntry}
                  className="w-full px-3 py-2 border border-border rounded-lg bg-background text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="">Select Branch</option>
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </div>

              {/* Supplier Select */}
              <div className="space-y-1">
                <label className="text-[10px] uppercase font-bold text-muted-foreground">Supplier</label>
                <select
                  value={formData.supplierId}
                  onChange={(e) => setFormData((prev) => ({ ...prev, supplierId: e.target.value }))}
                  className="w-full px-3 py-2 border border-border rounded-lg bg-background text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="">Select Supplier</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>

              {/* Quantity */}
              <div className="space-y-1">
                <label className="text-[10px] uppercase font-bold text-muted-foreground">Opening Quantity *</label>
                <input
                  type="number"
                  step="any"
                  value={formData.quantity}
                  onChange={(e) => setFormData((prev) => ({ ...prev, quantity: parseFloat(e.target.value) || 0 }))}
                  required
                  className="w-full px-3 py-2 border border-border rounded-lg bg-background text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              {/* Unit Type */}
              <div className="space-y-1">
                <label className="text-[10px] uppercase font-bold text-muted-foreground">Unit Type *</label>
                <select
                  value={formData.unitType}
                  onChange={(e) => setFormData((prev) => ({ ...prev, unitType: e.target.value }))}
                  required
                  className="w-full px-3 py-2 border border-border rounded-lg bg-background text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  {unitTypes.map((u) => (
                    <option key={u} value={u}>{u}</option>
                  ))}
                </select>
              </div>

              {/* Purchase Rate */}
              <div className="space-y-1">
                <label className="text-[10px] uppercase font-bold text-muted-foreground">Purchase Rate ({currencySymbol}) *</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.purchaseRate}
                  onChange={(e) => setFormData((prev) => ({ ...prev, purchaseRate: parseFloat(e.target.value) || 0 }))}
                  required
                  className="w-full px-3 py-2 border border-border rounded-lg bg-background text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              {/* Selling Price */}
              <div className="space-y-1">
                <label className="text-[10px] uppercase font-bold text-muted-foreground">Selling Price ({currencySymbol}) *</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.sellingPrice}
                  onChange={(e) => setFormData((prev) => ({ ...prev, sellingPrice: parseFloat(e.target.value) || 0 }))}
                  required
                  className="w-full px-3 py-2 border border-border rounded-lg bg-background text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              {/* MRP */}
              <div className="space-y-1">
                <label className="text-[10px] uppercase font-bold text-muted-foreground">MRP ({currencySymbol}) *</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.mrp}
                  onChange={(e) => setFormData((prev) => ({ ...prev, mrp: parseFloat(e.target.value) || 0 }))}
                  required
                  className="w-full px-3 py-2 border border-border rounded-lg bg-background text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              {/* Total Stock Value (Calculated Automatically) */}
              <div className="space-y-1">
                <label className="text-[10px] uppercase font-bold text-muted-foreground block">Total Stock Value</label>
                <div className="p-2 border border-dashed border-border rounded-lg text-foreground font-black bg-secondary/20">
                  {currencySymbol}{(formData.quantity * formData.purchaseRate).toFixed(2)}
                </div>
              </div>

              {/* Batch Number */}
              <div className="space-y-1">
                <label className="text-[10px] uppercase font-bold text-muted-foreground">Batch Number</label>
                <input
                  type="text"
                  value={formData.batchNumber}
                  onChange={(e) => setFormData((prev) => ({ ...prev, batchNumber: e.target.value }))}
                  className="w-full px-3 py-2 border border-border rounded-lg bg-background text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              {/* Manufacturing Date */}
              <div className="space-y-1">
                <label className="text-[10px] uppercase font-bold text-muted-foreground">Mfg Date</label>
                <input
                  type="date"
                  value={formData.manufacturingDate}
                  onChange={(e) => setFormData((prev) => ({ ...prev, manufacturingDate: e.target.value }))}
                  className="w-full px-3 py-2 border border-border rounded-lg bg-background text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              {/* Expiry Date */}
              <div className="space-y-1">
                <label className="text-[10px] uppercase font-bold text-muted-foreground">Expiry Date</label>
                <input
                  type="date"
                  value={formData.expiryDate}
                  onChange={(e) => setFormData((prev) => ({ ...prev, expiryDate: e.target.value }))}
                  className="w-full px-3 py-2 border border-border rounded-lg bg-background text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              {/* Rack Number */}
              <div className="space-y-1">
                <label className="text-[10px] uppercase font-bold text-muted-foreground">Rack Number</label>
                <input
                  type="text"
                  placeholder="e.g. Rack A-4"
                  value={formData.rackNumber}
                  onChange={(e) => setFormData((prev) => ({ ...prev, rackNumber: e.target.value }))}
                  className="w-full px-3 py-2 border border-border rounded-lg bg-background text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              {/* Remarks / Notes */}
              <div className="space-y-1 md:col-span-2">
                <label className="text-[10px] uppercase font-bold text-muted-foreground">Remarks / Notes</label>
                <input
                  type="text"
                  value={formData.remarks}
                  onChange={(e) => setFormData((prev) => ({ ...prev, remarks: e.target.value }))}
                  className="w-full px-3 py-2 border border-border rounded-lg bg-background text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
            </div>

            {!isManagerOrOwner && (
              <div className="mx-6 px-4 py-2 border border-amber-500/20 bg-amber-500/10 rounded-xl text-[10px] text-amber-700 font-semibold flex items-center gap-1.5">
                <ShieldAlert className="h-4 w-4" />
                This entry will require a Manager or Owner's approval before modifying active stock level quantities.
              </div>
            )}

            <div className="p-6 border-t border-border/50 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="px-4 py-2 bg-secondary border border-border hover:bg-secondary/80 rounded-xl font-bold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-primary text-primary-foreground hover:bg-primary/95 rounded-xl font-bold cursor-pointer"
              >
                {editingEntry ? "Save Changes" : isManagerOrOwner ? "Save and Approve" : "Submit Entry"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
