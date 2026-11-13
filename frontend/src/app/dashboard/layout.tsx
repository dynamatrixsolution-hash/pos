import { redirect } from "next/navigation";
import { auth } from "@/auth";
import DashboardShellClient from "@/components/dashboard-shell-client";
import { SettingsProvider } from "@/components/settings-provider";
import { cookies } from "next/headers";
import { apiClient } from "@/core/api/api-client";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session || !session.user) {
    redirect("/auth/login");
  }

  let branches: any[] = [];
  let initialNotifications: any[] = [];
  let subscription: any = null;
  let features: any = {};

  try {
    const cookieStore = await cookies();
    const cookieHeader = cookieStore.toString();

    const data = await apiClient.settings.getLayoutContext(cookieHeader);
    branches = data?.branches || [];
    initialNotifications = data?.initialNotifications || [];
    subscription = data?.subscription || null;
    features = data?.features || {};
  } catch (err) {
    console.error("Error connecting to backend layout context:", err);
  }

  return (
    <DashboardShellClient
      user={{
        name: session.user.name || "User",
        email: session.user.email || "",
        role: (session.user as any).role,
        branchId: (session.user as any).branchId,
      }}
      branches={branches}
      initialNotifications={initialNotifications}
      subscription={subscription}
      features={features}
    >
      <SettingsProvider>
        {children}
      </SettingsProvider>
    </DashboardShellClient>
  );
}
