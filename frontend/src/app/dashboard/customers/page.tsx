import { Suspense } from "react";
import { CustomersContainer } from "@/features/crm/presentation/customers/CustomersContainer";

export default function CustomersPage() {
  return (
    <Suspense
      fallback={
        <div className="p-6 space-y-4">
          <div className="h-8 w-64 animate-pulse rounded bg-[#EEE7DD]" />
          <div className="h-64 w-full animate-pulse rounded-lg bg-[#EEE7DD]" />
        </div>
      }
    >
      <CustomersContainer />
    </Suspense>
  );
}
