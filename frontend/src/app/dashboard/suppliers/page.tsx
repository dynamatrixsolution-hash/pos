"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { useSettings } from "@/components/settings-provider";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Search, Plus, Store, Receipt, FileText, ArrowUpRight } from "lucide-react";

interface SupplierItem {
  id: string;
  name: string;
  contactName: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  balance: number;
}

interface LedgerEntry {
  id: string;
  type: string;
  reference: string | null;
  debit: number; // what we paid supplier
  credit: number; // what we bought from supplier
  balance: number; // running balance we owe
  description: string | null;
  createdAt: string;
}

const supplierSchema = z.object({
  name: z.string().min(2, "Supplier name must be at least 2 characters"),
  contactName: z.string().optional().nullable(),
  email: z.string().email("Invalid email").optional().nullable().or(z.literal("")),
  phone: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
});

type SupplierInputs = z.infer<typeof supplierSchema>;

export default function SuppliersPage() {
  const { currencySymbol } = useSettings();
  const [suppliers, setSuppliers] = React.useState<SupplierItem[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [search, setSearch] = React.useState("");
  const [modalOpen, setModalOpen] = React.useState(false);
  const [submitError, setSubmitError] = React.useState<string | null>(null);

  // Ledger state
  const [selectedSupplier, setSelectedSupplier] = React.useState<SupplierItem | null>(null);
  const [ledgerEntries, setLedgerEntries] = React.useState<LedgerEntry[]>([]);
  const [ledgerLoading, setLedgerLoading] = React.useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<SupplierInputs>({
    resolver: zodResolver(supplierSchema),
  });

  const loadSuppliers = React.useCallback(async () => {
    try {
      setIsLoading(true);
      const res = await fetch(`/api/v1/suppliers?limit=100&search=${search}`);
      if (res.ok) {
        const data = await res.json();
        setSuppliers(data.suppliers || []);
      }
    } catch (err) {
      console.error("Failed to load suppliers list:", err);
    } finally {
      setIsLoading(false);
    }
  }, [search]);

  React.useEffect(() => {
    loadSuppliers();
  }, [loadSuppliers]);

  const onSubmit = async (data: SupplierInputs) => {
    setSubmitError(null);
    try {
      const res = await fetch("/api/v1/suppliers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        const json = await res.json();
        setSubmitError(json.error || "Failed to create supplier profile");
        return;
      }

      setModalOpen(false);
      reset();
      loadSuppliers();
    } catch (err) {
      setSubmitError("Connection failure.");
    }
  };

  const viewLedger = async (supplier: SupplierItem) => {
    setSelectedSupplier(supplier);
    setLedgerLoading(true);
    try {
      const res = await fetch(`/api/v1/ledger/supplier/${supplier.id}`);
      if (res.ok) {
        const data = await res.json();
        setLedgerEntries(data.ledger || []);
      }
    } catch (err) {
      console.error("Failed to fetch supplier ledger:", err);
    } finally {
      setLedgerLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between bg-card border border-border p-5 rounded-2xl">
        <div>
          <h1 className="text-xl font-bold">Supplier Ledger Directory</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Manage restock vendors, track payment liabilities, and view balance sheets.
          </p>
        </div>
        <button
          onClick={() => {
            setModalOpen(true);
            setSubmitError(null);
          }}
          className="flex items-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground hover:bg-primary/95 rounded-xl text-xs font-black shadow-lg shadow-primary/20 transition-all uppercase tracking-wider"
        >
          <Plus className="h-4.5 w-4.5" />
          Add Supplier
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Side: Supplier Table List */}
        <div className="lg:col-span-2 bg-card border border-border rounded-2xl p-5 space-y-4">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-2.5 h-4.5 w-4.5 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search suppliers by name, phone, contact person..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 w-full px-4 py-2 border border-border rounded-lg bg-background text-sm focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          {isLoading ? (
            <div className="py-12 text-center text-xs text-muted-foreground">Loading suppliers directory...</div>
          ) : suppliers.length === 0 ? (
            <div className="py-12 text-center text-xs text-muted-foreground">No supplier profiles found.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left border-collapse">
                <thead>
                  <tr className="border-b border-border text-muted-foreground font-semibold uppercase tracking-wider text-[10px]">
                    <th className="py-3 px-2">Supplier details</th>
                    <th className="py-3 px-2">Contact Person</th>
                    <th className="py-3 px-2 text-right">Owed Balance</th>
                    <th className="py-3 px-2 text-center">Statements</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {suppliers.map((s) => (
                    <tr
                      key={s.id}
                      className={`hover:bg-secondary/10 cursor-pointer ${
                        selectedSupplier?.id === s.id ? "bg-primary/5" : ""
                      }`}
                      onClick={() => viewLedger(s)}
                    >
                      <td className="py-3 px-2">
                        <div className="font-bold text-foreground">{s.name}</div>
                        <div className="text-[10px] text-muted-foreground mt-0.5">
                          {s.phone || "No Phone"} {s.email ? `| ${s.email}` : ""}
                        </div>
                      </td>
                      <td className="py-3 px-2 text-muted-foreground font-semibold">
                        {s.contactName || "None"}
                      </td>
                      <td className="py-3 px-2 text-right font-black text-destructive">
                        {currencySymbol}{s.balance.toFixed(2)}
                      </td>
                      <td className="py-3 px-2 text-center">
                        <button
                          type="button"
                          className="text-primary hover:underline text-[10px] font-bold flex items-center gap-0.5 mx-auto"
                        >
                          Statement <ArrowUpRight className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Right Side: Ledger Statement readout */}
        <div className="bg-card border border-border rounded-2xl p-5 flex flex-col justify-between min-h-[400px]">
          <div>
            <h2 className="text-sm font-bold border-b border-border pb-3 flex items-center gap-2">
              <Receipt className="h-4.5 w-4.5 text-primary" />
              Supplier Ledgers Statement
            </h2>

            {!selectedSupplier ? (
              <div className="h-full flex flex-col items-center justify-center text-center text-muted-foreground p-6 mt-12">
                <FileText className="h-10 w-10 stroke-1 opacity-50 mb-1" />
                <p className="text-xs">Select a vendor profile on the left to review ledger statement lines.</p>
              </div>
            ) : ledgerLoading ? (
              <div className="py-12 text-center text-xs text-muted-foreground">Compiling ledger balances...</div>
            ) : (
              <div className="space-y-4 mt-4">
                <div className="bg-secondary/40 border border-border rounded-xl p-3 text-xs space-y-1">
                  <div className="font-extrabold text-foreground">{selectedSupplier.name}</div>
                  <div className="flex justify-between mt-1 text-[10px] text-muted-foreground">
                    <span>Contact: {selectedSupplier.contactName || "None"}</span>
                    <span className="text-destructive font-bold">Owe: {currencySymbol}{selectedSupplier.balance.toFixed(2)}</span>
                  </div>
                </div>

                <div className="space-y-2.5 overflow-y-auto max-h-[300px] pr-1">
                  {ledgerEntries.length === 0 ? (
                    <div className="text-center text-[10px] text-muted-foreground py-6">No entries recorded.</div>
                  ) : (
                    ledgerEntries.map((l) => (
                      <div key={l.id} className="bg-background border border-border rounded-lg p-2.5 text-[10px] space-y-1">
                        <div className="flex justify-between font-bold">
                          <span className="text-primary">{l.type} ({l.reference || "None"})</span>
                          <span className="text-muted-foreground">{new Date(l.createdAt).toLocaleDateString()}</span>
                        </div>
                        <div className="text-[9px] text-muted-foreground">{l.description}</div>
                        <div className="flex justify-between border-t border-border/40 pt-1 mt-1 font-semibold">
                          <span>Dr (Paid): {currencySymbol}{l.debit.toFixed(2)} | Cr (Bought): {currencySymbol}{l.credit.toFixed(2)}</span>
                          <span className="text-destructive">Bal Owed: {currencySymbol}{l.balance.toFixed(2)}</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Add Supplier Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="bg-card border border-border rounded-xl p-6 w-full max-w-md space-y-4">
            <div>
              <h3 className="text-sm font-bold">Register Supplier Profile</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Register vendor profiles for restock invoices and purchase order tracking.
              </p>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                  Vendor Name
                </label>
                <input
                  type="text"
                  placeholder="Global Distributor Inc."
                  {...register("name")}
                  className={`w-full px-3 py-2 border rounded-lg text-xs bg-background focus:outline-none focus:ring-1 ${
                    errors.name ? "border-destructive focus:ring-destructive" : "border-border focus:ring-primary"
                  }`}
                />
                {errors.name && (
                  <span className="text-[10px] text-destructive font-semibold">{errors.name.message}</span>
                )}
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                  Contact Person Name
                </label>
                <input
                  type="text"
                  placeholder="Michael Supplier"
                  {...register("contactName")}
                  className="w-full px-3 py-2 border border-border rounded-lg text-xs bg-background focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                    Email Address
                  </label>
                  <input
                    type="email"
                    placeholder="sales@globaldist.com"
                    {...register("email")}
                    className="w-full px-3 py-2 border border-border rounded-lg text-xs bg-background focus:outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                    Phone Number
                  </label>
                  <input
                    type="text"
                    placeholder="+1-555-0900"
                    {...register("phone")}
                    className="w-full px-3 py-2 border border-border rounded-lg text-xs bg-background focus:outline-none"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                  Office Location Address
                </label>
                <input
                  type="text"
                  placeholder="100 Logistics Rd, Newark, NJ"
                  {...register("address")}
                  className="w-full px-3 py-2 border border-border rounded-lg text-xs bg-background focus:outline-none"
                />
              </div>

              {submitError && (
                <div className="text-xs text-destructive bg-destructive/10 border border-destructive/20 p-2.5 rounded-lg font-semibold leading-tight">
                  {submitError}
                </div>
              )}

              <div className="flex justify-end gap-2 border-t border-border pt-4">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 border border-border text-xs rounded-lg hover:bg-secondary font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-primary text-primary-foreground text-xs font-black rounded-lg hover:bg-primary/90 shadow-lg shadow-primary/20"
                >
                  Create Profile
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
