import CurrentStockClient from "./current-stock-client";

export default function CurrentStockPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-card border border-border p-6 rounded-2xl">
        <div>
          <h1 className="text-xl font-bold">Current Stock Levels</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Real-time view of stock quantities across all accessible branches.
          </p>
        </div>
      </div>

      <CurrentStockClient />
    </div>
  );
}
