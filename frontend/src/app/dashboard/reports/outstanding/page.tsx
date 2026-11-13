import { OutstandingReportContainer } from "@/features/reports/presentation/OutstandingReportContainer";

export const metadata = {
  title: "Outstanding & Aging Balances | Merosathi POS",
  description: "Accounts receivable from customers and accounts payable to vendors",
};

export default function OutstandingReportPage() {
  return <OutstandingReportContainer />;
}
