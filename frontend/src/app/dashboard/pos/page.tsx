import { redirect } from "next/navigation";

export default function LegacyPosRedirectPage() {
  redirect("/dashboard/restaurant/pos?view=menu");
}
