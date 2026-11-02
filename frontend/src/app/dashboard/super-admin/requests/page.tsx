import { redirect } from "next/navigation";

export default function RequestsRedirectPage() {
  redirect("/dashboard/super-admin/businesses/pending");
}
