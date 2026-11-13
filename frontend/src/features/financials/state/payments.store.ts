import { create } from "zustand";
import { PaymentRecord, PaymentType, PaymentMethod } from "../models/financials.types";
import { financialsRepository } from "../repositories/financials.repository";
import { apiClient } from "@/core/api/api-client";

interface PaymentsState {
  paymentType: PaymentType;
  payments: PaymentRecord[];
  branches: Array<{ id: string; name: string }>;
  customers: Array<{ id: string; name: string; phone?: string | null }>;
  suppliers: Array<{ id: string; name: string; phone?: string | null }>;
  isLoading: boolean;
  isSaving: boolean;
  error: string | null;

  // Filters
  search: string;
  methodFilter: string;
  branchFilter: string;

  // Modals & Inspection Targets
  isRecordModalOpen: boolean;
  reversingPayment: PaymentRecord | null;
  selectedPaymentForReceipt: PaymentRecord | null;

  // Actions
  setPaymentType: (type: PaymentType) => void;
  setSearch: (q: string) => void;
  setMethodFilter: (method: string) => void;
  setBranchFilter: (bId: string) => void;

  openRecordModal: () => void;
  closeRecordModal: () => void;
  setReversingPayment: (payment: PaymentRecord | null) => void;
  setSelectedPaymentForReceipt: (payment: PaymentRecord | null) => void;

  loadInitialData: () => Promise<void>;
  loadPayments: () => Promise<void>;
  submitPayment: (payload: any) => Promise<boolean>;
  submitReversePayment: (reason: string) => Promise<boolean>;
}

export const usePaymentsStore = create<PaymentsState>((set, get) => ({
  paymentType: "RECEIVED",
  payments: [],
  branches: [],
  customers: [],
  suppliers: [],
  isLoading: false,
  isSaving: false,
  error: null,

  search: "",
  methodFilter: "ALL",
  branchFilter: "ALL",

  isRecordModalOpen: false,
  reversingPayment: null,
  selectedPaymentForReceipt: null,

  setPaymentType: (paymentType) => {
    set({ paymentType });
    get().loadPayments();
  },
  setSearch: (search) => set({ search }),
  setMethodFilter: (methodFilter) => {
    set({ methodFilter });
    get().loadPayments();
  },
  setBranchFilter: (branchFilter) => {
    set({ branchFilter });
    get().loadPayments();
  },

  openRecordModal: () => set({ isRecordModalOpen: true }),
  closeRecordModal: () => set({ isRecordModalOpen: false }),
  setReversingPayment: (reversingPayment) => set({ reversingPayment }),
  setSelectedPaymentForReceipt: (selectedPaymentForReceipt) => set({ selectedPaymentForReceipt }),

  loadInitialData: async () => {
    try {
      const [branchesRes, custRes, suppRes] = await Promise.all([
        apiClient.product.getBranches(),
        apiClient.customer.searchCustomers(""),
        apiClient.customer.getSuppliers({ limit: 500 }).catch(() => ({ suppliers: [] })),
      ]);

      const branches = branchesRes?.branches || branchesRes || [];
      const customers = custRes?.customers || [];
      const suppliers = suppRes?.suppliers || [];

      set({ branches, customers, suppliers });
      await get().loadPayments();
    } catch (err: any) {
      set({ error: err.message || "Failed to load master metadata" });
    }
  },

  loadPayments: async () => {
    set({ isLoading: true, error: null });
    try {
      const { paymentType, search, methodFilter, branchFilter } = get();
      const res = await financialsRepository.fetchPayments({
        type: paymentType,
        search: search.trim() || undefined,
        method: methodFilter !== "ALL" ? methodFilter : undefined,
        branchId: branchFilter !== "ALL" ? branchFilter : undefined,
      });
      set({ payments: res.payments, isLoading: false });
    } catch (err: any) {
      set({ isLoading: false, error: err.message || "Failed to load payment transactions" });
    }
  },

  submitPayment: async (payload) => {
    set({ isSaving: true, error: null });
    try {
      await financialsRepository.recordPayment({
        ...payload,
        type: get().paymentType,
      });
      await get().loadPayments();
      set({ isSaving: false, isRecordModalOpen: false });
      return true;
    } catch (err: any) {
      set({ isSaving: false, error: err.message || "Failed to record payment" });
      return false;
    }
  },

  submitReversePayment: async (reason) => {
    const target = get().reversingPayment;
    if (!target) return false;

    set({ isSaving: true, error: null });
    try {
      await financialsRepository.reversePayment(target.id, reason);
      await get().loadPayments();
      set({ isSaving: false, reversingPayment: null });
      return true;
    } catch (err: any) {
      set({ isSaving: false, error: err.message || "Failed to reverse payment" });
      return false;
    }
  },
}));

