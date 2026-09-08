"use client";

import * as React from "react";
import { Search, TrendingUp, Calendar, ArrowRight, User, Printer } from "lucide-react";
import { useSettings } from "@/components/settings-provider";
import { printThermalReceipt } from "@/lib/thermal-printer";
import { ReceiptData, ReceiptSettings } from "@/components/pos/thermal-receipt";

interface SaleItem {
  id: string;
  invoiceNumber: string;
  subtotal?: number;
  tax?: number;
  total: number;
  paidAmount: number;
  payments: Array<{ method: string }>;
  paymentStatus: string;
  status: string;
  notes: string | null;
  createdAt: string;
  customer?: { name: string; phone?: string; panNumber?: string } | null;
  user: { name: string };
  saleItems?: Array<{
    id: string;
    quantity: number;
    price: number;
    discount?: number;
    product?: { name: string; sku?: string; barcode?: string };
  }>;
}

export default function SalesPage() {
  const {
    currencySymbol,
    businessName,
    address,
    phone,
    panNumber,
    vatNumber,
    taxName,
    receiptTitle,
    receiptHeader,
    receiptFooter,
    receiptLogo,
    invoiceLogo,
    receiptWidth,
    paymentQrImage,
    fonepayQr,
    paymentQrMedium,
    paymentUpiId,
    paymentAccountName,
    showTaxBreakup,
    showQrCode,
  } = useSettings();

  const [sales, setSales] = React.useState<SaleItem[]>([]);
  const [search, setSearch] = React.useState("");
  const [isLoading, setIsLoading] = React.useState(true);
  const [printingId, setPrintingId] = React.useState<string | null>(null);

  const loadSales = React.useCallback(async () => {
    try {
      setIsLoading(true);
      const res = await fetch(`/api/v1/sales?limit=50&search=${search}`);
      if (res.ok) {
        const data = await res.json();
        setSales(data.sales || []);
      }
    } catch (err) {
      console.error("Failed to load sales log:", err);
    } finally {
      setIsLoading(false);
    }
  }, [search]);

  React.useEffect(() => {
    loadSales();
  }, [loadSales]);

  const handleReprintSale = async (sale: SaleItem) => {
    setPrintingId(sale.id);
    try {
      const items = (sale.saleItems || []).map((si) => ({
        id: si.id,
        name: si.product?.name || "Product Item",
        quantity: si.quantity,
        price: si.price,
        discount: si.discount || 0,
        sku: si.product?.sku,
        barcode: si.product?.barcode,
      }));

      const receiptData: ReceiptData = {
        invoiceNumber: sale.invoiceNumber,
        isReprint: true,
        createdAt: sale.createdAt,
        cashierName: sale.user.name,
        customerName: sale.customer?.name,
        customerPhone: sale.customer?.phone,
        customerPan: sale.customer?.panNumber,
        items,
        subtotal: sale.subtotal ?? (sale.total - (sale.tax || 0)),
        tax: sale.tax || 0,
        total: sale.total,
        paidAmount: sale.paidAmount,
        roundedTotal: Math.round(sale.total),
      };

      const receiptSettings: ReceiptSettings = {
        businessName,
        address,
        phone,
        panNumber,
        vatNumber,
        taxName,
        currencySymbol,
        receiptTitle,
        receiptHeader,
        receiptFooter,
        receiptLogo,
        invoiceLogo,
        receiptWidth,
        paymentQrImage: paymentQrImage || fonepayQr,
        paymentQrMedium,
        paymentUpiId,
        paymentAccountName: paymentAccountName || businessName,
        showTaxBreakup,
        showQrCode,
      };

      await printThermalReceipt(receiptData, receiptSettings, sale.id);
    } finally {
      setPrintingId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between bg-card border border-border p-5 rounded-2xl">
        <div>
          <h1 className="text-xl font-bold">Sales Log History</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Log records of POS billing, invoice numbers, and collection details.
          </p>
        </div>
      </div>

      {/* Main List */}
      <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
        {/* Search */}
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-2.5 h-4.5 w-4.5 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search by invoice number or customer name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 w-full px-4 py-2 border border-border rounded-lg bg-background text-sm focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>

        {isLoading ? (
          <div className="py-12 text-center text-xs text-muted-foreground">Loading sales history...</div>
        ) : sales.length === 0 ? (
          <div className="py-12 text-center text-xs text-muted-foreground">No billing invoices found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left border-collapse">
              <thead>
                <tr className="border-b border-border text-muted-foreground font-semibold uppercase tracking-wider text-[10px]">
                  <th className="py-3 px-2">Invoice #</th>
                  <th className="py-3 px-2">Date / Time</th>
                  <th className="py-3 px-2">Customer</th>
                  <th className="py-3 px-2 text-right">Total Invoice</th>
                  <th className="py-3 px-2 text-right">Paid Amount</th>
                  <th className="py-3 px-2 text-center">Method</th>
                  <th className="py-3 px-2 text-center">Payment Status</th>
                  <th className="py-3 px-2">Cashier</th>
                  <th className="py-3 px-2 text-center">Receipt</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {sales.map((sale) => (
                  <tr key={sale.id} className="hover:bg-secondary/10">
                    <td className="py-3 px-2 font-bold text-primary">{sale.invoiceNumber}</td>
                    <td className="py-3 px-2 text-muted-foreground">
                      {new Date(sale.createdAt).toLocaleString()}
                    </td>
                    <td className="py-3 px-2">
                      <span className="font-semibold text-foreground">
                        {sale.customer?.name || "Walk-in Customer"}
                      </span>
                    </td>
                    <td className="py-3 px-2 text-right font-black text-foreground">
                      {currencySymbol}{sale.total.toFixed(2)}
                    </td>
                    <td className="py-3 px-2 text-right font-medium text-primary">
                      {currencySymbol}{sale.paidAmount.toFixed(2)}
                    </td>
                    <td className="py-3 px-2 text-center">
                      <span className="bg-secondary text-secondary-foreground px-2 py-0.5 rounded font-bold text-[9px]">
                        {sale.payments && sale.payments.length > 0
                          ? Array.from(new Set(sale.payments.map((p: any) => p.method))).join(", ")
                          : "CREDIT"}
                      </span>
                    </td>
                    <td className="py-3 px-2 text-center">
                      <span className={`px-2 py-0.5 rounded font-semibold text-[9px] border ${
                        sale.paymentStatus === "PAID"
                          ? "bg-primary/10 text-primary border-primary/20"
                          : sale.paymentStatus === "PARTIAL"
                          ? "bg-amber-500/10 text-amber-500 border-amber-500/20"
                          : "bg-destructive/10 text-destructive border-destructive/20"
                      }`}>
                        {sale.paymentStatus}
                      </span>
                    </td>
                    <td className="py-3 px-2 text-muted-foreground">{sale.user.name}</td>
                    <td className="py-3 px-2 text-center">
                      <button
                        type="button"
                        onClick={() => handleReprintSale(sale)}
                        disabled={printingId === sale.id}
                        className="inline-flex items-center gap-1 px-2.5 py-1 bg-secondary hover:bg-primary hover:text-white text-secondary-foreground rounded-lg text-[10px] font-bold transition-all shadow-xs cursor-pointer disabled:opacity-50"
                        title="Reprint Thermal Receipt"
                      >
                        <Printer className="h-3 w-3" />
                        <span>{printingId === sale.id ? "Printing..." : "Print"}</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
