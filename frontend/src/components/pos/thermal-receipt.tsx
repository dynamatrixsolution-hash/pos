"use client";

import * as React from "react";

export interface ReceiptItem {
  id?: string;
  name: string;
  quantity: number;
  price: number;
  discount?: number;
  sku?: string;
  barcode?: string;
  hsn?: string;
  taxRate?: number;
}

export interface ReceiptData {
  invoiceNumber: string;
  isReprint?: boolean;
  createdAt?: string | Date;
  cashierName?: string;
  customerName?: string;
  customerPhone?: string;
  customerPan?: string;
  customerAddress?: string;
  tableNumber?: string;
  items: ReceiptItem[];
  subtotal: number;
  discount?: number;
  taxableValue?: number;
  tax?: number;
  taxBreakup?: Array<{
    label: string;
    rate: number;
    cgst?: number;
    sgst?: number;
    amount: number;
  }>;
  total: number;
  paidAmount?: number;
  roundOff?: number;
  roundedTotal?: number;
  paymentMethod?: string;
}

export interface ReceiptSettings {
  businessName?: string;
  address?: string;
  phone?: string;
  email?: string;
  panNumber?: string;
  vatNumber?: string;
  taxName?: string;
  currencySymbol?: string;
  receiptLogo?: string;
  invoiceLogo?: string;
  receiptTitle?: string;
  receiptHeader?: string;
  receiptFooter?: string;
  receiptWidth?: "80mm" | "58mm" | "auto" | string;
  paymentQrImage?: string;
  paymentQrMedium?: string;
  paymentUpiId?: string;
  paymentAccountName?: string;
  showTaxBreakup?: boolean;
  showQrCode?: boolean;
}

// Crisp default SVG QR code when no custom image is uploaded
export const DEFAULT_QR_SVG = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" width="120" height="120"><rect width="120" height="120" fill="white"/><path d="M10,10 h35 v35 h-35 z M15,15 v25 h25 v-25 z M20,20 h15 v15 h-15 z M75,10 h35 v35 h-35 z M80,15 v25 h25 v-25 z M85,20 h15 v15 h-15 z M10,75 h35 v35 h-35 z M15,80 v25 h25 v-25 z M20,85 h15 v15 h-15 z M50,15 h5 v10 h-5 z M60,15 h10 v5 h-10 z M55,30 h10 v10 h-10 z M15,50 h10 v5 h-10 z M30,55 h10 v10 h-10 z M50,50 h5 v5 h-5 z M60,50 h10 v10 h-10 z M75,55 h10 v5 h-10 z M95,50 h15 v5 h-15 z M50,70 h5 v10 h-5 z M60,75 h15 v5 h-15 z M50,90 h10 v10 h-10 z M65,95 h10 v15 h-10 z M80,75 h15 v10 h-15 z M100,75 h10 v10 h-10 z M85,95 h15 v10 h-15 z M105,95 h5 v15 h-5 z" fill="black"/></svg>`;

