import { BranchesUserContainer } from "@/features/users/presentation/BranchesUserContainer";

export const metadata = {
  title: "Staff Branch Access | Merosathi POS",
  description: "Assign store cashiers and branch managers to designated locations",
};

export default function UsersBranchPage() {
  return <BranchesUserContainer />;
}
