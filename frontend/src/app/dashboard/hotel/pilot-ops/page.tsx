import { PilotOpsContainer } from "@/features/hotel/presentation/PilotOpsContainer";

export const metadata = {
  title: "Pilot Operations Console | Merosathi POS",
  description: "Cross-department telemetry, feature rollout switches, printer rehearsal and night audit reconciliation",
};

export default function HotelPilotOpsPage() {
  return <PilotOpsContainer />;
}
