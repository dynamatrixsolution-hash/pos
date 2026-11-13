import { RolesContainer } from "@/features/users/presentation/RolesContainer";

export const metadata = {
  title: "Roles & Access Control | Merosathi POS",
  description: "View RBAC permissions matrix, module authorization and role capabilities",
};

export default function RolesPage() {
  return <RolesContainer />;
}
