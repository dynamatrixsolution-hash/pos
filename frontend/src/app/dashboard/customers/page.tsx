"use client";

import { Notify } from "@/lib/notify";

import * as React from "react";
import { useForm } from "react-hook-form";
import { useSettings } from "@/components/settings-provider";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Search, Plus, UserCheck, CreditCard, Receipt, FileText, ArrowUpRight, Loader2 } from "lucide-react";

interface CustomerItem {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  customerType: string;
  creditLimit: number;
  balance: number;
}

interface LedgerEntry {
  id: string;
  type: string;
  reference: string | null;
  debit: number;
  credit: number;
  balance: number;
  description: string | null;
  createdAt: string;
}

const customerSchema = z.object({
  name: z.string().min(2, "Customer name must be at least 2 characters"),
  email: z.string().email("Invalid email").optional().nullable().or(z.literal("")),
  phone: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  customerType: z.enum(["RETAIL", "WHOLESALE"]),
  creditLimit: z.number().nonnegative(),
});

type CustomerInputs = z.infer<typeof customerSchema>;

export default function CustomersPage() {
  const { currencySymbol } = useSettings();
  const [customers, setCustomers] = React.useState<CustomerItem[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [search, setSearch] = React.useState("");
  const [modalOpen, setModalOpen] = React.useState(false);
  const [submitError, setSubmitError] = React.useState<string | null>(null);

  // Ledger state
  const [selectedCustomer, setSelectedCustomer] = React.useState<CustomerItem | null>(null);
  const [ledgerEntries, setLedgerEntries] = React.useState<LedgerEntry[]>([]);
  const [ledgerLoading, setLedgerLoading] = React.useState(false);

  // Receive payment state
  const [receivePaymentOpen, setReceivePaymentOpen] = React.useState(false);
  const [receiveAmount, setReceiveAmount] = React.useState(0);
  const [receiveMethod, setReceiveMethod] = React.useState("CASH");
  const [receiveRef, setReceiveRef] = React.useState("");
  const [receiveRemarks, setReceiveRemarks] = React.useState("");
  const [receiveError, setReceiveError] = React.useState<string | null>(null);
  const [isReceiving, setIsReceiving] = React.useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CustomerInputs>({
    resolver: zodResolver(customerSchema),
    defaultValues: {
      customerType: "RETAIL",
      creditLimit: 0,
    },
  });

  const loadCustomers = React.useCallback(async () => {
    try {
      setIsLoading(true);
      const res = await fetch(`/api/v1/customers?limit=100&search=${search}`);
      if (res.ok) {
        const data = await res.json();
        setCustomers(data.customers || []);
      }
    } catch (err) {
      console.error("Failed to load customers catalog:", err);
    } finally {
      setIsLoading(false);
    }
  }, [search]);

  React.useEffect(() => {
    loadCustomers();
  }, [loadCustomers]);

  const onSubmit = async (data: CustomerInputs) => {
    setSubmitError('');
    try {
      const res = await fetch("/api/v1/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        const json = await res.json();
        Notify.failure(json.error || "Failed to create customer profile"); setSubmitError(json.error || "Failed to create customer profile");
        return;
      }

      setModalOpen(false);
      reset();
      loadCustomers();
    } catch (err) {
      Notify.failure("Connection failure."); setSubmitError("Connection failure.");
    }
  };

  const viewLedger = async (customer: CustomerItem) => {
    setSelectedCustomer(customer);
    setLedgerLoading(true);
    try {
      const res = await fetch(`/api/v1/ledger/customer/${customer.id}`);
      if (res.ok) {
        const data = await res.json();
        setLedgerEntries(data.ledger || []);
      }
    } catch (err) {
      console.error("Failed to fetch customer ledger:", err);
    } finally {
      setLedgerLoading(false);
    }
  };

  const handleReceivePaymentSubmit = async () => {
    if (receiveAmount <= 0) {
      Notify.failure("Please enter a positive payment amount."); setReceiveError("Please enter a positive payment amount.");
      return;
    }
    if (!selectedCustomer) return;

    setIsReceiving(true);
    setReceiveError('');

    try {
      const res = await fetch("/api/v1/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "RECEIVED",
          customerId: selectedCustomer.id,
          amount: receiveAmount,
          method: receiveMethod,
          reference: receiveRef,
          remarks: receiveRemarks,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        Notify.failure(data.error || "Failed to record payment."); setReceiveError(data.error || "Failed to record payment.");
        return;
      }

      setReceivePaymentOpen(false);
      setReceiveAmount(0);
      setReceiveRef("");
      setReceiveRemarks("");
      
      // Refresh customer data
      await loadCustomers();
      
      // Update selected customer local balance
      setSelectedCustomer(prev => prev ? { ...prev, balance: Math.max(0, prev.balance - receiveAmount) } : null);
      
      // Reload statements
      viewLedger(selectedCustomer);
    } catch (e) {
      Notify.failure("Network connection error."); setReceiveError("Network connection error.");
    } finally {
      setIsReceiving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between bg-card border border-border p-5 rounded-lg">
        <div>
          <h1 className="text-xl font-bold">Customer Ledger Directory</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Manage clients, credit ceilings, payments, and double-entry statements.
          </p>
        </div>
        <button
          onClick={() => {
            setModalOpen(true);
            setSubmitError('');
          }}
          className="flex items-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground hover:bg-primary/95 rounded-md text-xs font-black shadow-sm shadow-primary/20 transition-all uppercase tracking-wider"
        >
          <Plus className="h-4.5 w-4.5" />
          Add Customer
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2/3 Side: Customer Table List */}
        <div className="lg:col-span-2 bg-card border border-border rounded-lg p-5 space-y-4">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-2.5 h-4.5 w-4.5 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search customers by name, phone, email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 w-full px-4 py-2 border border-border rounded-lg bg-background text-sm focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          {isLoading ? (
            <div className="py-12 text-center text-xs text-muted-foreground">Loading customers directory...</div>
          ) : customers.length === 0 ? (
            <div className="py-12 text-center text-xs text-muted-foreground">No customer profiles found.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left border-collapse">
                <thead>
                  <tr className="border-b border-border text-muted-foreground font-semibold uppercase tracking-wider text-[10px]">
                    <th className="py-3 px-2">Customer Profile</th>
                    <th className="py-3 px-2">Type</th>
                    <th className="py-3 px-2 text-right">Credit Limit</th>
                    <th className="py-3 px-2 text-right">Balance Due</th>
                    <th className="py-3 px-2 text-center">Statements</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {customers.map((c) => (
                    <tr
                      key={c.id}
                      className={`hover:bg-secondary/10 cursor-pointer ${
                        selectedCustomer?.id === c.id ? "bg-primary/5" : ""
                      }`}
                      onClick={() => viewLedger(c)}
                    >
                      <td className="py-3 px-2">
                        <div className="font-bold text-foreground">{c.name}</div>
                        <div className="text-[10px] text-muted-foreground mt-0.5">
                          {c.phone || "No Phone"} {c.email ? `| ${c.email}` : ""}
                        </div>
                      </td>
                      <td className="py-3 px-2">
                        <span className={`px-2 py-0.5 rounded text-[9px] font-bold border ${
                          c.customerType === "WHOLESALE"
                            ? "bg-amber-500/10 text-amber-500 border-amber-500/20"
                            : "bg-secondary text-foreground"
                        }`}>
                          {c.customerType}
                        </span>
                      </td>
                      <td className="py-3 px-2 text-right font-medium">{currencySymbol}{c.creditLimit.toFixed(2)}</td>
                      <td className="py-3 px-2 text-right font-black text-destructive">
                        {currencySymbol}{c.balance.toFixed(2)}
                      </td>
                      <td className="py-3 px-2 text-center">
                        <button
                          type="button"
                          className="text-primary hover:underline text-[10px] font-bold flex items-center gap-0.5 mx-auto"
                        >
                          Ledger <ArrowUpRight className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Right 1/3 Side: Ledger Account Statement readout */}
        <div className="bg-card border border-border rounded-lg p-5 flex flex-col justify-between min-h-[400px]">
          <div>
            <h2 className="text-sm font-bold border-b border-border pb-3 flex items-center gap-2">
              <Receipt className="h-4.5 w-4.5 text-primary" />
              Customer Ledgers Statement
            </h2>

            {!selectedCustomer ? (
              <div className="h-full flex flex-col items-center justify-center text-center text-muted-foreground p-6 mt-12">
                <FileText className="h-10 w-10 stroke-1 opacity-50 mb-1" />
                <p className="text-xs">Select a customer profile on the left to review their ledger card statements.</p>
              </div>
            ) : ledgerLoading ? (
              <div className="py-12 text-center text-xs text-muted-foreground">Compiling ledger balances...</div>
            ) : (
              <div className="space-y-4 mt-4">
                <div className="bg-secondary/40 border border-border rounded-md p-3 text-xs space-y-1">
                  <div className="font-extrabold text-foreground">{selectedCustomer.name}</div>
                  <div className="flex justify-between mt-1 text-[10px] text-muted-foreground">
                    <span>Credit Ceiling: {currencySymbol}{selectedCustomer.creditLimit.toFixed(2)}</span>
                    <span className="text-destructive font-bold">Owes: {currencySymbol}{selectedCustomer.balance.toFixed(2)}</span>
                  </div>
                  {selectedCustomer.balance > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        setReceiveAmount(selectedCustomer.balance);
                        setReceivePaymentOpen(true);
                        setReceiveError('');
                      }}
                      className="mt-2.5 w-full flex items-center justify-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[10px] font-bold transition-all shadow-xs cursor-pointer"
                    >
                      <CreditCard className="h-3.5 w-3.5" /> Receive Payment
                    </button>
                  )}
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
                          <span>Dr: {currencySymbol}{l.debit.toFixed(2)} | Cr: {currencySymbol}{l.credit.toFixed(2)}</span>
                          <span className="text-destructive">Bal: {currencySymbol}{l.balance.toFixed(2)}</span>
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

      {/* Add Customer Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="bg-card border border-border rounded-md p-6 w-full max-w-md space-y-4">
            <div>
              <h3 className="text-sm font-bold">Register Customer Profile</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Register customer accounts for split cashiers or wholesale credit tracking.
              </p>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                  Customer Name
                </label>
                <input
                  type="text"
                  placeholder="John Customer"
                  {...register("name")}
                  className={`w-full px-3 py-2 border rounded-lg text-xs bg-background focus:outline-none focus:ring-1 ${
                    errors.name ? "border-destructive focus:ring-destructive" : "border-border focus:ring-primary"
                  }`}
                />
                {errors.name && (
                  <span className="text-[10px] text-destructive font-semibold">{errors.name.message}</span>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                    Email Address
                  </label>
                  <input
                    type="email"
                    placeholder="john@customer.com"
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
                    placeholder="+1-555-0810"
                    {...register("phone")}
                    className="w-full px-3 py-2 border border-border rounded-lg text-xs bg-background focus:outline-none"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                  Physical Location
                </label>
                <input
                  type="text"
                  placeholder="777 Park Ave, New York, NY"
                  {...register("address")}
                  className="w-full px-3 py-2 border border-border rounded-lg text-xs bg-background focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                    Customer Pricing Class
                  </label>
                  <select
                    {...register("customerType")}
                    className="w-full px-3 py-2 border border-border rounded-lg text-xs bg-background focus:outline-none"
                  >
                    <option value="RETAIL">RETAIL CUSTOMER</option>
                    <option value="WHOLESALE">WHOLESALE CUSTOMER</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                    Credit Limit Ceiling ({currencySymbol})
                  </label>
                  <input
                    type="number"
                    placeholder="0"
                    {...register("creditLimit", { valueAsNumber: true })}
                    className="w-full px-3 py-2 border border-border rounded-lg text-xs bg-background focus:outline-none"
                  />
                </div>
              </div>

              {submitError && (
                <div className="text-xs text-destructive bg-destructive/10 border border-destructive/20 p-2.5 rounded-lg font-semibold leading-tight">
                  {submitError}
                </div>
              )}

              <div className="flex justify-end gap-2 border-t border-border pt-4">
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 border border-border text-xs rounded-lg hover:bg-secondary hover:text-secondary-foreground font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 bg-primary text-primary-foreground text-xs font-black rounded-lg hover:bg-primary/90 shadow-sm shadow-primary/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    "Create Profile"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {receivePaymentOpen && selectedCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="bg-card border border-border rounded-md p-6 w-full max-w-sm space-y-4 shadow-sm">
            <div>
              <h3 className="text-sm font-bold">Receive Customer Payment</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Collect outstanding credit dues from <strong>{selectedCustomer.name}</strong>.
              </p>
            </div>

            <div className="space-y-3">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                  Amount to Receive ({currencySymbol})
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={receiveAmount}
                  onChange={(e) => setReceiveAmount(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 border border-border rounded-lg text-xs bg-background focus:outline-none"
                  max={selectedCustomer.balance}
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                  Payment Method
                </label>
                <select
                  value={receiveMethod}
                  onChange={(e) => setReceiveMethod(e.target.value)}
                  className="w-full px-3 py-2 border border-border rounded-lg text-xs bg-background focus:outline-none"
                >
                  <option value="CASH">CASH</option>
                  <option value="CARD">CARD</option>
                  <option value="FONE_PAY">FONEPAY QR</option>
                  <option value="ESEWA">eSewa Wallet</option>
                  <option value="KHALTI">Khalti Wallet</option>
                  <option value="NEPAL_PAY">NepalPay QR</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                  Reference / Receipt No.
                </label>
                <input
                  type="text"
                  placeholder="e.g. TXN-8871"
                  value={receiveRef}
                  onChange={(e) => setReceiveRef(e.target.value)}
                  className="w-full px-3 py-2 border border-border rounded-lg text-xs bg-background focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                  Remarks / Notes
                </label>
                <input
                  type="text"
                  placeholder="e.g. Settled partial ledger credit"
                  value={receiveRemarks}
                  onChange={(e) => setReceiveRemarks(e.target.value)}
                  className="w-full px-3 py-2 border border-border rounded-lg text-xs bg-background focus:outline-none"
                />
              </div>

              {receiveError && (
                <div className="text-[10px] text-destructive bg-destructive/10 border border-destructive/20 p-2 rounded-lg font-semibold">
                  {receiveError}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 border-t border-border pt-4">
              <button
                type="button"
                onClick={() => setReceivePaymentOpen(false)}
                className="px-4 py-2 border border-border text-xs rounded-lg hover:bg-secondary font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isReceiving}
                onClick={handleReceivePaymentSubmit}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg shadow-sm disabled:opacity-50 flex items-center justify-center gap-1.5"
              >
                {isReceiving ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Recording...
                  </>
                ) : (
                  "Record Payment"
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
