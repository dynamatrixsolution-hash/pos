"use client";

import React, { useState, useEffect, useCallback } from "react";
import { 
  Truck, Plus, Search, RefreshCw, CheckCircle2, XCircle, AlertCircle, 
  ArrowRight, MapPin, User, Calendar, FileText, ChevronDown, Trash2
} from "lucide-react";
import { useUser } from "@/lib/client-auth";

interface ProductItem {
  id: string;
  name: string;
  sku: string;
}

interface BranchItem {
  id: string;
  name: string;
}

interface TransferItem {
  id: string;
  productId: string;
  quantity: number;
  product: {
    name: string;
    sku: string | null;
  };
}

interface StockTransfer {
  id: string;
  status: string;
  notes: string | null;
  remarks: string | null;
  createdAt: string;
  sourceBranchId: string;
  targetBranchId: string;
  sourceBranch: { name: string };
  targetBranch: { name: string };
  requestedBy: { name: string } | null;
  approvedBy: { name: string } | null;
  receivedBy: { name: string } | null;
  items: TransferItem[];
}

export default function StockTransfersPage() {
  const user = useUser();
  const isManagerOrOwner = user && ["OWNER", "MANAGER"].includes(user.role);

  const [transfers, setTransfers] = useState<StockTransfer[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // Options
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [branches, setBranches] = useState<BranchItem[]>([]);

  // Filters
  const [filterSource, setFilterSource] = useState("");
  const [filterTarget, setFilterTarget] = useState("");
  const [filterStatus, setFilterStatus] = useState("");

  // Create Request Modal State
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [transferType, setTransferType] = useState<"REQUEST" | "SEND_OVERSTOCK">("REQUEST");
  const [selectedSource, setSelectedSource] = useState("");
  const [selectedTarget, setSelectedTarget] = useState("");
  const [notes, setNotes] = useState("");
  const [transferItems, setTransferItems] = useState<Array<{ productId: string; quantity: number }>>([]);
  const [currentProduct, setCurrentProduct] = useState("");
  const [currentQty, setCurrentQty] = useState(1);
  const [productStocks, setProductStocks] = useState<any[]>([]);

  // Adjust selections based on role & transfer type
  useEffect(() => {
    if (!showRequestModal) return;
    const isOwner = user && ["OWNER", "SUPER_ADMIN"].includes(user.role);
    if (!isOwner && user?.branchId) {
      if (transferType === "REQUEST") {
        setSelectedTarget(user.branchId);
        setSelectedSource((prev) => (prev === user.branchId ? "" : prev));
      } else {
        setSelectedSource(user.branchId);
        setSelectedTarget((prev) => (prev === user.branchId ? "" : prev));
      }
    }
  }, [transferType, user, showRequestModal]);

  // Workflow Action Modals
  const [actingTransfer, setActingTransfer] = useState<StockTransfer | null>(null);
  const [actionType, setActionType] = useState<"APPROVE" | "REJECT" | "DISPATCH" | "RECEIVE" | null>(null);
  const [actionRemarks, setActionRemarks] = useState("");

  const fetchOptions = useCallback(async () => {
    try {
      const prodRes = await fetch("/api/v1/products?limit=500");
      if (prodRes.ok) {
        const pData = await prodRes.json();
        setProducts(pData.products || []);
      }

      const branchRes = await fetch("/api/v1/branches?all=true");
      if (branchRes.ok) {
        const bData = await branchRes.json();
        setBranches(bData || []);
      }

      const stockRes = await fetch("/api/v1/inventory/current-stock?allBranches=true");
      if (stockRes.ok) {
        const sData = await stockRes.json();
        setProductStocks(sData.stocks || []);
      }
    } catch (err) {
      console.error("Failed to load options:", err);
    }
  }, []);

  const fetchTransfers = useCallback(async () => {
    setLoading(true);
    setErrorMsg("");
    try {
      const res = await fetch("/api/v1/inventory/transfer");
      if (res.ok) {
        const data = await res.json();
        setTransfers(data || []);
      } else {
        setErrorMsg("Failed to load stock transfers");
      }
    } catch (err) {
      console.error(err);
      setErrorMsg("Network error loading transfers");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOptions();
    fetchTransfers();
  }, [fetchOptions, fetchTransfers]);

  // Form helpers
  const handleAddItem = () => {
    if (!currentProduct || currentQty <= 0) return;
    
    // Check duplicate
    const exists = transferItems.find(item => item.productId === currentProduct);
    if (exists) {
      setTransferItems(prev => prev.map(item => 
        item.productId === currentProduct ? { ...item, quantity: item.quantity + currentQty } : item
      ));
    } else {
      setTransferItems(prev => [...prev, { productId: currentProduct, quantity: currentQty }]);
    }
    
    setCurrentProduct("");
    setCurrentQty(1);
  };

  const handleRemoveItem = (index: number) => {
    setTransferItems(prev => prev.filter((_, i) => i !== index));
  };

  const handleCreateRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    setSuccessMsg("");

    if (transferItems.length === 0) {
      setErrorMsg("At least one product must be added to the list");
      return;
    }

    if (selectedSource === selectedTarget) {
      setErrorMsg("Source and Target branch cannot be the same");
      return;
    }

    try {
      const res = await fetch("/api/v1/inventory/transfer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceBranchId: selectedSource,
          targetBranchId: selectedTarget,
          items: transferItems,
          notes,
        }),
      });

      if (res.ok) {
        setSuccessMsg("Stock transfer request created in PENDING status");
        setShowRequestModal(false);
        setTransferItems([]);
        setSelectedSource("");
        setSelectedTarget("");
        setNotes("");
        fetchTransfers();
      } else {
        const err = await res.json();
        setErrorMsg(err.error || "Failed to create transfer request");
      }
    } catch (err) {
      console.error(err);
      setErrorMsg("Network error occurred");
    }
  };

  // Execute workflow step
  const executeWorkflowStep = async () => {
    if (!actingTransfer || !actionType) return;
    setErrorMsg("");
    setSuccessMsg("");

    try {
      const res = await fetch(`/api/v1/inventory/transfer/${actingTransfer.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: actionType,
          remarks: actionRemarks,
        }),
      });

      if (res.ok) {
        setSuccessMsg(`Transfer successfully updated to ${actionType === "APPROVE" ? "APPROVED" : actionType === "REJECT" ? "REJECTED" : actionType === "DISPATCH" ? "DISPATCHED" : "RECEIVED"}`);
        setActingTransfer(null);
        setActionType(null);
        setActionRemarks("");
        fetchTransfers();
      } else {
        const err = await res.json();
        setErrorMsg(err.error || "Failed to process transfer action");
      }
    } catch (err) {
      console.error(err);
      setErrorMsg("Network error occurred");
    }
  };

  // Filter transfers
  const filteredTransfers = transfers.filter(t => {
    const matchesSource = !filterSource || t.sourceBranchId === filterSource;
    const matchesTarget = !filterTarget || t.targetBranchId === filterTarget;
    const matchesStatus = !filterStatus || t.status === filterStatus;
    return matchesSource && matchesTarget && matchesStatus;
  });

  const getStatusBadgeColor = (status: string) => {
    switch (status.toUpperCase()) {
      case "PENDING":
        return "bg-amber-500/10 text-amber-600 border-amber-500/20";
      case "APPROVED":
        return "bg-sky-500/10 text-sky-600 border-sky-500/20";
      case "REJECTED":
        return "bg-destructive/10 text-destructive border-destructive/20";
      case "DISPATCHED":
        return "bg-purple-500/10 text-purple-600 border-purple-500/20";
      case "RECEIVED":
        return "bg-emerald-500/10 text-emerald-600 border-emerald-500/20";
      default:
        return "bg-muted text-muted-foreground border-border";
    }
  };

  // Find current product stock info
  const selectedProductStockInfo = productStocks.find((s) => s.id === currentProduct);
  const selectedSourceStock = selectedProductStockInfo?.branchStocks?.find(
    (bs: any) => bs.branchId === selectedSource
  );
  const selectedSourceStockQty = selectedSourceStock ? selectedSourceStock.quantity : 0;

  const otherBranchesStock = selectedProductStockInfo?.branchStocks?.filter(
    (bs: any) => bs.branchId !== selectedSource && bs.quantity > 0
  ) || [];

  // Compute overstocked items for the selected source branch
  const overstockedProducts = selectedSource
    ? productStocks.map((ps) => {
        const sourceStock = ps.branchStocks?.find((bs: any) => bs.branchId === selectedSource);
        const qty = sourceStock ? sourceStock.quantity : 0;
        const alertQty = ps.alertQuantity || 5;
        const threshold = Math.max(alertQty * 2, 10);
        const excess = qty - alertQty;
        return {
          ...ps,
          quantityAtSource: qty,
          threshold,
          excess: excess > 0 ? excess : 0,
          isOverstocked: qty > threshold,
        };
      }).filter((p) => p.isOverstocked && p.excess > 0)
    : [];

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-card border border-border p-6 rounded-3xl shadow-sm bg-gradient-to-br from-primary/5 via-transparent to-transparent">
        <div>
          <h1 className="text-2xl font-black flex items-center gap-2">
            <Truck className="h-6 w-6 text-primary" />
            Stock Transfers
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Request, dispatch, and receive stock transfers across your network of warehouses and branches.
          </p>
        </div>
        <button
          onClick={() => {
            setSelectedSource("");
            const isOwner = user && ["OWNER", "SUPER_ADMIN"].includes(user.role);
            if (!isOwner && user?.branchId) {
              setSelectedTarget(user.branchId);
            } else {
              setSelectedTarget("");
            }
            setTransferType("REQUEST");
            setShowRequestModal(true);
          }}
          className="flex items-center gap-1.5 px-4 py-2 bg-primary text-primary-foreground hover:bg-primary/95 rounded-xl text-xs font-bold transition-all cursor-pointer"
        >
          <Plus className="h-4.5 w-4.5" />
          Request Transfer
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

      {/* Filters */}
      <div className="bg-card border border-border p-6 rounded-3xl shadow-sm grid grid-cols-1 sm:grid-cols-3 gap-4">
        <select
          value={filterSource}
          onChange={(e) => setFilterSource(e.target.value)}
          className="px-3 py-2 border border-border rounded-lg bg-background text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
        >
          <option value="">All Source Warehouses</option>
          {branches.map((b) => (
            <option key={b.id} value={b.id}>{b.name}</option>
          ))}
        </select>

        <select
          value={filterTarget}
          onChange={(e) => setFilterTarget(e.target.value)}
          className="px-3 py-2 border border-border rounded-lg bg-background text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
        >
          <option value="">All Destination Warehouses</option>
          {branches.map((b) => (
            <option key={b.id} value={b.id}>{b.name}</option>
          ))}
        </select>

        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="px-3 py-2 border border-border rounded-lg bg-background text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
        >
          <option value="">All Statuses</option>
          <option value="PENDING">Pending Request</option>
          <option value="APPROVED">Approved</option>
          <option value="REJECTED">Rejected</option>
          <option value="DISPATCHED">In Transit (Dispatched)</option>
          <option value="RECEIVED">Received</option>
        </select>
      </div>

      {/* Transfers List */}
      <div className="bg-card border border-border rounded-3xl p-6 shadow-sm">
        {loading ? (
          <div className="py-12 text-center text-xs text-muted-foreground">
            <RefreshCw className="h-6 w-6 animate-spin mx-auto text-primary mb-2" />
            Loading transfer history...
          </div>
        ) : filteredTransfers.length === 0 ? (
          <div className="py-12 text-center text-xs text-muted-foreground">
            <Truck className="h-10 w-10 mx-auto opacity-35 mb-2" />
            No transfers recorded. Initiate a new request.
          </div>
        ) : (
          <div className="space-y-6">
            {filteredTransfers.map((t) => (
              <div 
                key={t.id} 
                className="border border-border/60 hover:border-primary/30 rounded-2xl p-5 flex flex-col space-y-4 transition-all"
              >
                {/* Header */}
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-border/40 pb-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono font-bold text-foreground">TR-{t.id.slice(0, 8).toUpperCase()}</span>
                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold border uppercase tracking-wider ${getStatusBadgeColor(t.status)}`}>
                      {t.status}
                    </span>
                    <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {new Date(t.createdAt).toLocaleString()}
                    </span>
                  </div>

                  {/* Actions buttons dynamically mapped by status */}
                  <div className="flex gap-2">
                    {t.status === "PENDING" && isManagerOrOwner && (
                      <>
                        <button
                          onClick={() => {
                            setActingTransfer(t);
                            setActionType("APPROVE");
                          }}
                          className="px-2.5 py-1 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 rounded-lg text-[10px] font-bold border border-emerald-500/20 cursor-pointer"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => {
                            setActingTransfer(t);
                            setActionType("REJECT");
                          }}
                          className="px-2.5 py-1 bg-destructive/10 hover:bg-destructive/20 text-destructive rounded-lg text-[10px] font-bold border border-destructive/20 cursor-pointer"
                        >
                          Reject
                        </button>
                      </>
                    )}

                    {t.status === "APPROVED" && (t.sourceBranchId === user?.branchId || isManagerOrOwner) && (
                      <button
                        onClick={() => {
                          setActingTransfer(t);
                          setActionType("DISPATCH");
                        }}
                        className="px-2.5 py-1 bg-purple-500/10 hover:bg-purple-500/20 text-purple-600 rounded-lg text-[10px] font-bold border border-purple-500/20 cursor-pointer"
                      >
                        Dispatch Stock
                      </button>
                    )}

                    {t.status === "DISPATCHED" && (t.targetBranchId === user?.branchId || isManagerOrOwner) && (
                      <button
                        onClick={() => {
                          setActingTransfer(t);
                          setActionType("RECEIVE");
                        }}
                        className="px-2.5 py-1 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 rounded-lg text-[10px] font-bold border border-emerald-500/20 cursor-pointer"
                      >
                        Receive Stock
                      </button>
                    )}
                  </div>
                </div>

                {/* Body Details */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-xs text-muted-foreground font-medium">
                  {/* Route */}
                  <div className="space-y-1.5">
                    <span className="text-[9px] uppercase font-bold tracking-wider text-muted-foreground/80 block">Route Scope</span>
                    <div className="flex items-center gap-2 text-foreground font-semibold">
                      <div className="flex items-center gap-1">
                        <MapPin className="h-3.5 w-3.5 text-primary" />
                        {t.sourceBranch.name}
                      </div>
                      <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                      <div className="flex items-center gap-1">
                        <MapPin className="h-3.5 w-3.5 text-primary" />
                        {t.targetBranch.name}
                      </div>
                    </div>
                  </div>

                  {/* Audit Signatures */}
                  <div className="space-y-1 text-[10px]">
                    <span className="text-[9px] uppercase font-bold tracking-wider text-muted-foreground/80 block">Signatures</span>
                    <div>Req: <span className="font-bold text-foreground">{t.requestedBy?.name || "System"}</span></div>
                    {t.approvedBy && <div>App: <span className="font-bold text-foreground">{t.approvedBy.name}</span></div>}
                    {t.receivedBy && <div>Rec: <span className="font-bold text-foreground">{t.receivedBy.name}</span></div>}
                  </div>

                  {/* Remarks */}
                  <div className="space-y-1">
                    <span className="text-[9px] uppercase font-bold tracking-wider text-muted-foreground/80 block">Remarks</span>
                    <p className="text-foreground leading-relaxed italic">
                      {t.remarks || t.notes || "No remarks logged."}
                    </p>
                  </div>
                </div>

                {/* Items Box */}
                <div className="bg-secondary/30 rounded-xl p-4 border border-border/40">
                  <span className="text-[9px] uppercase font-bold tracking-wider text-muted-foreground/80 block mb-2">Item Checklist</span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 text-xs">
                    {t.items.map((item) => (
                      <div key={item.id} className="flex justify-between items-center bg-card p-2.5 rounded-lg border border-border/50">
                        <div>
                          <div className="font-bold text-foreground">{item.product.name}</div>
                          {item.product.sku && <div className="text-[9px] text-muted-foreground font-mono">SKU: {item.product.sku}</div>}
                        </div>
                        <div className="font-black text-primary px-2 py-0.5 bg-primary/5 rounded border border-primary/10">
                          {item.quantity} units
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Workflow Action Remarks Dialog */}
      {actingTransfer && actionType && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-3xl max-w-md w-full shadow-2xl p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150 text-xs">
            <div>
              <h3 className="font-black text-foreground text-sm uppercase tracking-wide">
                Confirm {actionType} Workflow Action
              </h3>
              <p className="text-muted-foreground mt-0.5 text-[10px]">
                You are performing status transition on Transfer ID: {actingTransfer.id.slice(0, 8).toUpperCase()}
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] uppercase font-bold text-muted-foreground">Action Remarks / Notes</label>
              <textarea
                value={actionRemarks}
                onChange={(e) => setActionRemarks(e.target.value)}
                placeholder="Log notes about dispatch carrier, receipt check, rejection reason..."
                className="w-full min-h-24 px-3 py-2 border border-border rounded-lg bg-background text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setActingTransfer(null);
                  setActionType(null);
                  setActionRemarks("");
                }}
                className="px-3.5 py-1.5 bg-secondary border border-border hover:bg-secondary/80 rounded-xl font-bold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={executeWorkflowStep}
                className="px-4 py-1.5 bg-primary text-primary-foreground hover:bg-primary/95 rounded-xl font-bold cursor-pointer"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Transfer Request Dialog */}
      {showRequestModal && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form
            onSubmit={handleCreateRequest}
            className="bg-card border border-border rounded-3xl max-w-xl w-full max-h-[90vh] flex flex-col shadow-2xl animate-in fade-in zoom-in-95 duration-150 text-xs"
          >
            <div className="p-6 border-b border-border/50 flex items-center justify-between">
              <h3 className="font-black text-foreground text-sm flex items-center gap-2">
                <Truck className="h-5 w-5 text-primary" />
                {transferType === "REQUEST" ? "Request Stock Transfer (Pull)" : "Send Overstock Transfer (Push)"}
              </h3>
              <button
                type="button"
                onClick={() => setShowRequestModal(false)}
                className="px-2.5 py-1 text-xs border border-border hover:bg-secondary rounded-xl font-semibold cursor-pointer"
              >
                Cancel
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4">
              {/* Transfer Mode Selector Toggle */}
              <div className="bg-secondary/15 p-1 rounded-xl border border-border/40 grid grid-cols-2 gap-1">
                <button
                  type="button"
                  onClick={() => setTransferType("REQUEST")}
                  className={`py-1.5 text-center rounded-lg font-bold transition-all cursor-pointer text-[10px] ${
                    transferType === "REQUEST"
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:bg-secondary/30"
                  }`}
                >
                  Request Stock (Pull)
                </button>
                <button
                  type="button"
                  onClick={() => setTransferType("SEND_OVERSTOCK")}
                  className={`py-1.5 text-center rounded-lg font-bold transition-all cursor-pointer text-[10px] ${
                    transferType === "SEND_OVERSTOCK"
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:bg-secondary/30"
                  }`}
                >
                  Send Overstock (Push)
                </button>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {/* Source Branch */}
                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-bold text-muted-foreground">Source Warehouse *</label>
                  <select
                    value={selectedSource}
                    onChange={(e) => setSelectedSource(e.target.value)}
                    required
                    disabled={transferType === "SEND_OVERSTOCK" && !(user && ["OWNER", "SUPER_ADMIN"].includes(user.role))}
                    className="w-full px-3 py-2 border border-border rounded-lg bg-background text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-60"
                  >
                    <option value="">Select Source Branch</option>
                    {(user && ["OWNER", "SUPER_ADMIN"].includes(user.role) || transferType === "REQUEST"
                      ? branches
                      : branches.filter((b) => b.id === user?.branchId)
                    ).map((b) => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                  </select>
                </div>

                {/* Target Branch */}
                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-bold text-muted-foreground">Destination Warehouse *</label>
                  <select
                    value={selectedTarget}
                    onChange={(e) => setSelectedTarget(e.target.value)}
                    required
                    disabled={transferType === "REQUEST" && !(user && ["OWNER", "SUPER_ADMIN"].includes(user.role))}
                    className="w-full px-3 py-2 border border-border rounded-lg bg-background text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-60"
                  >
                    <option value="">Select Destination Branch</option>
                    {(user && ["OWNER", "SUPER_ADMIN"].includes(user.role) || transferType === "SEND_OVERSTOCK"
                      ? branches
                      : branches.filter((b) => b.id === user?.branchId)
                    ).map((b) => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Overstock Suggestions */}
              {transferType === "SEND_OVERSTOCK" && selectedSource && (
                <div className="border border-border/60 rounded-xl p-4 bg-primary/5 space-y-2">
                  <div className="flex justify-between items-center border-b border-border/40 pb-1.5">
                    <span className="text-[10px] uppercase font-black tracking-wider text-primary block">
                      Suggested Overstocked Items at Source
                    </span>
                    <span className="text-[9px] text-muted-foreground font-semibold">
                      Threshold: &gt; Max(Alert × 2, 10)
                    </span>
                  </div>
                  
                  {overstockedProducts.length === 0 ? (
                    <div className="text-muted-foreground italic text-[10px] py-1 text-center">
                      No overstocked items detected at the selected source warehouse.
                    </div>
                  ) : (
                    <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                      {overstockedProducts.map((p) => {
                        const inList = transferItems.some((item) => item.productId === p.id);
                        return (
                          <div key={p.id} className="flex justify-between items-center bg-card border border-border/40 p-2 rounded-lg text-[10px]">
                            <div>
                              <div className="font-bold text-foreground">{p.name}</div>
                              <div className="text-[9px] text-muted-foreground font-mono">
                                Stock: <span className="font-semibold text-foreground">{p.quantityAtSource}</span> / Alert limit: {p.alertQuantity} (Excess: <span className="text-primary font-bold">{p.excess}</span>)
                              </div>
                            </div>
                            <button
                              type="button"
                              disabled={inList}
                              onClick={() => {
                                setTransferItems((prev) => {
                                  const exists = prev.find((item) => item.productId === p.id);
                                  if (exists) return prev;
                                  return [...prev, { productId: p.id, quantity: p.excess }];
                                });
                              }}
                              className={`px-2.5 py-1 rounded-md font-bold transition-all cursor-pointer text-[9px] ${
                                inList
                                  ? "bg-secondary text-muted-foreground border border-border cursor-not-allowed"
                                  : "bg-primary text-primary-foreground hover:bg-primary/90"
                              }`}
                            >
                              {inList ? "Added" : `Send Excess (${p.excess})`}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* Add Product Line Section */}
              <div className="border border-border/60 rounded-xl p-4 bg-secondary/10 space-y-3">
                <span className="text-[10px] uppercase font-black tracking-wider text-muted-foreground block border-b border-border/40 pb-1.5">
                  Add Stock Item
                </span>
                <div className="flex gap-3 items-end">
                  <div className="flex-1 space-y-1">
                    <label className="text-[9px] uppercase font-bold text-muted-foreground">Product</label>
                    <select
                      value={currentProduct}
                      onChange={(e) => setCurrentProduct(e.target.value)}
                      className="w-full px-3 py-2 border border-border rounded-lg bg-background text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                    >
                      <option value="">Select Product</option>
                      {products.map((p) => (
                        <option key={p.id} value={p.id}>{p.name} ({p.sku || "No SKU"})</option>
                      ))}
                    </select>
                  </div>
                  <div className="w-24 space-y-1">
                    <label className="text-[9px] uppercase font-bold text-muted-foreground">Quantity</label>
                    <input
                      type="number"
                      min="1"
                      value={currentQty}
                      onChange={(e) => setCurrentQty(parseInt(e.target.value, 10) || 1)}
                      className="w-full px-3 py-2 border border-border rounded-lg bg-background text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleAddItem}
                    className="px-4 py-2 bg-secondary border border-border hover:bg-secondary/80 rounded-lg font-bold text-foreground transition-all cursor-pointer"
                  >
                    Add
                  </button>
                </div>

                {/* Real-time stock display */}
                {currentProduct && (
                  <div className="mt-2.5 p-3 rounded-xl border border-border/60 text-[11px] space-y-2.5 bg-background shadow-xs">
                    {/* Status in selected source */}
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground font-semibold">Selected Source Stock:</span>
                      {selectedSource ? (
                        <span className={`font-black px-2 py-0.5 rounded-lg text-[10px] border ${
                          selectedSourceStockQty >= currentQty
                            ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
                            : selectedSourceStockQty > 0
                            ? "bg-amber-500/10 text-amber-600 border-amber-500/20"
                            : "bg-destructive/10 text-destructive border-destructive/20"
                        }`}>
                          {selectedSourceStockQty > 0 ? `${selectedSourceStockQty} units available` : "Out of stock at source"}
                        </span>
                      ) : (
                        <span className="text-amber-500 italic font-semibold flex items-center gap-1">
                          <AlertCircle className="h-3.5 w-3.5" /> Select Source Warehouse
                        </span>
                      )}
                    </div>

                    {/* Stock status in other branches */}
                    <div className="border-t border-border/40 pt-2 space-y-1.5">
                      <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">
                        {selectedSource ? "Alternative Branches with Stock:" : "Branches with Available Stock:"}
                      </span>
                      {otherBranchesStock.length === 0 ? (
                        <span className="text-muted-foreground italic text-[10px] block pt-0.5">
                          No {selectedSource ? "other " : ""}branches have available stock.
                        </span>
                      ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[100px] overflow-y-auto pr-1 pt-1">
                          {otherBranchesStock.map((bs: any) => (
                            <div key={bs.branchId} className="flex justify-between items-center bg-secondary/35 border border-border/40 px-2.5 py-1 rounded-lg">
                              <span className="font-semibold text-foreground truncate max-w-[120px]" title={bs.branchName}>
                                {bs.branchName}
                              </span>
                              <div className="flex items-center gap-1.5 shrink-0">
                                <span className="font-extrabold text-primary shrink-0">
                                  {bs.quantity} units
                                </span>
                                <button
                                  type="button"
                                  onClick={() => setSelectedSource(bs.branchId)}
                                  className="text-[9px] bg-primary/10 text-primary hover:bg-primary/20 font-bold px-1.5 py-0.5 rounded cursor-pointer transition-colors"
                                >
                                  Use as Source
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Items List */}
              <div className="space-y-2">
                <span className="text-[10px] uppercase font-bold text-muted-foreground block">Items Requested</span>
                {transferItems.length === 0 ? (
                  <div className="p-4 border border-dashed border-border rounded-xl text-center text-muted-foreground font-semibold">
                    No items added yet. Search and add items above.
                  </div>
                ) : (
                  <div className="max-h-48 overflow-y-auto space-y-2">
                    {transferItems.map((item, index) => {
                      const p = products.find(p => p.id === item.productId);
                      const prodStockInfo = productStocks.find((s) => s.id === item.productId);
                      const sourceStockInfo = prodStockInfo?.branchStocks?.find(
                        (bs: any) => bs.branchId === selectedSource
                      );
                      const availableQty = sourceStockInfo ? sourceStockInfo.quantity : 0;
                      const hasSufficientStock = selectedSource ? (availableQty >= item.quantity) : true;
                      
                      const itemOtherBranches = prodStockInfo?.branchStocks?.filter(
                        (bs: any) => bs.branchId !== selectedSource && bs.quantity > 0
                      ) || [];

                      return (
                        <div key={index} className={`flex flex-col p-3 border rounded-xl bg-card hover:bg-secondary/10 transition-all ${
                          !hasSufficientStock ? "border-destructive/30 bg-destructive/5" : "border-border"
                        }`}>
                          <div className="flex justify-between items-center">
                            <div>
                              <span className="font-bold text-foreground">{p?.name}</span>
                              {p?.sku && <span className="ml-2 font-mono text-[9px] text-muted-foreground uppercase bg-secondary/50 px-1 py-0.5 rounded">({p.sku})</span>}
                            </div>
                            <div className="flex items-center gap-3">
                              <span className="font-black text-primary px-2 py-0.5 bg-primary/5 rounded border border-primary/10">
                                {item.quantity} pcs
                              </span>
                              <button
                                type="button"
                                onClick={() => handleRemoveItem(index)}
                                className="text-destructive p-1 hover:bg-secondary rounded-lg transition-colors cursor-pointer"
                              >
                                <Trash2 className="h-4.5 w-4.5" />
                              </button>
                            </div>
                          </div>

                          {/* Stock Warning & Alternative branches for this item */}
                          {selectedSource && (
                            <div className="mt-2 flex flex-col gap-1 text-[10px] border-t border-border/40 pt-2">
                              {!hasSufficientStock ? (
                                <div className="text-destructive font-semibold flex items-center gap-1">
                                  <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                                  <span>
                                    {availableQty === 0 
                                      ? "Out of stock at source branch" 
                                      : `Insufficient stock at source branch (Only ${availableQty} available)`
                                    }
                                  </span>
                                </div>
                              ) : (
                                <div className="text-emerald-600 font-semibold flex items-center gap-1">
                                  <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                                  <span>Sufficient stock (Available: {availableQty})</span>
                                </div>
                              )}
                              
                              {/* Display alternative branches if source has insufficient stock */}
                              {!hasSufficientStock && itemOtherBranches.length > 0 && (
                                <div className="text-muted-foreground mt-1">
                                  <span className="font-medium">Available at other branches:</span>{" "}
                                  <div className="flex flex-wrap gap-1.5 mt-1">
                                    {itemOtherBranches.map((bs: any) => (
                                      <button
                                        key={bs.branchId}
                                        type="button"
                                        onClick={() => setSelectedSource(bs.branchId)}
                                        className="inline-flex items-center gap-1 bg-secondary px-2 py-0.5 rounded border border-border text-[9px] hover:bg-secondary/80 font-bold transition-all text-foreground cursor-pointer"
                                        title="Click to set this branch as source"
                                      >
                                        {bs.branchName} ({bs.quantity})
                                      </button>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Notes */}
              <div className="space-y-1">
                <label className="text-[10px] uppercase font-bold text-muted-foreground">Request Notes</label>
                <input
                  type="text"
                  placeholder="Specify urgency, transport request, reasons..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-3 py-2 border border-border rounded-lg bg-background text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
            </div>

            <div className="p-6 border-t border-border/50 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowRequestModal(false)}
                className="px-4 py-2 bg-secondary border border-border hover:bg-secondary/80 rounded-xl font-bold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-primary text-primary-foreground hover:bg-primary/95 rounded-xl font-bold cursor-pointer"
              >
                Send Request
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
