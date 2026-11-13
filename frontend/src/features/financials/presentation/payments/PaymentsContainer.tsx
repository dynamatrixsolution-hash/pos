"use client";

import React, { useEffect } from "react";
import { PaymentType } from "../../models/financials.types";
import { usePaymentsStore } from "../../state/payments.store";
import { PaymentHeader } from "./PaymentHeader";
import { PaymentTable } from "./PaymentTable";
import { RecordPaymentModal } from "./RecordPaymentModal";
import { ReversePaymentModal } from "./ReversePaymentModal";
import { PaymentReceiptModal } from "./PaymentReceiptModal";

interface PaymentsContainerProps {
  type: PaymentType;
}

export const PaymentsContainer: React.FC<PaymentsContainerProps> = ({ type }) => {
  const setPaymentType = usePaymentsStore((s) => s.setPaymentType);
  const loadInitialData = usePaymentsStore((s) => s.loadInitialData);

  useEffect(() => {
    setPaymentType(type);
    loadInitialData();
  }, [type, setPaymentType, loadInitialData]);

  return (
    <div className="space-y-4 p-4 md:p-6 bg-[#F7F3EC] min-h-screen text-[#292320]">
      <PaymentHeader />
      <PaymentTable />
      <RecordPaymentModal />
      <ReversePaymentModal />
      <PaymentReceiptModal />
    </div>
  );
};

