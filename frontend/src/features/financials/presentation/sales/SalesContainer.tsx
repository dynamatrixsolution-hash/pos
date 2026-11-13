"use client";

import React, { useEffect, useState } from "react";
import { Search, TrendingUp, Calendar, Printer, RefreshCw, Eye, CheckCircle2, AlertCircle, Clock } from "lucide-react";
import { useSalesStore } from "../../state/sales.store";
import { useSettings } from "@/components/settings-provider";
import { printThermalReceipt } from "@/lib/thermal-printer";
import { ReceiptData, ReceiptSettings } from "@/components/pos/thermal-receipt";

function formatNPR(amount: number | string | undefined): string {
  const val = Number(amount) || 0;
  return `Rs. ${val.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export const SalesContainer: React.FC = () => {
  const sales = useSalesStore((s) => s.sales);
  const isLoading = useSalesStore((s) => s.isLoading);
  const search = useSalesStore((s) => s.search);
  const setSearch = useSalesStore((s) => s.setSearch);
  const loadSales = useSalesStore((s) => s.loadSales);
  const setSelectedSale = useSalesStore((s) => s.setSelectedSaleForInspection);

  const settings = useSettings();
  const [printingId, setPrintingId] = useState<string | null>(null);

  useEffect(() => {
    loadSales();
  }, [loadSales]);

  const handlePrint = (sale: any) => {
    setPrintingId(sale.id);
    const receiptData: ReceiptData = {
      invoiceNumber: sale.invoiceNumber,
      items: (sale.saleItems || []).map((item: any) => ({
        id: item.id,
        name: item.product?.name || "Product",
        quantity: item.quantity,
        price: Number(item.price) || 0,
      })),
      subtotal: Number(sale.subtotal) || Number(sale.total) || 0,
      discount: Number(sale.discount) || 0,
      tax: Number(sale.tax) || 0,
      total: Number(sale.total) || 0,
      paymentMethod: sale.payments?.[0]?.method || "CASH",
      paidAmount: Number(sale.paidAmount) || Number(sale.total) || 0,
      createdAt: sale.createdAt,
      customerName: sale.customer?.name,
      customerPhone: sale.customer?.phone,
      cashierName: sale.user?.name,
    };

    const receiptSettings: ReceiptSettings = {
      businessName: settings.businessName || "Restroinn POS",
      address: settings.address || "",
      phone: settings.phone || "",
      panNumber: settings.panNumber || "",
      vatNumber: settings.vatNumber || "",
      receiptHeader: settings.receiptHeader,
      receiptFooter: settings.receiptFooter,
      receiptWidth: (settings.receiptWidth as any) || "80mm",
      showTaxBreakup: settings.showTaxBreakup,
    };

    try {
      printThermalReceipt(receiptData, receiptSettings);
    } finally {
      setTimeout(() => setPrintingId(null), 1000);
    }
  };

  return (
    <div className="space-y-4 p-4 md:p-6 bg-[#F7F3EC] min-h-screen text-[#292320]">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#FFFCF7] p-4 rounded-xl border border-[#D8CEC1] shadow-2xs">
        <div className="flex items-center gap-2.5">
          <div className="p-2.5 rounded-xl bg-[#6B2837] text-white">
            <TrendingUp className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-[#292320]">
              Sales Invoices &amp; Completed Orders
            </h1>
            <p className="text-xs text-[#71675E]">
              Audited electronic sales register, tax invoices, and reprint receipts
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={loadSales}
          disabled={isLoading}
          className="h-8 px-3 rounded-lg border border-[#D8CEC1] bg-[#FFFCF7] hover:bg-[#EEE7DD] text-xs font-semibold text-[#292320] flex items-center gap-1.5 transition-colors cursor-pointer self-start sm:self-auto"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Search Bar */}
      <div className="p-3 rounded-xl border border-[#D8CEC1] bg-[#FFFCF7] flex items-center justify-between gap-3 shadow-2xs">
        <div className="relative flex-1 max-w-md">
          <Search className="h-3.5 w-3.5 text-[#71675E] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search invoice number, customer name, phone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && loadSales()}
            className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-[#D8CEC1] bg-[#FFFCF7] text-[#292320] focus:border-[#6B2837] focus:outline-none placeholder:text-[#71675E]"
          />
        </div>
      </div>

      {/* Sales Invoices Table */}
      <div className="rounded-xl border border-[#D8CEC1] bg-[#FFFCF7] overflow-hidden shadow-2xs">
        {isLoading ? (
          <div className="p-4 space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-12 w-full animate-pulse rounded-lg bg-[#EEE7DD]" />
            ))}
          </div>
        ) : sales.length === 0 ? (
          <div className="py-16 text-center text-xs text-[#71675E] space-y-2">
            <TrendingUp className="h-8 w-8 text-[#71675E]/40 mx-auto" />
            <p className="font-bold text-[#292320]">No sales invoices found</p>
            <p>New completed orders from POS or counter sales will show up here.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-[#D8CEC1] bg-[#F7F3EC] text-[11px] font-bold uppercase tracking-wider text-[#71675E]">
                <tr>
                  <th className="px-3.5 py-3">Invoice #</th>
                  <th className="px-3.5 py-3">Customer</th>
                  <th className="px-3.5 py-3">Method</th>
                  <th className="px-3.5 py-3 text-right">Total (NPR)</th>
                  <th className="px-3.5 py-3 text-right">Paid (NPR)</th>
                  <th className="px-3.5 py-3">Status</th>
                  <th className="px-3.5 py-3">Date</th>
                  <th className="px-3.5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#D8CEC1]/60">
                {sales.map((sale) => {
                  const isPaid = sale.paymentStatus === "PAID";
                  const isPartial = sale.paymentStatus === "PARTIAL";

                  return (
                    <tr key={sale.id} className="hover:bg-[#F7F3EC]/50 transition-colors">
                      <td className="px-3.5 py-3">
                        <span className="font-mono font-bold text-[#6B2837]">
                          #{sale.invoiceNumber || sale.id.slice(0, 8)}
                        </span>
                      </td>

                      <td className="px-3.5 py-3">
                        {sale.customer ? (
                          <div>
                            <div className="font-bold text-[#292320]">{sale.customer.name}</div>
                            {sale.customer.phone && (
                              <div className="text-[10px] text-[#71675E]">{sale.customer.phone}</div>
                            )}
                          </div>
                        ) : (
                          <span className="text-[11px] text-[#71675E] italic">Walk-In Guest</span>
                        )}
                      </td>

                      <td className="px-3.5 py-3">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#F7F3EC] border border-[#D8CEC1] text-[#292320]">
                          {sale.payments?.[0]?.method || "CASH"}
                        </span>
                      </td>

                      <td className="px-3.5 py-3 text-right font-mono font-bold text-[#292320] tabular-nums">
                        {formatNPR(sale.total)}
                      </td>

                      <td className="px-3.5 py-3 text-right font-mono font-bold text-[#16A34A] tabular-nums">
                        {formatNPR(sale.paidAmount || sale.total)}
                      </td>

                      <td className="px-3.5 py-3">
                        {isPaid ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#EDF5ED] text-[#2D6A4F] border border-[#C8DFCD]">
                            <CheckCircle2 className="h-3 w-3" />
                            <span>Paid</span>
                          </span>
                        ) : isPartial ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#FEF3C7] text-[#92400E] border border-[#FDE68A]">
                            <Clock className="h-3 w-3" />
                            <span>Partial</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-800 border border-red-200">
                            <AlertCircle className="h-3 w-3" />
                            <span>Unpaid</span>
                          </span>
                        )}
                      </td>

                      <td className="px-3.5 py-3 text-[11px] text-[#71675E]">
                        <div className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          <span>{sale.createdAt ? sale.createdAt.split("T")[0] : "Recent"}</span>
                        </div>
                      </td>

                      <td className="px-3.5 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => handlePrint(sale)}
                          disabled={printingId === sale.id}
                          className="p-1.5 rounded-lg border border-[#D8CEC1] bg-[#FFFCF7] hover:bg-[#EEE7DD] text-[#71675E] hover:text-[#292320] transition-colors cursor-pointer"
                          title="Print Thermal Receipt"
                        >
                          <Printer className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
