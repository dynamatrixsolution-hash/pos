import { AccountingReportContainer } from "@/features/reports/presentation/AccountingReportContainer";

export const metadata = {
  title: "Accounting & Profit & Loss | Merosathi POS",
  description: "Income statement, operating margins, cost of goods and balance sheet summary",
};

export default function AccountingReportPage() {
  return <AccountingReportContainer />;
}
