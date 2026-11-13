import { TransactionsReportContainer } from "@/features/reports/presentation/TransactionsReportContainer";

export const metadata = {
  title: "Transactions Ledger | Merosathi POS",
  description: "Complete chronological ledger of sales, purchases, expenses and payments",
};

export default function TransactionsReportPage() {
  return <TransactionsReportContainer />;
}
