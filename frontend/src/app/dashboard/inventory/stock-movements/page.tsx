import StockMovementsClient from "./stock-movements-client";

export default function StockMovementsPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-card border border-border p-6 rounded-2xl">
        <div>
          <h1 className="text-xl font-bold">Stock In / Out Movements</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Track all incoming purchases and outgoing sales with details.
          </p>
        </div>
      </div>

      <StockMovementsClient />
    </div>
  );
}
