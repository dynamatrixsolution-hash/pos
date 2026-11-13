import { InventoryReportContainer } from "@/features/reports/presentation/InventoryReportContainer";

export const metadata = {
  title: "Inventory & Stock Valuation Report | Merosathi POS",
  description: "Stock levels, valuation at cost basis, catalog metrics and reorder warnings",
};

export default function InventoryReportPage() {
  return <InventoryReportContainer />;
}
