import { auth } from "@/auth";
import { redirect } from "next/navigation";

export default async function Page() {
  const session = await auth();

  if (!session?.user) {
    redirect("/auth/login");
  }

  const role = (session.user as any)?.role || "CASHIER";
  if (role === "CASHIER") {
    redirect("/dashboard/pos");
  } else {
    redirect("/dashboard");
  }
}
