import StockValueClient from "./stock-value-client";

export default function StockValuePage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-card border border-border p-6 rounded-2xl">
        <div>
          <h1 className="text-xl font-bold">Stock Value Report</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Analyze inventory value, profit margins, and valuation by category and branch.
          </p>
        </div>
      </div>

      <StockValueClient />
    </div>
  );
}
