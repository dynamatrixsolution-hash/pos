import InventoryClient from "./inventory-client";

export default function InventoryPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-card border border-border p-6 rounded-2xl">
        <div>
          <h1 className="text-xl font-bold">Inventory Management</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Track stock levels, valuations, and manually adjust stock quantities.
          </p>
        </div>
      </div>

      <InventoryClient />
    </div>
  );
}
