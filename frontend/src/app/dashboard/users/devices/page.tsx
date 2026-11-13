import { DevicesContainer } from "@/features/users/presentation/DevicesContainer";

export const metadata = {
  title: "Authorized Devices & Stations | Merosathi POS",
  description: "Monitor authenticated mobile terminals, kitchen tablets and cashier workstations",
};

export default function DevicesPage() {
  return <DevicesContainer />;
}
