import { SettingsContainer } from "@/features/settings/presentation/SettingsContainer";

export const metadata = {
  title: "Settings & Store Configuration | Merosathi POS",
  description: "Configure store profile, taxation, thermal receipts, logos and QR payments",
};

export default function SettingsPage() {
  return <SettingsContainer />;
}
