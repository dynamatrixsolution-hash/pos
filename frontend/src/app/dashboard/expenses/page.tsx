"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { useSettings } from "@/components/settings-provider";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Plus, Tag, Coins, FileText, Calendar, TrendingUp, TrendingDown } from "lucide-react";
import { useSession } from "next-auth/react";

interface ExpenseItem {
  id: string;
  amount: number;
  reference: string | null;
  description: string | null;
  createdAt: string;
  category: { name: string };
  branch: { name: string };
  user: { name: string };
}

interface CategoryItem {
  id: string;
  name: string;
}

interface BranchItem {
  id: string;
  name: string;
}

const expenseFormSchema = z.object({
  amount: z.number().positive("Amount must be greater than zero"),
  categoryId: z.string().uuid("Please select a valid category"),
  branchId: z.string().uuid("Please select a valid branch"),
  reference: z.string().optional(),
  description: z.string().optional(),
});

type ExpenseInputs = z.infer<typeof expenseFormSchema>;

export default function ExpensesPage() {
  const { data: session } = useSession();
  const { currencySymbol } = useSettings();
  const currentBranchId = session?.user ? (session.user as any).branchId : null;

  const [activeTab, setActiveTab] = React.useState<"expenses" | "income">("expenses");
  const [expenses, setExpenses] = React.useState<ExpenseItem[]>([]);
  const [income, setIncome] = React.useState<ExpenseItem[]>([]);
  const [categories, setCategories] = React.useState<CategoryItem[]>([]);
  const [incomeCategories, setIncomeCategories] = React.useState<CategoryItem[]>([]);
  const [branches, setBranches] = React.useState<BranchItem[]>([]);
  
  const [expenseSummary, setExpenseSummary] = React.useState({ total: 0, today: 0, thisMonth: 0 });
  const [incomeSummary, setIncomeSummary] = React.useState({ total: 0, today: 0, thisMonth: 0 });

  const [isLoading, setIsLoading] = React.useState(true);
  const [modalOpen, setModalOpen] = React.useState(false);
  const [catModalOpen, setCatModalOpen] = React.useState(false);
  const [newCatName, setNewCatName] = React.useState("");
  const [submitError, setSubmitError] = React.useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    reset,
    formState: { errors },
  } = useForm<ExpenseInputs>({
    resolver: zodResolver(expenseFormSchema),
  });

  const loadData = React.useCallback(async () => {
    try {
      setIsLoading(true);
      const [expRes, incRes, catRes, incCatRes, brRes] = await Promise.all([
        fetch("/api/v1/expenses?limit=50"),
        fetch("/api/v1/income?limit=50"),
        fetch("/api/v1/expenses/categories"),
        fetch("/api/v1/income/categories"),
        fetch("/api/v1/branches"),
      ]);
      
      if (expRes.ok) {
        const data = await expRes.json();
        setExpenses(data.expenses || []);
        setExpenseSummary(data.summary || { total: 0, today: 0, thisMonth: 0 });
      }
      if (incRes.ok) {
        const data = await incRes.json();
        setIncome(data.incomes || []);
        setIncomeSummary(data.summary || { total: 0, today: 0, thisMonth: 0 });
      }
      if (catRes.ok) {
        const data = await catRes.json();
        setCategories(data || []);
      }
      if (incCatRes.ok) {
        const data = await incCatRes.json();
        setIncomeCategories(data || []);
      }
      if (brRes.ok) {
        const data = await brRes.json();
        setBranches(data || []);
      }
    } catch (err) {
      console.error("Failed to load expenses/income data:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  React.useEffect(() => {
    loadData();
  }, [loadData]);

  // Pre-fill active branch when modal opens
  React.useEffect(() => {
    if (currentBranchId && modalOpen) {
      setValue("branchId", currentBranchId);
    }
  }, [currentBranchId, modalOpen, setValue]);

  const onSubmit = async (data: ExpenseInputs) => {
    setSubmitError(null);
    try {
      const endpoint = activeTab === "expenses" ? "/api/v1/expenses" : "/api/v1/income";
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        const json = await res.json();
        setSubmitError(json.error || `Failed to record ${activeTab === "expenses" ? "expense" : "income"}`);
        return;
      }

      setModalOpen(false);
      reset();
      loadData();
    } catch (err) {
      setSubmitError("Connection failure.");
    }
  };

  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCatName.trim()) return;
    
    try {
      const endpoint = activeTab === "expenses" ? "/api/v1/expenses/categories" : "/api/v1/income/categories";
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newCatName }),
      });

      if (res.ok) {
        setNewCatName("");
        setCatModalOpen(false);
        loadData();
      } else {
        alert("Failed to create category");
      }
    } catch (err) {
      alert("Error connecting to server");
    }
  };

  return (
    <div className="space-y-6">
      {/* Tabs Switcher */}
      <div className="flex space-x-2 border-b border-border/50 pb-2">
        <button
          onClick={() => {
            setActiveTab("expenses");
            reset();
          }}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
            activeTab === "expenses" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:bg-secondary"
          }`}
        >
          <TrendingDown className="h-4 w-4" />
          Expenses
        </button>
        <button
          onClick={() => {
            setActiveTab("income");
            reset();
          }}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
            activeTab === "income" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:bg-secondary"
          }`}
        >
          <TrendingUp className="h-4 w-4" />
          Income
        </button>
      </div>

      {/* Page Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-card border border-border p-5 rounded-2xl">
        <div>
          <h1 className="text-xl font-bold">
            {activeTab === "expenses" ? "Business Expenses Log" : "Business Income Log"}
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {activeTab === "expenses"
              ? "Log overhead costs, office supplies, utilities, and branch payouts."
              : "Track additional business income and other cash inflows."}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setCatModalOpen(true)}
            className="flex items-center gap-2 px-3 py-2 border border-border hover:bg-secondary rounded-xl text-xs font-semibold transition-colors"
          >
            <Tag className="h-4 w-4" />
            Add Category
          </button>
          <button
            onClick={() => {
              setModalOpen(true);
              setSubmitError(null);
            }}
            className="flex items-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground hover:bg-primary/95 rounded-xl text-xs font-black shadow-lg shadow-primary/20 transition-all uppercase tracking-wider"
          >
            <Plus className="h-4.5 w-4.5" />
            {activeTab === "expenses" ? "Record Expense" : "Record Income"}
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {activeTab === "expenses" ? (
          <>
            <div className="bg-card border border-border/80 rounded-2xl p-5 shadow-sm space-y-1 hover:shadow-md transition-shadow">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Total Expenses</span>
              <div className="text-2xl font-black text-destructive">
                -{currencySymbol}{expenseSummary.total.toFixed(2)}
              </div>
            </div>
            <div className="bg-card border border-border/80 rounded-2xl p-5 shadow-sm space-y-1 hover:shadow-md transition-shadow">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Today's Expenses</span>
              <div className="text-2xl font-black text-destructive">
                -{currencySymbol}{expenseSummary.today.toFixed(2)}
              </div>
            </div>
            <div className="bg-card border border-border/80 rounded-2xl p-5 shadow-sm space-y-1 hover:shadow-md transition-shadow">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">This Month's Expenses</span>
              <div className="text-2xl font-black text-destructive">
                -{currencySymbol}{expenseSummary.thisMonth.toFixed(2)}
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="bg-card border border-border/80 rounded-2xl p-5 shadow-sm space-y-1 hover:shadow-md transition-shadow">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Total Income</span>
              <div className="text-2xl font-black text-emerald-600 dark:text-emerald-500">
                +{currencySymbol}{incomeSummary.total.toFixed(2)}
              </div>
            </div>
            <div className="bg-card border border-border/80 rounded-2xl p-5 shadow-sm space-y-1 hover:shadow-md transition-shadow">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Today's Income</span>
              <div className="text-2xl font-black text-emerald-600 dark:text-emerald-500">
                +{currencySymbol}{incomeSummary.today.toFixed(2)}
              </div>
            </div>
            <div className="bg-card border border-border/80 rounded-2xl p-5 shadow-sm space-y-1 hover:shadow-md transition-shadow">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">This Month's Income</span>
              <div className="text-2xl font-black text-emerald-600 dark:text-emerald-500">
                +{currencySymbol}{incomeSummary.thisMonth.toFixed(2)}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Main List */}
      <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
        <h2 className="text-sm font-bold flex items-center gap-2 pb-1.5 border-b border-border/60">
          <Coins className="h-4.5 w-4.5 text-primary" />
          {activeTab === "expenses" ? "Outward Cash Flows" : "Incoming Cash Flows"}
        </h2>

        {isLoading ? (
          <div className="py-12 text-center text-xs text-muted-foreground">
            {activeTab === "expenses" ? "Loading expenses catalog..." : "Loading income catalog..."}
          </div>
        ) : (activeTab === "expenses" ? expenses : income).length === 0 ? (
          <div className="py-12 text-center text-xs text-muted-foreground">
            {activeTab === "expenses" ? "No expenses recorded yet." : "No income recorded yet."}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left border-collapse">
              <thead>
                <tr className="border-b border-border text-muted-foreground font-semibold uppercase tracking-wider text-[10px]">
                  <th className="py-3 px-2">{activeTab === "expenses" ? "Expense Date" : "Income Date"}</th>
                  <th className="py-3 px-2">Category</th>
                  <th className="py-3 px-2">Branch</th>
                  <th className="py-3 px-2">Voucher / Ref</th>
                  <th className="py-3 px-2">Description</th>
                  <th className="py-3 px-2 text-right">
                    {activeTab === "expenses" ? "Amount Paid" : "Amount Received"}
                  </th>
                  <th className="py-3 px-2">Recorded By</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {(activeTab === "expenses" ? expenses : income).map((e) => (
                  <tr key={e.id} className="hover:bg-secondary/10">
                    <td className="py-3 px-2 text-muted-foreground">
                      {new Date(e.createdAt).toLocaleDateString()}
                    </td>
                    <td className="py-3 px-2 font-bold text-foreground">
                      {e.category.name}
                    </td>
                    <td className="py-3 px-2">
                      <span className="bg-secondary px-2 py-0.5 rounded text-[10px]">
                        {e.branch.name}
                      </span>
                    </td>
                    <td className="py-3 px-2 font-semibold text-primary">{e.reference || "None"}</td>
                    <td className="py-3 px-2 text-muted-foreground max-w-xs truncate">{e.description || "None"}</td>
                    <td className={`py-3 px-2 text-right font-black ${
                      activeTab === "expenses" ? "text-destructive" : "text-emerald-600 dark:text-emerald-500"
                    }`}>
                      {activeTab === "expenses" ? "-" : "+"}{currencySymbol}{e.amount.toFixed(2)}
                    </td>
                    <td className="py-3 px-2 text-muted-foreground">{e.user.name}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Record Expense/Income Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="bg-card border border-border rounded-xl p-6 w-full max-w-md space-y-4">
            <div>
              <h3 className="text-sm font-bold">
                {activeTab === "expenses" ? "Record Cash Outflow Voucher" : "Record Cash Inflow Voucher"}
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                {activeTab === "expenses"
                  ? "Register a cash expenditure voucher against branch funds."
                  : "Register a cash income voucher against branch funds."}
              </p>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                    {activeTab === "expenses" ? "Expense Amount" : "Income Amount"} ({currencySymbol})
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    {...register("amount", { valueAsNumber: true })}
                    className={`w-full px-3 py-2 border rounded-lg text-xs bg-background focus:outline-none focus:ring-1 ${
                      errors.amount ? "border-destructive focus:ring-destructive" : "border-border focus:ring-primary"
                    }`}
                  />
                  {errors.amount && (
                    <span className="text-[10px] text-destructive font-semibold">{errors.amount.message}</span>
                  )}
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                    Category
                  </label>
                  <select
                    {...register("categoryId")}
                    className={`w-full px-3 py-2 border rounded-lg text-xs bg-background focus:outline-none focus:ring-1 ${
                      errors.categoryId ? "border-destructive focus:ring-destructive" : "border-border focus:ring-primary"
                    }`}
                  >
                    <option value="">Select Category</option>
                    {(activeTab === "expenses" ? categories : incomeCategories).map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                  {errors.categoryId && (
                    <span className="text-[10px] text-destructive font-semibold">{errors.categoryId.message}</span>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                    Branch Context
                  </label>
                  <select
                    {...register("branchId")}
                    className={`w-full px-3 py-2 border rounded-lg text-xs bg-background focus:outline-none focus:ring-1 ${
                      errors.branchId ? "border-destructive focus:ring-destructive" : "border-border focus:ring-primary"
                    }`}
                  >
                    <option value="">Select Branch</option>
                    {branches.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                  {errors.branchId && (
                    <span className="text-[10px] text-destructive font-semibold">{errors.branchId.message}</span>
                  )}
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                    Voucher / Reference
                  </label>
                  <input
                    type="text"
                    placeholder="VOU-0012"
                    {...register("reference")}
                    className="w-full px-3 py-2 border border-border rounded-lg text-xs bg-background focus:outline-none"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                  Description
                </label>
                <textarea
                  placeholder={
                    activeTab === "expenses"
                      ? "Purchased lightbulbs for storefront..."
                      : "Received service fee from client..."
                  }
                  {...register("description")}
                  className="w-full px-3 py-2 border border-border rounded-lg text-xs bg-background focus:outline-none h-16 resize-none"
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
                  Record Voucher
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Category Modal */}
      {catModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="bg-card border border-border rounded-xl p-5 w-full max-w-sm space-y-4">
            <div>
              <h3 className="text-sm font-bold">
                {activeTab === "expenses" ? "Add Expense Category" : "Add Income Category"}
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                {activeTab === "expenses"
                  ? "Register a new general categorization label for overheads."
                  : "Register a new general categorization label for income."}
              </p>
            </div>
            <form onSubmit={handleAddCategory} className="space-y-4">
              <input
                type="text"
                placeholder={activeTab === "expenses" ? "e.g. Marketing / Rent" : "e.g. Service Income / Commission"}
                value={newCatName}
                onChange={(e) => setNewCatName(e.target.value)}
                className="w-full px-3 py-2 border border-border rounded-lg bg-background text-xs focus:outline-none"
                required
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setCatModalOpen(false)}
                  className="px-4 py-2 border border-border text-xs rounded-lg hover:bg-secondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!newCatName.trim()}
                  className="px-4 py-2 bg-primary text-primary-foreground text-xs font-bold rounded-lg hover:bg-primary/90 disabled:opacity-50"
                >
                  Save Category
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