export function formatDateTime(val?: string | Date): string {
  if (!val) {
    const now = new Date();
    const YYYY = now.getFullYear();
    const MM = String(now.getMonth() + 1).padStart(2, "0");
    const DD = String(now.getDate()).padStart(2, "0");
    const hh = String(now.getHours()).padStart(2, "0");
    const mm = String(now.getMinutes()).padStart(2, "0");
    return `${YYYY}-${MM}-${DD} ${hh}:${mm}`;
  }
  const d = new Date(val);
  if (isNaN(d.getTime())) return String(val);
  const YYYY = d.getFullYear();
  const MM = String(d.getMonth() + 1).padStart(2, "0");
  const DD = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${YYYY}-${MM}-${DD} ${hh}:${mm}`;
}

export function generateThermalReceiptHtml(
  data: ReceiptData,
  settings: ReceiptSettings
): string {
  const widthClass = settings.receiptWidth === "58mm" ? "58mm" : "80mm";
  const maxWidth = widthClass === "58mm" ? "54mm" : "76mm";
  const fontSize = widthClass === "58mm" ? "10.5px" : "12px";
  const lineSpacing = widthClass === "58mm" ? "1.2" : "1.3";
  const currency = settings.currencySymbol || "Rs. ";

  const subtotal = Number(data.subtotal) || 0;
  const discount = Number(data.discount) || 0;
  const taxableValue =
    data.taxableValue !== undefined && data.taxableValue !== null
      ? Number(data.taxableValue) || 0
      : Math.max(0, subtotal - discount);
  const tax = Number(data.tax) || 0;
  const total =
    data.total !== undefined && data.total !== null
      ? Number(data.total) || 0
      : subtotal + tax - discount;
  const roundOff =
    data.roundOff !== undefined && data.roundOff !== null
      ? Number(data.roundOff) || 0
      : parseFloat((Math.round(total) - total).toFixed(2));
  const roundedTotal =
    data.roundedTotal !== undefined && data.roundedTotal !== null
      ? Number(data.roundedTotal) || 0
      : Math.round(total);

  const qrImage = settings.paymentQrImage || DEFAULT_QR_SVG;
  const qrMedium = settings.paymentQrMedium || "Fonepay";
  const upiId = settings.paymentUpiId || "dbg@upi";
  const accountName = settings.paymentAccountName || settings.businessName || "Store Merchant";
  const showQr = settings.showQrCode !== false;

  // Build Item rows
  const itemsHtml = (data.items || [])
    .map((item) => {
      const itemPrice = Number(item.price) || 0;
      const itemQty = Number(item.quantity) || 1;
      const itemDiscount = Number(item.discount) || 0;
      const lineTotal = ((itemPrice - itemDiscount) * itemQty).toFixed(2);
      const subInfoParts: string[] = [];
      if (item.hsn) subInfoParts.push(`HSN: ${item.hsn}`);
      else if (item.sku) subInfoParts.push(`SKU: ${item.sku}`);
      if (item.taxRate) subInfoParts.push(`GST: ${item.taxRate}%`);
      const subInfo = subInfoParts.length > 0 ? subInfoParts.join(" | ") : "";

      return `
        <div style="margin-bottom: 5px;">
          <div style="display: flex; justify-content: space-between; align-items: baseline;">
            <span style="flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; padding-right: 4px; font-weight: 600;">
              ${item.name}
            </span>
            <span style="width: 28px; text-align: center; flex-shrink: 0;">${item.quantity}</span>
            <span style="width: 52px; text-align: right; flex-shrink: 0;">${itemPrice.toFixed(2)}</span>
            <span style="width: 58px; text-align: right; flex-shrink: 0; font-weight: 600;">${lineTotal}</span>
          </div>
          ${
            subInfo
              ? `<div style="font-size: 9px; color: #444; margin-top: 1px;">${subInfo}</div>`
              : ""
          }
        </div>
      `;
    })
    .join("");

  const logoHtml =
    settings.receiptLogo || settings.invoiceLogo
      ? `<div style="text-align: center; margin-bottom: 6px;">
          <img src="${settings.receiptLogo || settings.invoiceLogo}" alt="Logo" style="max-height: 48px; max-width: 100%; object-fit: contain; margin: 0 auto; display: block;" />
        </div>`
      : "";

  const taxId = settings.panNumber || settings.vatNumber;
  const taxIdLabel = settings.panNumber ? "PAN / GSTIN" : "VAT / GSTIN";

  return `
    <div class="thermal-receipt-root" style="
      width: ${maxWidth};
      max-width: 100%;
      margin: 0 auto;
      padding: 6px 4px;
      box-sizing: border-box;
      font-family: 'Courier New', Courier, 'Lucida Console', Monaco, monospace;
      font-size: ${fontSize};
      line-height: ${lineSpacing};
      color: #000000;
      background: #ffffff;
      -webkit-font-smoothing: antialiased;
    ">
      <!-- COPY OF ORIGINAL Banner (Rendered when printing bill again) -->
      ${
        data.isReprint
          ? `
        <div style="
          text-align: center;
          font-weight: 900;
          font-size: 1.15em;
          letter-spacing: 1.5px;
          border-top: 1.5px dashed #000000;
          border-bottom: 1.5px dashed #000000;
          padding: 4px 0;
          margin-bottom: 8px;
          text-transform: uppercase;
        ">
          *** COPY OF ORIGINAL ***
        </div>
        `
          : ""
      }
      ${logoHtml}

      <!-- Header Title & Store Details -->
      <div style="text-align: center; margin-bottom: 8px;">
        <div style="font-weight: 900; font-size: 1.15em; letter-spacing: 0.5px; text-transform: uppercase;">
          ${settings.receiptTitle || "POS GST INVOICE"}
        </div>
        <div style="font-weight: 700; font-size: 1.05em; margin-top: 2px;">
          ${settings.businessName || "Store Billing"}
        </div>
        ${settings.address ? `<div style="font-size: 0.9em; margin-top: 1px;">${settings.address}</div>` : ""}
        ${taxId ? `<div style="font-size: 0.9em; margin-top: 1px;">${taxIdLabel}: ${taxId}</div>` : ""}
        ${settings.phone ? `<div style="font-size: 0.9em; margin-top: 1px;">Phone: ${settings.phone}</div>` : ""}
        ${settings.receiptHeader ? `<div style="font-size: 0.85em; margin-top: 2px; font-style: italic;">${settings.receiptHeader}</div>` : ""}
      </div>

      <!-- Dashed Divider -->
      <div style="border-top: 1px dashed #000000; margin: 6px 0;"></div>

      <!-- Invoice & Customer Metadata -->
      <div style="font-size: 0.92em; line-height: 1.35; margin-bottom: 6px;">
        <div style="display: flex; justify-content: space-between;">
          <span>Invoice No: <strong>${data.invoiceNumber}</strong></span>
        </div>
        <div>Date: ${formatDateTime(data.createdAt)}</div>
        <div>Cashier: ${data.cashierName || "Cashier"}</div>
        <div>Bill To: ${data.customerName ? "Customer" : "Walk-in"}</div>
        ${data.customerName ? `<div>Customer: <strong>${data.customerName}</strong></div>` : ""}
        ${data.customerPhone ? `<div>Phone: ${data.customerPhone}</div>` : ""}
        ${data.customerPan ? `<div>GSTIN / PAN: ${data.customerPan}</div>` : ""}
        ${data.tableNumber ? `<div>Restaurant Table: ${data.tableNumber}</div>` : ""}
      </div>

      <!-- Dashed Divider -->
      <div style="border-top: 1px dashed #000000; margin: 6px 0;"></div>

      <!-- Table Header -->
      <div style="display: flex; justify-content: space-between; font-weight: bold; font-size: 0.92em; margin-bottom: 4px;">
        <span style="flex: 1;">Item</span>
        <span style="width: 28px; text-align: center; flex-shrink: 0;">Qty</span>
        <span style="width: 52px; text-align: right; flex-shrink: 0;">Rate</span>
        <span style="width: 58px; text-align: right; flex-shrink: 0;">Amt</span>
      </div>

      <!-- Dashed Divider -->
      <div style="border-top: 1px dashed #000000; margin-bottom: 6px;"></div>

      <!-- Items List -->
      <div style="margin-bottom: 6px;">
        ${itemsHtml}
      </div>

      <!-- Dashed Divider -->
      <div style="border-top: 1px dashed #000000; margin: 6px 0;"></div>

      <!-- Subtotals and Taxable -->
      <div style="font-size: 0.95em; line-height: 1.4;">
        <div style="display: flex; justify-content: space-between;">
          <span>Subtotal</span>
          <span>${subtotal.toFixed(2)}</span>
        </div>
        ${
          discount > 0
            ? `<div style="display: flex; justify-content: space-between;">
                <span>Discount</span>
                <span>-${discount.toFixed(2)}</span>
              </div>`
            : `<div style="display: flex; justify-content: space-between;">
                <span>Discount</span>
                <span>0.00</span>
              </div>`
        }
        <div style="display: flex; justify-content: space-between;">
          <span>Taxable Value</span>
          <span>${taxableValue.toFixed(2)}</span>
        </div>
      </div>

      <!-- Grand Total & Round Off -->
      <div style="font-size: 0.95em; line-height: 1.4; margin-top: 4px;">
        <div style="display: flex; justify-content: space-between;">
          <span>Grand Total</span>
          <span>${total.toFixed(2)}</span>
        </div>
        <div style="display: flex; justify-content: space-between; font-size: 0.9em; color: #333;">
          <span>Round Off</span>
          <span>${roundOff > 0 ? `+${roundOff.toFixed(2)}` : roundOff.toFixed(2)}</span>
        </div>
        <div style="display: flex; justify-content: space-between; font-weight: 900; font-size: 1.15em; margin-top: 2px; padding-top: 2px;">
          <span>Rounded Total</span>
          <span>${currency}${roundedTotal.toFixed(2)}</span>
        </div>
      </div>

      <!-- Dashed Divider -->
      <div style="border-top: 1px dashed #000000; margin: 8px 0;"></div>

      <!-- Scan & Pay QR Code Section -->
      ${
        showQr
          ? `
        <div style="text-align: center; margin: 8px 0;">
          <div style="display: inline-block; padding: 4px; background: #fff; border: 1px solid #eee; border-radius: 6px;">
            <img 
              src="${qrImage}" 
              alt="Payment QR" 
              style="width: 110px; height: 110px; object-fit: contain; display: block; margin: 0 auto;" 
            />
          </div>
          <div style="font-size: 0.9em; font-weight: 700; margin-top: 4px; text-transform: uppercase;">
            Scan & Pay
          </div>
          ${upiId ? `<div style="font-size: 0.82em; margin-top: 1px;">UPI ID: ${upiId}</div>` : ""}
          <div style="font-size: 0.82em; margin-top: 1px;">Name: ${accountName}</div>
        </div>
        <!-- Dashed Divider -->
        <div style="border-top: 1px dashed #000000; margin: 8px 0;"></div>
        `
          : ""
      }

      <!-- Footer Thank You Note -->
      <div style="text-align: center; font-size: 0.85em; line-height: 1.35; margin-top: 4px;">
        <div style="font-weight: 600;">${settings.receiptFooter || "Thank you! Visit again."}</div>
        <div style="font-size: 0.9em; color: #555; margin-top: 1px;">
          ${settings.taxName || "GST"} included as applicable.
        </div>
      </div>
    </div>
  `;
}

export default function ThermalReceipt({
  data,
  settings,
}: {
  data: ReceiptData;
  settings: ReceiptSettings;
}) {
  const html = React.useMemo(() => generateThermalReceiptHtml(data, settings), [data, settings]);

  return (
    <div
      className="thermal-receipt-container"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
