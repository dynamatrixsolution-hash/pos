import CategoriesClient from "./categories-client";

export default function CategoriesPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border border-[#D8CEC1] bg-[#FFFCF7] p-5 rounded-lg">
        <div>
          <h1 className="text-xl font-bold text-[#292320]">Category &amp; Unit</h1>
          <p className="text-xs text-[#71675E] mt-0.5">
            Manage your product categories and measurement units.
          </p>
        </div>
      </div>

      <CategoriesClient />
    </div>
  );
}
