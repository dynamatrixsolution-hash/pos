"use client";

import * as React from "react";
import { useSession } from "next-auth/react";
import { useSettings } from "@/components/settings-provider";
import {
  CreditCard,
  Search,
  PlusCircle,
  Download,
  Printer,
  Calendar,
  Store,
  Users,
  Edit2,
  Trash2,
  X,
  FileText,
} from "lucide-react";
import * as XLSX from "xlsx";
import { jsPDF } from "jspdf";

interface Payment {
  id: string;
  receiptNumber: string; // Used to hold voucher code
  amount: number;
  method: string;
  reference: string | null;
  remarks: string | null;
  createdAt: string;
  supplier?: { id: string; name: string; phone: string | null } | null;
  branch?: { id: string; name: string } | null;
  user?: { id: string; name: string } | null;
  purchase?: { id: string; purchaseNumber: string } | null;
}

interface Supplier {
  id: string;
  name: string;
  phone: string | null;
  balance: number;
}

interface Branch {
  id: string;
  name: string;
}

export default function PaymentSentPage() {
  const { data: session } = useSession();
  const { currencySymbol } = useSettings();

  const [payments, setPayments] = React.useState<Payment[]>([]);
  const [suppliers, setSuppliers] = React.useState<Supplier[]>([]);
  const [branches, setBranches] = React.useState<Branch[]>([]);

  // Filtering state
  const [selectedBranch, setSelectedBranch] = React.useState<string>("");
  const [selectedSupplier, setSelectedSupplier] = React.useState<string>("all");
  const [selectedMethod, setSelectedMethod] = React.useState<string>("all");
  const [datePreset, setDatePreset] = React.useState<string>("this_month");
  const [startDate, setStartDate] = React.useState<string>("");
  const [endDate, setEndDate] = React.useState<string>("");
  const [searchQuery, setSearchQuery] = React.useState<string>("");
  const [debouncedSearch, setDebouncedSearch] = React.useState<string>("");

  // Pagination
  const [page, setPage] = React.useState<number>(1);
  const [totalPages, setTotalPages] = React.useState<number>(1);
  const [totalItems, setTotalItems] = React.useState<number>(0);
  const limit = 15;

  const [isLoading, setIsLoading] = React.useState<boolean>(true);
  const [isSubmitLoading, setIsSubmitLoading] = React.useState<boolean>(false);

  // Modal forms state
  const [isAddModalOpen, setIsAddModalOpen] = React.useState<boolean>(false);
  const [isEditModalOpen, setIsEditModalOpen] = React.useState<boolean>(false);
  const [selectedPayment, setSelectedPayment] = React.useState<Payment | null>(null);

  // Add payment form values
  const [addSupplierId, setAddSupplierId] = React.useState<string>("");
  const [addAmount, setAddAmount] = React.useState<string>("");
  const [addMethod, setAddMethod] = React.useState<string>("CASH");
  const [addReference, setAddReference] = React.useState<string>("");
  const [addVoucherNumber, setAddVoucherNumber] = React.useState<string>("");
  const [addRemarks, setAddRemarks] = React.useState<string>("");
  const [addBranchId, setAddBranchId] = React.useState<string>("");
  const [addDate, setAddDate] = React.useState<string>("");

  // Edit payment form values
  const [editRemarks, setEditRemarks] = React.useState<string>("");
  const [editReference, setEditReference] = React.useState<string>("");

  // Sync debounced search
  React.useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      setPage(1);
    }, 200);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Set date preset ranges
  React.useEffect(() => {
    if (datePreset === "custom") return;

    const today = new Date();
    let start = new Date();
    let end = new Date();

    if (datePreset === "today") {
      start = today;
      end = today;
    } else if (datePreset === "yesterday") {
      const yesterday = new Date();
      yesterday.setDate(today.getDate() - 1);
      start = yesterday;
      end = yesterday;
    } else if (datePreset === "this_week") {
      const day = today.getDay();
      const diff = today.getDate() - day + (day === 0 ? -6 : 1);
      start = new Date(today.setDate(diff));
      end = new Date();
    } else if (datePreset === "last_30") {
      start = new Date();
      start.setDate(today.getDate() - 30);
      end = new Date();
    } else if (datePreset === "this_month") {
      start = new Date(today.getFullYear(), today.getMonth(), 1);
      end = new Date();
    } else if (datePreset === "last_month") {
      start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      end = new Date(today.getFullYear(), today.getMonth(), 0);
    }

    const formatDate = (d: Date) => {
      const m = String(d.getMonth() + 1).padStart(2, "0");
      const dayStr = String(d.getDate()).padStart(2, "0");
      return `${d.getFullYear()}-${m}-${dayStr}`;
    };

    setStartDate(formatDate(start));
    setEndDate(formatDate(end));
    setPage(1);
  }, [datePreset]);

  // Fetch branches, suppliers
  React.useEffect(() => {
    async function loadResources() {
      try {
        const [branchRes, supplierRes] = await Promise.all([
          fetch("/api/v1/branches"),
          fetch("/api/v1/suppliers"),
        ]);

        if (branchRes.ok) {
          const data = await branchRes.json();
          setBranches(data);
        }
        if (supplierRes.ok) {
          const data = await supplierRes.json();
          setSuppliers(data.suppliers || data); // handle standard structure differences
        }
      } catch (err) {
        console.error("Failed to load resources:", err);
      }
    }
    loadResources();
  }, []);

  // Fetch payments list
  const fetchPayments = React.useCallback(async () => {
    setIsLoading(true);
    try {
      let url = `/api/v1/payments?type=SENT&page=${page}&limit=${limit}`;
      if (selectedBranch) url += `&branchId=${selectedBranch}`;
      if (selectedSupplier !== "all") url += `&supplierId=${selectedSupplier}`;
      if (selectedMethod !== "all") url += `&method=${selectedMethod}`;
      if (startDate) url += `&startDate=${startDate}`;
      if (endDate) url += `&endDate=${endDate}`;
      if (debouncedSearch) url += `&search=${encodeURIComponent(debouncedSearch)}`;

      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setPayments(data.payments || []);
        setTotalPages(data.pagination?.totalPages || 1);
        setTotalItems(data.pagination?.totalItems || 0);
      }
    } catch (err) {
      console.error("Error fetching payments:", err);
    } finally {
      setIsLoading(false);
    }
  }, [page, selectedBranch, selectedSupplier, selectedMethod, startDate, endDate, debouncedSearch]);

  React.useEffect(() => {
    fetchPayments();
  }, [page, selectedBranch, selectedSupplier, selectedMethod, startDate, endDate, debouncedSearch, fetchPayments]);

  const handleAddPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addSupplierId) return alert("Please select a supplier");
    if (!addAmount || parseFloat(addAmount) <= 0) return alert("Please enter a valid amount");

    setIsSubmitLoading(true);
    try {
      const payload = {
        type: "SENT",
        supplierId: addSupplierId,
        amount: parseFloat(addAmount),
        method: addMethod,
        reference: addReference || null,
        receiptNumber: addVoucherNumber || null, // saved in receiptNumber database column
        remarks: addRemarks || null,
        branchId: addBranchId || null,
        createdAt: addDate ? new Date(addDate).toISOString() : null,
      };

      const res = await fetch("/api/v1/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Failed to save payment voucher");
      }

      // Reload
      fetchPayments();
      // Reload suppliers context
      const supRes = await fetch("/api/v1/suppliers");
      if (supRes.ok) {
        const data = await supRes.json();
        setSuppliers(data.suppliers || data);
      }

      setIsAddModalOpen(false);
      resetAddForm();
    } catch (err: any) {
      alert(err.message || "An error occurred");
    } finally {
      setIsSubmitLoading(false);
    }
  };

  const handleEditPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPayment) return;

    setIsSubmitLoading(true);
    try {
      const res = await fetch(`/api/v1/payments/${selectedPayment.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          remarks: editRemarks,
          reference: editReference,
        }),
      });

      if (!res.ok) throw new Error("Failed to update payment");

      fetchPayments();
      setIsEditModalOpen(false);
    } catch (err: any) {
      alert(err.message || "An error occurred");
    } finally {
      setIsSubmitLoading(false);
    }
  };

  const handleDeletePayment = async (id: string) => {
    if (!confirm("Are you sure you want to reverse (cancel) this payment? This will restore the debt balance we owe to the supplier!")) {
      return;
    }

    try {
      const res = await fetch(`/api/v1/payments/${id}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to reverse payment");
      }

      alert("Payment voucher reversed successfully.");
      fetchPayments();
      // Reload suppliers balance
      const supRes = await fetch("/api/v1/suppliers");
      if (supRes.ok) {
        const data = await supRes.json();
        setSuppliers(data.suppliers || data);
      }
    } catch (err: any) {
      alert(err.message || "Reversal failed");
    }
  };

  const resetAddForm = () => {
    setAddSupplierId("");
    setAddAmount("");
    setAddMethod("CASH");
    setAddReference("");
    setAddVoucherNumber("");
    setAddRemarks("");
    setAddBranchId("");
    setAddDate("");
  };

  const exportExcel = () => {
    if (payments.length === 0) return alert("No data to export");
    const exportData = payments.map((p) => ({
      "Voucher Number": p.receiptNumber,
      Supplier: p.supplier?.name || "N/A",
      "Purchase Number": p.purchase?.purchaseNumber || "N/A",
      Amount: p.amount,
      Method: p.method,
      Reference: p.reference || "",
      Branch: p.branch?.name || "N/A",
      "Paid By": p.user?.name || "N/A",
      Remarks: p.remarks || "",
      Date: new Date(p.createdAt).toLocaleString(),
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Payments Sent");
    XLSX.writeFile(wb, "payments_sent.xlsx");
  };

  const exportPDF = () => {
    if (payments.length === 0) return alert("No data to export");
    const doc = new jsPDF();
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.setTextColor(239, 68, 68); // Red tone for outgoing payments
    doc.text("DynaPOS - Payments Sent (Outward Disbursements)", 14, 20);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(100, 100, 100);
    doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 26);
    doc.text(`Scope: ${selectedBranch ? "Specific Branch" : "All Branches"}`, 14, 31);

    let y = 40;
    doc.setFont("helvetica", "bold");
    doc.setFillColor(243, 244, 246);
    doc.rect(14, y, 182, 7, "F");
    doc.setTextColor(50, 50, 50);
    doc.text("Voucher No", 15, y + 5);
    doc.text("Supplier", 50, y + 5);
    doc.text("Amount", 110, y + 5);
    doc.text("Method", 135, y + 5);
    doc.text("Date", 160, y + 5);

    y += 7;
    doc.setFont("helvetica", "normal");
    payments.forEach((p) => {
      if (y > 280) {
        doc.addPage();
        y = 20;
      }
      doc.text(p.receiptNumber, 15, y + 5);
      doc.text(p.supplier?.name?.slice(0, 26) || "N/A", 50, y + 5);
      doc.text(`${currencySymbol}${p.amount.toFixed(2)}`, 110, y + 5);
      doc.text(p.method, 135, y + 5);
      doc.text(new Date(p.createdAt).toLocaleDateString(), 160, y + 5);
      y += 8;
    });

    doc.save("payments_sent_report.pdf");
  };

  const handlePrintReceipt = (payment: Payment) => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    printWindow.document.write(`
      <html>
        <head>
          <title>Voucher ${payment.receiptNumber}</title>
          <style>
            body { font-family: monospace; padding: 20px; color: #333; max-width: 300px; margin: 0 auto; }
            .header { text-align: center; border-bottom: 1px dashed #ccc; padding-bottom: 10px; }
            .logo { font-size: 20px; font-weight: bold; margin-bottom: 5px; }
            .details { margin: 15px 0; font-size: 12px; line-height: 1.6; }
            .amount-section { border-top: 1px dashed #ccc; border-bottom: 1px dashed #ccc; padding: 10px 0; text-align: center; margin: 15px 0; }
            .amount { font-size: 22px; font-weight: bold; }
            .footer { text-align: center; font-size: 10px; color: #777; margin-top: 20px; }
          </style>
        </head>
        <body onload="window.print(); window.close();">
          <div class="header">
            <div class="logo">DynaPOS</div>
            <div>Debit Voucher (Payment Out)</div>
          </div>
          <div class="details">
            <div><strong>Voucher No:</strong> ${payment.receiptNumber}</div>
            <div><strong>Supplier:</strong> ${payment.supplier?.name || "N/A"}</div>
            <div><strong>PO Reference:</strong> ${payment.purchase?.purchaseNumber || "N/A"}</div>
            <div><strong>Date/Time:</strong> ${new Date(payment.createdAt).toLocaleString()}</div>
            <div><strong>Branch:</strong> ${payment.branch?.name || "N/A"}</div>
            <div><strong>Paid By:</strong> ${payment.user?.name || "Cashier"}</div>
            ${payment.reference ? `<div><strong>Ref No:</strong> ${payment.reference}</div>` : ""}
            ${payment.remarks ? `<div><strong>Remarks:</strong> ${payment.remarks}</div>` : ""}
          </div>
          <div class="amount-section">
            <div>DISBURSED AMOUNT</div>
            <div class="amount">${currencySymbol}${payment.amount.toFixed(2)}</div>
            <div>Method: ${payment.method}</div>
          </div>
          <div class="footer">
            <p>Signature / Approval Receipt copy</p>
            <p>Powered by DynaPOS Cloud terminal</p>
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  return (
    <div className="space-y-6">
      {/* 1. Header controls */}
      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4 bg-white dark:bg-[#0a0f24] border border-slate-200/50 dark:border-slate-800 rounded-3xl p-6 shadow-sm print:hidden">
        <div>
          <h1 className="text-2xl font-black text-slate-800 dark:text-white flex items-center gap-2">
            <CreditCard className="h-6 w-6 text-red-500" /> Payment Sent (Suppliers / Expenses)
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Audit and record outgoing supplier payments, manage cash disbursements, and print debit vouchers.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full xl:w-auto">
          {session?.user && (session.user as any).role !== "CASHIER" && (
            <button
              onClick={() => {
                resetAddForm();
                setIsAddModalOpen(true);
              }}
              className="flex items-center justify-center gap-2 px-4 py-2.5 bg-red-500 hover:bg-red-600 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-red-500/20 cursor-pointer w-full sm:w-auto"
            >
              <PlusCircle className="h-4.5 w-4.5" />
              <span>Add Payment</span>
            </button>
          )}

          <button
            onClick={exportExcel}
            className="flex items-center justify-center gap-2 px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold transition-all cursor-pointer w-full sm:w-auto"
            title="Export to Excel"
          >
            <Download className="h-4 w-4" />
            <span>Excel</span>
          </button>
          <button
            onClick={exportPDF}
            className="flex items-center justify-center gap-2 px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold transition-all cursor-pointer w-full sm:w-auto"
            title="Export to PDF"
          >
            <FileText className="h-4 w-4" />
            <span>PDF</span>
          </button>
        </div>
      </div>

      {/* 2. Filter Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 bg-white dark:bg-[#0a0f24] border border-slate-200/50 dark:border-slate-800 rounded-3xl p-5 shadow-sm print:hidden">
        {/* Search */}
        <div className="relative flex items-center bg-[#F9FAFB] dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-xl px-3 h-10 w-full col-span-1 lg:col-span-1">
          <Search className="h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search voucher, name, ref..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-transparent border-none text-xs outline-none pl-2 focus:ring-0 text-foreground placeholder-slate-400 font-semibold"
          />
        </div>

        {/* Branch Context */}
        <div className="relative flex items-center bg-[#F9FAFB] dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-xl px-3 h-10 w-full">
          <Store className="h-4 w-4 text-red-500 shrink-0" />
          <select
            value={selectedBranch}
            onChange={(e) => {
              setSelectedBranch(e.target.value);
              setPage(1);
            }}
            className="w-full bg-transparent border-none text-xs outline-none pl-2 focus:ring-0 text-foreground cursor-pointer font-bold"
          >
            <option value="">All Branches</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </div>

        {/* Supplier select */}
        <div className="relative flex items-center bg-[#F9FAFB] dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-xl px-3 h-10 w-full">
          <Users className="h-4 w-4 text-red-500 shrink-0" />
          <select
            value={selectedSupplier}
            onChange={(e) => {
              setSelectedSupplier(e.target.value);
              setPage(1);
            }}
            className="w-full bg-transparent border-none text-xs outline-none pl-2 focus:ring-0 text-foreground cursor-pointer font-bold"
          >
            <option value="all">All Suppliers</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>

        {/* Payment Method */}
        <div className="relative flex items-center bg-[#F9FAFB] dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-xl px-3 h-10 w-full">
          <CreditCard className="h-4 w-4 text-red-500 shrink-0" />
          <select
            value={selectedMethod}
            onChange={(e) => {
              setSelectedMethod(e.target.value);
              setPage(1);
            }}
            className="w-full bg-transparent border-none text-xs outline-none pl-2 focus:ring-0 text-foreground cursor-pointer font-bold"
          >
            <option value="all">All Methods</option>
            <option value="CASH">CASH</option>
            <option value="CARD">CARD</option>
            <option value="QR">QR Payment</option>
            <option value="BANK_TRANSFER">BANK TRANSFER</option>
            <option value="CREDIT">CREDIT / LEDGER</option>
          </select>
        </div>

        {/* Date presets */}
        <div className="relative flex items-center bg-[#F9FAFB] dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-xl px-3 h-10 w-full">
          <Calendar className="h-4 w-4 text-red-500 shrink-0" />
          <select
            value={datePreset}
            onChange={(e) => setDatePreset(e.target.value)}
            className="w-full bg-transparent border-none text-xs outline-none pl-2 focus:ring-0 text-foreground cursor-pointer font-bold"
          >
            <option value="today">Today</option>
            <option value="yesterday">Yesterday</option>
            <option value="this_week">This Week</option>
            <option value="last_30">Last 30 Days</option>
            <option value="this_month">This Month</option>
            <option value="last_month">Last Month</option>
            <option value="custom">Custom Date Range</option>
          </select>
        </div>

        {/* Custom date range inputs */}
        {datePreset === "custom" && (
          <div className="col-span-1 sm:col-span-2 lg:col-span-5 flex items-center gap-3 bg-[#F9FAFB] dark:bg-slate-900/50 border border-slate-200/50 dark:border-slate-800 rounded-xl p-3 text-xs w-full mt-1">
            <span className="text-muted-foreground font-semibold">Start Date:</span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                setPage(1);
              }}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-1.5 focus:outline-none text-foreground font-semibold"
            />
            <span className="text-muted-foreground font-semibold">End Date:</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => {
                setEndDate(e.target.value);
                setPage(1);
              }}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-1.5 focus:outline-none text-foreground font-semibold"
            />
          </div>
        )}
      </div>

      {/* 3. Data Listing */}
      <div className="bg-white dark:bg-[#0a0f24] border border-slate-200/50 dark:border-slate-800 rounded-3xl overflow-hidden shadow-sm">
        {isLoading ? (
          <div className="h-80 flex flex-col items-center justify-center space-y-3">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-red-500 border-t-transparent" />
            <p className="text-xs text-muted-foreground font-medium">Fetching disbursement records...</p>
          </div>
        ) : payments.length === 0 ? (
          <div className="h-80 flex flex-col items-center justify-center text-center p-6 text-muted-foreground">
            <CreditCard className="h-12 w-12 mb-3 opacity-25 text-slate-400" />
            <h3 className="text-sm font-bold text-foreground">No Payments Sent</h3>
            <p className="text-xs mt-1 max-w-sm">No outgoing supplier payments found in the specified scopes.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200/60 dark:border-slate-800/80 text-slate-500 font-bold uppercase text-[9px] tracking-wider">
                  <th className="py-3 px-4">Voucher No</th>
                  <th className="py-3 px-3">Supplier</th>
                  <th className="py-3 px-3">Purchase Number</th>
                  <th className="py-3 px-3 text-right">Amount</th>
                  <th className="py-3 px-3 text-center">Method</th>
                  <th className="py-3 px-3">Reference</th>
                  <th className="py-3 px-3">Branch</th>
                  <th className="py-3 px-3">Sent By</th>
                  <th className="py-3 px-3">Date</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {payments.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-850/20 transition-colors">
                    <td className="py-3.5 px-4 font-extrabold text-slate-850 dark:text-slate-100 whitespace-nowrap">
                      {p.receiptNumber}
                    </td>
                    <td className="py-3.5 px-3 font-semibold text-slate-700 dark:text-slate-200">
                      {p.supplier?.name || <span className="text-slate-400">Expense Disburse</span>}
                    </td>
                    <td className="py-3.5 px-3 font-mono text-slate-500">
                      {p.purchase?.purchaseNumber || <span className="text-slate-350">—</span>}
                    </td>
                    <td className="py-3.5 px-3 font-bold text-red-500 text-right whitespace-nowrap">
                      {currencySymbol}{p.amount.toFixed(2)}
                    </td>
                    <td className="py-3.5 px-3 text-center whitespace-nowrap">
                      <span className="px-2 py-0.5 text-[9px] font-black rounded-md bg-slate-100 dark:bg-slate-850 text-slate-600 dark:text-slate-350 border border-slate-200/40 dark:border-slate-800">
                        {p.method}
                      </span>
                    </td>
                    <td className="py-3.5 px-3 text-slate-550 font-medium max-w-[140px] truncate" title={p.reference || ""}>
                      {p.reference || <span className="text-slate-300">—</span>}
                    </td>
                    <td className="py-3.5 px-3 text-slate-600 dark:text-slate-400 font-semibold">
                      {p.branch?.name || "N/A"}
                    </td>
                    <td className="py-3.5 px-3 text-slate-550 dark:text-slate-400 font-medium">
                      {p.user?.name || "N/A"}
                    </td>
                    <td className="py-3.5 px-3 text-slate-450 dark:text-slate-500 whitespace-nowrap font-medium">
                      {new Date(p.createdAt).toLocaleDateString()}
                    </td>
                    <td className="py-3.5 px-4 text-right whitespace-nowrap">
                      <div className="flex justify-end gap-1.5">
                        <button
                          onClick={() => handlePrintReceipt(p)}
                          className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded text-slate-500 hover:text-red-500 transition-colors cursor-pointer"
                          title="Print Voucher"
                        >
                          <Printer className="h-3.5 w-3.5" />
                        </button>
                        {session?.user && (session.user as any).role !== "CASHIER" && (
                          <>
                            <button
                              onClick={() => {
                                setSelectedPayment(p);
                                setEditRemarks(p.remarks || "");
                                setEditReference(p.reference || "");
                                setIsEditModalOpen(true);
                              }}
                              className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 transition-colors cursor-pointer"
                              title="Edit Details"
                            >
                              <Edit2 className="h-3.5 w-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeletePayment(p.id)}
                              className="p-1 hover:bg-red-50 dark:hover:bg-red-950/20 rounded text-slate-400 hover:text-red-500 transition-colors cursor-pointer"
                              title="Reverse Voucher"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* 4. Pagination */}
        {!isLoading && totalPages > 1 && (
          <div className="flex justify-between items-center px-6 py-4 border-t border-slate-150 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-900/30">
            <span className="text-xs text-muted-foreground font-semibold">
              Showing {(page - 1) * limit + 1} - {Math.min(page * limit, totalItems)} of {totalItems} payment vouchers
            </span>
            <div className="flex items-center gap-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(p - 1, 1))}
                className="px-3 py-1.5 border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-bold bg-white dark:bg-slate-950 hover:bg-slate-50 disabled:opacity-50 transition-all cursor-pointer"
              >
                Previous
              </button>
              <span className="text-xs font-bold text-foreground">
                Page {page} of {totalPages}
              </span>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(p + 1, totalPages))}
                className="px-3 py-1.5 border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-bold bg-white dark:bg-slate-950 hover:bg-slate-50 disabled:opacity-50 transition-all cursor-pointer"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 5. Add Standalone Payment Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 w-full max-w-md shadow-2xl relative">
            <button
              onClick={() => setIsAddModalOpen(false)}
              className="absolute top-4 right-4 p-1 rounded-full hover:bg-slate-150 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-800 cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>

            <form onSubmit={handleAddPayment} className="space-y-4 text-left">
              <div>
                <h3 className="text-base font-black text-slate-800 dark:text-white">Record Outgoing Payment</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Log payments made to suppliers or other standalone disbursements. Ledger statements update dynamically.
                </p>
              </div>

              <div className="space-y-3">
                {/* Supplier selection */}
                <div className="space-y-1">
                  <label className="block text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                    Supplier *
                  </label>
                  <select
                    required
                    value={addSupplierId}
                    onChange={(e) => setAddSupplierId(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50 dark:bg-slate-950 text-xs font-semibold text-foreground focus:outline-none"
                  >
                    <option value="">Select Supplier</option>
                    {suppliers.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} (Balance we owe: {currencySymbol}{s.balance.toFixed(2)})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Amount */}
                <div className="space-y-1">
                  <label className="block text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                    Disbursed Amount *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    placeholder="0.00"
                    value={addAmount}
                    onChange={(e) => setAddAmount(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50 dark:bg-slate-950 text-xs font-semibold text-foreground focus:outline-none"
                  />
                </div>

                {/* Payment Method & Branch */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="block text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                      Method *
                    </label>
                    <select
                      value={addMethod}
                      onChange={(e) => setAddMethod(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50 dark:bg-slate-950 text-xs font-semibold text-foreground focus:outline-none"
                    >
                      <option value="CASH">CASH</option>
                      <option value="CARD">CARD</option>
                      <option value="QR">QR Payment</option>
                      <option value="BANK_TRANSFER">BANK TRANSFER</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="block text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                      Branch Context *
                    </label>
                    <select
                      value={addBranchId}
                      onChange={(e) => setAddBranchId(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50 dark:bg-slate-950 text-xs font-semibold text-foreground focus:outline-none"
                    >
                      <option value="">Select Branch</option>
                      {branches.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Custom Voucher & Reference */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="block text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                      Voucher No (Optional)
                    </label>
                    <input
                      type="text"
                      placeholder="Autogenerated"
                      value={addVoucherNumber}
                      onChange={(e) => setAddVoucherNumber(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50 dark:bg-slate-950 text-xs font-semibold text-foreground focus:outline-none"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                      Reference Number
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. check_0099"
                      value={addReference}
                      onChange={(e) => setAddReference(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50 dark:bg-slate-950 text-xs font-semibold text-foreground focus:outline-none"
                    />
                  </div>
                </div>

                {/* Custom Date & Remarks */}
                <div className="space-y-1">
                  <label className="block text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                    Date (Optional)
                  </label>
                  <input
                    type="date"
                    value={addDate}
                    onChange={(e) => setAddDate(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50 dark:bg-slate-950 text-xs font-semibold text-foreground focus:outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                    Remarks/Notes
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Settled outstanding restock invoices"
                    value={addRemarks}
                    onChange={(e) => setAddRemarks(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50 dark:bg-slate-950 text-xs font-semibold text-foreground focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 border-t border-slate-100 dark:border-slate-800 pt-4">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 dark:border-slate-800 text-xs rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 font-bold text-slate-500 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitLoading}
                  className="px-5 py-2 bg-red-500 text-white text-xs font-bold rounded-xl hover:bg-red-650 disabled:opacity-50 cursor-pointer shadow-md shadow-red-500/25"
                >
                  {isSubmitLoading ? "Saving..." : "Save Voucher"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 6. Edit Payment Remarks Modal */}
      {isEditModalOpen && selectedPayment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 w-full max-w-sm shadow-2xl relative">
            <button
              onClick={() => setIsEditModalOpen(false)}
              className="absolute top-4 right-4 p-1 rounded-full hover:bg-slate-150 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-800 cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>

            <form onSubmit={handleEditPayment} className="space-y-4 text-left">
              <div>
                <h3 className="text-base font-black text-slate-800 dark:text-white">Edit Voucher Details</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Update remarks and references for debit voucher {selectedPayment.receiptNumber}.
                </p>
              </div>

              <div className="space-y-3">
                <div className="space-y-1">
                  <label className="block text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                    Reference Number
                  </label>
                  <input
                    type="text"
                    value={editReference}
                    onChange={(e) => setEditReference(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50 dark:bg-slate-950 text-xs font-semibold text-foreground focus:outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                    Remarks/Notes
                  </label>
                  <input
                    type="text"
                    value={editRemarks}
                    onChange={(e) => setEditRemarks(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50 dark:bg-slate-950 text-xs font-semibold text-foreground focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 border-t border-slate-100 dark:border-slate-800 pt-4">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 dark:border-slate-800 text-xs rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 font-bold text-slate-500 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitLoading}
                  className="px-5 py-2 bg-[#2563EB] text-white text-xs font-bold rounded-xl hover:bg-[#1D4ED8] disabled:opacity-50 cursor-pointer shadow-md shadow-[#2563EB]/25"
                >
                  {isSubmitLoading ? "Saving..." : "Update"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
