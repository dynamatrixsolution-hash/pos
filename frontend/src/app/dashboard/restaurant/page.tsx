import { redirect } from "next/navigation";

export default function RestaurantPage() {
  redirect("/dashboard/restaurant/pos?view=tables");
}

