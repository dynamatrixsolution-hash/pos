import { ActivityLogsContainer } from "@/features/users/presentation/ActivityLogsContainer";

export const metadata = {
  title: "Staff Activity Logs | Merosathi POS",
  description: "Monitor user actions, audit trails, login records and operational logs",
};

export default function ActivityLogsPage() {
  return <ActivityLogsContainer />;
}
