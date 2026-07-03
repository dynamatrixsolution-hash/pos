"use client";

import * as React from "react";

interface SettingsContextType {
  currencySymbol: string;
  taxName: string;
  vatPercentage: number;
  pricingType: "INCLUSIVE" | "EXCLUSIVE";
  enableVat: boolean;
  businessName: string;
  loading: boolean;
  refreshSettings: () => Promise<void>;
}

const SettingsContext = React.createContext<SettingsContextType>({
  currencySymbol: "$",
  taxName: "VAT",
  vatPercentage: 13,
  pricingType: "EXCLUSIVE",
  enableVat: true,
  businessName: "",
  loading: true,
  refreshSettings: async () => {},
});

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [currencySymbol, setCurrencySymbol] = React.useState("$");
  const [taxName, setTaxName] = React.useState("VAT");
  const [vatPercentage, setVatPercentage] = React.useState(13);
  const [pricingType, setPricingType] = React.useState<"INCLUSIVE" | "EXCLUSIVE">("EXCLUSIVE");
  const [enableVat, setEnableVat] = React.useState(true);
  const [businessName, setBusinessName] = React.useState("");
  const [loading, setLoading] = React.useState(true);

  const fetchSettings = React.useCallback(async () => {
    try {
      const res = await fetch("/api/v1/settings");
      if (res.ok) {
        const data = await res.json();
        setBusinessName(data.name || "");
        if (data.taxConfig && typeof data.taxConfig === "object") {
          setTaxName(data.taxConfig.taxName || "VAT");
        }
        const meta = data.settings || {};
        setCurrencySymbol(meta.currencySymbol || "$");
        setEnableVat(meta.enableVat ?? true);
        setVatPercentage(meta.vatPercentage ?? (data.taxConfig?.rate || 13));
        setPricingType(meta.pricingType || "EXCLUSIVE");
      }
    } catch (error) {
      console.error("Error fetching settings in provider:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  return (
    <SettingsContext.Provider
      value={{
        currencySymbol,
        taxName,
        vatPercentage,
        pricingType,
        enableVat,
        businessName,
        loading,
        refreshSettings: fetchSettings,
      }}
    >
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  return React.useContext(SettingsContext);
}
