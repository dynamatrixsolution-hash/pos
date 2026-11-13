import { DailyReportContainer } from "@/features/reports/presentation/DailyReportContainer";

export const metadata = {
  title: "Daily Financial Report | Merosathi POS",
  description: "End of day register balances, turnover, sales and tender reconciliation",
};

export default function DailyReportPage() {
  return <DailyReportContainer />;
}
