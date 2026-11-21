"use client";

import React, { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { useSuperAdminBusinessesStore } from "../../state/super-admin-businesses.store";
import { BusinessHeader } from "./BusinessHeader";
import { BusinessTable } from "./BusinessTable";
import { BusinessModal } from "./BusinessModal";
import { BusinessInspectionDrawer } from "./BusinessInspectionDrawer";

export const BusinessesContainer: React.FC = () => {
  const searchParams = useSearchParams();
  const urlSearch = searchParams.get("search") || "";
  const setSearch = useSuperAdminBusinessesStore((s) => s.setSearch);
  const loadBusinesses = useSuperAdminBusinessesStore((s) => s.loadBusinesses);

  useEffect(() => {
    if (urlSearch) {
      setSearch(urlSearch);
    }
    loadBusinesses();
  }, [urlSearch, setSearch, loadBusinesses]);

  return (
    <div className="space-y-4 p-4 md:p-6 bg-[#F7F3EC] min-h-screen text-[#292320]">
      <BusinessHeader />
      <BusinessTable />
      <BusinessModal />
      <BusinessInspectionDrawer />
    </div>
  );
};

