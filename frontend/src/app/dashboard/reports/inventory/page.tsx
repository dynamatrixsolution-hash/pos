"use client";

import * as React from "react";
import { useSession } from "next-auth/react";
import { useSettings } from "@/components/settings-provider";
import {
  Download,
  Printer,
  Calendar,
  Store,
  Boxes,
  Search,
  AlertTriangle,
} from "lucide-react";
import * as XLSX from "xlsx";
import { jsPDF } from "jspdf";

interface Product {
  id: string;
  name: string;
  sku: string;
  costPrice: number;
  sellingPrice: number;
  alertQuantity: number;
  productStocks: Array<{ quantity: number }>;
  category?: { name: string } | null;
  batches?: Array<{
    id: string;
    batchNumber: string;
    quantity: number;
    expiryDate: string | null;
  }>;
}

export default function InventoryReportsPage() {
  const { data: session } = useSession();
  const { currencySymbol } = useSettings();

  const [activeTab, setActiveTab] = React.useState<string>("summary");
  const [products, setProducts] = React.useState<Product[]>([]);
  const [branches, setBranches] = React.useState<any[]>([]);
  const [selectedBranch, setSelectedBranch] = React.useState<string>("");
  const [searchQuery, setSearchQuery] = React.useState<string>("");
  const [isLoading, setIsLoading] = React.useState<boolean>(true);

  // Load resources
  React.useEffect(() => {
    async function loadData() {
      setIsLoading(true);
      try {
        const [prodRes, branchRes] = await Promise.all([
          fetch("/api/v1/products?limit=250"),
          fetch("/api/v1/branches"),
        ]);
        if (prodRes.ok) {
          const data = await prodRes.json();
          setProducts(data.products || []);
        }
        if (branchRes.ok) {
          const data = await branchRes.json();
          setBranches(data);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    }
    loadData();
  }, []);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value.toLowerCase());
  };

  const getFilteredProducts = () => {
    let result = products;

    if (searchQuery.trim()) {
      result = result.filter(
        (p) =>
          p.name.toLowerCase().includes(searchQuery) ||
          p.sku.toLowerCase().includes(searchQuery)
      );
    }

    if (activeTab === "lowstock") {
      result = result.filter((p) => {
        const stock = p.productStocks.reduce((sum, s) => sum + s.quantity, 0);
        return stock <= p.alertQuantity;
      });
    }

    return result;
  };

  const filteredProducts = getFilteredProducts();

  const exportExcel = () => {
    if (filteredProducts.length === 0) return alert("No inventory data to export");
    const exportData = filteredProducts.map((p) => {
      const stock = p.productStocks.reduce((sum, s) => sum + s.quantity, 0);
      return {
        Name: p.name,
        SKU: p.sku || "",
        Category: p.category?.name || "N/A",
        Stock: stock,
        "Cost Price": p.costPrice,
        "Selling Price": p.sellingPrice,
        "Stock Value": stock * p.costPrice,
      };
    });

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Inventory");
    XLSX.writeFile(wb, `inventory_${activeTab}.xlsx`);
  };

  const exportPDF = () => {
    if (filteredProducts.length === 0) return alert("No inventory data to export");
    const doc = new jsPDF();
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.setTextColor(94, 80, 235);
    doc.text(`DynaPOS - Inventory ${activeTab.toUpperCase()} Statement`, 14, 20);
    doc.save(`inventory_${activeTab}.pdf`);
  };

  const renderContent = () => {
    if (isLoading) {
      return (
        <div className="h-64 flex flex-col items-center justify-center space-y-3">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#2563EB] border-t-transparent" />
          <p className="text-xs text-muted-foreground font-medium">Analyzing stock levels...</p>
        </div>
      );
    }

    if (activeTab === "summary" || activeTab === "lowstock") {
      return (
        <div className="space-y-4">
          <div className="overflow-x-auto border border-slate-200/50 dark:border-slate-800 rounded-2xl">
            <table className="w-full text-xs text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-800 text-slate-500 font-bold uppercase text-[9px] tracking-wider">
                  <th className="py-2.5 px-3">Product Name</th>
                  <th className="py-2.5 px-3">SKU</th>
                  <th className="py-2.5 px-3">Category</th>
                  <th className="py-2.5 px-3 text-right">Cost Price</th>
                  <th className="py-2.5 px-3 text-right">Selling Price</th>
                  <th className="py-2.5 px-3 text-right">Alert Qty</th>
                  <th className="py-2.5 px-3 text-right">Current Stock</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {filteredProducts.map((p) => {
                  const stock = p.productStocks.reduce((sum, s) => sum + s.quantity, 0);
                  const isLow = stock <= p.alertQuantity;

                  return (
                    <tr key={p.id} className="hover:bg-slate-50/50">
                      <td className="py-2.5 px-3 font-semibold text-slate-800 dark:text-slate-200">{p.name}</td>
                      <td className="py-2.5 px-3 font-mono text-slate-500">{p.sku}</td>
                      <td className="py-2.5 px-3 text-slate-500">{p.category?.name || "N/A"}</td>
                      <td className="py-2.5 px-3 text-right">{currencySymbol}{p.costPrice.toFixed(2)}</td>
                      <td className="py-2.5 px-3 text-right">{currencySymbol}{p.sellingPrice.toFixed(2)}</td>
                      <td className="py-2.5 px-3 text-right font-semibold text-slate-400">{p.alertQuantity}</td>
                      <td className={`py-2.5 px-3 text-right font-bold ${isLow ? "text-red-500" : "text-emerald-600"}`}>
                        {stock} available
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      );
    }

    if (activeTab === "stockvalue") {
      const totalInventoryValue = products.reduce((acc, cur) => {
        const stock = cur.productStocks.reduce((sum, s) => sum + s.quantity, 0);
        return acc + stock * cur.costPrice;
      }, 0);

      return (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200/50 dark:border-slate-800 p-4 rounded-2xl">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total Asset Stock Value</span>
              <h4 className="text-lg font-black text-[#2563EB] mt-1">{currencySymbol}{totalInventoryValue.toFixed(2)}</h4>
            </div>
            <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200/50 dark:border-slate-800 p-4 rounded-2xl">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Products Catalog Count</span>
              <h4 className="text-lg font-black text-foreground mt-1">{products.length} entries</h4>
            </div>
          </div>

          <div className="overflow-x-auto border border-slate-200/50 dark:border-slate-800 rounded-2xl">
            <table className="w-full text-xs text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-800 text-slate-500 font-bold uppercase text-[9px] tracking-wider">
                  <th className="py-2.5 px-3">Product Name</th>
                  <th className="py-2.5 px-3">SKU</th>
                  <th className="py-2.5 px-3 text-right">Available Stock</th>
                  <th className="py-2.5 px-3 text-right">Purchase Unit Cost</th>
                  <th className="py-2.5 px-3 text-right">Total Net Asset Value</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-mono">
                {filteredProducts.map((p) => {
                  const stock = p.productStocks.reduce((sum, s) => sum + s.quantity, 0);
                  const netValue = stock * p.costPrice;

                  return (
                    <tr key={p.id} className="hover:bg-slate-50/50 font-sans">
                      <td className="py-2.5 px-3 font-semibold text-slate-850 dark:text-slate-200">{p.name}</td>
                      <td className="py-2.5 px-3 font-mono text-slate-400">{p.sku}</td>
                      <td className="py-2.5 px-3 text-right">{stock}</td>
                      <td className="py-2.5 px-3 text-right">{currencySymbol}{p.costPrice.toFixed(2)}</td>
                      <td className="py-2.5 px-3 text-right font-extrabold text-[#2563EB]">{currencySymbol}{netValue.toFixed(2)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      );
    }

    if (activeTab === "batch") {
      return (
        <div className="space-y-4">
          <div className="overflow-x-auto border border-slate-200/50 dark:border-slate-800 rounded-2xl">
            <table className="w-full text-xs text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 text-slate-500 font-bold uppercase text-[9px] tracking-wider">
                  <th className="py-2.5 px-3">Product</th>
                  <th className="py-2.5 px-3">Batch Number</th>
                  <th className="py-2.5 px-3 text-right">Stock Quantity</th>
                  <th className="py-2.5 px-3">Expiration Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {products.filter((p) => p.batches && p.batches.length > 0).flatMap((p) =>
                  (p.batches || []).map((b) => (
                    <tr key={b.id} className="hover:bg-slate-50/50 font-sans">
                      <td className="py-2.5 px-3 font-semibold text-slate-800 dark:text-slate-200">{p.name}</td>
                      <td className="py-2.5 px-3 font-mono font-bold text-[#2563EB]">{b.batchNumber}</td>
                      <td className="py-2.5 px-3 text-right font-bold">{b.quantity}</td>
                      <td className="py-2.5 px-3 text-slate-500 font-mono">
                        {b.expiryDate ? new Date(b.expiryDate).toLocaleDateString() : "No Expiry Limit"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      );
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. Header */}
      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4 bg-white dark:bg-[#0a0f24] border border-slate-200/50 dark:border-slate-800 rounded-3xl p-6 shadow-sm">
        <div>
          <h1 className="text-2xl font-black text-slate-800 dark:text-white flex items-center gap-2">
            <Boxes className="h-6 w-6 text-[#2563EB]" /> Inventory Reports
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Audit inventory levels, batch lifespans, low-stock warnings, and net asset stock values.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full xl:w-auto">
          <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-900 border border-slate-200/50 dark:border-slate-800 px-3 py-2 rounded-xl text-xs w-full sm:w-auto">
            <Search className="h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search product SKU..."
              onChange={handleSearchChange}
              className="bg-transparent border-none outline-none font-bold text-foreground text-xs focus:ring-0"
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <button
              onClick={exportExcel}
              className="flex items-center justify-center gap-2 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold transition-all w-full sm:w-auto cursor-pointer"
            >
              <Download className="h-4 w-4" />
              <span>Excel</span>
            </button>
            <button
              onClick={exportPDF}
              className="flex items-center justify-center gap-2 px-3.5 py-2 bg-[#2563EB] text-white hover:bg-[#1D4ED8] rounded-xl text-xs font-bold transition-all w-full sm:w-auto cursor-pointer"
            >
              <Printer className="h-4 w-4" />
              <span>PDF</span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2.5 overflow-x-auto scrollbar-none shrink-0">
        <button
          onClick={() => setActiveTab("summary")}
          className={`px-4 py-2 text-xs font-bold rounded-xl whitespace-nowrap transition-all select-none cursor-pointer border ${
            activeTab === "summary"
              ? "bg-[#2563EB] text-white border-transparent shadow-md shadow-[#2563EB]/15"
              : "bg-white hover:bg-slate-50 dark:bg-[#0a0f24] dark:hover:bg-slate-900 text-slate-500 border-slate-200 dark:border-slate-850"
          }`}
        >
          Stock Summary
        </button>
        <button
          onClick={() => setActiveTab("lowstock")}
          className={`px-4 py-2 text-xs font-bold rounded-xl whitespace-nowrap transition-all select-none cursor-pointer border ${
            activeTab === "lowstock"
              ? "bg-[#2563EB] text-white border-transparent shadow-md shadow-[#2563EB]/15"
              : "bg-white hover:bg-slate-50 dark:bg-[#0a0f24] dark:hover:bg-slate-900 text-slate-500 border-slate-200 dark:border-slate-850"
          }`}
        >
          Low Stock Alerts
        </button>
        <button
          onClick={() => setActiveTab("stockvalue")}
          className={`px-4 py-2 text-xs font-bold rounded-xl whitespace-nowrap transition-all select-none cursor-pointer border ${
            activeTab === "stockvalue"
              ? "bg-[#2563EB] text-white border-transparent shadow-md shadow-[#2563EB]/15"
              : "bg-white hover:bg-slate-50 dark:bg-[#0a0f24] dark:hover:bg-slate-900 text-slate-500 border-slate-200 dark:border-slate-850"
          }`}
        >
          Stock Asset Valuation
        </button>
        <button
          onClick={() => setActiveTab("batch")}
          className={`px-4 py-2 text-xs font-bold rounded-xl whitespace-nowrap transition-all select-none cursor-pointer border ${
            activeTab === "batch"
              ? "bg-[#2563EB] text-white border-transparent shadow-md shadow-[#2563EB]/15"
              : "bg-white hover:bg-slate-50 dark:bg-[#0a0f24] dark:hover:bg-slate-900 text-slate-500 border-slate-200 dark:border-slate-850"
          }`}
        >
          Batch-wise Stock
        </button>
      </div>

      {/* 3. Content */}
      <div className="bg-white dark:bg-[#0a0f24] border border-slate-200/50 dark:border-slate-800 rounded-3xl p-6 shadow-sm">
        {renderContent()}
      </div>
    </div>
  );
}
