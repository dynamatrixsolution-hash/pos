"use client";

import * as React from "react";
import { useSession } from "next-auth/react";
import { useSettings } from "@/components/settings-provider";
import dynamic from "next/dynamic";

const BarcodeScannerModal = dynamic(() => import("@/components/barcode-scanner-modal"), {
  ssr: false,
});
import {
  Search,
  ShoppingCart,
  Trash2,
  Pause,
  Play,
  CreditCard,
  User,
  Plus,
  Minus,
  Printer,
  Barcode,
  Grid,
  Users,
  Check,
  X,
  Info,
  ShoppingBag,
  FileText,
  Edit2,
  Calendar,
  ChevronDown,
  Monitor,
  List,
  Sparkles,
  Layers,
  Table,
  PlusCircle,
  Percent,
  Calculator,
  UserPlus,
  ArrowLeftRight,
  ShieldCheck,
  Package,
  Camera,
  AlertTriangle,
  Loader2,
} from "lucide-react";

interface ProductItem {
  id: string;
  name: string;
  sku: string;
  barcode: string;
  costPrice: number;
  sellingPrice: number;
  alertQuantity: number;
  batchTracking: boolean;
  productStocks: { quantity: number }[];
  unit?: { name: string } | null;
  description?: string | null;
  category?: { name: string } | null;
  brand?: { name: string } | null;
  image?: string | null;
  categoryId?: string;
  batches?: {
    id: string;
    batchNumber: string;
    quantity: number;
    manufacturingDate?: string | Date | null;
    expiryDate?: string | Date | null;
  }[];
}

interface CartItem {
  id: string; // product ID
  name: string;
  sku: string;
  barcode: string;
  price: number;
  quantity: number;
  discount: number; // item level discount
  tax: number; // item level tax
  availableStock: number;
  batchNumber?: string;
  image?: string | null;
  notes?: string;
  serialNumber?: string;
  expiryDate?: string;
  rackNumber?: string;
}

interface CustomerItem {
  id: string;
  name: string;
  phone: string;
  customerType: string;
  creditLimit: number;
  balance: number;
}

interface ActiveOrder {
  id: string;
  invoiceNumber: string;
  cart: CartItem[];
  selectedCustomerId: string;
  customerType: "WALK_IN" | "REGISTERED";
  overallDiscount: number;
  discountType: "FLAT" | "PERCENTAGE";
  invoiceNotes: string;
  tableNumber: string;
  diningType: "DINE_IN" | "TAKE_AWAY" | "DELIVERY";
  waiterId: string;
  posMode: "RETAIL" | "RESTAURANT" | "PHARMACY" | "WHOLESALE";
  splitPayments: {
    cash: number;
    card: number;
    qr: number;
    bank: number;
    credit: number;
  };
}

interface HeldBill {
  id: string;
  name: string;
  items: CartItem[];
  customerId: string | null;
  overallDiscount: number;
  notes: string;
  createdAt: Date;
  tableNumber?: string;
  diningType?: string;
  posMode?: string;
}

