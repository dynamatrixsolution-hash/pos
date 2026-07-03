import CategoriesClient from "./categories-client";

export default function CategoriesPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 glass-card bg-gradient-to-br from-primary/10 via-transparent to-transparent p-6 rounded-3xl">
        <div>
          <h1 className="text-2xl font-black">Category & Unit</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Manage your product categories and measurement units.
          </p>
        </div>
      </div>

      <CategoriesClient />
    </div>
  );
}
