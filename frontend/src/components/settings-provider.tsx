"use client";

import * as React from "react";

interface SettingsContextType {
  currencySymbol: string;
  taxName: string;
  vatPercentage: number;
  pricingType: "INCLUSIVE" | "EXCLUSIVE";
  enableVat: boolean;
  businessName: string;
  businessType: string;
  phone: string;
  address: string;
  panNumber: string;
  vatNumber: string;
  receiptHeader: string;
  receiptFooter: string;
  receiptTitle: string;
  receiptWidth: string;
  autoPrint: boolean;
  invoiceLogo: string;
  receiptLogo: string;
  fonepayQr: string;
  paymentQrImage: string;
  paymentQrMedium: string;
  paymentUpiId: string;
  paymentAccountName: string;
  showTaxBreakup: boolean;
  showQrCode: boolean;
  loading: boolean;
  refreshSettings: () => Promise<void>;
}

const SettingsContext = React.createContext<SettingsContextType>({
  currencySymbol: "Rs. ",
  taxName: "VAT",
  vatPercentage: 13,
  pricingType: "EXCLUSIVE",
  enableVat: true,
  businessName: "",
  businessType: "RETAIL",
  phone: "",
  address: "",
  panNumber: "",
  vatNumber: "",
  receiptHeader: "",
  receiptFooter: "",
  receiptTitle: "POS GST INVOICE",
  receiptWidth: "80mm",
  autoPrint: false,
  invoiceLogo: "",
  receiptLogo: "",
  fonepayQr: "",
  paymentQrImage: "",
  paymentQrMedium: "Fonepay",
  paymentUpiId: "",
  paymentAccountName: "",
  showTaxBreakup: true,
  showQrCode: true,
  loading: true,
  refreshSettings: async () => {},
});

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [currencySymbol, setCurrencySymbol] = React.useState("Rs. ");
  const [taxName, setTaxName] = React.useState("VAT");
  const [vatPercentage, setVatPercentage] = React.useState(13);
  const [pricingType, setPricingType] = React.useState<"INCLUSIVE" | "EXCLUSIVE">("EXCLUSIVE");
  const [enableVat, setEnableVat] = React.useState(true);
  const [businessName, setBusinessName] = React.useState("");
  const [businessType, setBusinessType] = React.useState("RETAIL");
  const [phone, setPhone] = React.useState("");
  const [address, setAddress] = React.useState("");
  const [panNumber, setPanNumber] = React.useState("");
  const [vatNumber, setVatNumber] = React.useState("");
  const [receiptHeader, setReceiptHeader] = React.useState("");
  const [receiptFooter, setReceiptFooter] = React.useState("");
  const [receiptTitle, setReceiptTitle] = React.useState("POS GST INVOICE");
  const [receiptWidth, setReceiptWidth] = React.useState("80mm");
  const [autoPrint, setAutoPrint] = React.useState(false);
  const [invoiceLogo, setInvoiceLogo] = React.useState("");
  const [receiptLogo, setReceiptLogo] = React.useState("");
  const [fonepayQr, setFonepayQr] = React.useState("");
  const [paymentQrImage, setPaymentQrImage] = React.useState("");
  const [paymentQrMedium, setPaymentQrMedium] = React.useState("Fonepay");
  const [paymentUpiId, setPaymentUpiId] = React.useState("");
  const [paymentAccountName, setPaymentAccountName] = React.useState("");
  const [showTaxBreakup, setShowTaxBreakup] = React.useState(true);
  const [showQrCode, setShowQrCode] = React.useState(true);
  const [loading, setLoading] = React.useState(true);

  const fetchSettings = React.useCallback(async () => {
    try {
      const res = await fetch("/api/v1/settings");
      if (res.ok) {
        const data = await res.json();
        setBusinessName(data.name || "");
        setPhone(data.phone || "");
        setAddress(data.address || "");
        if (data.taxConfig && typeof data.taxConfig === "object") {
          setTaxName(data.taxConfig.taxName || "VAT");
        }
        const meta = data.settings || {};
        setCurrencySymbol(meta.currencySymbol || "Rs. ");
        setBusinessType(meta.businessType || "RETAIL");
        setPanNumber(meta.panNumber || "");
        setVatNumber(meta.vatNumber || "");
        setEnableVat(meta.enableVat ?? true);
        setVatPercentage(meta.vatPercentage ?? (data.taxConfig?.rate || 13));
        setPricingType(meta.pricingType || "EXCLUSIVE");
        setReceiptHeader(meta.receiptHeader || "");
        setReceiptFooter(meta.receiptFooter || "");
        setReceiptTitle(meta.receiptTitle || "POS GST INVOICE");
        setReceiptWidth(meta.receiptWidth || "80mm");
        setAutoPrint(meta.autoPrint ?? false);
        setInvoiceLogo(meta.invoiceLogo || "");
        setReceiptLogo(meta.receiptLogo || "");
        setFonepayQr(meta.fonepayQr || meta.paymentQrImage || "");
        setPaymentQrImage(meta.paymentQrImage || meta.fonepayQr || "");
        setPaymentQrMedium(meta.paymentQrMedium || "Fonepay");
        setPaymentUpiId(meta.paymentUpiId || "");
        setPaymentAccountName(meta.paymentAccountName || data.name || "");
        setShowTaxBreakup(meta.showTaxBreakup ?? true);
        setShowQrCode(meta.showQrCode ?? true);
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
        businessType,
        phone,
        address,
        panNumber,
        vatNumber,
        receiptHeader,
        receiptFooter,
        receiptTitle,
        receiptWidth,
        autoPrint,
        invoiceLogo,
        receiptLogo,
        fonepayQr,
        paymentQrImage,
        paymentQrMedium,
        paymentUpiId,
        paymentAccountName,
        showTaxBreakup,
        showQrCode,
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
