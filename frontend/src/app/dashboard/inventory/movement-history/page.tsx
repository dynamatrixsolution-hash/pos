import MovementHistoryClient from "./movement-history-client";

export default function MovementHistoryPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-card border border-border p-6 rounded-2xl">
        <div>
          <h1 className="text-xl font-bold">Inventory Movement History</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Complete audit trail of all inventory transactions and adjustments.
          </p>
        </div>
      </div>

      <MovementHistoryClient />
    </div>
  );
}
