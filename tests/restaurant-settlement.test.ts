import { describe, expect, it } from "vitest";
import { computeSettlementTotals } from "../backend/src/lib/services/restaurant-order-service";

describe("computeSettlementTotals", () => {
  it("computes single 13% VAT on pre-tax line totals without double-taxing", () => {
    const res = computeSettlementTotals({
      lines: [
        { unitPrice: 1000, quantity: 2 },
        { unitPrice: 250, quantity: 1 },
      ],
      applyVat: true,
    });

    expect(res.subtotal).toBe(2250);
    expect(res.discountTotal).toBe(0);
    expect(res.afterDiscount).toBe(2250);
    expect(res.taxTotal).toBe(292.5);
    expect(res.extraFees).toBe(0);
    expect(res.totalAmount).toBe(2542.5);
  });

  it("clamps FLAT and PERCENT discounts so totals never go negative", () => {
    const overPercent = computeSettlementTotals({
      lines: [{ unitPrice: 500, quantity: 2 }],
      discountType: "PERCENT",
      discountValue: 150,
      applyVat: true,
    });
    expect(overPercent.discountTotal).toBe(1000);
    expect(overPercent.afterDiscount).toBe(0);
    expect(overPercent.taxTotal).toBe(0);
    expect(overPercent.totalAmount).toBe(0);

    const overFlat = computeSettlementTotals({
      lines: [{ unitPrice: 300, quantity: 1 }],
      discountType: "FLAT",
      discountTotal: 999,
      applyVat: true,
    });
    expect(overFlat.discountTotal).toBe(300);
    expect(overFlat.afterDiscount).toBe(0);
    expect(overFlat.taxTotal).toBe(0);
    expect(overFlat.totalAmount).toBe(0);

    const validPercent = computeSettlementTotals({
      lines: [{ unitPrice: 400, quantity: 2 }],
      discountType: "PERCENT",
      discountValue: 10,
      applyVat: true,
    });
    expect(validPercent.subtotal).toBe(800);
    expect(validPercent.discountTotal).toBe(80);
    expect(validPercent.afterDiscount).toBe(720);
    expect(validPercent.taxTotal).toBe(93.6);
    expect(validPercent.totalAmount).toBe(813.6);
  });

  it("adds delivery and packaging fees after VAT without taxing fees", () => {
    const res = computeSettlementTotals({
      lines: [{ unitPrice: 1000, quantity: 1 }],
      applyVat: true,
      deliveryFee: 100,
      packagingFee: 50,
      expressFee: -25,
    });

    expect(res.subtotal).toBe(1000);
    expect(res.taxTotal).toBe(130);
    expect(res.extraFees).toBe(150);
    expect(res.totalAmount).toBe(1280);
  });

  it("produces zero tax when applyVat is false", () => {
    const res = computeSettlementTotals({
      lines: [{ unitPrice: 600, quantity: 2 }],
      applyVat: false,
      deliveryFee: 100,
    });

    expect(res.subtotal).toBe(1200);
    expect(res.taxTotal).toBe(0);
    expect(res.extraFees).toBe(100);
    expect(res.totalAmount).toBe(1300);
  });
});
