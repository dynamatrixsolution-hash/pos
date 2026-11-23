import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getDefaultDashboardRoute } from "@/lib/rbac";

export default async function Page() {
  const session = await auth();

  if (!session?.user) {
    redirect("/auth/login");
  }

  const role = (session.user as any)?.role || "CASHIER";
  redirect(getDefaultDashboardRoute(role));
}
