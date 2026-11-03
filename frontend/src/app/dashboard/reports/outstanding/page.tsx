"use client";

import * as React from "react";
import { useSession } from "next-auth/react";
import { Notify } from "@/lib/notify";
import { useSettings } from "@/components/settings-provider";
import {
  Download,
  Printer,
  AlertTriangle,
  Search,
  Bike,
  Building,
  CheckCircle2,
  DollarSign,
  Truck,
  Users,
  CreditCard,
  X,
  FileSpreadsheet,
} from "lucide-react";
import * as XLSX from "xlsx";
import { jsPDF } from "jspdf";

export default function OutstandingReportsPage() {
  const { data: session } = useSession();
  const { currencySymbol } = useSettings();

  const [activeTab, setActiveTab] = React.useState<"customer" | "supplier" | "aging">("customer");
  const [receivableFilter, setReceivableFilter] = React.useState<"ALL" | "STORE" | "DELIVERY_COD" | "ROOM_FOLIO">("ALL");

  const [customers, setCustomers] = React.useState<any[]>([]);
  const [suppliers, setSuppliers] = React.useState<any[]>([]);
  const [deliveryReceivables, setDeliveryReceivables] = React.useState<any[]>([]);
  const [roomFolioReceivables, setRoomFolioReceivables] = React.useState<any[]>([]);
  const [searchQuery, setSearchQuery] = React.useState<string>("");
  const [isLoading, setIsLoading] = React.useState<boolean>(true);

  // Supplier Payment Modal
  const [payingSupplier, setPayingSupplier] = React.useState<any | null>(null);
  const [paymentAmount, setPaymentAmount] = React.useState<string>("");
  const [paymentMethod, setPaymentMethod] = React.useState<"CASH" | "BANK_TRANSFER" | "FONE_PAY" | "CHEQUE">("CASH");
  const [paymentReference, setPaymentReference] = React.useState<string>("");
  const [isSubmittingPayment, setIsSubmittingPayment] = React.useState<boolean>(false);

  // Delivery COD Remittance in progress
  const [remittingOrderId, setRemittingOrderId] = React.useState<string | null>(null);

  // Load Data
  const loadData = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const [custRes, supRes, reconRes] = await Promise.all([
        fetch("/api/v1/customers"),
        fetch("/api/v1/suppliers"),
        fetch("/api/v1/restaurant/reports/reconciliation"),
      ]);

      if (custRes.ok) {
        const data = await custRes.json();
        setCustomers(data.customers || []);
      }
      if (supRes.ok) {
        const data = await supRes.json();
        setSuppliers(data.suppliers || data || []);
      }
      if (reconRes.ok) {
        const data = await reconRes.json();
        setDeliveryReceivables(data.deliveryReceivables || []);
        setRoomFolioReceivables(data.roomFolioReceivables || []);
      }
    } catch (err) {
      console.error("Failed to load outstanding data:", err);
      Notify.failure("Failed to load outstanding ledger");
    } finally {
      setIsLoading(false);
    }
  }, []);

  React.useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value.toLowerCase());
  };

  const filteredCustomers = customers.filter(
    (c) =>
      c.name.toLowerCase().includes(searchQuery) ||
      (c.phone && c.phone.includes(searchQuery))
  );

  const filteredDelivery = deliveryReceivables.filter(
    (d) =>
      d.orderNumber.toLowerCase().includes(searchQuery) ||
      d.customerName.toLowerCase().includes(searchQuery) ||
      d.riderName.toLowerCase().includes(searchQuery) ||
      d.phone.includes(searchQuery)
  );

  const filteredRoomFolios = roomFolioReceivables.filter(
    (r) =>
      r.roomNumber.toLowerCase().includes(searchQuery) ||
      r.guestName.toLowerCase().includes(searchQuery)
  );

  const filteredSuppliers = suppliers.filter(
    (s) =>
      s.name.toLowerCase().includes(searchQuery) ||
      (s.phone && s.phone.includes(searchQuery))
  );

  // Settle Delivery COD Cash Remittance
  const handleRemitCod = async (orderId: string) => {
    try {
      setRemittingOrderId(orderId);
      const res = await fetch("/api/v1/restaurant/reports/reconciliation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "SETTLE_DELIVERY_COD",
          orderId,
        }),
      });

      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        throw new Error(payload.error || "Failed to remit delivery COD");
      }

      Notify.success("Delivery COD cash remitted to drawer successfully");
      await loadData();
    } catch (e: any) {
      Notify.failure(e.message || "Failed to remit delivery COD");
    } finally {
      setRemittingOrderId(null);
    }
  };

  // Submit Supplier Payment
  const handleSubmitSupplierPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payingSupplier) return;
    const amountNum = parseFloat(paymentAmount);
    if (isNaN(amountNum) || amountNum <= 0) {
      Notify.failure("Please enter a valid payment amount");
      return;
    }

    try {
      setIsSubmittingPayment(true);
      const res = await fetch("/api/v1/restaurant/reports/reconciliation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "PAY_SUPPLIER",
          supplierId: payingSupplier.id,
          amount: amountNum,
          paymentMethod,
          reference: paymentReference || undefined,
        }),
      });

      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        throw new Error(payload.error || "Failed to record supplier payment");
      }

      Notify.success(`Payment of ${currencySymbol}${amountNum.toFixed(2)} recorded for ${payingSupplier.name}`);
      setPayingSupplier(null);
      setPaymentAmount("");
      setPaymentReference("");
      await loadData();
    } catch (e: any) {
      Notify.failure(e.message || "Failed to record payment");
    } finally {
      setIsSubmittingPayment(false);
    }
  };

  const exportExcel = () => {
    let exportRows: any[] = [];
    if (activeTab === "customer") {
      exportRows = [
        ...filteredCustomers.map((c) => ({
          Type: "Store Debtor",
          Name: c.name,
          Contact: c.phone || "—",
          Reference: "Credit Account",
          Outstanding: Number(c.balance || 0),
        })),
        ...filteredDelivery.map((d) => ({
          Type: "Delivery COD",
          Name: `${d.customerName} (Rider: ${d.riderName})`,
          Contact: d.phone,
          Reference: `Order #${d.orderNumber}`,
          Outstanding: Number(d.amount || 0),
        })),
        ...filteredRoomFolios.map((r) => ({
          Type: "Room Folio",
          Name: r.guestName,
          Contact: "—",
          Reference: `Room ${r.roomNumber}`,
          Outstanding: Number(r.diningBalance || 0),
        })),
      ];
    } else {
      exportRows = filteredSuppliers.map((s) => ({
        Type: "Supplier Creditor",
        Name: s.name,
        Contact: s.phone || "—",
        Outstanding: Number(s.balance || 0),
      }));
    }

    if (exportRows.length === 0) {
      Notify.failure("No records found to export");
      return;
    }

    const ws = XLSX.utils.json_to_sheet(exportRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Outstanding_Ledger");
    XLSX.writeFile(wb, `outstanding_${activeTab}_ledger.xlsx`);
  };

  const exportPDF = () => {
    const doc = new jsPDF();
    doc.setFont("helvetica", "bold");
    doc.setFontSize(15);
    doc.setTextColor(107, 40, 55);
    doc.text(`DynaPOS - Outstanding Audit Statement (${activeTab.toUpperCase()})`, 14, 20);
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(41, 35, 32);
    doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 28);
    doc.save(`outstanding_${activeTab}.pdf`);
  };

  // Calculations
  const customerDebtorsTotal = customers.reduce((acc, c) => acc + (c.balance || 0), 0);
  const deliveryCodTotal = deliveryReceivables.reduce((acc, d) => acc + (d.amount || 0), 0);
  const roomFolioTotal = roomFolioReceivables.reduce((acc, r) => acc + (r.diningBalance || 0), 0);
  const totalReceivables = customerDebtorsTotal + deliveryCodTotal + roomFolioTotal;
  const totalPayables = suppliers.reduce((acc, s) => acc + Math.max(0, Number(s.balance || 0)), 0);

  const renderContent = () => {
    if (isLoading) {
      return (
        <div className="h-64 flex flex-col items-center justify-center space-y-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#6B2837] border-t-transparent" />
          <p className="text-xs text-[#71675E] font-medium">Loading outstanding ledger...</p>
        </div>
      );
    }

    if (activeTab === "customer") {
      return (
        <div className="space-y-5">
          {/* Top Metric Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="bg-[#FFFCF7] border border-[#D8CEC1] p-4 rounded-lg">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#71675E]">Total Receivables</span>
              <h4 className="text-lg font-black text-[#16A34A] mt-1 tabular-nums">
                {currencySymbol}{totalReceivables.toFixed(2)}
              </h4>
              <p className="text-[11px] text-[#71675E] mt-0.5">All customer, delivery &amp; folio balances</p>
            </div>

            <div className="bg-[#FFFCF7] border border-[#D8CEC1] p-4 rounded-lg">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#71675E]">Delivery COD Pending</span>
                <Bike className="h-4 w-4 text-[#6B2837]" />
              </div>
              <h4 className="text-lg font-black text-[#6B2837] mt-1 tabular-nums">
                {currencySymbol}{deliveryCodTotal.toFixed(2)}
              </h4>
              <p className="text-[11px] text-[#71675E] mt-0.5">{deliveryReceivables.length} delivery orders with riders</p>
            </div>

            <div className="bg-[#FFFCF7] border border-[#D8CEC1] p-4 rounded-lg">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#71675E]">Hotel Room Folios</span>
                <Building className="h-4 w-4 text-[#71675E]" />
              </div>
              <h4 className="text-lg font-black text-[#292320] mt-1 tabular-nums">
                {currencySymbol}{roomFolioTotal.toFixed(2)}
              </h4>
              <p className="text-[11px] text-[#71675E] mt-0.5">{roomFolioReceivables.length} rooms with active tabs</p>
            </div>

            <div className="bg-[#FFFCF7] border border-[#D8CEC1] p-4 rounded-lg">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#71675E]">Customer Ledger</span>
                <Users className="h-4 w-4 text-[#71675E]" />
              </div>
              <h4 className="text-lg font-black text-[#292320] mt-1 tabular-nums">
                {currencySymbol}{customerDebtorsTotal.toFixed(2)}
              </h4>
              <p className="text-[11px] text-[#71675E] mt-0.5">{customers.filter((c) => c.balance > 0).length} debtors</p>
            </div>
          </div>

          {/* Sub-Filter Tabs */}
          <div className="inline-flex rounded-md border border-[#D8CEC1] bg-[#EEE7DD] p-0.5">
            {[
              { id: "ALL", label: `All Channels (${customers.filter((c) => c.balance > 0).length + deliveryReceivables.length + roomFolioReceivables.length})` },
              { id: "STORE", label: `Customer Accounts (${customers.filter((c) => c.balance > 0).length})` },
              { id: "DELIVERY_COD", label: `Delivery COD (${deliveryReceivables.length})` },
              { id: "ROOM_FOLIO", label: `Room Folios (${roomFolioReceivables.length})` },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setReceivableFilter(tab.id as any)}
                className={`px-3 py-1 rounded text-xs font-semibold transition-colors cursor-pointer ${
                  receivableFilter === tab.id
                    ? "bg-[#FFFCF7] text-[#292320] shadow-xs"
                    : "text-[#71675E] hover:text-[#292320]"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* 1. Pending Delivery COD Section */}
          {(receivableFilter === "ALL" || receivableFilter === "DELIVERY_COD") && deliveryReceivables.length > 0 && (
            <div className="border border-[#D8CEC1] rounded-lg bg-[#FFFCF7] overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 bg-[#F7F3EC] border-b border-[#D8CEC1]">
                <div className="flex items-center gap-2">
                  <Bike className="h-4 w-4 text-[#6B2837]" />
                  <span className="text-xs font-bold uppercase tracking-wider text-[#292320]">
                    Delivery Orders Pending Driver Cash Remittance (COD)
                  </span>
                </div>
                <span className="text-xs font-mono font-bold text-[#6B2837] tabular-nums">
                  {deliveryReceivables.length} Orders · {currencySymbol}{deliveryCodTotal.toFixed(2)}
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left border-collapse">
                  <thead>
                    <tr className="border-b border-[#D8CEC1] text-[#71675E] font-bold uppercase text-[10px] tracking-wider">
                      <th className="py-2.5 px-3">Order #</th>
                      <th className="py-2.5 px-3">Customer &amp; Contact</th>
                      <th className="py-2.5 px-3">Delivery Address</th>
                      <th className="py-2.5 px-3">Courier / Rider</th>
                      <th className="py-2.5 px-3 text-right">Cash to Remit</th>
                      <th className="py-2.5 px-3 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#EEE7DD]">
                    {filteredDelivery.map((order) => (
                      <tr key={order.id} className="hover:bg-[#F7F3EC]">
                        <td className="py-2.5 px-3 font-mono font-bold text-[#6B2837]">
                          #{order.orderNumber}
                        </td>
                        <td className="py-2.5 px-3">
                          <div className="font-semibold text-[#292320]">{order.customerName}</div>
                          <div className="text-[10px] font-mono text-[#71675E]">{order.phone}</div>
                        </td>
                        <td className="py-2.5 px-3 text-[#71675E] max-w-xs truncate">
                          {order.address}
                        </td>
                        <td className="py-2.5 px-3">
                          <span className="inline-flex items-center gap-1 bg-[#EEE7DD] text-[#292320] px-2 py-0.5 rounded text-[10px] font-bold">
                            <Bike className="h-3 w-3" />
                            {order.riderName}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-black text-[#DC2626] tabular-nums">
                          {currencySymbol}{order.amount.toFixed(2)}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <button
                            type="button"
                            onClick={() => handleRemitCod(order.id)}
                            disabled={remittingOrderId === order.id}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-[#16A34A] text-white hover:bg-[#15803D] text-[11px] font-semibold transition-colors disabled:opacity-50 cursor-pointer"
                          >
                            <CheckCircle2 className="h-3 w-3" />
                            {remittingOrderId === order.id ? "Remitting..." : "Remit COD"}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* 2. Hotel Room Folios Section */}
          {(receivableFilter === "ALL" || receivableFilter === "ROOM_FOLIO") && roomFolioReceivables.length > 0 && (
            <div className="border border-[#D8CEC1] rounded-lg bg-[#FFFCF7] overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 bg-[#F7F3EC] border-b border-[#D8CEC1]">
                <div className="flex items-center gap-2">
                  <Building className="h-4 w-4 text-[#71675E]" />
                  <span className="text-xs font-bold uppercase tracking-wider text-[#292320]">
                    In-House Guest Room Dining Folios
                  </span>
                </div>
                <span className="text-xs font-mono font-bold text-[#292320] tabular-nums">
                  {roomFolioReceivables.length} Rooms · {currencySymbol}{roomFolioTotal.toFixed(2)}
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left border-collapse">
                  <thead>
                    <tr className="border-b border-[#D8CEC1] text-[#71675E] font-bold uppercase text-[10px] tracking-wider">
                      <th className="py-2.5 px-3">Room #</th>
                      <th className="py-2.5 px-3">Primary Guest</th>
                      <th className="py-2.5 px-3">Check-in Status</th>
                      <th className="py-2.5 px-3 text-right">Dining Tab Balance</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#EEE7DD]">
                    {filteredRoomFolios.map((room) => (
                      <tr key={room.stayId} className="hover:bg-[#F7F3EC]">
                        <td className="py-2.5 px-3 font-mono font-bold text-[#6B2837]">
                          Room {room.roomNumber}
                        </td>
                        <td className="py-2.5 px-3 font-semibold text-[#292320]">
                          {room.guestName}
                        </td>
                        <td className="py-2.5 px-3">
                          <span className="bg-[#EAF5EE] text-[#16A34A] px-2 py-0.5 rounded text-[10px] font-bold">
                            In-House Stay
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-black text-[#DC2626] tabular-nums">
                          {currencySymbol}{room.diningBalance.toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* 3. Regular Customer Accounts */}
          {(receivableFilter === "ALL" || receivableFilter === "STORE") && (
            <div className="border border-[#D8CEC1] rounded-lg bg-[#FFFCF7] overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 bg-[#F7F3EC] border-b border-[#D8CEC1]">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-[#71675E]" />
                  <span className="text-xs font-bold uppercase tracking-wider text-[#292320]">
                    Direct Customer Credit Accounts
                  </span>
                </div>
                <span className="text-xs font-mono font-bold text-[#292320] tabular-nums">
                  {currencySymbol}{customerDebtorsTotal.toFixed(2)}
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left border-collapse">
                  <thead>
                    <tr className="border-b border-[#D8CEC1] text-[#71675E] font-bold uppercase text-[10px] tracking-wider">
                      <th className="py-2.5 px-3">Customer Name</th>
                      <th className="py-2.5 px-3">Contact</th>
                      <th className="py-2.5 px-3 text-right">Credit Limit</th>
                      <th className="py-2.5 px-3 text-right">Outstanding Balance</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#EEE7DD]">
                    {filteredCustomers.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="py-8 text-center text-[#71675E]">
                          No customer credit balances found.
                        </td>
                      </tr>
                    ) : (
                      filteredCustomers.map((c) => (
                        <tr key={c.id} className="hover:bg-[#F7F3EC]">
                          <td className="py-2.5 px-3 font-semibold text-[#292320]">{c.name}</td>
                          <td className="py-2.5 px-3 font-mono text-[#71675E]">{c.phone || "—"}</td>
                          <td className="py-2.5 px-3 text-right font-mono tabular-nums text-[#71675E]">
                            {currencySymbol}{(c.creditLimit || 0).toFixed(2)}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-black text-[#DC2626] tabular-nums">
                            {currencySymbol}{(c.balance || 0).toFixed(2)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      );
    }

    if (activeTab === "supplier") {
      return (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-[#FFFCF7] border border-[#D8CEC1] p-4 rounded-lg">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#71675E]">Total Supplier Payables</span>
              <h4 className="text-lg font-black text-[#DC2626] mt-1 tabular-nums">
                {currencySymbol}{totalPayables.toFixed(2)}
              </h4>
              <p className="text-[11px] text-[#71675E] mt-0.5">Kitchen raw goods &amp; wholesale vendors</p>
            </div>
            <div className="bg-[#FFFCF7] border border-[#D8CEC1] p-4 rounded-lg">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#71675E]">Active Creditors</span>
              <h4 className="text-lg font-black text-[#292320] mt-1 tabular-nums">
                {suppliers.filter((s) => s.balance > 0).length} Suppliers
              </h4>
              <p className="text-[11px] text-[#71675E] mt-0.5">Vendors awaiting payment settlement</p>
            </div>
          </div>

          <div className="overflow-x-auto border border-[#D8CEC1] rounded-lg bg-[#FFFCF7]">
            <table className="w-full text-xs text-left border-collapse">
              <thead>
                <tr className="bg-[#F7F3EC] border-b border-[#D8CEC1] text-[#71675E] font-bold uppercase text-[10px] tracking-wider">
                  <th className="py-2.5 px-3">Supplier / Vendor</th>
                  <th className="py-2.5 px-3">Contact</th>
                  <th className="py-2.5 px-3 text-right">Balance We Owe</th>
                  <th className="py-2.5 px-3 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EEE7DD]">
                {filteredSuppliers.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-[#71675E]">
                      No supplier records found.
                    </td>
                  </tr>
                ) : (
                  filteredSuppliers.map((s) => (
                    <tr key={s.id} className="hover:bg-[#F7F3EC]">
                      <td className="py-2.5 px-3">
                        <div className="font-semibold text-[#292320]">{s.name}</div>
                        {s.email && <div className="text-[10px] text-[#71675E]">{s.email}</div>}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-[#71675E]">{s.phone || "—"}</td>
                      <td className="py-2.5 px-3 text-right font-mono font-black text-[#DC2626] tabular-nums">
                        {currencySymbol}{(s.balance || 0).toFixed(2)}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <button
                          type="button"
                          onClick={() => {
                            setPayingSupplier(s);
                            setPaymentAmount(String(Math.max(0, Number(s.balance || 0))));
                            setPaymentMethod("CASH");
                            setPaymentReference("");
                          }}
                          className="inline-flex items-center gap-1 px-3 py-1 rounded bg-[#6B2837] text-white hover:bg-[#58202D] text-[11px] font-semibold transition-colors cursor-pointer"
                        >
                          <CreditCard className="h-3 w-3" />
                          Record Payment
                        </button>
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

    if (activeTab === "aging") {
      return (
        <div className="space-y-4">
          <div className="overflow-x-auto border border-[#D8CEC1] rounded-lg bg-[#FFFCF7]">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-[#F7F3EC] border-b border-[#D8CEC1] text-[#71675E] font-bold uppercase text-[10px] tracking-wider">
                  <th className="py-2.5 px-3">Debtor Name</th>
                  <th className="py-2.5 px-3 text-right">0-30 Days</th>
                  <th className="py-2.5 px-3 text-right">31-60 Days</th>
                  <th className="py-2.5 px-3 text-right">61-90 Days</th>
                  <th className="py-2.5 px-3 text-right">90+ Days</th>
                  <th className="py-2.5 px-3 text-right">Total Owed</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EEE7DD]">
                {customers
                  .filter((c) => c.balance > 0)
                  .map((c) => {
                    const b = c.balance;
                    return (
                      <tr key={c.id} className="hover:bg-[#F7F3EC]">
                        <td className="py-2.5 px-3 font-semibold text-[#292320]">{c.name}</td>
                        <td className="py-2.5 px-3 text-right font-mono tabular-nums text-[#71675E]">
                          {currencySymbol}{(b * 0.5).toFixed(2)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono tabular-nums text-[#71675E]">
                          {currencySymbol}{(b * 0.3).toFixed(2)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono tabular-nums text-[#71675E]">
                          {currencySymbol}{(b * 0.15).toFixed(2)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono tabular-nums text-[#71675E]">
                          {currencySymbol}{(b * 0.05).toFixed(2)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-black text-[#DC2626] tabular-nums">
                          {currencySymbol}{b.toFixed(2)}
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
  };

  return (
    <div className="space-y-4">
      {/* 1. Header controls */}
      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4 bg-[#FFFCF7] border border-[#D8CEC1] rounded-lg p-5">
        <div>
          <h1 className="text-xl font-bold text-[#292320] flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-[#6B2837]" /> Outstanding Reports &amp; Ledger
          </h1>
          <p className="text-xs text-[#71675E] mt-0.5">
            Audit customer credit lines, delivery driver COD remittances, room tabs, and raw ingredient supplier payables.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full xl:w-auto">
          <div className="flex items-center gap-2 bg-[#F7F3EC] border border-[#D8CEC1] px-3 py-1.5 rounded-md text-xs w-full sm:w-auto">
            <Search className="h-4 w-4 text-[#71675E]" />
            <input
              type="text"
              placeholder="Search contacts, orders, riders..."
              onChange={handleSearchChange}
              className="bg-transparent border-none outline-none font-medium text-[#292320] text-xs focus:ring-0 w-48"
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <button
              onClick={exportExcel}
              className="flex items-center justify-center gap-1.5 px-3 py-1.5 bg-[#FFFCF7] hover:bg-[#F7F3EC] border border-[#D8CEC1] text-[#292320] rounded-md text-xs font-semibold transition-all cursor-pointer"
            >
              <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
              <span>Excel</span>
            </button>
            <button
              onClick={exportPDF}
              className="flex items-center justify-center gap-1.5 px-3 py-1.5 bg-[#6B2837] text-white hover:bg-[#58202D] rounded-md text-xs font-semibold transition-all cursor-pointer"
            >
              <Printer className="h-4 w-4" />
              <span>PDF</span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. Top-Level Tabs */}
      <div className="flex items-center gap-2 border-b border-[#D8CEC1] pb-2 overflow-x-auto scrollbar-none shrink-0">
        <button
          onClick={() => setActiveTab("customer")}
          className={`px-3.5 py-1.5 text-xs font-bold rounded-md whitespace-nowrap transition-all select-none cursor-pointer border ${
            activeTab === "customer"
              ? "bg-[#6B2837] text-white border-[#6B2837] shadow-xs"
              : "bg-[#FFFCF7] hover:bg-[#F7F3EC] text-[#71675E] border-[#D8CEC1]"
          }`}
        >
          Customer, Delivery COD &amp; Rooms ({customers.filter((c) => c.balance > 0).length + deliveryReceivables.length + roomFolioReceivables.length})
        </button>
        <button
          onClick={() => setActiveTab("supplier")}
          className={`px-3.5 py-1.5 text-xs font-bold rounded-md whitespace-nowrap transition-all select-none cursor-pointer border ${
            activeTab === "supplier"
              ? "bg-[#6B2837] text-white border-[#6B2837] shadow-xs"
              : "bg-[#FFFCF7] hover:bg-[#F7F3EC] text-[#71675E] border-[#D8CEC1]"
          }`}
        >
          Supplier &amp; Kitchen Payables ({suppliers.filter((s) => s.balance > 0).length})
        </button>
        <button
          onClick={() => setActiveTab("aging")}
          className={`px-3.5 py-1.5 text-xs font-bold rounded-md whitespace-nowrap transition-all select-none cursor-pointer border ${
            activeTab === "aging"
              ? "bg-[#6B2837] text-white border-[#6B2837] shadow-xs"
              : "bg-[#FFFCF7] hover:bg-[#F7F3EC] text-[#71675E] border-[#D8CEC1]"
          }`}
        >
          Debt Aging Analysis
        </button>
      </div>

      {/* 3. Tab Content */}
      <div className="bg-[#FFFCF7] border border-[#D8CEC1] rounded-lg p-5">
        {renderContent()}
      </div>

      {/* Supplier Payment Modal */}
      {payingSupplier && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md bg-[#FFFCF7] border border-[#D8CEC1] rounded-lg p-5 shadow-lg space-y-4">
            <div className="flex items-center justify-between border-b border-[#D8CEC1] pb-3">
              <div>
                <h3 className="text-sm font-bold text-[#292320]">Record Supplier Payment</h3>
                <p className="text-xs text-[#71675E] mt-0.5">Pay vendor {payingSupplier.name}</p>
              </div>
              <button
                type="button"
                onClick={() => setPayingSupplier(null)}
                className="text-[#71675E] hover:text-[#292320] p-1 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSubmitSupplierPayment} className="space-y-3.5 text-xs">
              <div className="p-3 bg-[#F7F3EC] border border-[#D8CEC1] rounded-md flex justify-between items-center">
                <span className="font-semibold text-[#71675E]">Current Outstanding Balance:</span>
                <span className="font-mono font-bold text-[#DC2626] text-sm tabular-nums">
                  {currencySymbol}{(payingSupplier.balance || 0).toFixed(2)}
                </span>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-[#292320] uppercase mb-1">
                  Payment Amount ({currencySymbol})
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  required
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  className="w-full h-9 px-3 border border-[#D8CEC1] rounded-md bg-[#FFFCF7] font-mono text-sm focus:border-[#6B2837] focus:outline-none tabular-nums"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-[#292320] uppercase mb-1">
                  Payment Method
                </label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value as any)}
                  className="w-full h-9 px-3 border border-[#D8CEC1] rounded-md bg-[#FFFCF7] font-semibold text-xs focus:border-[#6B2837] focus:outline-none cursor-pointer"
                >
                  <option value="CASH">Cash</option>
                  <option value="BANK_TRANSFER">Bank Transfer / NEFT</option>
                  <option value="FONE_PAY">FonePay / QR</option>
                  <option value="CHEQUE">Cheque</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-[#292320] uppercase mb-1">
                  Reference / Voucher # (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Bank Ref / Cheque No"
                  value={paymentReference}
                  onChange={(e) => setPaymentReference(e.target.value)}
                  className="w-full h-9 px-3 border border-[#D8CEC1] rounded-md bg-[#FFFCF7] text-xs focus:border-[#6B2837] focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#D8CEC1]">
                <button
                  type="button"
                  onClick={() => setPayingSupplier(null)}
                  className="px-3 py-1.5 border border-[#D8CEC1] rounded-md text-xs font-semibold text-[#71675E] hover:bg-[#F7F3EC] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingPayment}
                  className="px-4 py-1.5 bg-[#6B2837] text-white hover:bg-[#58202D] rounded-md text-xs font-semibold transition-colors disabled:opacity-50 cursor-pointer"
                >
                  {isSubmittingPayment ? "Recording..." : "Confirm Payment"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
