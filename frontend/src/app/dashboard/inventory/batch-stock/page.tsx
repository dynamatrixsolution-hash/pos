import BatchStockClient from "./batch-stock-client";

export default function BatchStockPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-card border border-border p-6 rounded-2xl">
        <div>
          <h1 className="text-xl font-bold">Batch-wise Stock</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Track product batches, expiry dates, and batch-specific quantities.
          </p>
        </div>
      </div>

      <BatchStockClient />
    </div>
  );
}
