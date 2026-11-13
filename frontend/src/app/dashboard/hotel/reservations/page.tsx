import { ReservationsContainer } from "@/features/hotel/presentation/ReservationsContainer";

export const metadata = {
  title: "Hotel Reservations | Merosathi POS",
  description: "Manage hotel reservations, arrivals, deposits and bookings",
};

export default function HotelReservationsPage() {
  return <ReservationsContainer />;
}
