"use client";

import * as React from "react";
import { useSession } from "next-auth/react";
import { useSettings } from "@/components/settings-provider";
import {
  Settings as SettingsIcon,
  Store,
  Phone,
  Mail,
  MapPin,
  DollarSign,
  Percent,
  CheckCircle,
  AlertTriangle,
  Lock,
  Globe,
  FileText,
  User,
  Printer,
  Barcode,
  Database,
  History,
  Info,
  Calendar,
  Upload,
  Trash2,
  CreditCard,
} from "lucide-react";

interface AuditLogItem {
  id: string;
  action: string;
  module: string;
  details: string | null;
  createdAt: string;
  user?: {
    name: string;
    email: string;
    role: string;
  } | null;
}

export default function SettingsPage() {
  const { data: session } = useSession();
  const { refreshSettings } = useSettings();
  const userRole = (session?.user as any)?.role || "CASHIER";
  const isAuthorized = userRole === "OWNER" || userRole === "SUPER_ADMIN" || userRole === "MANAGER";

  // Tabs state
  const [activeTab, setActiveTab] = React.useState("overview");

  // Form states
  const [name, setName] = React.useState("");
  const [phone, setPhone] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [address, setAddress] = React.useState("");
  const [currency, setCurrency] = React.useState("USD");
  const [taxName, setTaxName] = React.useState("VAT");
  const [taxRate, setTaxRate] = React.useState<number>(10);
  const [slug, setSlug] = React.useState("");
  const [branches, setBranches] = React.useState<any[]>([]);

  // Metadata settings
  const [businessType, setBusinessType] = React.useState("");
  const [ownerName, setOwnerName] = React.useState("");
  const [registrationNumber, setRegistrationNumber] = React.useState("");
  const [website, setWebsite] = React.useState("");
  const [invoiceLogo, setInvoiceLogo] = React.useState("");
  const [receiptLogo, setReceiptLogo] = React.useState("");
  const [panNumber, setPanNumber] = React.useState("");
  const [vatNumber, setVatNumber] = React.useState("");
  const [taxRegDetails, setTaxRegDetails] = React.useState("");
  const [taxStatus, setTaxStatus] = React.useState("REGISTERED");
  const [currencySymbol, setCurrencySymbol] = React.useState("$");
  const [decimalPrecision, setDecimalPrecision] = React.useState<number>(2);
  const [fiscalYearStart, setFiscalYearStart] = React.useState("");
  const [fiscalYearEnd, setFiscalYearEnd] = React.useState("");
  const [nepaliFiscalYear, setNepaliFiscalYear] = React.useState(false);
  const [datePreference, setDatePreference] = React.useState("AD");
  const [invoicePrefix, setInvoicePrefix] = React.useState("INV-");
  const [purchasePrefix, setPurchasePrefix] = React.useState("PUR-");
  const [salesPrefix, setSalesPrefix] = React.useState("SAL-");
  const [returnPrefix, setReturnPrefix] = React.useState("RET-");
  const [autoNumberGen, setAutoNumberGen] = React.useState(true);
  const [enableVat, setEnableVat] = React.useState(true);
  const [vatPercentage, setVatPercentage] = React.useState<number>(13);
  const [pricingType, setPricingType] = React.useState<"INCLUSIVE" | "EXCLUSIVE">("EXCLUSIVE");
  const [taxSlabsText, setTaxSlabsText] = React.useState("5, 13, 18");
  const [defaultWalkIn, setDefaultWalkIn] = React.useState(true);
  const [defaultPaymentMethod, setDefaultPaymentMethod] = React.useState("CASH");
  const [defaultCreditLimit, setDefaultCreditLimit] = React.useState<number>(0);
  const [defaultDiscount, setDefaultDiscount] = React.useState<number>(0);
  const [printerType, setPrinterType] = React.useState("THERMAL");
  const [receiptWidth, setReceiptWidth] = React.useState("80mm");
  const [autoPrint, setAutoPrint] = React.useState(false);
  const [barcodeFormat, setBarcodeFormat] = React.useState("CODE128");
  const [barcodeLength, setBarcodeLength] = React.useState<number>(12);
  const [barcodePrefix, setBarcodePrefix] = React.useState("");
  const [autoBarcodeGen, setAutoBarcodeGen] = React.useState(true);

  // Stats, Logs and Subscription
  const [auditLogs, setAuditLogs] = React.useState<AuditLogItem[]>([]);
  const [subscription, setSubscription] = React.useState<any>(null);
  const [subMetrics, setSubMetrics] = React.useState<any>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [errorMsg, setErrorMsg] = React.useState("");
  const [successMsg, setSuccessMsg] = React.useState("");
  const [restoreSuccess, setRestoreSuccess] = React.useState("");
  const [restoreError, setRestoreError] = React.useState("");

  // AD/BS Converter Preview state
  const [convertAdDate, setConvertAdDate] = React.useState("");
  const [convertedBsDate, setConvertedBsDate] = React.useState("");

  // Load Settings
  const loadSettings = React.useCallback(async () => {
    try {
      setIsLoading(true);
      const [res, logsRes, branchesRes, subRes] = await Promise.all([
        fetch("/api/v1/settings"),
        fetch("/api/v1/settings/audit-logs"),
        fetch("/api/v1/branches"),
        fetch("/api/v1/subscriptions"),
      ]);

      if (res.ok) {
        const data = await res.json();
        setName(data.name || "");
        setPhone(data.phone || "");
        setEmail(data.email || "");
        setAddress(data.address || "");
        setCurrency(data.currency || "USD");
        setSlug(data.slug || "");
        
        if (data.taxConfig && typeof data.taxConfig === "object") {
          setTaxName((data.taxConfig as any).taxName || "VAT");
          setTaxRate((data.taxConfig as any).rate ?? 10);
        }

        // Load settings metadata
        const meta = data.settings || {};
        setBusinessType(meta.businessType || "");
        setOwnerName(meta.ownerName || "");
        setRegistrationNumber(meta.registrationNumber || "");
        setWebsite(meta.website || "");
        setInvoiceLogo(meta.invoiceLogo || "");
        setReceiptLogo(meta.receiptLogo || "");
        setPanNumber(meta.panNumber || "");
        setVatNumber(meta.vatNumber || "");
        setTaxRegDetails(meta.taxRegDetails || "");
        setTaxStatus(meta.taxStatus || "REGISTERED");
        setCurrencySymbol(meta.currencySymbol || "$");
        setDecimalPrecision(meta.decimalPrecision ?? 2);
        setFiscalYearStart(meta.fiscalYearStart || "");
        setFiscalYearEnd(meta.fiscalYearEnd || "");
        setNepaliFiscalYear(meta.nepaliFiscalYear ?? false);
        setDatePreference(meta.datePreference || "AD");
        setInvoicePrefix(meta.invoicePrefix || "INV-");
        setPurchasePrefix(meta.purchasePrefix || "PUR-");
        setSalesPrefix(meta.salesPrefix || "SAL-");
        setReturnPrefix(meta.returnPrefix || "RET-");
        setAutoNumberGen(meta.autoNumberGen ?? true);
        setEnableVat(meta.enableVat ?? true);
        setVatPercentage(meta.vatPercentage ?? 13);
        setPricingType(meta.pricingType || "EXCLUSIVE");
        if (Array.isArray(meta.taxSlabs)) {
          setTaxSlabsText(meta.taxSlabs.join(", "));
        }
        setDefaultWalkIn(meta.defaultWalkIn ?? true);
        setDefaultPaymentMethod(meta.defaultPaymentMethod || "CASH");
        setDefaultCreditLimit(meta.defaultCreditLimit ?? 0);
        setDefaultDiscount(meta.defaultDiscount ?? 0);
        setPrinterType(meta.printerType || "THERMAL");
        setReceiptWidth(meta.receiptWidth || "80mm");
        setAutoPrint(meta.autoPrint ?? false);
        setBarcodeFormat(meta.barcodeFormat || "CODE128");
        setBarcodeLength(meta.barcodeLength ?? 12);
        setBarcodePrefix(meta.barcodePrefix || "");
        setAutoBarcodeGen(meta.autoBarcodeGen ?? true);
      } else {
        setErrorMsg("Failed to load business configurations");
      }

      if (logsRes.ok) {
        const data = await logsRes.json();
        setAuditLogs(data || []);
      }
      if (branchesRes.ok) {
        const data = await branchesRes.json();
        setBranches(data || []);
      }
      if (subRes.ok) {
        const data = await subRes.json();
        setSubscription(data.subscription || null);
        setSubMetrics(data.metrics || null);
      }
    } catch (err) {
      console.error(err);
      setErrorMsg("Network error loading settings");
    } finally {
      setIsLoading(false);
    }
  }, []);

  React.useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  // Handle AD to BS Demo Conversion
  React.useEffect(() => {
    if (convertAdDate) {
      const parts = convertAdDate.split("-");
      if (parts.length === 3) {
        const yearAd = parseInt(parts[0], 10);
        const yearBs = yearAd + 57;
        const monthBs = (parseInt(parts[1], 10) + 8) % 12 || 12;
        const dayBs = (parseInt(parts[2], 10) + 15) % 30 || 1;
        setConvertedBsDate(`${yearBs}-${String(monthBs).padStart(2, "0")}-${String(dayBs).padStart(2, "0")} BS`);
      }
    } else {
      setConvertedBsDate("");
    }
  }, [convertAdDate]);

  // Save Settings
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAuthorized) return;

    setErrorMsg("");
    setSuccessMsg("");
    setIsSubmitting(true);

    // Parse slabs text into array of numbers
    const taxSlabs = taxSlabsText
      .split(",")
      .map((s) => parseFloat(s.trim()))
      .filter((n) => !isNaN(n));

    try {
      const res = await fetch("/api/v1/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          phone: phone || null,
          email: email || null,
          address: address || null,
          currency,
          taxName,
          taxRate: Number(taxRate),
          businessType,
          ownerName,
          registrationNumber,
          website,
          invoiceLogo,
          receiptLogo,
          panNumber,
          vatNumber,
          taxRegDetails,
          taxStatus,
          currencySymbol,
          decimalPrecision: Number(decimalPrecision),
          fiscalYearStart,
          fiscalYearEnd,
          nepaliFiscalYear,
          datePreference,
          invoicePrefix,
          purchasePrefix,
          salesPrefix,
          returnPrefix,
          autoNumberGen,
          enableVat,
          vatPercentage: Number(vatPercentage),
          pricingType,
          taxSlabs,
          defaultWalkIn,
          defaultPaymentMethod,
          defaultCreditLimit: Number(defaultCreditLimit),
          defaultDiscount: Number(defaultDiscount),
          printerType,
          receiptWidth,
          autoPrint,
          barcodeFormat,
          barcodeLength: Number(barcodeLength),
          barcodePrefix,
          autoBarcodeGen,
        }),
      });

      if (res.ok) {
        setSuccessMsg("System configurations updated successfully!");
        setTimeout(() => setSuccessMsg(""), 4000);
        loadSettings();
        refreshSettings();
      } else {
        const err = await res.json();
        setErrorMsg(err.error || "Failed to update configurations");
      }
    } catch (err) {
      console.error(err);
      setErrorMsg("Network error updating configurations");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Logo base64 upload helpers
  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>, type: "invoice" | "receipt") => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      if (type === "invoice") setInvoiceLogo(base64String);
      else setReceiptLogo(base64String);
    };
    reader.readAsDataURL(file);
  };

  // Trigger Backup File Download
  const handleBackupDownload = async () => {
    try {
      window.open("/api/v1/settings/backup", "_blank");
    } catch (err) {
      alert("Failed to download backup");
    }
  };

  // Handle Restore Backup File Upload
  const handleRestoreUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setRestoreError("");
    setRestoreSuccess("");

    if (!confirm("Restoring a backup file will overwrite all active business records. Are you sure you want to proceed?")) {
      e.target.value = "";
      return;
    }

    try {
      const fileText = await file.text();
      const backupJson = JSON.parse(fileText);

      const res = await fetch("/api/v1/settings/backup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(backupJson),
      });

      const data = await res.json();
      if (res.ok) {
        setRestoreSuccess("Database backup restored successfully!");
        loadSettings();
      } else {
        setRestoreError(data.error || "Failed to restore database backup.");
      }
    } catch (err) {
      setRestoreError("Failed to parse the backup file. Verify it is a valid JSON export.");
    } finally {
      e.target.value = "";
    }
  };

  if (isLoading) {
    return (
      <div className="h-96 flex items-center justify-center">
        <div className="text-center space-y-2">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto" />
          <p className="text-xs text-muted-foreground">Loading configurations...</p>
        </div>
      </div>
    );
  }

  const currencyList = [
    { code: "USD", symbol: "$" },
    { code: "EUR", symbol: "€" },
    { code: "GBP", symbol: "£" },
    { code: "INR", symbol: "₹" },
    { code: "NPR", symbol: "₨" },
    { code: "AUD", symbol: "A$" },
    { code: "CAD", symbol: "C$" },
  ];

  const tabs = [
    { id: "overview", label: "Settings Overview", icon: Info },
    { id: "profile", label: "Business Profile", icon: Store },
    { id: "logos", label: "Logo & Contact", icon: Globe },
    { id: "taxation", label: "PAN / VAT Details", icon: Percent },
    { id: "currency", label: "Currency & Dates", icon: Calendar },
    { id: "pos", label: "Invoices & Billing", icon: FileText },
    { id: "subscription", label: "Subscription Plan", icon: CreditCard },
    { id: "backup", label: "Backup & Logs", icon: Database },
  ];

  return (
    <div className="space-y-6">
      {/* 1. Header Banner */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-card border border-border p-5 rounded-2xl">
        <div>
          <h1 className="text-2xl font-black">System Preferences</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Configure invoice parameters, printers, barcodes, taxes, and localization defaults.
          </p>
        </div>
      </div>

      {/* Access Restriction Notice */}
      {!isAuthorized && (
        <div className="bg-amber-500/10 border border-amber-500/20 text-amber-500 text-xs p-4 rounded-xl flex items-start gap-2.5">
          <Lock className="h-4.5 w-4.5 mt-0.5 flex-shrink-0" />
          <div>
            <span className="font-bold">Read-Only Mode:</span>
            <span className="ml-1">
              Your cashier account role ({userRole}) does not have permission to modify system configuration. Only Admin or Owner profiles can apply modifications.
            </span>
          </div>
        </div>
      )}

      {/* Save Alerts */}
      {errorMsg && (
        <div className="bg-destructive/10 border border-destructive/20 text-destructive text-xs p-4 rounded-xl flex items-start gap-2.5">
          <AlertTriangle className="h-4.5 w-4.5 flex-shrink-0 mt-0.5" />
          <span>{errorMsg}</span>
        </div>
      )}
      {successMsg && (
        <div className="bg-primary/10 border border-primary/20 text-primary text-xs p-4 rounded-xl flex items-start gap-2.5">
          <CheckCircle className="h-4.5 w-4.5 flex-shrink-0 mt-0.5" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Main Configurations Tabs Split Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Left Side: Sidebar Tabs Navigation */}
        <div className="space-y-1 bg-card border border-border rounded-2xl p-3 h-fit">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold transition-all ${
                  activeTab === tab.id
                    ? "bg-primary text-primary-foreground shadow-lg shadow-primary/10"
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                }`}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Right Side: Tab Panel Form Content */}
        <div className="lg:col-span-3 bg-card border border-border rounded-2xl p-6 shadow-sm">
          <form onSubmit={handleSaveSettings} className="space-y-6">
            
            {/* T1. OVERVIEW */}
            {activeTab === "overview" && (
              <div className="space-y-5">
                <h3 className="text-sm font-black border-b border-border/50 pb-2 uppercase tracking-wider text-primary">
                  Settings Overview
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Summary Business Profile Card */}
                  <div className="border border-border/60 rounded-xl p-4 space-y-2.5 bg-secondary/10">
                    <h4 className="text-xs font-bold flex items-center gap-1.5 text-foreground">
                      <Store className="h-4 w-4 text-blue-500" /> Business Profile Summary
                    </h4>
                    <ul className="text-xs space-y-1.5 text-muted-foreground pt-1.5 border-t border-border/40">
                      <li><strong className="text-foreground">Business Name:</strong> {name || "Not Set"}</li>
                      <li><strong className="text-foreground">Owner Name:</strong> {ownerName || "Not Set"}</li>
                      <li><strong className="text-foreground">Domain Slug:</strong> {slug}</li>
                      <li><strong className="text-foreground">Branches:</strong> {branches.length} Location(s)</li>
                    </ul>
                  </div>

                  {/* Summary Tax settings Card */}
                  <div className="border border-border/60 rounded-xl p-4 space-y-2.5 bg-secondary/10">
                    <h4 className="text-xs font-bold flex items-center gap-1.5 text-foreground">
                      <Percent className="h-4 w-4 text-emerald-500" /> Taxation & Currency Config
                    </h4>
                    <ul className="text-xs space-y-1.5 text-muted-foreground pt-1.5 border-t border-border/40">
                      <li><strong className="text-foreground">PAN Number:</strong> {panNumber || "Not Set"}</li>
                      <li><strong className="text-foreground">VAT Number:</strong> {vatNumber || "Not Set"}</li>
                      <li><strong className="text-foreground">Tax Scheme:</strong> {taxName} ({taxRate}%)</li>
                      <li><strong className="text-foreground">Currency Code:</strong> {currency} ({currencySymbol})</li>
                    </ul>
                  </div>

                  {/* Summary Invoice settings Card */}
                  <div className="border border-border/60 rounded-xl p-4 space-y-2.5 bg-secondary/10">
                    <h4 className="text-xs font-bold flex items-center gap-1.5 text-foreground">
                      <FileText className="h-4 w-4 text-purple-500" /> POS Invoice & Prefixes
                    </h4>
                    <ul className="text-xs space-y-1.5 text-muted-foreground pt-1.5 border-t border-border/40">
                      <li><strong className="text-foreground">Sales Prefix:</strong> {salesPrefix}</li>
                      <li><strong className="text-foreground">Purchase Prefix:</strong> {purchasePrefix}</li>
                      <li><strong className="text-foreground">Auto Sequential Numbers:</strong> {autoNumberGen ? "Enabled" : "Disabled"}</li>
                      <li><strong className="text-foreground">Default Payment:</strong> {defaultPaymentMethod}</li>
                    </ul>
                  </div>

                  {/* Summary Printer settings Card */}
                  <div className="border border-border/60 rounded-xl p-4 space-y-2.5 bg-secondary/10">
                    <h4 className="text-xs font-bold flex items-center gap-1.5 text-foreground">
                      <Printer className="h-4 w-4 text-orange-500" /> Printer Configuration
                    </h4>
                    <ul className="text-xs space-y-1.5 text-muted-foreground pt-1.5 border-t border-border/40">
                      <li><strong className="text-foreground">Receipt Type:</strong> {printerType}</li>
                      <li><strong className="text-foreground">Receipt Width:</strong> {receiptWidth}</li>
                      <li><strong className="text-foreground">Auto Print on Checkout:</strong> {autoPrint ? "Yes" : "No"}</li>
                    </ul>
                  </div>
                </div>

                 <div className="border border-border/60 rounded-xl p-4 space-y-3 mt-4">
                  <h4 className="text-xs font-bold text-foreground">Quick Setup Actions</h4>
                  <div className="flex flex-wrap gap-2">
                    <button type="button" onClick={() => setActiveTab("profile")} className="px-3 py-1.5 bg-secondary hover:bg-border text-xs rounded-lg font-bold">Edit Profile</button>
                    <button type="button" onClick={() => setActiveTab("taxation")} className="px-3 py-1.5 bg-secondary hover:bg-border text-xs rounded-lg font-bold">Manage VAT</button>
                    <button type="button" onClick={() => setActiveTab("pos")} className="px-3 py-1.5 bg-secondary hover:bg-border text-xs rounded-lg font-bold">Configure Invoices</button>
                    <button type="button" onClick={() => setActiveTab("subscription")} className="px-3 py-1.5 bg-secondary hover:bg-border text-xs rounded-lg font-bold">Subscription Plan</button>
                    <button type="button" onClick={() => setActiveTab("backup")} className="px-3 py-1.5 bg-secondary hover:bg-border text-xs rounded-lg font-bold">Download Backup</button>
                  </div>
                </div>
              </div>
            )}

            {/* T2. BUSINESS PROFILE */}
            {activeTab === "profile" && (
              <div className="space-y-4">
                <h3 className="text-sm font-black border-b border-border/50 pb-2 uppercase tracking-wider text-primary">
                  Business Profile Details
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="block text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Business / Store Name *</label>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      disabled={!isAuthorized || isSubmitting}
                      className="w-full bg-background border border-border px-3 py-2 rounded-xl text-xs text-foreground font-semibold outline-none focus:ring-1 focus:ring-primary"
                      required
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Business Type</label>
                    <input
                      type="text"
                      placeholder="e.g. Supermarket, Retail POS, Restaurant"
                      value={businessType}
                      onChange={(e) => setBusinessType(e.target.value)}
                      disabled={!isAuthorized || isSubmitting}
                      className="w-full bg-background border border-border px-3 py-2 rounded-xl text-xs text-foreground font-semibold outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Owner Name</label>
                    <input
                      type="text"
                      placeholder="e.g. John Doe"
                      value={ownerName}
                      onChange={(e) => setOwnerName(e.target.value)}
                      disabled={!isAuthorized || isSubmitting}
                      className="w-full bg-background border border-border px-3 py-2 rounded-xl text-xs text-foreground font-semibold outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Registration Number</label>
                    <input
                      type="text"
                      placeholder="e.g. Reg-78190B"
                      value={registrationNumber}
                      onChange={(e) => setRegistrationNumber(e.target.value)}
                      disabled={!isAuthorized || isSubmitting}
                      className="w-full bg-background border border-border px-3 py-2 rounded-xl text-xs text-foreground font-semibold outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Website URL</label>
                    <input
                      type="url"
                      placeholder="e.g. https://mystore.com"
                      value={website}
                      onChange={(e) => setWebsite(e.target.value)}
                      disabled={!isAuthorized || isSubmitting}
                      className="w-full bg-background border border-border px-3 py-2 rounded-xl text-xs text-foreground font-semibold outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Address Details</label>
                    <input
                      type="text"
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      disabled={!isAuthorized || isSubmitting}
                      className="w-full bg-background border border-border px-3 py-2 rounded-xl text-xs text-foreground font-semibold outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>
                </div>

                <div className="border border-border/60 rounded-xl p-4 space-y-2.5 mt-3">
                  <h4 className="text-xs font-bold text-foreground">Registered Outlets / Branches</h4>
                  <div className="space-y-1.5 max-h-40 overflow-y-auto">
                    {branches.map((b) => (
                      <div key={b.id} className="flex justify-between items-center text-xs p-2 bg-secondary/30 rounded border border-border/40">
                        <span className="font-semibold">{b.name}</span>
                        <span className="text-[10px] font-bold bg-primary/10 text-primary px-1.5 py-0.5 rounded uppercase">
                          {b.isMain ? "Main Headquarter" : "Branch Location"}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* T3. LOGO & CONTACT */}
            {activeTab === "logos" && (
              <div className="space-y-4">
                <h3 className="text-sm font-black border-b border-border/50 pb-2 uppercase tracking-wider text-primary">
                  Logo & Contact Settings
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Invoice logo card */}
                  <div className="border border-border rounded-xl p-4 space-y-3">
                    <h4 className="text-xs font-bold">Invoice Header Logo</h4>
                    {invoiceLogo ? (
                      <div className="relative border border-dashed border-border/80 rounded-lg p-2.5 h-36 flex items-center justify-center bg-secondary/10">
                        <img src={invoiceLogo} alt="Invoice Logo Preview" className="max-h-full max-w-full object-contain" />
                        <button
                          type="button"
                          onClick={() => setInvoiceLogo("")}
                          className="absolute top-2 right-2 p-1.5 bg-destructive text-destructive-foreground hover:bg-destructive/90 rounded-full transition-colors"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    ) : (
                      <div className="border border-dashed border-border/80 rounded-lg p-6 h-36 flex flex-col items-center justify-center text-center text-muted-foreground bg-secondary/5">
                        <Upload className="h-8 w-8 stroke-1 mb-2" />
                        <span className="text-[10px] font-bold uppercase">Click below to upload</span>
                      </div>
                    )}
                    <div className="space-y-2">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => handleLogoUpload(e, "invoice")}
                        className="hidden"
                        id="invoice-logo-uploader"
                      />
                      <label
                        htmlFor="invoice-logo-uploader"
                        className="flex items-center justify-center gap-1.5 py-2 px-3 bg-secondary hover:bg-border rounded-lg text-xs font-bold cursor-pointer transition-colors"
                      >
                        <Upload className="h-4 w-4" />
                        Choose Invoice Logo file
                      </label>
                      <input
                        type="text"
                        placeholder="Or paste invoice logo image URL..."
                        value={invoiceLogo}
                        onChange={(e) => setInvoiceLogo(e.target.value)}
                        className="w-full bg-background border border-border px-2.5 py-1.5 rounded-lg text-[10px] outline-none"
                      />
                    </div>
                  </div>

                  {/* Receipt logo card */}
                  <div className="border border-border rounded-xl p-4 space-y-3">
                    <h4 className="text-xs font-bold">Receipt Header Logo</h4>
                    {receiptLogo ? (
                      <div className="relative border border-dashed border-border/80 rounded-lg p-2.5 h-36 flex items-center justify-center bg-secondary/10">
                        <img src={receiptLogo} alt="Receipt Logo Preview" className="max-h-full max-w-full object-contain" />
                        <button
                          type="button"
                          onClick={() => setReceiptLogo("")}
                          className="absolute top-2 right-2 p-1.5 bg-destructive text-destructive-foreground hover:bg-destructive/90 rounded-full transition-colors"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    ) : (
                      <div className="border border-dashed border-border/80 rounded-lg p-6 h-36 flex flex-col items-center justify-center text-center text-muted-foreground bg-secondary/5">
                        <Upload className="h-8 w-8 stroke-1 mb-2" />
                        <span className="text-[10px] font-bold uppercase">Click below to upload</span>
                      </div>
                    )}
                    <div className="space-y-2">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => handleLogoUpload(e, "receipt")}
                        className="hidden"
                        id="receipt-logo-uploader"
                      />
                      <label
                        htmlFor="receipt-logo-uploader"
                        className="flex items-center justify-center gap-1.5 py-2 px-3 bg-secondary hover:bg-border rounded-lg text-xs font-bold cursor-pointer transition-colors"
                      >
                        <Upload className="h-4 w-4" />
                        Choose Receipt Logo file
                      </label>
                      <input
                        type="text"
                        placeholder="Or paste receipt logo image URL..."
                        value={receiptLogo}
                        onChange={(e) => setReceiptLogo(e.target.value)}
                        className="w-full bg-background border border-border px-2.5 py-1.5 rounded-lg text-[10px] outline-none"
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                  <div className="space-y-1.5">
                    <label className="block text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Business Phone Contact</label>
                    <input
                      type="text"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      disabled={!isAuthorized || isSubmitting}
                      className="w-full bg-background border border-border px-3 py-2 rounded-xl text-xs text-foreground font-semibold outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Business Contact Email</label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      disabled={!isAuthorized || isSubmitting}
                      className="w-full bg-background border border-border px-3 py-2 rounded-xl text-xs text-foreground font-semibold outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* T4. PAN / VAT DETAILS */}
            {activeTab === "taxation" && (
              <div className="space-y-4">
                <h3 className="text-sm font-black border-b border-border/50 pb-2 uppercase tracking-wider text-primary">
                  PAN / VAT & Taxation details
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="block text-[10px] uppercase font-bold text-muted-foreground tracking-wider">PAN Registration Number</label>
                    <input
                      type="text"
                      placeholder="e.g. PAN-981290382"
                      value={panNumber}
                      onChange={(e) => setPanNumber(e.target.value)}
                      disabled={!isAuthorized || isSubmitting}
                      className="w-full bg-background border border-border px-3 py-2 rounded-xl text-xs text-foreground font-semibold outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-[10px] uppercase font-bold text-muted-foreground tracking-wider">VAT Registration Number</label>
                    <input
                      type="text"
                      placeholder="e.g. VAT-100239129"
                      value={vatNumber}
                      onChange={(e) => setVatNumber(e.target.value)}
                      disabled={!isAuthorized || isSubmitting}
                      className="w-full bg-background border border-border px-3 py-2 rounded-xl text-xs text-foreground font-semibold outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Tax Registration Status</label>
                    <select
                      value={taxStatus}
                      onChange={(e) => setTaxStatus(e.target.value)}
                      disabled={!isAuthorized || isSubmitting}
                      className="w-full bg-background border border-border px-3 py-2 rounded-xl text-xs text-foreground font-bold outline-none focus:ring-1 focus:ring-primary"
                    >
                      <option value="REGISTERED">REGISTERED (ACTIVE)</option>
                      <option value="NON_REGISTERED">UNREGISTERED / EXEMPT</option>
                      <option value="SUSPENDED">SUSPENDED</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Tax Label Name *</label>
                    <input
                      type="text"
                      value={taxName}
                      onChange={(e) => setTaxName(e.target.value)}
                      disabled={!isAuthorized || isSubmitting}
                      className="w-full bg-background border border-border px-3 py-2 rounded-xl text-xs text-foreground font-semibold outline-none focus:ring-1 focus:ring-primary"
                      required
                    />
                  </div>
                </div>

                <div className="border border-border/60 rounded-xl p-4 space-y-4 mt-3 bg-secondary/10">
                  <h4 className="text-xs font-bold text-foreground">VAT & Pricing Scheme Config</h4>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="flex items-center justify-between p-2.5 bg-background border border-border/60 rounded-lg">
                      <div className="flex flex-col">
                        <span className="text-xs font-bold text-foreground">Enable Global VAT</span>
                        <span className="text-[10px] text-muted-foreground">Calculate VAT tax on checkout sales automatically</span>
                      </div>
                      <input
                        type="checkbox"
                        checked={enableVat}
                        onChange={(e) => setEnableVat(e.target.checked)}
                        disabled={!isAuthorized || isSubmitting}
                        className="h-4 w-4 text-primary focus:ring-primary rounded"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="block text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Default VAT Rate (%)</label>
                      <input
                        type="number"
                        step="0.01"
                        value={vatPercentage}
                        onChange={(e) => {
                          setVatPercentage(parseFloat(e.target.value) || 0);
                          setTaxRate(parseFloat(e.target.value) || 0);
                        }}
                        disabled={!isAuthorized || isSubmitting}
                        className="w-full bg-background border border-border px-3 py-2 rounded-xl text-xs text-foreground font-semibold outline-none focus:ring-1 focus:ring-primary"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="block text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Pricing Type (VAT calculation style)</label>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => setPricingType("INCLUSIVE")}
                          className={`py-2 px-1 text-[10px] font-bold rounded-lg border transition-all ${
                            pricingType === "INCLUSIVE"
                              ? "bg-primary text-primary-foreground border-primary"
                              : "border-border hover:bg-secondary bg-background"
                          }`}
                        >
                          TAX INCLUSIVE
                        </button>
                        <button
                          type="button"
                          onClick={() => setPricingType("EXCLUSIVE")}
                          className={`py-2 px-1 text-[10px] font-bold rounded-lg border transition-all ${
                            pricingType === "EXCLUSIVE"
                              ? "bg-primary text-primary-foreground border-primary"
                              : "border-border hover:bg-secondary bg-background"
                          }`}
                        >
                          TAX EXCLUSIVE
                        </button>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="block text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Multiple Tax Slabs (Comma-separated percent values)</label>
                      <input
                        type="text"
                        placeholder="5, 13, 18"
                        value={taxSlabsText}
                        onChange={(e) => setTaxSlabsText(e.target.value)}
                        disabled={!isAuthorized || isSubmitting}
                        className="w-full bg-background border border-border px-3 py-2 rounded-xl text-xs text-foreground font-semibold outline-none focus:ring-1 focus:ring-primary"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* T5. CURRENCY & DATES */}
            {activeTab === "currency" && (
              <div className="space-y-4">
                <h3 className="text-sm font-black border-b border-border/50 pb-2 uppercase tracking-wider text-primary">
                  Currency & Date configuration
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="block text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Base Currency Selection</label>
                    <select
                      value={currency}
                      onChange={(e) => {
                        const code = e.target.value;
                        setCurrency(code);
                        const found = currencyList.find((c) => c.code === code);
                        if (found) {
                          setCurrencySymbol(found.symbol);
                        }
                      }}
                      disabled={!isAuthorized || isSubmitting}
                      className="w-full bg-background border border-border px-3 py-2 rounded-xl text-xs text-foreground font-bold outline-none focus:ring-1 focus:ring-primary"
                    >
                      {currencyList.map((cur) => (
                        <option key={cur.code} value={cur.code}>
                          {cur.code} ({cur.symbol})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Currency Symbol</label>
                    <input
                      type="text"
                      placeholder="$ / Rs / €"
                      value={currencySymbol}
                      onChange={(e) => setCurrencySymbol(e.target.value)}
                      disabled={!isAuthorized || isSubmitting}
                      className="w-full bg-background border border-border px-3 py-2 rounded-xl text-xs text-foreground font-semibold outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Decimal Precision (Decimal places)</label>
                    <select
                      value={decimalPrecision}
                      onChange={(e) => setDecimalPrecision(parseInt(e.target.value) || 2)}
                      disabled={!isAuthorized || isSubmitting}
                      className="w-full bg-background border border-border px-3 py-2 rounded-xl text-xs text-foreground font-bold outline-none"
                    >
                      <option value="0">0 places (e.g. Rs 500)</option>
                      <option value="2">2 places (e.g. $5.25)</option>
                      <option value="3">3 places (e.g. $5.255)</option>
                      <option value="4">4 places (e.g. $5.2555)</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Global Date Preference</label>
                    <select
                      value={datePreference}
                      onChange={(e) => setDatePreference(e.target.value)}
                      disabled={!isAuthorized || isSubmitting}
                      className="w-full bg-background border border-border px-3 py-2 rounded-xl text-xs text-foreground font-bold outline-none"
                    >
                      <option value="AD">English Calendar (AD)</option>
                      <option value="BS">Nepali Calendar (BS)</option>
                    </select>
                  </div>
                </div>

                <div className="border border-border/60 rounded-xl p-4 space-y-3 mt-3 bg-secondary/10">
                  <h4 className="text-xs font-bold text-foreground">Fiscal Year Setup</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="block text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Fiscal Year Start Date</label>
                      <input
                        type="date"
                        value={fiscalYearStart}
                        onChange={(e) => setFiscalYearStart(e.target.value)}
                        disabled={!isAuthorized || isSubmitting}
                        className="w-full bg-background border border-border px-3 py-2 rounded-xl text-xs text-foreground font-semibold outline-none focus:ring-1 focus:ring-primary"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="block text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Fiscal Year End Date</label>
                      <input
                        type="date"
                        value={fiscalYearEnd}
                        onChange={(e) => setFiscalYearEnd(e.target.value)}
                        disabled={!isAuthorized || isSubmitting}
                        className="w-full bg-background border border-border px-3 py-2 rounded-xl text-xs text-foreground font-semibold outline-none focus:ring-1 focus:ring-primary"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-2.5 bg-background border border-border/60 rounded-lg mt-2">
                    <div className="flex flex-col">
                      <span className="text-xs font-bold text-foreground">Nepali Fiscal Year Support (Shrawan - Ashadh)</span>
                      <span className="text-[10px] text-muted-foreground">Align reports to standard Nepal Government fiscal year schedule</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={nepaliFiscalYear}
                      onChange={(e) => setNepaliFiscalYear(e.target.checked)}
                      disabled={!isAuthorized || isSubmitting}
                      className="h-4 w-4 text-primary focus:ring-primary rounded"
                    />
                  </div>
                </div>

                {/* AD to BS date converter utility preview */}
                <div className="border border-border/60 rounded-xl p-4 space-y-3 bg-secondary/10">
                  <h4 className="text-xs font-bold text-foreground flex items-center gap-1.5">
                    <Calendar className="h-4 w-4 text-primary" /> AD / BS Date Conversion Utility
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="block text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Input AD Date (English)</label>
                      <input
                        type="date"
                        value={convertAdDate}
                        onChange={(e) => setConvertAdDate(e.target.value)}
                        className="w-full bg-background border border-border px-3 py-2 rounded-xl text-xs text-foreground font-semibold outline-none"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="block text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Output BS Date (Nepali conversion)</label>
                      <input
                        type="text"
                        readOnly
                        placeholder="Conversion result..."
                        value={convertedBsDate}
                        className="w-full bg-secondary border border-border px-3 py-2 rounded-xl text-xs text-foreground font-semibold outline-none cursor-default"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* T6. INVOICES & BILLING */}
            {activeTab === "pos" && (
              <div className="space-y-4">
                <h3 className="text-sm font-black border-b border-border/50 pb-2 uppercase tracking-wider text-primary">
                  Invoice Prefixes & Default POS Settings
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="block text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Sales Billing Invoice Prefix</label>
                    <input
                      type="text"
                      placeholder="e.g. SAL-"
                      value={salesPrefix}
                      onChange={(e) => setSalesPrefix(e.target.value)}
                      disabled={!isAuthorized || isSubmitting}
                      className="w-full bg-background border border-border px-3 py-2 rounded-xl text-xs text-foreground font-semibold outline-none"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Purchase Order Prefix</label>
                    <input
                      type="text"
                      placeholder="e.g. PUR-"
                      value={purchasePrefix}
                      onChange={(e) => setPurchasePrefix(e.target.value)}
                      disabled={!isAuthorized || isSubmitting}
                      className="w-full bg-background border border-border px-3 py-2 rounded-xl text-xs text-foreground font-semibold outline-none"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Sales Return Prefix</label>
                    <input
                      type="text"
                      placeholder="e.g. RET-"
                      value={returnPrefix}
                      onChange={(e) => setReturnPrefix(e.target.value)}
                      disabled={!isAuthorized || isSubmitting}
                      className="w-full bg-background border border-border px-3 py-2 rounded-xl text-xs text-foreground font-semibold outline-none"
                    />
                  </div>

                  <div className="flex items-center justify-between p-2.5 bg-secondary/20 border border-border/60 rounded-xl">
                    <div className="flex flex-col">
                      <span className="text-xs font-bold text-foreground">Sequential Automatic Numbers</span>
                      <span className="text-[10px] text-muted-foreground">Generate sequential codes (e.g. SAL-00001)</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={autoNumberGen}
                      onChange={(e) => setAutoNumberGen(e.target.checked)}
                      disabled={!isAuthorized || isSubmitting}
                      className="h-4 w-4 text-primary focus:ring-primary rounded"
                    />
                  </div>
                </div>

                <div className="border border-border/60 rounded-xl p-4 space-y-4 bg-secondary/10">
                  <h4 className="text-xs font-bold text-foreground flex items-center gap-1.5">
                    <Printer className="h-4 w-4 text-primary" /> POS Billing Printer configuration
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="block text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Receipt Style</label>
                      <select
                        value={printerType}
                        onChange={(e) => setPrinterType(e.target.value)}
                        disabled={!isAuthorized || isSubmitting}
                        className="w-full bg-background border border-border px-3 py-2 rounded-xl text-xs text-foreground font-bold outline-none"
                      >
                        <option value="THERMAL">80mm / 58mm Thermal Receipt</option>
                        <option value="A4">A4 Full Sheet Invoice</option>
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="block text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Receipt Width Selection</label>
                      <select
                        value={receiptWidth}
                        onChange={(e) => setReceiptWidth(e.target.value)}
                        disabled={!isAuthorized || isSubmitting}
                        className="w-full bg-background border border-border px-3 py-2 rounded-xl text-xs text-foreground font-bold outline-none"
                      >
                        <option value="80mm">80mm Standard Width</option>
                        <option value="58mm">58mm Compact Width</option>
                      </select>
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-2.5 bg-background border border-border/60 rounded-lg">
                    <div className="flex flex-col">
                      <span className="text-xs font-bold text-foreground">Auto Print Receipt After Billing Checkout</span>
                      <span className="text-[10px] text-muted-foreground">Trigger print automatically when billing completes</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={autoPrint}
                      onChange={(e) => setAutoPrint(e.target.checked)}
                      disabled={!isAuthorized || isSubmitting}
                      className="h-4 w-4 text-primary focus:ring-primary rounded"
                    />
                  </div>
                </div>

                <div className="border border-border/60 rounded-xl p-4 space-y-4 bg-secondary/10">
                  <h4 className="text-xs font-bold text-foreground flex items-center gap-1.5">
                    <Barcode className="h-4 w-4 text-primary" /> Barcode & Label Generation Settings
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="block text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Barcode Format</label>
                      <select
                        value={barcodeFormat}
                        onChange={(e) => setBarcodeFormat(e.target.value)}
                        disabled={!isAuthorized || isSubmitting}
                        className="w-full bg-background border border-border px-3 py-2 rounded-xl text-xs text-foreground font-bold outline-none"
                      >
                        <option value="CODE128">CODE 128 (Variable length AlphaNumeric)</option>
                        <option value="EAN13">EAN 13 (Standard European 13-digit)</option>
                        <option value="UPCA">UPC A (Standard US 12-digit)</option>
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="block text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Barcode Length Limit</label>
                      <input
                        type="number"
                        value={barcodeLength}
                        onChange={(e) => setBarcodeLength(parseInt(e.target.value) || 12)}
                        disabled={!isAuthorized || isSubmitting}
                        className="w-full bg-background border border-border px-3 py-2 rounded-xl text-xs text-foreground font-semibold outline-none"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="block text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Barcode Prefix String</label>
                      <input
                        type="text"
                        placeholder="e.g. BAR-"
                        value={barcodePrefix}
                        onChange={(e) => setBarcodePrefix(e.target.value)}
                        disabled={!isAuthorized || isSubmitting}
                        className="w-full bg-background border border-border px-3 py-2 rounded-xl text-xs text-foreground font-semibold outline-none"
                      />
                    </div>

                    <div className="flex items-center justify-between p-2.5 bg-background border border-border/60 rounded-lg">
                      <div className="flex flex-col">
                        <span className="text-xs font-bold text-foreground">Auto Generate Barcode</span>
                        <span className="text-[10px] text-muted-foreground">Assign unique barcode code automatically to new products</span>
                      </div>
                      <input
                        type="checkbox"
                        checked={autoBarcodeGen}
                        onChange={(e) => setAutoBarcodeGen(e.target.checked)}
                        disabled={!isAuthorized || isSubmitting}
                        className="h-4 w-4 text-primary focus:ring-primary rounded"
                      />
                    </div>
                  </div>
                </div>

                <div className="border border-border/60 rounded-xl p-4 space-y-4 bg-secondary/10">
                  <h4 className="text-xs font-bold text-foreground flex items-center gap-1.5">
                    <User className="h-4 w-4 text-primary" /> Default POS customer & payment modes
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="flex items-center justify-between p-2.5 bg-background border border-border/60 rounded-lg">
                      <div className="flex flex-col">
                        <span className="text-xs font-bold text-foreground">Default Walk-in Customers Allowed</span>
                        <span className="text-[10px] text-muted-foreground">Accept cash sales without forcing customer registration</span>
                      </div>
                      <input
                        type="checkbox"
                        checked={defaultWalkIn}
                        onChange={(e) => setDefaultWalkIn(e.target.checked)}
                        disabled={!isAuthorized || isSubmitting}
                        className="h-4 w-4 text-primary focus:ring-primary rounded"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="block text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Default Payment Method</label>
                      <select
                        value={defaultPaymentMethod}
                        onChange={(e) => setDefaultPaymentMethod(e.target.value)}
                        disabled={!isAuthorized || isSubmitting}
                        className="w-full bg-background border border-border px-3 py-2 rounded-xl text-xs text-foreground font-bold outline-none"
                      >
                        <option value="CASH">CASH Payment</option>
                        <option value="CARD">CARD Swipe Terminal</option>
                        <option value="QR">QR Digital Wallet Code</option>
                        <option value="BANK_TRANSFER">Bank Direct Wire</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* T7. BACKUP & LOGS */}
            {activeTab === "backup" && (
              <div className="space-y-4">
                <h3 className="text-sm font-black border-b border-border/50 pb-2 uppercase tracking-wider text-primary">
                  Database Backups & Audit activity Trail
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Backup Card */}
                  <div className="border border-border/60 rounded-xl p-4 space-y-3.5 bg-secondary/15">
                    <div className="flex items-center gap-2">
                      <Database className="h-5 w-5 text-primary" />
                      <h4 className="text-xs font-bold">Manual Backup export</h4>
                    </div>
                    <p className="text-[11px] text-muted-foreground leading-relaxed">
                      Download a complete snapshot of categories, products, inventory stock counts, customer records, invoices, and payment histories for offline archiving.
                    </p>
                    <button
                      type="button"
                      onClick={handleBackupDownload}
                      className="w-full py-2 px-3 bg-primary text-primary-foreground font-black text-xs rounded-xl shadow-lg shadow-primary/20 hover:bg-primary/95 transition-all uppercase tracking-wider text-center"
                    >
                      Export Database Backup file (.json)
                    </button>
                  </div>

                  {/* Restore Card */}
                  <div className="border border-border/60 rounded-xl p-4 space-y-3.5 bg-secondary/15">
                    <div className="flex items-center gap-2">
                      <History className="h-5 w-5 text-primary" />
                      <h4 className="text-xs font-bold">Restore Snapshot Database</h4>
                    </div>
                    <p className="text-[11px] text-muted-foreground leading-relaxed">
                      Select a previously downloaded JSON file to restore settings, inventory catalog, customers, and sales transactions records completely.
                    </p>
                    <div>
                      <input
                        type="file"
                        accept=".json"
                        onChange={handleRestoreUpload}
                        className="hidden"
                        id="restore-database-input"
                      />
                      <label
                        htmlFor="restore-database-input"
                        className="flex items-center justify-center gap-1.5 w-full py-2 px-3 border border-border bg-background hover:bg-secondary rounded-xl text-xs font-bold cursor-pointer transition-colors uppercase tracking-wider"
                      >
                        <Upload className="h-4 w-4" />
                        Choose restore file (.json)
                      </label>
                    </div>
                    {restoreSuccess && (
                      <div className="text-[10px] text-primary font-bold bg-primary/10 border border-primary/20 p-2 rounded-lg leading-tight">
                        {restoreSuccess}
                      </div>
                    )}
                    {restoreError && (
                      <div className="text-[10px] text-destructive font-bold bg-destructive/10 border border-destructive/20 p-2 rounded-lg leading-tight">
                        {restoreError}
                      </div>
                    )}
                  </div>
                </div>

                {/* Audit trail activity log */}
                <div className="border border-border/60 rounded-xl p-4 space-y-3">
                  <h4 className="text-xs font-bold text-foreground">User Activity logs & Audit Trail</h4>
                  {auditLogs.length === 0 ? (
                    <div className="py-6 text-center text-xs text-muted-foreground">No recent activity logs found.</div>
                  ) : (
                    <div className="overflow-x-auto max-h-64">
                      <table className="w-full text-[10px] text-left border-collapse">
                        <thead>
                          <tr className="border-b border-border/60 text-muted-foreground font-semibold uppercase tracking-wider">
                            <th className="py-2 px-1">Timestamp</th>
                            <th className="py-2 px-1">User</th>
                            <th className="py-2 px-1">Action</th>
                            <th className="py-2 px-1">Module</th>
                            <th className="py-2 px-1">Details</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border/40">
                          {auditLogs.map((log) => (
                            <tr key={log.id} className="hover:bg-secondary/20">
                              <td className="py-2 px-1 text-muted-foreground whitespace-nowrap">
                                {new Date(log.createdAt).toLocaleString()}
                              </td>
                              <td className="py-2 px-1 font-semibold whitespace-nowrap">
                                {log.user?.name || "System"} ({log.user?.role || "SYSTEM"})
                              </td>
                              <td className="py-2 px-1">
                                <span className={`px-1.5 py-0.5 rounded font-bold uppercase ${
                                  log.action === "CREATE" ? "bg-emerald-500/10 text-emerald-600" :
                                  log.action === "UPDATE" ? "bg-blue-500/10 text-blue-600" :
                                  log.action === "DELETE" ? "bg-red-500/10 text-red-600" : "bg-secondary text-foreground"
                                }`}>
                                  {log.action}
                                </span>
                              </td>
                              <td className="py-2 px-1 font-medium">{log.module}</td>
                              <td className="py-2 px-1 text-muted-foreground max-w-xs truncate">{log.details}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* T8. SUBSCRIPTION PLAN */}
            {activeTab === "subscription" && (
              <div className="space-y-6">
                <h3 className="text-sm font-black border-b border-border/50 pb-2 uppercase tracking-wider text-primary">
                  Subscription Status & Plan Details
                </h3>

                {subscription ? (
                  <div className="space-y-6">
                    {/* Main subscription card */}
                    <div className="border border-border/60 rounded-2xl p-6 relative overflow-hidden bg-gradient-to-br from-[#2563EB]/5 to-transparent">
                      <div className="absolute top-0 right-0 h-32 w-32 bg-[#2563EB]/5 rounded-full -mr-16 -mt-16 blur-xl" />
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
                        <div className="space-y-1">
                          <span className="text-[9px] font-black bg-primary/10 text-primary px-2.5 py-1 rounded-full uppercase tracking-wider">
                            Active Subscription
                          </span>
                          <h4 className="text-xl font-black mt-2 text-foreground">
                            {subscription.plan} Plan
                          </h4>
                          <p className="text-xs text-muted-foreground">
                            Registered business billing tier context.
                          </p>
                        </div>
                        
                        <div className="flex flex-col items-start md:items-end gap-1.5">
                          <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Plan Expiry Date</span>
                          <span className="text-sm font-black text-foreground">
                            {new Date(subscription.endDate).toLocaleDateString(undefined, {
                              year: "numeric",
                              month: "long",
                              day: "numeric",
                            })}
                          </span>
                          <span className="text-[10px] text-muted-foreground">
                            Started: {new Date(subscription.startDate).toLocaleDateString()}
                          </span>
                        </div>
                      </div>

                      {/* Live countdown details */}
                      <div className="mt-6 pt-5 border-t border-border/50 grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="p-4 rounded-xl border border-border bg-secondary/10 flex items-center gap-3">
                          <Calendar className="h-5 w-5 text-primary shrink-0" />
                          <div>
                            <div className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Billing Cycle Status</div>
                            <div className="text-xs font-bold text-foreground">
                              {subscription.status === "ACTIVE" ? "Auto-renew or Active" : "Cancelled/Suspended"}
                            </div>
                          </div>
                        </div>

                        <div className="p-4 rounded-xl border border-border bg-secondary/10 flex items-center gap-3">
                          <Info className="h-5 w-5 text-amber-500 shrink-0" />
                          <div>
                            <div className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Time Remaining</div>
                            <div className="text-xs font-black text-foreground">
                              {(() => {
                                const end = new Date(subscription.endDate);
                                const diff = end.getTime() - new Date().getTime();
                                if (diff <= 0) return "Expired";
                                const days = Math.floor(diff / (1000 * 60 * 60 * 24));
                                return `${days} Days Remaining`;
                              })()}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Limits and quotas */}
                    {subMetrics && (
                      <div className="space-y-4">
                        <h4 className="text-xs font-extrabold text-foreground uppercase tracking-wider">
                          Resource Usage & Limits
                        </h4>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {/* Branch usage */}
                          <div className="border border-border/60 rounded-xl p-4 space-y-3">
                            <div className="flex justify-between items-center text-xs">
                              <span className="font-bold text-muted-foreground uppercase text-[10px] tracking-wider">Branches</span>
                              <span className="font-black text-foreground">
                                {subMetrics.branchCount} / {subscription.branchLimit}
                              </span>
                            </div>
                            <div className="h-2 w-full bg-secondary rounded-full overflow-hidden">
                              <div 
                                className="h-full bg-[#2563EB] rounded-full transition-all duration-500" 
                                style={{ width: `${Math.min(100, (subMetrics.branchCount / subscription.branchLimit) * 100)}%` }}
                              />
                            </div>
                            <p className="text-[10px] text-muted-foreground leading-snug">
                              Maximum physical branches and warehouses allowed on this tier.
                            </p>
                          </div>

                          {/* User usage */}
                          <div className="border border-border/60 rounded-xl p-4 space-y-3">
                            <div className="flex justify-between items-center text-xs">
                              <span className="font-bold text-muted-foreground uppercase text-[10px] tracking-wider">Employee Accounts</span>
                              <span className="font-black text-foreground">
                                {subMetrics.userCount} / {subscription.userLimit}
                              </span>
                            </div>
                            <div className="h-2 w-full bg-secondary rounded-full overflow-hidden">
                              <div 
                                className="h-full bg-emerald-500 rounded-full transition-all duration-500" 
                                style={{ width: `${Math.min(100, (subMetrics.userCount / subscription.userLimit) * 100)}%` }}
                              />
                            </div>
                            <p className="text-[10px] text-muted-foreground leading-snug">
                              Maximum employee profiles (cashiers, managers) that can login.
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="py-12 border border-dashed border-border rounded-xl text-center text-muted-foreground space-y-2 bg-secondary/5">
                    <AlertTriangle className="h-8 w-8 text-amber-500 mx-auto stroke-1" />
                    <p className="text-xs font-bold">No Subscription Found</p>
                    <p className="text-[10px]">Contact system admin to configure your billing subscription.</p>
                  </div>
                )}
              </div>
            )}

            {/* Save Buttons Panel - Only shown for config fields */}
            {activeTab !== "overview" && activeTab !== "backup" && activeTab !== "subscription" && isAuthorized && (
              <div className="border-t border-border/50 pt-4 flex justify-end">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-6 py-2.5 bg-primary text-primary-foreground hover:bg-primary/95 rounded-xl text-xs font-black shadow-lg shadow-primary/20 transition-all uppercase tracking-wider"
                >
                  {isSubmitting ? "Applying updates..." : "Save changes"}
                </button>
              </div>
            )}
          </form>
        </div>
      </div>
    </div>
  );
}
