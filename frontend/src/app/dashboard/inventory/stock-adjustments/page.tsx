import StockAdjustmentsClient from "./stock-adjustments-client";

export default function StockAdjustmentsPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-card border border-border p-6 rounded-2xl">
        <div>
          <h1 className="text-xl font-bold">Stock Adjustments</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            View and manage manual stock adjustments, damage records, and quantity corrections.
          </p>
        </div>
      </div>

      <StockAdjustmentsClient />
    </div>
  );
}
