"use client";

import React, { useState, useEffect } from "react";
import { X, Layers, Save, Building2, Calendar, DollarSign, Package } from "lucide-react";
import { useInventoryOpeningStore } from "../../state/inventory-opening.store";

export const OpeningStockModal: React.FC = () => {
  const isCreateModalOpen = useInventoryOpeningStore((s) => s.isCreateModalOpen);
  const closeCreateModal = useInventoryOpeningStore((s) => s.closeCreateModal);
  const editingEntry = useInventoryOpeningStore((s) => s.editingEntry);
  const branches = useInventoryOpeningStore((s) => s.branches);
  const products = useInventoryOpeningStore((s) => s.products);
  const suppliers = useInventoryOpeningStore((s) => s.suppliers);
  const saveEntry = useInventoryOpeningStore((s) => s.saveEntry);
  const isSaving = useInventoryOpeningStore((s) => s.isSaving);

  const [productId, setProductId] = useState("");
  const [branchId, setBranchId] = useState("");
  const [supplierId, setSupplierId] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [unitType, setUnitType] = useState("pcs");
  const [purchaseRate, setPurchaseRate] = useState("0");
  const [sellingPrice, setSellingPrice] = useState("0");
  const [mrp, setMrp] = useState("0");
  const [batchNumber, setBatchNumber] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [manufacturingDate, setManufacturingDate] = useState("");
  const [rackNumber, setRackNumber] = useState("");
  const [remarks, setRemarks] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (editingEntry) {
      setProductId(editingEntry.productId || "");
      setBranchId(editingEntry.branchId || "");
      setSupplierId(editingEntry.supplierId || "");
      setQuantity(editingEntry.quantity?.toString() || "1");
      setUnitType(editingEntry.unitType || "pcs");
      setPurchaseRate(editingEntry.purchaseRate?.toString() || "0");
      setSellingPrice(editingEntry.sellingPrice?.toString() || "0");
      setMrp(editingEntry.mrp?.toString() || "0");
      setBatchNumber(editingEntry.batchNumber || "");
      setExpiryDate(editingEntry.expiryDate ? editingEntry.expiryDate.split("T")[0] : "");
      setManufacturingDate(editingEntry.manufacturingDate ? editingEntry.manufacturingDate.split("T")[0] : "");
      setRackNumber(editingEntry.rackNumber || "");
      setRemarks(editingEntry.remarks || "");
    } else {
      setProductId(products[0]?.id || "");
      setBranchId(branches[0]?.id || "");
      setSupplierId("");
      setQuantity("1");
      setUnitType("pcs");
      setPurchaseRate("0");
      setSellingPrice("0");
      setMrp("0");
      setBatchNumber("");
      setExpiryDate("");
      setManufacturingDate("");
      setRackNumber("");
      setRemarks("");
    }
    setError(null);
  }, [editingEntry, isCreateModalOpen, products, branches]);

  if (!isCreateModalOpen) return null;

  const handleProductChange = (prodId: string) => {
    setProductId(prodId);
    const prod = products.find((p) => p.id === prodId);
    if (prod) {
      if (prod.costPrice) setPurchaseRate(prod.costPrice.toString());
      if (prod.sellingPrice) setSellingPrice(prod.sellingPrice.toString());
      if (prod.unit?.name) setUnitType(prod.unit.name);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!productId) {
      setError("Please select a product");
      return;
    }
    if (!branchId) {
      setError("Please select a target branch");
      return;
    }
    const q = Number(quantity);
    if (isNaN(q) || q <= 0) {
      setError("Quantity must be greater than zero");
      return;
    }

    const payload = {
      productId,
      branchId,
      supplierId: supplierId || null,
      quantity: q,
      unitType,
      purchaseRate: Number(purchaseRate) || 0,
      sellingPrice: Number(sellingPrice) || 0,
      mrp: Number(mrp) || 0,
      batchNumber: batchNumber.trim() || null,
      expiryDate: expiryDate ? new Date(expiryDate).toISOString() : null,
      manufacturingDate: manufacturingDate ? new Date(manufacturingDate).toISOString() : null,
      rackNumber: rackNumber.trim() || null,
      remarks: remarks.trim() || null,
    };

    const success = await saveEntry(payload);
    if (!success) {
      setError("Failed to record opening stock");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#292320]/50 p-4 select-none">
      <div className="w-full max-w-xl rounded-xl border border-[#D8CEC1] bg-[#FFFCF7] p-5 space-y-4 max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#D8CEC1] pb-3 shrink-0">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-[#6B2837] text-white">
              <Layers className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-[#292320]">
                {editingEntry ? "Edit Opening Stock Entry" : "New Opening Stock Entry"}
              </h3>
              <p className="text-[11px] text-[#71675E]">
                Add opening inventory count to seed the initial branch stock ledger
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={closeCreateModal}
            className="h-8 w-8 rounded-lg border border-[#D8CEC1] bg-[#FFFCF7] hover:bg-[#EEE7DD] flex items-center justify-center text-[#71675E] hover:text-[#292320] cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {error && (
          <div className="p-2.5 rounded-lg border border-red-200 bg-red-50 text-xs text-[#DC2626] font-medium shrink-0">
            {error}
          </div>
        )}

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto space-y-3.5 pr-1">
          {/* Product & Branch */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-[#292320]">Product *</label>
              <select
                value={productId}
                onChange={(e) => handleProductChange(e.target.value)}
                disabled={Boolean(editingEntry)}
                className="w-full h-8 px-2.5 rounded-lg border border-[#D8CEC1] bg-[#FFFCF7] text-xs font-medium text-[#292320] focus:border-[#6B2837] focus:outline-none"
              >
                <option value="">-- Choose Product --</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} {p.sku ? `(${p.sku})` : ""}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-bold text-[#292320]">Branch *</label>
              <select
                value={branchId}
                onChange={(e) => setBranchId(e.target.value)}
                className="w-full h-8 px-2.5 rounded-lg border border-[#D8CEC1] bg-[#FFFCF7] text-xs font-medium text-[#292320] focus:border-[#6B2837] focus:outline-none"
              >
                <option value="">-- Choose Branch --</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Quantity, Unit & Supplier */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-[#292320]">Opening Quantity *</label>
              <input
                type="number"
                min="0.01"
                step="any"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className="w-full h-8 px-2.5 rounded-lg border border-[#D8CEC1] bg-[#FFFCF7] text-xs font-mono tabular-nums text-[#292320] focus:border-[#6B2837] focus:outline-none"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-bold text-[#292320]">Unit</label>
              <input
                type="text"
                value={unitType}
                onChange={(e) => setUnitType(e.target.value)}
                placeholder="pcs, kg, bottle..."
                className="w-full h-8 px-2.5 rounded-lg border border-[#D8CEC1] bg-[#FFFCF7] text-xs text-[#292320] focus:border-[#6B2837] focus:outline-none"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-bold text-[#292320]">Supplier (Optional)</label>
              <select
                value={supplierId}
                onChange={(e) => setSupplierId(e.target.value)}
                className="w-full h-8 px-2.5 rounded-lg border border-[#D8CEC1] bg-[#FFFCF7] text-xs font-medium text-[#292320] focus:border-[#6B2837] focus:outline-none"
              >
                <option value="">-- None / Direct --</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Pricing Row */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-[#292320]">Cost / Purchase Rate (NPR)</label>
              <input
                type="number"
                min="0"
                step="any"
                value={purchaseRate}
                onChange={(e) => setPurchaseRate(e.target.value)}
                className="w-full h-8 px-2.5 rounded-lg border border-[#D8CEC1] bg-[#FFFCF7] text-xs font-mono tabular-nums text-[#292320] focus:border-[#6B2837] focus:outline-none"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-bold text-[#292320]">Selling Price (NPR)</label>
              <input
                type="number"
                min="0"
                step="any"
                value={sellingPrice}
                onChange={(e) => setSellingPrice(e.target.value)}
                className="w-full h-8 px-2.5 rounded-lg border border-[#D8CEC1] bg-[#FFFCF7] text-xs font-mono tabular-nums text-[#292320] focus:border-[#6B2837] focus:outline-none"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-bold text-[#292320]">MRP (NPR)</label>
              <input
                type="number"
                min="0"
                step="any"
                value={mrp}
                onChange={(e) => setMrp(e.target.value)}
                className="w-full h-8 px-2.5 rounded-lg border border-[#D8CEC1] bg-[#FFFCF7] text-xs font-mono tabular-nums text-[#292320] focus:border-[#6B2837] focus:outline-none"
              />
            </div>
          </div>

          {/* Batch, Rack, Dates */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-[#292320]">Batch #</label>
              <input
                type="text"
                placeholder="e.g. BATCH-2026-001"
                value={batchNumber}
                onChange={(e) => setBatchNumber(e.target.value)}
                className="w-full h-8 px-2.5 rounded-lg border border-[#D8CEC1] bg-[#FFFCF7] text-xs font-mono text-[#292320] focus:border-[#6B2837] focus:outline-none"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-bold text-[#292320]">Rack / Shelf Location</label>
              <input
                type="text"
                placeholder="e.g. RACK-A4"
                value={rackNumber}
                onChange={(e) => setRackNumber(e.target.value)}
                className="w-full h-8 px-2.5 rounded-lg border border-[#D8CEC1] bg-[#FFFCF7] text-xs text-[#292320] focus:border-[#6B2837] focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-[#292320]">Manufacturing Date</label>
              <input
                type="date"
                value={manufacturingDate}
                onChange={(e) => setManufacturingDate(e.target.value)}
                className="w-full h-8 px-2.5 rounded-lg border border-[#D8CEC1] bg-[#FFFCF7] text-xs text-[#292320] focus:border-[#6B2837] focus:outline-none"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-bold text-[#292320]">Expiry Date</label>
              <input
                type="date"
                value={expiryDate}
                onChange={(e) => setExpiryDate(e.target.value)}
                className="w-full h-8 px-2.5 rounded-lg border border-[#D8CEC1] bg-[#FFFCF7] text-xs text-[#292320] focus:border-[#6B2837] focus:outline-none"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-bold text-[#292320]">Remarks / Audit Note</label>
            <input
              type="text"
              placeholder="e.g. Physical inventory counted by Auditor"
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              className="w-full h-8 px-2.5 rounded-lg border border-[#D8CEC1] bg-[#FFFCF7] text-xs text-[#292320] focus:border-[#6B2837] focus:outline-none"
            />
          </div>

          {/* Footer Buttons */}
          <div className="pt-3 border-t border-[#D8CEC1] flex items-center justify-end gap-2 shrink-0">
            <button
              type="button"
              onClick={closeCreateModal}
              className="px-3.5 py-2 text-xs font-semibold rounded-lg border border-[#D8CEC1] bg-[#FFFCF7] hover:bg-[#EEE7DD] text-[#71675E] cursor-pointer"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={isSaving}
              className="px-4 py-2 text-xs font-bold rounded-lg bg-[#6B2837] hover:bg-[#541E2A] text-white flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs disabled:opacity-50"
            >
              <Save className="h-3.5 w-3.5" />
              <span>{isSaving ? "Saving..." : editingEntry ? "Save Changes" : "Create Entry"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