export default function POSPage() {
  const { data: session } = useSession();
  const branchId = session?.user ? (session.user as any).branchId : null;
  const role = session?.user ? (session.user as any).role : null;
  const { currencySymbol, vatPercentage, pricingType, enableVat, taxName } = useSettings();

  const [posScannerOpen, setPosScannerOpen] = React.useState(false);
  const [scanToast, setScanToast] = React.useState<{ message: string; type: "success" | "error" } | null>(null);

  // Custom Alert / Confirm popup state
  interface AlertModalState {
    open: boolean;
    title: string;
    message: string;
    type: "info" | "error" | "confirm" | "prompt";
    defaultValue?: string;
    onPromptSubmit?: (value: string) => void;
    onConfirm?: () => void;
  }
  const [alertModal, setAlertModal] = React.useState<AlertModalState>({
    open: false,
    title: "",
    message: "",
    type: "info",
  });

  const [discountModalOpen, setDiscountModalOpen] = React.useState(false);
  const [discountModalAmount, setDiscountModalAmount] = React.useState("");
  const [discountModalType, setDiscountModalType] = React.useState<"FLAT" | "PERCENTAGE">("FLAT");

  const showAlert = (title: string, message: string, type: "info" | "error" = "info") => {
    setAlertModal({
      open: true,
      title,
      message,
      type,
    });
  };

  const showConfirm = (title: string, message: string, onConfirm: () => void) => {
    setAlertModal({
      open: true,
      title,
      message,
      type: "confirm",
      onConfirm,
    });
  };

  const showPrompt = (title: string, message: string, defaultValue: string, onPromptSubmit: (value: string) => void) => {
    setAlertModal({
      open: true,
      title,
      message,
      type: "prompt",
      defaultValue,
      onPromptSubmit,
    });
  };

  React.useEffect(() => {
    if (scanToast) {
      const timer = setTimeout(() => setScanToast(null), 2200);
      return () => clearTimeout(timer);
    }
  }, [scanToast]);

  // Catalog Data States
  const [products, setProducts] = React.useState<ProductItem[]>([]);
  const [filteredProducts, setFilteredProducts] = React.useState<ProductItem[]>([]);
  const [categories, setCategories] = React.useState<any[]>([]);
  const [customers, setCustomers] = React.useState<CustomerItem[]>([]);
  const [visibleCount, setVisibleCount] = React.useState<number>(36);

  // Layout Configuration
  const [viewMode, setViewMode] = React.useState<"grid" | "compact" | "list">("grid");
  const [searchQuery, setSearchQuery] = React.useState<string>("");
  const [debouncedQuery, setDebouncedQuery] = React.useState<string>("");
  const [selectedCategory, setSelectedCategory] = React.useState<string>("all");
  const [selectedBrand, setSelectedBrand] = React.useState<string>("all");

  // Dynamic Fullscreen Sidebar/Header toggles tracking
  const [sidebarOpen, setSidebarOpen] = React.useState(false);
  const [navbarOpen, setNavbarOpen] = React.useState(true);

  React.useEffect(() => {
    const handleSidebar = () => setSidebarOpen((prev) => !prev);
    const handleNavbar = () => setNavbarOpen((prev) => !prev);

    window.addEventListener("toggle-pos-sidebar", handleSidebar);
    window.addEventListener("toggle-pos-navbar", handleNavbar);

    return () => {
      window.removeEventListener("toggle-pos-sidebar", handleSidebar);
      window.removeEventListener("toggle-pos-navbar", handleNavbar);
    };
  }, []);

  // Tabbed multi-order list state
  const [activeOrders, setActiveOrders] = React.useState<ActiveOrder[]>([
    {
      id: "1",
      invoiceNumber: "INV-1001",
      cart: [],
      selectedCustomerId: "",
      customerType: "WALK_IN",
      overallDiscount: 0,
      discountType: "FLAT",
      invoiceNotes: "",
      tableNumber: "Table 01",
      diningType: "TAKE_AWAY",
      waiterId: "Waiter 01",
      posMode: "RETAIL",
      splitPayments: { cash: 0, card: 0, qr: 0, bank: 0, credit: 0 },
    },
  ]);
  const [currentOrderId, setCurrentOrderId] = React.useState<string>("1");

  const [cartSearchQuery, setCartSearchQuery] = React.useState<string>("");
  const [customerSearchQuery, setCustomerSearchQuery] = React.useState<string>("");
  const [couponDiscounts, setCouponDiscounts] = React.useState<Record<string, number>>({});

  // Get active order context helpers
  const currentOrder = React.useMemo(() => {
    return activeOrders.find((o) => o.id === currentOrderId) || activeOrders[0];
  }, [activeOrders, currentOrderId]);

  const couponDiscount = couponDiscounts[currentOrderId] || 0;

  // Math Calculations (CGST/SGST/VAT)
  const subtotal = currentOrder.cart.reduce(
    (sum, item) => sum + (item.price - item.discount) * item.quantity,
    0
  );

  const discountSales = currentOrder.cart.reduce(
    (sum, item) => sum + item.discount * item.quantity,
    0
  );

  const grossSubtotal = currentOrder.cart.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0
  );

  const productDiscount = currentOrder.cart.reduce(
    (sum, item) => sum + item.discount * item.quantity,
    0
  );

  const filteredCart = React.useMemo(() => {
    if (!cartSearchQuery.trim()) return currentOrder.cart;
    const q = cartSearchQuery.toLowerCase();
    return currentOrder.cart.filter((item) =>
      item.name.toLowerCase().includes(q) ||
      item.sku.toLowerCase().includes(q) ||
      (item.barcode && item.barcode.toLowerCase().includes(q))
    );
  }, [currentOrder.cart, cartSearchQuery]);

  // Calculate tax dynamically based on settings
  const rawOverallDiscount =
    currentOrder.discountType === "PERCENTAGE"
      ? subtotal * (currentOrder.overallDiscount / 100)
      : currentOrder.overallDiscount;

  let tax = 0;
  if (enableVat) {
    if (pricingType === "INCLUSIVE") {
      // Inclusive tax: selling price already includes the tax
      tax = (subtotal - rawOverallDiscount - couponDiscount) * (vatPercentage / (100 + vatPercentage));
    } else {
      // Exclusive tax: tax is added on top of the subtotal minus overall discount
      tax = Math.max(0, subtotal - rawOverallDiscount - couponDiscount) * (vatPercentage / 100);
    }
  }

  // Splits of the tax (always splits equally for displaying)
  const vat = tax * 0.5;
  const cgst = tax * 0.25;
  const sgst = tax * 0.25;

  // Compute final total payable
  const total = pricingType === "INCLUSIVE"
    ? Math.max(0, subtotal - rawOverallDiscount - couponDiscount)
    : Math.max(0, subtotal + tax - rawOverallDiscount - couponDiscount);

  const roundOff = parseFloat((Math.round(total) - total).toFixed(2));
  const grandTotal = Math.round(total);


  const updateCurrentOrder = React.useCallback(
    (updater: (order: ActiveOrder) => ActiveOrder) => {
      setActiveOrders((prev) =>
        prev.map((o) => (o.id === currentOrderId ? updater(o) : o))
      );
    },
    [currentOrderId]
  );

  // UI state managers
  const [payModalOpen, setPayModalOpen] = React.useState(false);
  const [custModalOpen, setCustModalOpen] = React.useState(false);
  const [holdModalOpen, setHoldModalOpen] = React.useState(false);
  const [recallModalOpen, setRecallModalOpen] = React.useState(false);
  const [weightModalOpen, setWeightModalOpen] = React.useState(false);
  const [isDetailsOpen, setIsDetailsOpen] = React.useState(false);

  // Popup entities
  const [detailsProduct, setDetailsProduct] = React.useState<ProductItem | null>(null);
  const [weightModalProduct, setWeightModalProduct] = React.useState<ProductItem | null>(null);
  const [weightInputValue, setWeightInputValue] = React.useState<string>("");
  const [detailsQuantity, setDetailsQuantity] = React.useState<number>(1);
  const [qtyMultiplier, setQtyMultiplier] = React.useState<number>(1);
  const [holdName, setHoldName] = React.useState<string>("");
  const [heldBills, setHeldBills] = React.useState<HeldBill[]>([]);
  const [activeMobileTab, setActiveMobileTab] = React.useState<"catalog" | "cart">("catalog");

  // Localized configuration state from SettingsProvider context is now defined at the top of the component

  // Split payment modal details
  const [splitType, setSplitType] = React.useState<"SINGLE" | "METHOD" | "PERSONS">("SINGLE");
  const [personsCount, setPersonsCount] = React.useState<number>(2);
  const [personsPayments, setPersonsPayments] = React.useState<number[]>([0, 0]);
  const [singlePaymentMethod, setSinglePaymentMethod] = React.useState<string>("CASH");
  const [amountTendered, setAmountTendered] = React.useState<number>(0);
  const [isAmountTenderedManuallySet, setIsAmountTenderedManuallySet] = React.useState<boolean>(false);
  const [submitError, setSubmitError] = React.useState<string>("");
  const [isCheckingOut, setIsCheckingOut] = React.useState(false);
  const [lastInvoice, setLastInvoice] = React.useState<any | null>(null);

  // Sync amountTendered with grandTotal until user edits it manually
  React.useEffect(() => {
    if (!isAmountTenderedManuallySet) {
      setAmountTendered(grandTotal);
    }
  }, [grandTotal, isAmountTenderedManuallySet]);

  // Discount verification
  const [adminPasscodeModal, setAdminPasscodeModal] = React.useState(false);
  const [passcodeInput, setPasscodeInput] = React.useState("");
  const [pendingDiscountValue, setPendingDiscountValue] = React.useState<number>(0);
  const [pendingDiscountType, setPendingDiscountType] = React.useState<"FLAT" | "PERCENTAGE">("FLAT");

  // Customer inline creation states
  const [newName, setNewName] = React.useState("");
  const [newPhone, setNewPhone] = React.useState("");
  const [newAddress, setNewAddress] = React.useState("");
  const [newEmail, setNewEmail] = React.useState("");

  const searchInputRef = React.useRef<HTMLInputElement>(null);

  // Debounce search query filtering
  React.useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(searchQuery), 155);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Fetch product catalog, categories, customers
  React.useEffect(() => {
    async function loadData() {
      try {
        const [prodRes, catRes, custRes] = await Promise.all([
          fetch("/api/v1/products?limit=250"),
          fetch("/api/v1/categories"),
          fetch("/api/v1/customers"),
        ]);

        if (prodRes.ok) {
          const data = await prodRes.json();
          setProducts(data.products || []);
          setFilteredProducts(data.products || []);
        }
        if (catRes.ok) {
          const data = await catRes.json();
          setCategories(data || []);
        }
        if (custRes.ok) {
          const data = await custRes.json();
          setCustomers(data.customers || []);
        }
      } catch (err) {
        console.error("Failed to load initial POS data:", err);
      }
    }
    loadData();
  }, []);

  // Optimized local filtering logic
  React.useEffect(() => {
    let result = products;

    if (selectedCategory !== "all") {
      result = result.filter((p) => p.categoryId === selectedCategory);
    }

    if (selectedBrand !== "all") {
      result = result.filter(
        (p) => p.brand?.name?.toLowerCase() === selectedBrand.toLowerCase()
      );
    }

    if (debouncedQuery) {
      const q = debouncedQuery.toLowerCase();
      result = result.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.sku.toLowerCase().includes(q) ||
          p.barcode.toLowerCase().includes(q) ||
          (p.batches && p.batches.some((b) => b.batchNumber.toLowerCase().includes(q)))
      );
    }

    setFilteredProducts(result);
    setVisibleCount(36); // Reset page limits
  }, [debouncedQuery, selectedCategory, selectedBrand, products]);


  // Unified global keyboard hotkey configurations
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "F1") {
        e.preventDefault();
        searchInputRef.current?.focus();
      } else if (e.key === "F2") {
        e.preventDefault();
        setCustModalOpen(true);
      } else if (e.key === "F3") {
        e.preventDefault();
        if (currentOrder.cart.length > 0) setHoldModalOpen(true);
      } else if (e.key === "F4") {
        e.preventDefault();
        setRecallModalOpen(true);
      } else if (e.key === "F5") {
        e.preventDefault();
        if (currentOrder.cart.length > 0) {
          setAmountTendered(grandTotal);
          setPayModalOpen(true);
        }
      } else if (e.key === "F6") {
        e.preventDefault();
        if (currentOrder.cart.length > 0) handleCheckoutSubmit();
      } else if (e.key === "F7") {
        e.preventDefault();
        if (currentOrder.cart.length > 0) window.print();
      } else if (e.key === "F8") {
        e.preventDefault();
        if (currentOrder.cart.length > 0) openCheckout();
      } else if (e.key === "F9") {
        e.preventDefault();
        if (currentOrder.cart.length > 0) handleCheckoutSubmit();
      } else if (e.key === "F10") {
        e.preventDefault();
        if (currentOrder.cart.length > 0) handleCheckoutSubmit();
      } else if (e.key === "Escape") {
        e.preventDefault();
        updateCurrentOrder((o) => ({ ...o, cart: [] }));
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeOrders, currentOrderId, grandTotal, posScannerOpen]);

  // Tabbed controls
  const handleAddNewOrderTab = () => {
    const nextId = (
      Math.max(...activeOrders.map((o) => parseInt(o.id) || 0), 0) + 1
    ).toString();
    const invoiceNum = `INV-${1000 + parseInt(nextId)}`;
    const newTab: ActiveOrder = {
      id: nextId,
      invoiceNumber: invoiceNum,
      cart: [],
      selectedCustomerId: "",
      customerType: "WALK_IN",
      overallDiscount: 0,
      discountType: "FLAT",
      invoiceNotes: "",
      tableNumber: "Table 01",
      diningType: "TAKE_AWAY",
      waiterId: "Waiter 01",
      posMode: currentOrder.posMode,
      splitPayments: { cash: 0, card: 0, qr: 0, bank: 0, credit: 0 },
    };
    setActiveOrders([...activeOrders, newTab]);
    setCurrentOrderId(nextId);
  };

  const handleCloseOrderTab = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (activeOrders.length <= 1) return;
    const filterTabs = activeOrders.filter((t) => t.id !== id);
    setActiveOrders(filterTabs);
    if (currentOrderId === id) {
      setCurrentOrderId(filterTabs[0].id);
    }
  };

  // Sound scan effects
  const playBeep = () => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.frequency.setValueAtTime(920, audioCtx.currentTime);
      gain.gain.setValueAtTime(0.05, audioCtx.currentTime);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.065);
    } catch (_) {}
  };

  // Add Product to checkout cart
  const addToCart = (product: ProductItem) => {
    const isWeight =
      product.unit?.name?.toLowerCase() === "kg" || product.unit?.name?.toLowerCase() === "g";

    if (isWeight) {
      setWeightModalProduct(product);
      setWeightInputValue("");
      setWeightModalOpen(true);
      return;
    }

    addUnitToCart(product, qtyMultiplier);
    setQtyMultiplier(1);
  };

  const handlePosBarcodeScan = React.useCallback((barcode: string) => {
    const matched = products.find(
      (p) => p.barcode === barcode || (p.sku && p.sku.toLowerCase() === barcode.toLowerCase())
    );
    if (matched) {
      addToCart(matched);
      setScanToast({ message: `Scanned: ${matched.name}`, type: "success" });
    } else {
      setScanToast({ message: `Product not found: ${barcode}`, type: "error" });
    }
  }, [products, activeOrders, currentOrderId]);

  const addUnitToCart = (product: ProductItem, qty: number) => {
    playBeep();
    const stockQty = product.productStocks.reduce((sum, s) => sum + s.quantity, 0);

    if (stockQty <= 0) {
      alert(`Product "${product.name}" is completely out of stock.`);
      return;
    }

    const existing = currentOrder.cart.find((item) => item.id === product.id);

    if (existing) {
      if (existing.quantity + qty > stockQty) {
        alert(`Stock limit of ${stockQty} reached.`);
        return;
      }
      updateCurrentOrder((o) => ({
        ...o,
        cart: o.cart.map((item) =>
          item.id === product.id ? { ...item, quantity: item.quantity + qty } : item
        ),
      }));
    } else {
      const activeBatch = product.batches && product.batches.length > 0 ? product.batches[0] : undefined;
      const expiryStr = activeBatch?.expiryDate
        ? new Date(activeBatch.expiryDate).toLocaleDateString()
        : undefined;

      const newItem: CartItem = {
        id: product.id,
        name: product.name,
        sku: product.sku,
        barcode: product.barcode,
        price: product.sellingPrice,
        quantity: qty,
        discount: 0,
        tax: 0,
        availableStock: stockQty,
        batchNumber: activeBatch?.batchNumber || (product.batchTracking ? "BCH-01" : undefined),
        expiryDate: expiryStr,
        rackNumber: product.sku.slice(0, 2) + "-Rack",
        image: product.image,
      };

      updateCurrentOrder((o) => ({ ...o, cart: [...o.cart, newItem] }));
    }
  };

  const updateCartQty = (productId: string, qty: number) => {
    if (qty <= 0) {
      updateCurrentOrder((o) => ({ ...o, cart: o.cart.filter((i) => i.id !== productId) }));
      return;
    }
    const item = currentOrder.cart.find((i) => i.id === productId);
    if (item && qty > item.availableStock) {
      alert(`Stock limit is ${item.availableStock}`);
      return;
    }
    updateCurrentOrder((o) => ({
      ...o,
      cart: o.cart.map((i) => (i.id === productId ? { ...i, quantity: qty } : i)),
    }));
  };

  const updateItemNotes = (productId: string, notes: string) => {
    updateCurrentOrder((o) => ({
      ...o,
      cart: o.cart.map((i) => (i.id === productId ? { ...i, notes } : i)),
    }));
  };

  const updateItemDiscount = (productId: string, discount: number) => {
    updateCurrentOrder((o) => ({
      ...o,
      cart: o.cart.map((i) => (i.id === productId ? { ...i, discount: Math.max(0, discount) } : i)),
    }));
  };

  const updateItemSerial = (productId: string, serial: string) => {
    updateCurrentOrder((o) => ({
      ...o,
      cart: o.cart.map((i) => (i.id === productId ? { ...i, serialNumber: serial } : i)),
    }));
  };

  // Customer metrics
  const activeCustomer = customers.find((c) => c.id === currentOrder.selectedCustomerId);

  // Large discount authorization check
  const handleDiscountConfig = (value: number, type: "FLAT" | "PERCENTAGE") => {
    const discAmount = type === "PERCENTAGE" ? subtotal * (value / 100) : value;

    if (subtotal > 0 && discAmount / subtotal > 0.25) {
      setPendingDiscountValue(value);
      setPendingDiscountType(type);
      setAdminPasscodeModal(true);
      setPasscodeInput("");
    } else {
      updateCurrentOrder((o) => ({
        ...o,
        overallDiscount: value,
        discountType: type,
      }));
    }
  };

  const verifyAdminOverride = () => {
    if (passcodeInput === "1234") {
      updateCurrentOrder((o) => ({
        ...o,
        overallDiscount: pendingDiscountValue,
        discountType: pendingDiscountType,
      }));
      setAdminPasscodeModal(false);
      alert("Large discount override authorized by Admin.");
    } else {
      alert("Invalid passcode. Authorized override failed.");
    }
  };

  // Split calculations
  const totalPaidInSplits =
    splitType === "METHOD"
      ? currentOrder.splitPayments.cash +
        currentOrder.splitPayments.card +
        currentOrder.splitPayments.qr +
        currentOrder.splitPayments.bank +
        currentOrder.splitPayments.credit
      : splitType === "PERSONS"
      ? personsPayments.reduce((sum, v) => sum + v, 0)
      : amountTendered;

  const remainingOrChange = totalPaidInSplits - grandTotal;

  // Checkout submission
  const openCheckout = () => {
    setAmountTendered(grandTotal);
    setSplitType("SINGLE");
    setSinglePaymentMethod("CASH");
    setPersonsCount(2);
    const half = parseFloat((grandTotal / 2).toFixed(2));
    setPersonsPayments([half, parseFloat((grandTotal - half).toFixed(2))]);
    setSubmitError("");
    setPayModalOpen(true);
  };

  const handleCheckoutSubmit = async () => {
    if (!branchId) {
      setSubmitError("No branch context available.");
      return;
    }

    if (
      (splitType === "METHOD" || splitType === "PERSONS") &&
      Math.abs(remainingOrChange) > 0.05 &&
      remainingOrChange < 0
    ) {
      setSubmitError("Split payment amounts total must equal or exceed the grand total.");
      return;
    }

    // Wholesale balance verification
    if (currentOrder.posMode === "WHOLESALE" && activeCustomer) {
      const outstandingSum = activeCustomer.balance + grandTotal;
      if (outstandingSum > activeCustomer.creditLimit) {
        setSubmitError(
          `Wholesale check failed: credit limit (${currencySymbol}${activeCustomer.creditLimit}) exceeded.`
        );
        return;
      }
    }

    const splitPaymentsList = [];
    if (splitType === "METHOD") {
      if (currentOrder.splitPayments.cash > 0) {
        splitPaymentsList.push({ method: "CASH", amount: currentOrder.splitPayments.cash });
      }
      if (currentOrder.splitPayments.card > 0) {
        splitPaymentsList.push({ method: "CARD", amount: currentOrder.splitPayments.card });
      }
      if (currentOrder.splitPayments.qr > 0) {
        splitPaymentsList.push({ method: "QR", amount: currentOrder.splitPayments.qr });
      }
      if (currentOrder.splitPayments.bank > 0) {
        splitPaymentsList.push({ method: "BANK_TRANSFER", amount: currentOrder.splitPayments.bank });
      }
      if (currentOrder.splitPayments.credit > 0) {
        splitPaymentsList.push({ method: "CREDIT", amount: currentOrder.splitPayments.credit });
      }
    }

    const payload = {
      customerId: currentOrder.selectedCustomerId || null,
      branchId,
      items: currentOrder.cart.map((i) => ({
        productId: i.id,
        batchNumber: i.batchNumber,
        quantity: i.quantity,
        price: i.price - i.discount,
        discount: i.discount,
        tax: i.tax,
      })),
      subtotal,
      discount: rawOverallDiscount + discountSales + couponDiscount,
      tax,
      total: grandTotal,
      paidAmount: totalPaidInSplits,
      paymentMethod:
        splitType === "METHOD"
          ? "CASH"
          : singlePaymentMethod === "BANK"
          ? "BANK_TRANSFER"
          : (singlePaymentMethod as any),
      paymentStatus: totalPaidInSplits >= grandTotal ? "PAID" : "PARTIAL",
      status: "COMPLETED",
      notes: currentOrder.invoiceNotes,
      splitPayments: splitPaymentsList.length > 0 ? splitPaymentsList : undefined,
    };

    setIsCheckingOut(true);
    try {
      const res = await fetch("/api/v1/sales", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setSubmitError(data.error || "POS transaction failed.");
        return;
      }

      setLastInvoice({
        ...data,
        invoiceItems: currentOrder.cart,
        customerName: activeCustomer?.name || "Walk-in Customer",
        cashierName: session?.user?.name || "Cashier",
        tableNumber: currentOrder.posMode === "RESTAURANT" ? currentOrder.tableNumber : undefined,
      });

      // Reset Active Tab
      updateCurrentOrder((o) => ({
        ...o,
        cart: [],
        selectedCustomerId: "",
        customerType: "WALK_IN",
        overallDiscount: 0,
        invoiceNotes: "",
        splitPayments: { cash: 0, card: 0, qr: 0, bank: 0, credit: 0 },
      }));
      setCouponDiscounts((prev) => {
        const next = { ...prev };
        delete next[currentOrderId];
        return next;
      });

      setPayModalOpen(false);
      setIsAmountTenderedManuallySet(false);
      setAmountTendered(0);

      setTimeout(() => {
        window.print();
      }, 300);
    } catch (_) {
      setSubmitError("API Connection failure.");
    } finally {
      setIsCheckingOut(false);
    }
  };

  // Suspend drafts handlers
  const handleHoldBill = () => {
    if (!holdName.trim()) return;
    const newBill: HeldBill = {
      id: Math.random().toString(36).substring(7),
      name: holdName,
      items: currentOrder.cart,
      customerId: currentOrder.selectedCustomerId || null,
      overallDiscount: currentOrder.overallDiscount,
      notes: currentOrder.invoiceNotes,
      createdAt: new Date(),
      tableNumber: currentOrder.tableNumber,
      diningType: currentOrder.diningType,
      posMode: currentOrder.posMode,
    };

    setHeldBills([...heldBills, newBill]);
    setHoldName("");
    setHoldModalOpen(false);

    // Clear active tab
    updateCurrentOrder((o) => ({
      ...o,
      cart: [],
      selectedCustomerId: "",
      overallDiscount: 0,
      invoiceNotes: "",
    }));
    setCouponDiscounts((prev) => {
      const next = { ...prev };
      delete next[currentOrderId];
      return next;
    });
    setIsAmountTenderedManuallySet(false);
    setAmountTendered(0);
  };

  const handleRecallBill = (bill: HeldBill) => {
    updateCurrentOrder((o) => ({
      ...o,
      cart: bill.items,
      selectedCustomerId: bill.customerId || "",
      customerType: bill.customerId ? "REGISTERED" : "WALK_IN",
      overallDiscount: bill.overallDiscount,
      invoiceNotes: bill.notes,
      tableNumber: bill.tableNumber || o.tableNumber,
      diningType: (bill.diningType as any) || o.diningType,
      posMode: (bill.posMode as any) || o.posMode,
    }));
    setHeldBills(heldBills.filter((b) => b.id !== bill.id));
    setRecallModalOpen(false);
    setIsAmountTenderedManuallySet(false);
  };

  // Weight scale entry
  const handleWeightSubmit = (weight: number) => {
    if (!weightModalProduct || weight <= 0) return;
    const finalWeight = Number((weight * qtyMultiplier).toFixed(3));
    setQtyMultiplier(1);
    addUnitToCart(weightModalProduct, finalWeight);
    setWeightModalOpen(false);
  };

  // Inline customer quick creation
  const handleQuickCustomerSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;

    try {
      const res = await fetch("/api/v1/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newName,
          phone: newPhone || null,
          address: newAddress || null,
          email: newEmail || null,
          customerType: "RETAIL",
          creditLimit: 25000,
        }),
      });

      if (!res.ok) {
        alert("Failed to register customer.");
        return;
      }

      const data = await res.json();
      setCustomers((prev) => [...prev, data]);
      updateCurrentOrder((o) => ({
        ...o,
        selectedCustomerId: data.id,
        customerType: "REGISTERED",
      }));

      setNewName("");
      setNewPhone("");
      setNewAddress("");
      setNewEmail("");
      setCustModalOpen(false);
    } catch (_) {
      showAlert("Network Error", "Customer registration network failure.", "error");
    }
  };

  const handleNewOrder = () => {
    const proceedNewOrder = () => {
      updateCurrentOrder((o) => ({
        ...o,
        cart: [],
        selectedCustomerId: "",
        overallDiscount: 0,
        invoiceNotes: "",
        splitPayments: { cash: 0, card: 0, qr: 0, bank: 0, credit: 0 },
      }));
    };

    if (currentOrder.cart.length > 0) {
      showConfirm(
        "Discard Cart Items",
        "Are you sure you want to discard this cart items?",
        proceedNewOrder
      );
    } else {
      proceedNewOrder();
    }
  };

  return (
    <div className="w-full h-full p-4 bg-[#F3F4F6] dark:bg-slate-950 overflow-hidden text-foreground flex flex-col font-sans select-none transition-all duration-300">
      
      {/* Dynamic workspace wrapper grid */}
      <div className="flex-1 flex flex-col lg:flex-row gap-4 min-h-0 overflow-hidden no-print">
        
        {/* LEFT SECTION (75% screen width): Product grids & Category catalog */}
        <div className={`flex-1 lg:flex-[3] flex flex-col gap-4 bg-white dark:bg-[#0a0f24] rounded-[32px] p-5 border border-slate-200/50 dark:border-slate-800/80 shadow-sm min-h-0 overflow-hidden ${
          activeMobileTab === "catalog" ? "flex" : "hidden lg:flex"
        }`}>
          
          {/* Row 1: Left toggle trigger menu bar shortcuts */}
          <div className="flex flex-wrap items-center justify-between gap-3 shrink-0">
            <div className="flex items-center gap-3 flex-1 min-w-[200px]">
              
              {/* Sidebar collapse button */}
              <button
                onClick={() => window.dispatchEvent(new CustomEvent("toggle-pos-sidebar"))}
                className="bg-[#F9FAFB] dark:bg-slate-900 border border-slate-200 dark:border-slate-800 w-11 h-11 flex items-center justify-center rounded-xl text-slate-600 dark:text-slate-350 hover:bg-slate-50 dark:hover:bg-slate-800 shrink-0 shadow-xs cursor-pointer transition-all"
                title="Toggle Sidebar"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-slate-500 dark:text-slate-400"><line x1="4" y1="12" x2="20" y2="12"></line><line x1="4" y1="6" x2="20" y2="6"></line><line x1="4" y1="18" x2="20" y2="18"></line></svg>
              </button>

              {/* Modern High-Fidelity Search Wrapper matching the image */}
              <div className="flex-1 flex items-center bg-[#F9FAFB] dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xs h-11 px-3.5">
                <Search className="h-4.5 w-4.5 text-slate-400 shrink-0 mr-2.5" />
                <input
                  ref={searchInputRef}
                  type="text"
                  placeholder="Search products..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="flex-1 bg-transparent text-xs text-foreground placeholder-slate-400 focus:outline-none min-w-0 font-medium"
                  suppressHydrationWarning
                />
                <div className="flex items-center gap-1.5 shrink-0 ml-2">
                  {/* Inline Barcode Scanner button */}
                  <button
                    type="button"
                    onClick={() => setPosScannerOpen(true)}
                    className="text-slate-400 hover:text-[#2563EB] cursor-pointer p-1.5 transition-all"
                    title="Scan Barcode with Camera (F9)"
                  >
                    <Barcode className="h-4.5 w-4.5" />
                  </button>

                  <button
                    type="button"
                    onClick={() => setDebouncedQuery(searchQuery)}
                    className="px-4 h-8 bg-[#2563EB] hover:bg-[#1D4ED8] text-white rounded-lg font-bold text-xs cursor-pointer transition-all shadow-xs"
                  >
                    Search
                  </button>
                </div>
              </div>

              {/* Sliders filter settings button (matching the image filter button) */}
              <button
                type="button"
                onClick={() => {
                  setViewMode((prev) => (prev === "grid" ? "compact" : prev === "compact" ? "list" : "grid"));
                }}
                className="bg-[#F9FAFB] dark:bg-slate-900 border border-slate-200 dark:border-slate-800 w-11 h-11 flex items-center justify-center rounded-xl text-slate-600 dark:text-slate-355 hover:bg-slate-50 dark:hover:bg-slate-800 shrink-0 shadow-xs cursor-pointer transition-all"
                title={`Toggle View Mode (Current: ${viewMode})`}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-slate-500 dark:text-slate-400"><line x1="4" y1="21" x2="4" y2="14"></line><line x1="4" y1="10" x2="4" y2="3"></line><line x1="12" y1="21" x2="12" y2="12"></line><line x1="12" y1="8" x2="12" y2="3"></line><line x1="20" y1="21" x2="20" y2="16"></line><line x1="20" y1="12" x2="20" y2="3"></line><line x1="2" y1="14" x2="6" y2="14"></line><line x1="10" y1="8" x2="14" y2="8"></line><line x1="18" y1="16" x2="22" y2="16"></line></svg>
              </button>
            </div>

            {/* Business POS Adaptations Mode & Header collapse */}
            <div className="flex items-center gap-2">
              <select
                value={currentOrder.posMode}
                onChange={(e) =>
                  updateCurrentOrder((o) => ({
                    ...o,
                    posMode: e.target.value as any,
                  }))
                }
                className="h-11 px-4 border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900 text-xs font-bold text-slate-700 dark:text-slate-250 cursor-pointer outline-none focus:ring-1 focus:ring-[#2563EB] transition-all"
              >
                <option value="RETAIL">Retail / Supermarket</option>
                <option value="PHARMACY">Pharmacy Medical</option>
                <option value="RESTAURANT">Restaurant & Cafe</option>
                <option value="WHOLESALE">Wholesale Trade</option>
              </select>

              {/* Header navbar toggle button */}
              <button
                onClick={() => window.dispatchEvent(new CustomEvent("toggle-pos-navbar"))}
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 w-11 h-11 flex items-center justify-center rounded-xl text-slate-600 dark:text-slate-350 hover:bg-slate-50 dark:hover:bg-slate-800 shrink-0 shadow-xs cursor-pointer transition-all"
                title="Toggle Top Navbar View"
              >
                <Monitor className="h-4.5 w-4.5 text-slate-500 dark:text-slate-400" />
              </button>
            </div>
          </div>

          {/* Row 2: Multi-Bill concurrent Tabs */}
          <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-2.5 overflow-x-auto scrollbar-none shrink-0">
            {activeOrders.map((tab) => (
              <div
                key={tab.id}
                onClick={() => setCurrentOrderId(tab.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold cursor-pointer transition-all select-none border ${
                  tab.id === currentOrderId
                    ? "bg-[#2563EB] text-white border-transparent shadow-md shadow-[#2563EB]/15"
                    : "bg-white hover:bg-slate-50 dark:bg-slate-900 dark:hover:bg-slate-800 text-slate-650 dark:text-slate-400 border-slate-200 dark:border-slate-800"
                }`}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="opacity-90"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                <span>{tab.invoiceNumber}</span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded font-black ${tab.id === currentOrderId ? "bg-white/20 text-white" : "bg-slate-100 dark:bg-slate-800 text-slate-500"}`}>
                  {tab.cart.length} items
                </span>
                {activeOrders.length > 1 && (
                  <button
                    onClick={(e) => handleCloseOrderTab(tab.id, e)}
                    className="ml-1 p-0.5 rounded-full hover:bg-black/10 hover:text-white transition-colors cursor-pointer"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </div>
            ))}
            <button
              onClick={handleAddNewOrderTab}
              className="px-4 py-2 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-600 dark:text-slate-355 cursor-pointer flex items-center justify-center gap-1.5 text-xs font-bold transition-all shadow-xs"
              title="Add New Billing Tab"
            >
              <Plus className="h-4 w-4" /> Add Tab
            </button>
          </div>

          {/* Category Horizontal scrolling pills */}
          <div className="flex items-center gap-2.5 overflow-x-auto scrollbar-none shrink-0 pb-2">
            <button
              onClick={() => setSelectedCategory("all")}
              className={`px-4 py-2 text-xs font-bold rounded-xl transition-all select-none cursor-pointer ${
                selectedCategory === "all"
                  ? "bg-[#2563EB] text-white shadow-xs"
                  : "text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100/60 dark:hover:bg-slate-800/40"
              }`}
            >
              Show All
            </button>
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-4 py-2 text-xs font-bold rounded-xl whitespace-nowrap transition-all select-none cursor-pointer ${
                  selectedCategory === cat.id
                    ? "bg-[#2563EB] text-white shadow-xs"
                    : "text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100/60 dark:hover:bg-slate-800/40"
                }`}
              >
                {cat.name}
              </button>
            ))}
          </div>

          {/* Product Layout Representation Grid/Compact/List */}
          <div className="flex-1 overflow-y-auto pr-1 min-h-0">
            {filteredProducts.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center p-8 text-center text-xs text-slate-400">
                <Package className="h-10 w-10 opacity-30 mb-2" />
                No matching product inventory found.
              </div>
            ) : viewMode === "list" ? (
              <div className="border border-slate-100 dark:border-slate-800 rounded-2xl overflow-hidden bg-white dark:bg-slate-900 text-xs">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-800 border-b border-slate-100 dark:border-slate-800 text-slate-500 font-bold uppercase text-[9px] tracking-wider">
                      <th className="py-2.5 px-4">Product Name</th>
                      <th className="py-2.5 px-3">SKU / Code</th>
                      <th className="py-2.5 px-3">Stock Level</th>
                      <th className="py-2.5 px-3">Price</th>
                      {currentOrder.posMode === "PHARMACY" && <th className="py-2.5 px-3">Batch/Expiry</th>}
                      <th className="py-2.5 px-4 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredProducts.slice(0, visibleCount).map((p) => {
                      const stock = p.productStocks.reduce((sum, s) => sum + s.quantity, 0);
                      const isPharmacy = currentOrder.posMode === "PHARMACY";
                      const batch = p.batches && p.batches.length > 0 ? p.batches[0] : null;

                      return (
                        <tr
                          key={p.id}
                          onClick={() => addToCart(p)}
                          className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50/50 dark:hover:bg-slate-800/50 cursor-pointer transition-colors"
                        >
                          <td className="py-3 px-4 font-semibold text-slate-800 dark:text-slate-200">
                            {p.name}
                          </td>
                          <td className="py-3 px-3 text-slate-400 font-mono">{p.sku || p.barcode}</td>
                          <td className="py-3 px-3">
                            <span
                              className={`px-1.5 py-0.5 rounded font-bold text-[10px] ${
                                stock <= 0
                                  ? "bg-red-500/10 text-red-500"
                                  : stock <= p.alertQuantity
                                  ? "bg-amber-500/10 text-amber-500"
                                  : "bg-emerald-500/10 text-emerald-600"
                              }`}
                            >
                              {stock <= 0 ? "Out of Stock" : `${stock} available`}
                            </span>
                          </td>
                          <td className="py-3 px-3 font-bold text-[#2563EB] dark:text-[#7f74f7]">
                            {currencySymbol}{p.sellingPrice.toFixed(2)}
                          </td>
                          {isPharmacy && (
                            <td className="py-3 px-3 text-slate-400 font-medium">
                              {batch ? (
                                <span>
                                  {batch.batchNumber} (Exp:{" "}
                                  {new Date(batch.expiryDate!).toLocaleDateString()})
                                </span>
                              ) : (
                                "No Batch"
                              )}
                            </td>
                          )}
                          <td className="py-3 px-4 text-right">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                addToCart(p);
                              }}
                              className="px-2.5 py-1 bg-[#2563EB] hover:bg-[#1D4ED8] text-white rounded-lg font-bold text-[10px] cursor-pointer"
                            >
                              + Add
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              /* Grid Layout Views */
              <div
                className={`grid gap-4 ${
                  viewMode === "compact"
                    ? "grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6"
                    : "grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 2xl:grid-cols-4"
                }`}
              >
                {filteredProducts.slice(0, visibleCount).map((prod) => {
                  const stock = prod.productStocks.reduce((sum, s) => sum + s.quantity, 0);
                  const isPharmacy = currentOrder.posMode === "PHARMACY";
                  const batch = prod.batches && prod.batches.length > 0 ? prod.batches[0] : null;
                  const isExpiringSoon =
                    batch?.expiryDate &&
                    new Date(batch.expiryDate).getTime() - new Date().getTime() <
                      90 * 24 * 60 * 60 * 1000;

                  return (
                    <div
                      key={prod.id}
                      onClick={() => addToCart(prod)}
                      className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-2 flex flex-col justify-between hover:shadow-lg hover:border-[#2563EB]/25 hover:scale-[1.01] cursor-pointer relative group transition-all duration-300"
                    >
                      {/* Pharmacy Info helpers badge */}
                      {isPharmacy && (
                        <div className="absolute top-2 left-2 z-10 flex flex-col gap-1">
                          {isExpiringSoon && (
                            <span className="px-1.5 py-0.5 bg-amber-500/10 text-amber-600 border border-amber-500/20 text-[8px] font-black rounded-md uppercase tracking-wider">
                              Expiring
                            </span>
                          )}
                          <span className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-400 text-[8px] rounded">
                            {prod.sku.slice(0, 2)}-Rack
                          </span>
                        </div>
                      )}

                      {/* Stock Level Warning indicators */}
                      {stock <= 0 ? (
                        viewMode === "compact" && (
                          <span className="absolute top-2.5 right-2.5 bg-red-500 text-white font-extrabold text-[8px] uppercase tracking-wider px-2 py-0.5 rounded-md shadow-xs z-10">
                            OUT
                          </span>
                        )
                      ) : stock <= prod.alertQuantity ? (
                        <span className="absolute top-2.5 right-2.5 bg-amber-500 text-white font-extrabold text-[8px] uppercase tracking-wider px-2 py-0.5 rounded-md shadow-xs z-10">
                          LOW
                        </span>
                      ) : null}

                      {/* Detail overlays for alternate drug suggestion */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDetailsProduct(prod);
                          setDetailsQuantity(1);
                          setIsDetailsOpen(true);
                        }}
                        className="absolute bottom-16 right-3.5 z-10 bg-white/95 dark:bg-slate-900/95 border border-slate-200 dark:border-slate-800 p-2 rounded-full text-slate-400 hover:text-[#2563EB] opacity-0 group-hover:opacity-100 transition-opacity duration-150 shadow-sm cursor-pointer"
                        title="Alternative Products Suggestions"
                      >
                        <Sparkles className="h-3.5 w-3.5" />
                      </button>

                      {/* Standard Image Representation exactly like image */}
                      {viewMode !== "compact" ? (
                        <div className="w-full aspect-[4/3] bg-[#f3f4f6] dark:bg-slate-950 rounded-xl flex items-center justify-center overflow-hidden mb-2 select-none shrink-0 border border-slate-200/40 dark:border-slate-800/40 relative">
                          {stock <= 0 && (
                            <span className="absolute top-2.5 right-2.5 bg-red-500 text-white font-extrabold text-[8px] uppercase tracking-wider px-2 py-0.5 rounded-md shadow-xs z-10 select-none">
                              OUT
                            </span>
                          )}
                          {prod.image ? (
                            <img
                              src={prod.image}
                              alt={prod.name}
                              className="max-h-[85%] max-w-[85%] object-contain transition-transform group-hover:scale-105 duration-250"
                            />
                          ) : (
                            <div className="w-10 h-10 flex items-center justify-center rounded-full bg-[#2563EB]/10 text-[#2563EB] dark:bg-[#2563EB]/20 dark:text-purple-400 text-xs font-black uppercase tracking-wider select-none">
                              {prod.name.slice(0, 2)}
                            </div>
                          )}
                        </div>
                      ) : (
                        /* Compact view simple visual separator */
                        <div className="h-1.5 w-full bg-[#f3f4f6] dark:bg-slate-800/30 rounded mb-1 shrink-0" />
                      )}

                      {/* Product text details */}
                      <div className="space-y-1 text-left w-full mt-1.5">
                        <h4 className={`font-extrabold text-slate-800 dark:text-slate-100 leading-snug line-clamp-2 tracking-tight ${
                          viewMode === "compact" ? "text-[10px]" : "text-xs"
                        }`}>
                          {prod.name}
                        </h4>
                        <div className="flex justify-between items-center pt-1">
                          <span className="text-xs font-black text-[#2563EB] dark:text-purple-400">
                            {currencySymbol}{prod.sellingPrice.toFixed(2)}
                          </span>
                          
                          {/* Circular plus button */}
                          <div 
                            className="w-6 h-6 rounded-full bg-[#2563EB] hover:bg-[#1D4ED8] text-white flex items-center justify-center transition-all shadow-xs shrink-0 active:scale-90"
                            onClick={(e) => {
                              e.stopPropagation();
                              addToCart(prod);
                            }}
                          >
                            <Plus className="h-3.5 w-3.5 stroke-[3px]" />
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Pagination helper trigger */}
            {filteredProducts.length > visibleCount && (
              <div className="flex justify-center pt-5">
                <button
                  type="button"
                  onClick={() => setVisibleCount((prev) => prev + 36)}
                  className="px-4 py-2 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-xl text-xs font-bold text-slate-650 dark:text-slate-350 cursor-pointer shadow-xs"
                >
                  Load More Inventory
                </button>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT SECTION (25% screen width): Billing checkout panel */}
        <div className={`w-full lg:w-[400px] flex flex-col bg-white dark:bg-[#0a0f24] border border-slate-200/60 dark:border-slate-800 rounded-[32px] p-5 min-h-0 overflow-hidden shadow-xs shrink-0 no-print ${
          activeMobileTab === "cart" ? "flex" : "hidden lg:flex"
        }`}>
          
          {/* Metadata information card */}
          <div className="border-b border-slate-150 dark:border-slate-800/80 pb-3.5 mb-3 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider flex justify-between">
            <span>Bill: {currentOrder.invoiceNumber}</span>
            <span>Date: {new Date().toLocaleDateString()}</span>
            <span>Cashier: {session?.user?.name?.slice(0, 16) || "Alex Owner"}</span>
          </div>

          {/* Search customer or scan barcode input */}
          <div className="relative mb-3 shrink-0">
            <div className="relative flex items-center bg-[#F9FAFB] dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xs overflow-hidden h-11">
              <input
                type="text"
                placeholder="Search customer or scan barcode"
                value={customerSearchQuery}
                onChange={(e) => setCustomerSearchQuery(e.target.value)}
                className="w-full pl-3.5 pr-11 py-2.5 bg-transparent text-xs text-foreground placeholder-slate-400 focus:outline-none font-semibold"
              />
              <Search className="absolute right-3.5 h-4.5 w-4.5 text-slate-400 pointer-events-none" />
            </div>

            {/* Floating search results */}
            {customerSearchQuery.trim() && (
              <div className="absolute top-12 left-0 right-0 z-50 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl max-h-48 overflow-y-auto p-1.5 space-y-1">
                {customers
                  .filter(
                    (c) =>
                      c.name.toLowerCase().includes(customerSearchQuery.toLowerCase()) ||
                      c.phone.includes(customerSearchQuery)
                  )
                  .map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => {
                        updateCurrentOrder((o) => ({
                          ...o,
                          selectedCustomerId: c.id,
                          customerType: "REGISTERED",
                        }));
                        setCustomerSearchQuery("");
                      }}
                      className="w-full text-left px-3 py-2 rounded-lg text-xs hover:bg-slate-50 dark:hover:bg-slate-800 font-semibold text-slate-700 dark:text-slate-200 block"
                    >
                      {c.name} ({c.phone || "No Phone"})
                    </button>
                  ))}
                {customers.filter(
                  (c) =>
                    c.name.toLowerCase().includes(customerSearchQuery.toLowerCase()) ||
                    c.phone.includes(customerSearchQuery)
                ).length === 0 && (
                  <div className="text-center py-3 text-xs text-slate-400 font-medium">
                    No matching customers.
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Restaurant / Customer header details */}
          <div className="space-y-3 mb-3 shrink-0">
            {/* Dining type & Table side-by-side dropdown selectors */}
            <div className="grid grid-cols-2 gap-3">
              <div className="relative">
                <select
                  value={currentOrder.selectedCustomerId || ""}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === "new") {
                      setCustModalOpen(true);
                    } else {
                      updateCurrentOrder((o) => ({
                        ...o,
                        selectedCustomerId: val,
                        customerType: val ? "REGISTERED" : "WALK_IN",
                      }));
                    }
                  }}
                  className="w-full px-3 py-2.5 pr-8 border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900 text-xs font-semibold text-slate-500 focus:outline-none appearance-none cursor-pointer"
                >
                  <option value="">Walk-in Customer</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                  <option value="new" className="text-[#2563EB] font-bold">+ Register New</option>
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
              </div>

              <div className="relative">
                <select
                  value={currentOrder.waiterId}
                  onChange={(e) =>
                    updateCurrentOrder((o) => ({
                      ...o,
                      waiterId: e.target.value,
                    }))
                  }
                  className="w-full px-3 py-2.5 pr-8 border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900 text-xs font-semibold text-slate-500 focus:outline-none appearance-none cursor-pointer"
                >
                  <option value="">Select Sales Person</option>
                  {Array.from({ length: 8 }, (_, i) => `Sales Person ${String(i + 1).padStart(2, "0")}`).map((w) => (
                    <option key={w} value={w}>
                      {w}
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
              </div>
            </div>

            {/* Wholesale specific customer ledger information */}
            {currentOrder.posMode === "WHOLESALE" && activeCustomer && (
              <div className="bg-amber-500/10 border border-amber-500/20 text-amber-600 rounded-xl p-3 text-[10px] font-bold space-y-1">
                <div className="flex justify-between">
                  <span>Customer Type: {activeCustomer.customerType}</span>
                  <span>Outstanding: {currencySymbol}{activeCustomer.balance.toFixed(2)}</span>
                </div>
                <div className="flex justify-between border-t border-amber-500/10 pt-1">
                  <span>Wholesale Limit: {currencySymbol}{activeCustomer.creditLimit.toFixed(2)}</span>
                  <span>Available Credit: {currencySymbol}{(activeCustomer.creditLimit - activeCustomer.balance).toFixed(2)}</span>
                </div>
              </div>
            )}
          </div>

          {/* Active order heading row */}
          <div className="flex items-center justify-between mb-3 text-slate-800 dark:text-slate-200 shrink-0">
            <div className="flex items-center gap-2">
              <ShoppingBag className="h-5 w-5 text-slate-600 dark:text-slate-400" />
              <span className="font-extrabold text-base tracking-tight">Order #{currentOrder.invoiceNumber.split("-")[1] || currentOrder.id}</span>
            </div>
            
            <div className="flex items-center gap-2">
              {/* Clear Cart outline trash icon button */}
              {currentOrder.cart.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    showConfirm(
                      "Clear Shopping Cart",
                      "Are you sure you want to clear the shopping cart?",
                      () => {
                        updateCurrentOrder((o) => ({ ...o, cart: [] }));
                        setIsAmountTenderedManuallySet(false);
                        setAmountTendered(0);
                      }
                    );
                  }}
                  className="p-1.5 border border-red-200 hover:bg-red-500/10 text-red-500 rounded-lg cursor-pointer transition-all"
                  title="Clear Shopping Cart (Esc)"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>

          {/* Cart item listing container */}
          <div className="flex-1 overflow-y-auto pr-1 space-y-2 mb-3 min-h-0">
            {filteredCart.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-6 select-none">
                <div className="w-16 h-16 rounded-full bg-[#2563EB]/10 dark:bg-[#2563EB]/20 flex items-center justify-center mb-3">
                  <ShoppingCart className="h-7 w-7 stroke-1 text-[#2563EB] dark:text-purple-400" />
                </div>
                <p className="text-sm font-extrabold text-slate-800 dark:text-slate-200">
                  {cartSearchQuery ? "No matching items." : "Cart is empty."}
                </p>
                <p className="text-[11px] text-slate-455 dark:text-slate-500 mt-1 max-w-[200px] leading-relaxed">
                  {cartSearchQuery ? "Refine your search query or clear it." : "Select products to begin billing."}
                </p>
              </div>
            ) : (
              filteredCart.map((item) => {
                // Calculate dynamic soft colors for fallback avatar initials based on character code
                const initialChar = item.name.trim().charAt(0) || "P";
                const hue = (initialChar.charCodeAt(0) * 17) % 360;
                const initialsBg = `hsla(${hue}, 70%, 45%, 0.12)`;
                const initialsText = `hsl(${hue}, 75%, 40%)`;

                return (
                  <div
                    key={item.id}
                    className="group bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800/80 rounded-2xl p-4 hover:shadow-md transition-all duration-200 relative overflow-hidden"
                  >
                    <div className="flex gap-3 items-start">
                      {/* Product Image Thumbnail */}
                      <div className="w-12 h-12 rounded-xl overflow-hidden bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 flex items-center justify-center shrink-0 shadow-inner">
                        {item.image ? (
                          <img src={item.image} alt={item.name} className="w-[90%] h-[90%] object-contain transition-transform group-hover:scale-105" />
                        ) : (
                          <div
                            className="w-full h-full flex items-center justify-center text-xs font-black select-none tracking-wider"
                            style={{ backgroundColor: initialsBg, color: initialsText }}
                          >
                            {item.name.slice(0, 2).toUpperCase()}
                          </div>
                        )}
                      </div>

                      {/* Name & Formula Calculations */}
                      <div className="flex-1 min-w-0 text-left">
                        <div className="flex justify-between items-start gap-1">
                          <h4 className="font-extrabold text-slate-800 dark:text-slate-200 text-xs tracking-tight truncate leading-snug">
                            {item.name}
                          </h4>
                          
                          {/* Outline red delete button next to name */}
                          <button
                            type="button"
                            onClick={() => updateCartQty(item.id, 0)}
                            className="text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/20 p-1 rounded transition-all shrink-0"
                            title="Delete Item"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>

                        {/* Pricing formula calculation layout: green total matching mockup */}
                        <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-1.5">
                          <span>{currencySymbol}{(item.price - item.discount).toFixed(2)} &times; {item.quantity}</span>
                          <span className="text-[#10b981] font-bold">{currencySymbol}{((item.price - item.discount) * item.quantity).toFixed(2)}</span>
                        </div>

                        {/* Batch / Expiry / Serial info below the calculation line */}
                        {(item.batchNumber || item.expiryDate || item.serialNumber) && (
                          <div className="flex flex-wrap gap-1 mt-1 text-[8px] font-bold text-slate-400">
                            {item.batchNumber && <span>B: {item.batchNumber}</span>}
                            {item.expiryDate && <span>Exp: {item.expiryDate}</span>}
                            {item.serialNumber && <span>S/N: {item.serialNumber}</span>}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Stepper & Add Notes control row */}
                    <div className="flex items-center justify-between border-t border-slate-100 dark:border-slate-800/80 pt-3 mt-3">
                      {/* Compact gray pill quantity controls */}
                      <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg border border-slate-200/50 dark:border-slate-700/50">
                        <button
                          type="button"
                          onClick={() => updateCartQty(item.id, item.quantity - 1)}
                          className="w-5 h-5 flex items-center justify-center rounded-md bg-white dark:bg-slate-900 text-slate-550 hover:text-slate-800 dark:hover:text-slate-100 shadow-xs cursor-pointer active:scale-95 transition-all font-black text-xs"
                        >
                          <Minus className="h-2.5 w-2.5 stroke-[2.5px]" />
                        </button>
                        <span className="font-extrabold text-xs min-w-[16px] text-center text-slate-800 dark:text-slate-250 select-none">
                          {item.quantity}
                        </span>
                        <button
                          type="button"
                          onClick={() => updateCartQty(item.id, item.quantity + 1)}
                          className="w-5 h-5 flex items-center justify-center rounded-md bg-[#2563EB] hover:bg-[#1D4ED8] text-white shadow-xs cursor-pointer active:scale-95 transition-all font-black text-xs"
                        >
                          <Plus className="h-2.5 w-2.5 stroke-[2.5px]" />
                        </button>
                      </div>

                      {/* Actions Button Bar: only note and discount */}
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            showPrompt(
                              "Item Comments",
                              `Add comments for ${item.name}:`,
                              item.notes || "",
                              (val) => updateItemNotes(item.id, val)
                            );
                          }}
                          className={`flex items-center gap-1.5 px-2.5 py-1 border rounded-lg text-[10px] font-bold cursor-pointer transition-all ${
                            item.notes
                              ? "bg-[#2563EB]/10 border-transparent text-[#2563EB] dark:text-purple-400"
                              : "border-slate-200 dark:border-slate-800 bg-white hover:bg-slate-50 dark:bg-slate-900 dark:hover:bg-slate-800 text-slate-500"
                          }`}
                          title="Add Item Comments"
                        >
                          <FileText className="h-3.5 w-3.5" />
                          <span>Add Note</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            showPrompt(
                              "Item Discount",
                              `Enter flat discount per unit (${currencySymbol}) for ${item.name}:`,
                              item.discount.toString(),
                              (val) => updateItemDiscount(item.id, parseFloat(val) || 0)
                            );
                          }}
                          className={`flex items-center gap-1.5 px-2.5 py-1 border rounded-lg text-[10px] font-bold cursor-pointer transition-all ${
                            item.discount > 0
                              ? "bg-emerald-50 dark:bg-emerald-500/10 border-emerald-250 dark:border-emerald-500/30 text-emerald-600"
                              : "border-slate-200 dark:border-slate-800 bg-white hover:bg-slate-50 dark:bg-slate-900 dark:hover:bg-slate-800 text-slate-500"
                          }`}
                          title="Item Discount"
                        >
                          <Percent className="h-3.5 w-3.5" />
                          <span>Discount</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Pricing calculations details */}
          {currentOrder.cart.length > 0 && (
            <div className="border-t border-slate-200 dark:border-slate-850 pt-3 mt-auto space-y-3 shrink-0">
              
              {/* Labeled breakdowns layout exactly matching mockup design */}
              <div className="space-y-2.5 text-xs text-slate-700 dark:text-slate-200 font-semibold bg-transparent px-1 py-2 border-t border-b border-slate-100 dark:border-slate-800/80 my-3">
                <div className="flex justify-between items-center text-slate-500 dark:text-slate-400 font-medium">
                  <span>Sub Total :</span>
                  <span className="text-slate-800 dark:text-slate-100 font-bold">{currencySymbol}{grossSubtotal.toFixed(2)}</span>
                </div>

                <div className="flex justify-between items-center text-slate-500 dark:text-slate-400 font-medium">
                  <div className="flex items-center gap-1">
                    <span>Discount :</span>
                    <button
                      onClick={() => {
                        setDiscountModalAmount(currentOrder.overallDiscount.toString());
                        setDiscountModalType(currentOrder.discountType || "FLAT");
                        setDiscountModalOpen(true);
                      }}
                      className="hover:text-[#2563EB] transition-all cursor-pointer p-0.5"
                      title="Edit Extra Discount"
                    >
                      <Edit2 className="h-3.5 w-3.5 text-slate-400" />
                    </button>
                  </div>
                  <span className="text-slate-800 dark:text-slate-100 font-bold">
                    {currencySymbol}{(rawOverallDiscount + discountSales + couponDiscount).toFixed(2)}
                  </span>
                </div>

                <div className="flex justify-between items-center text-slate-500 dark:text-slate-400 font-medium">
                  <span>Tax ({vatPercentage}%) :</span>
                  <span className="text-slate-800 dark:text-slate-100 font-bold">{currencySymbol}{tax.toFixed(2)}</span>
                </div>

                <div className="flex justify-between items-center pt-2.5 border-t border-slate-150 dark:border-slate-800/80 my-1">
                  <span className="text-slate-800 dark:text-slate-100 font-extrabold text-sm">Total :</span>
                  <span className="text-[#10b981] dark:text-[#10b981] font-black text-xl tracking-tight">
                    {currencySymbol}{grandTotal.toFixed(2)}
                  </span>
                </div>
              </div>

              {/* Submit Error alert box (if any) */}
              {submitError && (
                <div className="bg-red-50 dark:bg-red-950/40 text-red-655 dark:text-red-400 text-[11px] font-bold p-3 rounded-2xl border border-red-200 dark:border-red-900/50 my-1 animate-in fade-in duration-200 flex justify-between items-start gap-2 text-left">
                  <span>{submitError}</span>
                  <button
                    type="button"
                    onClick={() => setSubmitError("")}
                    className="text-red-405 hover:text-red-650 font-black text-xs cursor-pointer shrink-0"
                  >
                    &times;
                  </button>
                </div>
              )}

              {/* Bottom checkout action buttons matching mockup */}
              <div className="space-y-2 shrink-0 font-bold text-xs select-none">
                {/* Row 1: Save & Print (F10) + Draft */}
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleCheckoutSubmit}
                    className="flex-1 py-3 bg-[#0f172a] dark:bg-slate-900 hover:bg-slate-800 dark:hover:bg-slate-800 text-white rounded-xl shadow-xs cursor-pointer flex items-center justify-center gap-1.5 transition-all duration-150 active:scale-95 text-center font-extrabold"
                  >
                    Save & Print (F10)
                  </button>
                  <button
                    type="button"
                    onClick={() => setHoldModalOpen(true)}
                    className="w-1/4 py-3 border border-slate-200 dark:border-slate-850 bg-white dark:bg-slate-950 hover:bg-slate-55 dark:hover:bg-slate-900 text-slate-700 dark:text-slate-200 rounded-xl cursor-pointer flex items-center justify-center gap-1.5 transition-all duration-150 active:scale-95"
                    title="Suspend Current Cart (F3)"
                  >
                    <FileText className="h-4 w-4 text-slate-500" />
                    <span>Draft</span>
                  </button>
                </div>

                {/* Row 2: Pay & Print (F9) + Pay (F8) */}
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleCheckoutSubmit}
                    className="flex-1 py-3 bg-[#10b981] hover:bg-[#059669] text-white rounded-xl shadow-xs cursor-pointer flex items-center justify-center gap-1.5 transition-all duration-150 active:scale-95 text-center font-extrabold"
                  >
                    Pay & Print (F9)
                  </button>
                  <button
                    type="button"
                    onClick={openCheckout}
                    className="flex-1 py-3 bg-[#f59e0b] hover:bg-[#d97706] text-white rounded-xl shadow-xs cursor-pointer flex items-center justify-center gap-1.5 transition-all duration-150 active:scale-95 text-center font-extrabold"
                    title="Open checkout payment details (F8 / Enter)"
                  >
                    Pay (F8)
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 3. Hold/Suspend Bill Modal */}
      {holdModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 no-print animate-in fade-in duration-100">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 w-full max-w-sm space-y-4 shadow-2xl">
            <div>
              <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">Suspend Bill Transaction</h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Save the cart items in the local drafts queue to recall it later.
              </p>
            </div>
            <input
              type="text"
              placeholder="Enter customer reference name..."
              value={holdName}
              onChange={(e) => setHoldName(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 dark:border-slate-800 rounded-lg bg-slate-50 dark:bg-slate-950 text-xs focus:outline-none text-foreground font-semibold"
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setHoldModalOpen(false)}
                className="px-4 py-2 border border-slate-200 dark:border-slate-800 text-xs rounded-lg hover:bg-slate-100 font-bold"
              >
                Cancel
              </button>
              <button
                onClick={handleHoldBill}
                disabled={!holdName.trim()}
                className="px-4 py-2 bg-[#2563EB] text-white text-xs font-bold rounded-lg hover:bg-[#1D4ED8] disabled:opacity-50"
              >
                Hold Cart
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3.2. Recall Bill Draft List Modal */}
      {recallModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 no-print animate-in fade-in duration-100">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 w-full max-w-md space-y-4 shadow-2xl flex flex-col max-h-[80vh]">
            <div>
              <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">Recall Suspended Bills</h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Select a draft order transaction to load back into the POS active tab.
              </p>
            </div>
            
            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              {heldBills.length === 0 ? (
                <div className="py-6 text-center text-xs text-slate-400">
                  No draft bills suspended.
                </div>
              ) : (
                heldBills.map((b) => (
                  <div
                    key={b.id}
                    onClick={() => handleRecallBill(b)}
                    className="flex justify-between items-center p-3 border border-slate-200 dark:border-slate-800 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer transition-colors"
                  >
                    <div className="text-left">
                      <span className="text-xs font-bold text-slate-800 dark:text-slate-250 block">
                        {b.name}
                      </span>
                      <span className="text-[10px] text-slate-400">
                        {new Date(b.createdAt).toLocaleTimeString()} ({b.items.length} items)
                      </span>
                    </div>
                    <span className="text-xs font-black text-[#2563EB]">
                      ${b.items.reduce((sum, i) => sum + i.price * i.quantity, 0).toFixed(2)}
                    </span>
                  </div>
                ))
              )}
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                onClick={() => setRecallModalOpen(false)}
                className="px-4 py-2 border border-slate-200 dark:border-slate-800 text-xs rounded-lg hover:bg-slate-100 font-bold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3.5. Quick Customer Creation Modal */}
      {custModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 no-print animate-in fade-in duration-100">
          <form
            onSubmit={handleQuickCustomerSubmit}
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 w-full max-w-sm space-y-4 shadow-xl"
          >
            <div>
              <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">Quick Customer Registration</h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Register a new customer directly to bind with this billing transaction.
              </p>
            </div>

            <div className="space-y-3">
              <div className="space-y-1">
                <label className="block text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                  Full Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. John Doe"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full px-3 py-1.5 border border-slate-200 dark:border-slate-800 rounded-lg bg-slate-50 dark:bg-slate-950 text-xs font-semibold focus:ring-1 focus:ring-primary outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                  Phone Number
                </label>
                <input
                  type="text"
                  placeholder="e.g. 9876543210"
                  value={newPhone}
                  onChange={(e) => setNewPhone(e.target.value)}
                  className="w-full px-3 py-1.5 border border-slate-200 dark:border-slate-800 rounded-lg bg-slate-50 dark:bg-slate-950 text-xs font-semibold focus:ring-1 focus:ring-primary outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                  Email Address
                </label>
                <input
                  type="email"
                  placeholder="e.g. john@example.com"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  className="w-full px-3 py-1.5 border border-slate-200 dark:border-slate-800 rounded-lg bg-slate-50 dark:bg-slate-950 text-xs font-semibold focus:ring-1 focus:ring-primary outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                  Address
                </label>
                <input
                  type="text"
                  placeholder="e.g. Kathmandu, Nepal"
                  value={newAddress}
                  onChange={(e) => setNewAddress(e.target.value)}
                  className="w-full px-3 py-1.5 border border-slate-200 dark:border-slate-800 rounded-lg bg-slate-50 dark:bg-slate-950 text-xs font-semibold focus:ring-1 focus:ring-primary outline-none"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t border-slate-100 dark:border-slate-800 pt-3">
              <button
                type="button"
                onClick={() => {
                  setCustModalOpen(false);
                  setNewName("");
                  setNewPhone("");
                  setNewAddress("");
                  setNewEmail("");
                }}
                className="px-4 py-2 border border-slate-200 dark:border-slate-800 text-xs rounded-lg hover:bg-slate-100 font-bold"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2 bg-[#2563EB] text-white text-xs font-bold rounded-lg hover:bg-[#1D4ED8] shadow-md shadow-[#2563EB]/20"
              >
                Register Customer
              </button>
            </div>
          </form>
        </div>
      )}

      {/* 4.5. Weight Entry Modal for Fresh Produce */}
      {weightModalOpen && weightModalProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 no-print animate-in fade-in duration-100">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 w-full max-w-sm space-y-4">
            <div>
              <span className="text-[9px] bg-primary/20 text-[#2563EB] border border-primary/30 font-bold px-2 py-0.5 rounded-full uppercase">
                Weight Scale Input
              </span>
              <h3 className="text-sm font-black mt-2 text-slate-800 dark:text-slate-100">
                Scale Weight: {weightModalProduct.name}
              </h3>
              <p className="text-[10px] text-slate-400 mt-0.5">
                Unit Price: {currencySymbol}{weightModalProduct.sellingPrice.toFixed(2)} / {weightModalProduct.unit?.name || "Kg"}
              </p>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                  Enter Weight ({weightModalProduct.unit?.name || "Kg"})
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.001"
                    placeholder="0.000"
                    value={weightInputValue}
                    onChange={(e) => setWeightInputValue(e.target.value)}
                    className="w-full pl-3 pr-10 py-2.5 border border-slate-200 dark:border-slate-800 rounded-lg bg-slate-50 dark:bg-slate-950 text-sm font-bold focus:outline-none focus:ring-1 focus:ring-[#2563EB] text-center"
                    autoFocus
                  />
                  <span className="absolute right-3 top-3.5 text-xs text-slate-400 font-bold">
                    {weightModalProduct.unit?.name || "Kg"}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                {[0.25, 0.5, 1.0, 1.5, 2.0, 5.0].map((val) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => handleWeightSubmit(val)}
                    className="py-1.5 border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-bold hover:bg-slate-50 transition-colors bg-white dark:bg-slate-950"
                  >
                    {val.toFixed(2)} Kg
                  </button>
                ))}
              </div>

              {Number(weightInputValue) > 0 && (
                <div className="bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-2.5 rounded-lg flex justify-between items-center text-xs">
                  <span className="text-slate-450 font-medium">Calculated Cost:</span>
                  <span className="font-extrabold text-slate-800 dark:text-slate-100">
                    {currencySymbol}{(Number(weightInputValue) * weightModalProduct.sellingPrice).toFixed(2)}
                  </span>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 border-t border-slate-100 dark:border-slate-800 pt-3">
              <button
                type="button"
                onClick={() => {
                  setWeightModalOpen(false);
                  setWeightModalProduct(null);
                }}
                className="px-4 py-2 border border-slate-200 dark:border-slate-800 text-xs rounded-lg hover:bg-slate-100 font-bold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleWeightSubmit(Number(weightInputValue))}
                disabled={!weightInputValue || isNaN(Number(weightInputValue)) || Number(weightInputValue) <= 0}
                className="px-5 py-2 bg-[#2563EB] text-white text-xs font-bold rounded-lg hover:bg-[#1D4ED8] shadow-lg disabled:opacity-50"
              >
                Add Weight
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 4.7. Product Details & Expiry / Alternative Modal */}
      {isDetailsOpen && detailsProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 no-print animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 w-full max-w-md shadow-2xl relative flex flex-col gap-4 animate-in zoom-in-95 duration-200">
            <button
              onClick={() => {
                setIsDetailsOpen(false);
                setDetailsProduct(null);
              }}
              className="absolute top-4 right-4 p-1.5 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-800 transition-colors"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="space-y-1">
              <span className="text-[9px] bg-[#2563EB]/10 text-[#2563EB] border border-[#2563EB]/20 font-bold px-2 py-0.5 rounded-full uppercase tracking-wider inline-block">
                Alternative Helpers
              </span>
              <h3 className="text-base font-black text-slate-800 dark:text-slate-100 mt-1">
                {detailsProduct.name}
              </h3>
              <p className="text-[10px] text-slate-400">
                SKU: {detailsProduct.sku} | Price: {currencySymbol}{detailsProduct.sellingPrice.toFixed(2)}
              </p>
            </div>

            {/* Alternative Products List recommendation */}
            <div className="space-y-2 border-t pt-3">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                Recommended Substitutes (Same Category)
              </span>

              <div className="max-h-[160px] overflow-y-auto space-y-2 pr-1">
                {products
                  .filter((p) => p.categoryId === detailsProduct.categoryId && p.id !== detailsProduct.id)
                  .slice(0, 4)
                  .map((alt) => (
                    <div
                      key={alt.id}
                      onClick={() => {
                        addToCart(alt);
                        setIsDetailsOpen(false);
                      }}
                      className="flex justify-between items-center p-2 border border-slate-200 dark:border-slate-800 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer transition-colors text-xs"
                    >
                      <span className="font-semibold text-slate-700 dark:text-slate-350">{alt.name}</span>
                      <span className="font-bold text-[#2563EB]">{currencySymbol}{alt.sellingPrice.toFixed(2)}</span>
                    </div>
                  ))}
                {products.filter((p) => p.categoryId === detailsProduct.categoryId && p.id !== detailsProduct.id).length === 0 && (
                  <div className="text-[10px] text-slate-400 py-2">
                    No equivalent substitutes in this category.
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t pt-3 mt-2">
              <button
                onClick={() => {
                  setIsDetailsOpen(false);
                  setDetailsProduct(null);
                }}
                className="px-4 py-2 border border-slate-200 dark:border-slate-800 text-xs rounded-lg hover:bg-slate-100 font-bold"
              >
                Close Helpers
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 4.9. Admin Override passcode Modal for Large discounts */}
      {adminPasscodeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 no-print animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 w-full max-w-sm space-y-4 shadow-2xl">
            <div className="text-center space-y-1">
              <ShieldCheck className="h-10 w-10 text-red-500 mx-auto" />
              <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">
                Large Discount Approval Required
              </h3>
              <p className="text-[10px] text-slate-400">
                You are offering a discount &gt; 25% of the total cart subtotal. Please enter the Admin pin override.
              </p>
            </div>

            <div className="space-y-1">
              <input
                type="password"
                placeholder="Enter 4-Digit Passcode (try: 1234)"
                value={passcodeInput}
                onChange={(e) => setPasscodeInput(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 dark:border-slate-800 rounded-lg text-center bg-slate-50 dark:bg-slate-950 text-sm font-black focus:outline-none focus:ring-1 focus:ring-red-500"
                autoFocus
              />
            </div>

            <div className="flex justify-end gap-2 border-t pt-3">
              <button
                onClick={() => setAdminPasscodeModal(false)}
                className="px-4 py-2 border border-slate-200 dark:border-slate-800 text-xs rounded-lg hover:bg-slate-100 font-bold"
              >
                Reject Discount
              </button>
              <button
                onClick={verifyAdminOverride}
                className="px-5 py-2 bg-red-500 text-white text-xs font-bold rounded-lg hover:bg-red-650"
              >
                Verify Override
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 5. Print Layout Structure (Hidden in Screen View) */}
      {lastInvoice && (
        <div className="hidden print-only max-w-[80mm] mx-auto text-black p-4 text-xs font-mono">
          <div className="text-center space-y-1 border-b border-dashed border-black pb-4 mb-4">
            <h2 className="text-base font-black">DynaPOS Store Billing</h2>
            <p className="text-[10px]">Receipt #: {lastInvoice.invoiceNumber || "INV-9022"}</p>
            <p className="text-[10px]">Date: {new Date().toLocaleString()}</p>
            {lastInvoice.tableNumber && <p className="text-[10px]">Restaurant Table: {lastInvoice.tableNumber}</p>}
            <p className="text-[10px]">Cashier: {lastInvoice.cashierName}</p>
          </div>

          <div className="space-y-2 border-b border-dashed border-black pb-4 mb-4">
            <div className="flex justify-between font-bold text-[9px] uppercase">
              <span className="w-1/2">Item Description</span>
              <span className="w-1/6 text-center">Qty</span>
              <span className="w-1/3 text-right">Total</span>
            </div>
            {lastInvoice.invoiceItems.map((item: any) => (
              <div key={item.id} className="flex justify-between text-[9px]">
                <span className="w-1/2 truncate">{item.name}</span>
                <span className="w-1/6 text-center">{item.quantity}</span>
                <span className="w-1/3 text-right">{currencySymbol}{((item.price - item.discount) * item.quantity).toFixed(2)}</span>
              </div>
            ))}
          </div>

          <div className="space-y-1 text-[9px]">
            <div className="flex justify-between">
              <span>Subtotal:</span>
              <span>{currencySymbol}{lastInvoice.subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span>Tax ({taxName} {vatPercentage}%):</span>
              <span>{currencySymbol}{lastInvoice.tax.toFixed(2)}</span>
            </div>
            <div className="flex justify-between font-bold text-xs pt-1 border-t border-dotted border-black">
              <span>GRAND TOTAL:</span>
              <span>{currencySymbol}{lastInvoice.total.toFixed(2)}</span>
            </div>
          </div>

          <div className="text-center space-y-1 mt-6 border-t pt-4">
            <p className="text-[9px] font-bold">Thank you for choosing DynaPOS!</p>
            <button
              onClick={() => setLastInvoice(null)}
              className="no-print border border-black px-3 py-1 rounded text-[10px] mt-4 hover:bg-gray-100"
            >
              Done printing
            </button>
          </div>
        </div>
      )}
      {scanToast && (
        <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-[110] px-4 py-2.5 rounded-xl text-xs font-bold shadow-lg select-none border border-border/80 transition-all animate-bounce ${
          scanToast.type === "success"
            ? "bg-emerald-500 text-white border-emerald-450"
            : "bg-rose-500 text-white border-rose-450"
        }`}>
          {scanToast.message}
        </div>
      )}
      {/* 4.0. Complete Payment Checkout Modal */}
      {payModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 no-print animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 w-full max-w-md shadow-2xl flex flex-col gap-4 animate-in zoom-in-95 duration-200">
            
            {/* Modal Header */}
            <div className="flex justify-between items-start border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <h3 className="text-base font-black text-slate-800 dark:text-slate-100">Complete Payment</h3>
                <p className="text-xs text-slate-400 mt-0.5">Choose payment split and method to finalize order.</p>
              </div>
              <button
                onClick={() => setPayModalOpen(false)}
                disabled={isCheckingOut}
                className="p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-800 dark:hover:text-white transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <X className="h-4.5 w-4.5" />
              </button>
            </div>

            <fieldset disabled={isCheckingOut} className="space-y-4 flex flex-col h-full border-0 p-0 m-0">
            {/* Total Payable Banner */}
            <div className="bg-[#F3F4F6] dark:bg-slate-950 border border-slate-200/50 dark:border-slate-800 rounded-2xl p-4 flex justify-between items-center select-none">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Payable</span>
              <span className="text-[#2563EB] dark:text-[#7f74f7] font-black text-2xl">
                {currencySymbol}{grandTotal.toFixed(2)}
              </span>
            </div>

            {/* Split Type Selector */}
            <div className="space-y-1">
              <label className="block text-[9px] uppercase font-black text-slate-400 tracking-wider">
                Payment Splits
              </label>
              <div className="flex bg-[#eaedf1] dark:bg-slate-950 p-1 rounded-xl border border-slate-200/50 dark:border-slate-800/80">
                {[
                  { value: "SINGLE", label: "Single Payment" },
                  { value: "METHOD", label: "Split Method" },
                  { value: "PERSONS", label: "Split Persons" }
                ].map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => {
                      setSplitType(opt.value as any);
                      if (opt.value === "PERSONS") {
                        const share = parseFloat((grandTotal / personsCount).toFixed(2));
                        const arr = Array(personsCount).fill(share);
                        const diff = parseFloat((grandTotal - share * personsCount).toFixed(2));
                        if (diff !== 0 && arr.length > 0) {
                          arr[arr.length - 1] = parseFloat((arr[arr.length - 1] + diff).toFixed(2));
                        }
                        setPersonsPayments(arr);
                      }
                    }}
                    className={`flex-1 py-1.5 rounded-lg text-[10px] font-black transition-all cursor-pointer text-center ${
                      splitType === opt.value
                        ? "bg-[#2563EB] text-white shadow-sm"
                        : "text-slate-500 hover:text-slate-800 dark:text-slate-405"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Dynamic Forms according to Split Type */}
            {splitType === "SINGLE" && (
              <div className="space-y-3.5">
                {/* Single Payment Method Tabs */}
                <div className="space-y-1">
                  <label className="block text-[9px] uppercase font-black text-slate-400 tracking-wider">
                    Payment Method
                  </label>
                  <div className="flex bg-[#eaedf1] dark:bg-slate-950 p-1 rounded-xl border border-slate-200/50 dark:border-slate-800/80">
                    {["CASH", "CARD", "QR", "BANK"].map((method) => (
                      <button
                        key={method}
                        type="button"
                        onClick={() => setSinglePaymentMethod(method)}
                        className={`flex-1 py-1.5 rounded-lg text-[10px] font-black transition-all cursor-pointer text-center ${
                          singlePaymentMethod === method
                            ? "bg-[#2563EB] text-white shadow-sm"
                            : "text-slate-500 hover:text-slate-800 dark:text-slate-405"
                        }`}
                      >
                        {method}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Cash Method Inputs */}
                {singlePaymentMethod === "CASH" && (
                  <div className="space-y-3 p-3 bg-[#F9FAFB] dark:bg-slate-950/40 border border-slate-200/60 dark:border-slate-800 rounded-2xl animate-in slide-in-from-top-1 duration-150">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-slate-500">Cash Rendered:</span>
                      <div className="relative">
                        <span className="absolute left-2.5 top-1.5 text-xs text-slate-400 font-bold">{currencySymbol}</span>
                        <input
                          type="number"
                          value={amountTendered || ""}
                          onChange={(e) => {
                            setAmountTendered(Math.max(0, parseFloat(e.target.value) || 0));
                            setIsAmountTenderedManuallySet(true);
                          }}
                          className="w-28 pl-6 pr-2 py-1 border border-slate-200 dark:border-slate-800 rounded-lg text-right text-xs bg-white dark:bg-slate-900 text-slate-800 dark:text-white font-extrabold focus:outline-none focus:ring-1 focus:ring-[#2563EB]"
                        />
                      </div>
                    </div>
                    <div className="flex justify-between items-center text-xs font-bold border-t border-slate-100 dark:border-slate-800/60 pt-2">
                      <span className="text-slate-500">Change Return:</span>
                      <span className="text-emerald-600 dark:text-emerald-400 font-black text-sm">
                        {currencySymbol}{Math.max(0, amountTendered - grandTotal).toFixed(2)}
                      </span>
                    </div>
                  </div>
                )}

                {/* Dynamic QR Code Generator */}
                {singlePaymentMethod === "QR" && (
                  <div className="flex flex-col items-center justify-center p-5 bg-[#F9FAFB] dark:bg-slate-950/40 border border-slate-200/60 dark:border-slate-800 rounded-3xl animate-in fade-in duration-250 text-center gap-4">
                    <span className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                      Dynamic QR Scanner
                    </span>
                    
                    {/* QR Code Container with Premium Focus Corners and Scanning Line */}
                    <div className="relative p-3 bg-white rounded-2xl border border-slate-200 dark:border-transparent dark:bg-white shadow-md flex items-center justify-center w-[180px] h-[180px] group transition-all duration-300">
                      {/* Scanner Corners */}
                      <div className="qr-scanner-corner qr-scanner-corner-tl" />
                      <div className="qr-scanner-corner qr-scanner-corner-tr" />
                      <div className="qr-scanner-corner qr-scanner-corner-bl" />
                      <div className="qr-scanner-corner qr-scanner-corner-br" />

                      {/* Moving laser scan line */}
                      <div className="qr-scanner-line" />

                      <img
                        src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(
                          JSON.stringify({
                            name: "Ramila Gharti",
                            eSewa_id: "9845478587",
                            amount: grandTotal,
                            amt: grandTotal,
                            total_amount: grandTotal,
                          })
                        )}`}
                        alt="Dynamic QR Code"
                        className="w-[145px] h-[145px] object-contain select-none transition-transform duration-300 group-hover:scale-102"
                      />
                    </div>
                    
                    <div className="space-y-1.5 px-2">
                      <p className="text-xs font-black text-slate-800 dark:text-slate-100 flex items-center justify-center gap-1.5">
                        Scan to Pay: <span className="text-[#2563EB] dark:text-[#7f74f7] text-sm font-black">{currencySymbol}{grandTotal.toFixed(2)}</span>
                      </p>
                      <p className="text-[10px] text-slate-450 dark:text-slate-400 leading-relaxed max-w-[240px]">
                        Scan the dynamic QR code using any digital wallet, Fonepay, or UPI mobile banking app to complete transaction.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {splitType === "METHOD" && (
              <div className="space-y-3.5 p-3.5 bg-[#F9FAFB] dark:bg-slate-950/40 border border-slate-200/60 dark:border-slate-800 rounded-2xl animate-in fade-in duration-200">
                <div className="grid grid-cols-5 gap-2 items-center text-[9px] font-black text-slate-400 uppercase text-center border-b pb-1.5 border-slate-200 dark:border-slate-800">
                  <span>Cash</span>
                  <span>Card</span>
                  <span>QR</span>
                  <span>Bank</span>
                  <span>Credit</span>
                </div>
                <div className="grid grid-cols-5 gap-1.5">
                  {["cash", "card", "qr", "bank", "credit"].map((method) => (
                    <input
                      key={method}
                      type="number"
                      placeholder="0"
                      value={currentOrder.splitPayments[method as keyof typeof currentOrder.splitPayments] || ""}
                      onChange={(e) =>
                        updateCurrentOrder((o) => ({
                          ...o,
                          splitPayments: {
                            ...o.splitPayments,
                            [method]: Math.max(0, parseFloat(e.target.value) || 0),
                          },
                        }))
                      }
                      className="px-1 py-1 text-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded text-xs font-bold focus:ring-1 focus:ring-[#2563EB] outline-none text-foreground"
                    />
                  ))}
                </div>

                <div className="flex justify-between items-center text-[10px] font-bold border-t border-slate-200 dark:border-slate-800 pt-2 mt-2">
                  <span className="text-slate-455 uppercase">Tendered vs Total:</span>
                  <span className="text-slate-700 dark:text-slate-350">{currencySymbol}{totalPaidInSplits.toFixed(2)} / {currencySymbol}{grandTotal.toFixed(2)}</span>
                </div>

                <div className="flex justify-between items-center text-[10px] font-bold">
                  <span className="text-slate-455 uppercase">Status:</span>
                  <span className={`px-2 py-0.5 rounded text-[9px] font-black ${remainingOrChange >= 0 ? "bg-emerald-500/10 text-emerald-600" : "bg-red-500/10 text-red-500"}`}>
                    {remainingOrChange >= 0
                      ? `✅ Balanced (Change: ${currencySymbol}${remainingOrChange.toFixed(2)})`
                      : `⚠️ Deficit ${currencySymbol}${Math.abs(remainingOrChange).toFixed(2)}`}
                  </span>
                </div>
              </div>
            )}

            {splitType === "PERSONS" && (
              <div className="space-y-3.5 p-3.5 bg-[#F9FAFB] dark:bg-slate-950/40 border border-slate-200/60 dark:border-slate-800 rounded-2xl animate-in fade-in duration-200">
                <div className="flex items-center justify-between bg-white dark:bg-slate-900 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-slate-500">Persons:</span>
                    <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-950 px-2 py-0.5 border border-slate-200 dark:border-slate-800 rounded-lg">
                      <button
                        type="button"
                        onClick={() => {
                          const newCount = Math.max(2, personsCount - 1);
                          setPersonsCount(newCount);
                          setPersonsPayments((prev) => {
                            const next = prev.slice(0, newCount);
                            while (next.length < newCount) next.push(0);
                            return next;
                          });
                        }}
                        className="p-0.5 text-slate-500 hover:text-slate-800 dark:hover:text-white cursor-pointer"
                      >
                        <Minus className="h-2.5 w-2.5 stroke-[3px]" />
                      </button>
                      <span className="font-extrabold text-xs min-w-[12px] text-center text-slate-800 dark:text-slate-200">
                        {personsCount}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          const newCount = Math.min(10, personsCount + 1);
                          setPersonsCount(newCount);
                          setPersonsPayments((prev) => {
                            const next = [...prev];
                            while (next.length < newCount) next.push(0);
                            return next;
                          });
                        }}
                        className="p-0.5 text-[#2563EB] hover:text-[#1D4ED8] cursor-pointer"
                      >
                        <Plus className="h-2.5 w-2.5 stroke-[3px]" />
                      </button>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      const share = parseFloat((grandTotal / personsCount).toFixed(2));
                      const newPayments = Array(personsCount).fill(share);
                      const diff = parseFloat((grandTotal - share * personsCount).toFixed(2));
                      if (diff !== 0 && newPayments.length > 0) {
                        newPayments[newPayments.length - 1] = parseFloat((newPayments[newPayments.length - 1] + diff).toFixed(2));
                      }
                      setPersonsPayments(newPayments);
                    }}
                    className="px-2 py-1 bg-[#2563EB]/10 hover:bg-[#2563EB]/15 text-[#2563EB] text-[9px] font-black rounded-lg cursor-pointer"
                  >
                    Auto-Split Evenly
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2 max-h-[140px] overflow-y-auto pr-1">
                  {Array.from({ length: personsCount }).map((_, index) => (
                    <div key={index} className="flex flex-col gap-0.5">
                      <label className="text-[9px] font-extrabold text-slate-400 uppercase">
                        Person {index + 1}
                      </label>
                      <div className="relative flex items-center">
                        <span className="absolute left-2.5 text-[10px] font-bold text-slate-400">{currencySymbol}</span>
                        <input
                          type="number"
                          step="0.01"
                          placeholder="0.00"
                          value={personsPayments[index] || ""}
                          onChange={(e) => {
                            const val = Math.max(0, parseFloat(e.target.value) || 0);
                            setPersonsPayments((prev) => {
                              const next = [...prev];
                              next[index] = val;
                              return next;
                            });
                          }}
                          className="w-full pl-5 pr-2 py-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-bold focus:ring-1 focus:ring-[#2563EB] outline-none text-foreground"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Popup Alert Modal for Checkout Errors */}
            {submitError && (
              <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 animate-in fade-in duration-200">
                <div className="bg-white dark:bg-slate-900 border-2 border-red-500/30 rounded-3xl p-6 w-full max-w-sm shadow-2xl flex flex-col items-center text-center gap-4 animate-in zoom-in-95 duration-200">
                  <div className="w-12 h-12 rounded-2xl bg-red-500/10 dark:bg-red-500/20 flex items-center justify-center text-red-600 dark:text-red-400 shrink-0">
                    <AlertTriangle className="h-6 w-6 stroke-[2.5]" />
                  </div>
                  <div className="space-y-1.5">
                    <h4 className="text-base font-black text-slate-800 dark:text-slate-100">Checkout Notice</h4>
                    <p className="text-xs text-slate-600 dark:text-slate-350 leading-relaxed font-semibold">
                      {submitError}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSubmitError("")}
                    className="w-full py-2.5 bg-red-600 hover:bg-red-700 text-white font-extrabold text-xs rounded-xl shadow-md transition-colors cursor-pointer"
                  >
                    OK, Got It
                  </button>
                </div>
              </div>
            )}

            {/* Modal Actions */}
            <div className="flex justify-end gap-2 border-t border-slate-100 dark:border-slate-800 pt-4 shrink-0">
              <button
                type="button"
                onClick={() => setPayModalOpen(false)}
                className="px-4 py-2 border border-slate-200 dark:border-slate-800 text-xs rounded-lg hover:bg-slate-100 dark:hover:bg-slate-850 font-bold cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCheckoutSubmit}
                disabled={isCheckingOut || (splitType === "METHOD" && remainingOrChange < 0)}
                className="px-5 py-2 bg-[#2563EB] hover:bg-[#1D4ED8] disabled:opacity-40 text-white text-xs font-bold rounded-lg shadow-md cursor-pointer disabled:cursor-not-allowed animate-in duration-150 flex items-center justify-center gap-1.5 min-w-[140px]"
              >
                {isCheckingOut ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Processing...
                  </>
                ) : (
                  "Complete Checkout"
                )}
              </button>
            </div>
            </fieldset>

          </div>
        </div>
      )}
      <BarcodeScannerModal
        isOpen={posScannerOpen}
        onClose={() => setPosScannerOpen(false)}
        onScan={handlePosBarcodeScan}
        title="POS Camera Barcode Scanner"
        continuous={true}
      />

      {/* Mobile Tab Switcher */}
      <div className="lg:hidden shrink-0 bg-white dark:bg-[#0a0f24] border-t border-slate-200 dark:border-slate-800 p-2 flex gap-2 shadow-[0_-4px_12px_rgba(0,0,0,0.05)] z-20">
        <button
          type="button"
          onClick={() => setActiveMobileTab("catalog")}
          className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
            activeMobileTab === "catalog"
              ? "bg-[#2563EB] text-white"
              : "bg-slate-50 dark:bg-slate-900/40 text-slate-600 dark:text-slate-400 border border-slate-200/60 dark:border-slate-800"
          }`}
        >
          <Grid className="h-4 w-4" />
          Catalog ({filteredProducts.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveMobileTab("cart")}
          className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 relative ${
            activeMobileTab === "cart"
              ? "bg-[#2563EB] text-white"
              : "bg-slate-50 dark:bg-slate-900/40 text-slate-600 dark:text-slate-400 border border-slate-200/60 dark:border-slate-800"
          }`}
        >
          <ShoppingCart className="h-4 w-4" />
          Active Cart
          {currentOrder.cart.length > 0 && (
            <span className="bg-red-500 text-white font-extrabold text-[9px] h-4.5 min-w-[18px] px-1 rounded-full flex items-center justify-center border border-white dark:border-[#0a0f24] shadow-xs">
              {currentOrder.cart.reduce((sum, item) => sum + item.quantity, 0)}
            </span>
          )}
        </button>
      </div>

      {/* Custom Alert/Confirm Popup Modal */}
      {alertModal.open && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 w-full max-w-sm shadow-2xl flex flex-col gap-4 animate-in zoom-in-95 duration-200">
            <div className="flex flex-col items-center text-center gap-3">
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${
                alertModal.type === "error"
                  ? "bg-red-500/10 text-red-650 dark:text-red-400"
                  : alertModal.type === "confirm"
                  ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                  : "bg-blue-500/10 text-blue-600 dark:text-blue-400"
              }`}>
                {alertModal.type === "error" ? (
                  <AlertTriangle className="h-6 w-6 stroke-[2.5]" />
                ) : alertModal.type === "confirm" ? (
                  <AlertTriangle className="h-6 w-6 stroke-[2.5]" />
                ) : (
                  <Info className="h-6 w-6 stroke-[2.5]" />
                )}
              </div>
              <div className="space-y-1.5">
                <h4 className="text-base font-black text-slate-850 dark:text-slate-100">{alertModal.title}</h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed font-semibold">
                  {alertModal.message}
                </p>
              </div>
            </div>

            {alertModal.type === "prompt" && (
              <div className="w-full">
                <input
                  type="text"
                  id="modal-prompt-input"
                  defaultValue={alertModal.defaultValue || ""}
                  className="w-full px-3 py-2.5 border border-slate-200 dark:border-slate-800 rounded-xl text-sm bg-background focus:outline-none focus:ring-2 focus:ring-blue-500/25 transition-all text-slate-800 dark:text-slate-100 font-bold"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      const val = (e.target as HTMLInputElement).value;
                      setAlertModal((prev) => ({ ...prev, open: false }));
                      if (alertModal.onPromptSubmit) alertModal.onPromptSubmit(val);
                    }
                  }}
                />
              </div>
            )}

            <div className="flex gap-2.5 mt-2">
              {alertModal.type === "prompt" ? (
                <>
                  <button
                    type="button"
                    onClick={() => setAlertModal((prev) => ({ ...prev, open: false }))}
                    className="flex-1 py-2.5 border border-slate-200 dark:border-slate-800 text-xs rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/80 font-bold transition-all cursor-pointer text-slate-700 dark:text-slate-350"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const inputEl = document.getElementById("modal-prompt-input") as HTMLInputElement;
                      const val = inputEl ? inputEl.value : "";
                      setAlertModal((prev) => ({ ...prev, open: false }));
                      if (alertModal.onPromptSubmit) alertModal.onPromptSubmit(val);
                    }}
                    className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs rounded-xl shadow-md transition-colors cursor-pointer"
                  >
                    Submit
                  </button>
                </>
              ) : alertModal.type === "confirm" ? (
                <>
                  <button
                    type="button"
                    onClick={() => setAlertModal((prev) => ({ ...prev, open: false }))}
                    className="flex-1 py-2.5 border border-slate-200 dark:border-slate-800 text-xs rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/80 font-bold transition-all cursor-pointer text-slate-700 dark:text-slate-350"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setAlertModal((prev) => ({ ...prev, open: false }));
                      if (alertModal.onConfirm) alertModal.onConfirm();
                    }}
                    className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs rounded-xl shadow-md transition-colors cursor-pointer"
                  >
                    Confirm
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => setAlertModal((prev) => ({ ...prev, open: false }))}
                  className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs rounded-xl shadow-md transition-colors cursor-pointer"
                >
                  OK
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Extra Invoice Discount Modal */}
      {discountModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 w-full max-w-sm shadow-2xl flex flex-col gap-4 animate-in zoom-in-95 duration-200">
            <div>
              <h4 className="text-base font-black text-slate-850 dark:text-slate-100">Extra Discount</h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed font-semibold">
                Configure the extra overall discount for the current sales ticket.
              </p>
            </div>

            <div className="space-y-3.5">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Discount Type</label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setDiscountModalType("FLAT")}
                    className={`flex-1 py-2 text-xs font-bold rounded-xl border transition-all cursor-pointer ${
                      discountModalType === "FLAT"
                        ? "bg-blue-600 text-white border-transparent shadow-xs"
                        : "border-slate-200 dark:border-slate-850 hover:bg-slate-50 text-slate-600 dark:text-slate-400"
                    }`}
                  >
                    Flat ({currencySymbol})
                  </button>
                  <button
                    type="button"
                    onClick={() => setDiscountModalType("PERCENTAGE")}
                    className={`flex-1 py-2 text-xs font-bold rounded-xl border transition-all cursor-pointer ${
                      discountModalType === "PERCENTAGE"
                        ? "bg-blue-600 text-white border-transparent shadow-xs"
                        : "border-slate-200 dark:border-slate-850 hover:bg-slate-50 text-slate-600 dark:text-slate-400"
                    }`}
                  >
                    Percentage (%)
                  </button>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Discount Value</label>
                <input
                  type="number"
                  step="any"
                  value={discountModalAmount}
                  onChange={(e) => setDiscountModalAmount(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-slate-200 dark:border-slate-800 rounded-xl text-sm bg-background focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all font-bold text-slate-800 dark:text-slate-100"
                  placeholder="Enter discount amount"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      handleDiscountConfig(parseFloat(discountModalAmount) || 0, discountModalType);
                      setDiscountModalOpen(false);
                    }
                  }}
                />
              </div>
            </div>

            <div className="flex gap-2.5 mt-2">
              <button
                type="button"
                onClick={() => setDiscountModalOpen(false)}
                className="flex-1 py-2.5 border border-slate-200 dark:border-slate-800 text-xs rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/80 font-bold transition-all cursor-pointer text-slate-700 dark:text-slate-350"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  handleDiscountConfig(parseFloat(discountModalAmount) || 0, discountModalType);
                  setDiscountModalOpen(false);
                }}
                className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs rounded-xl shadow-md transition-colors cursor-pointer"
              >
                Apply Discount
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
