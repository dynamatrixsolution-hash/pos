import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { isolatedDatabaseUrl } from "../scripts/database-verification.mjs";

const target = process.env.TEST_DATABASE_URL;
if (!target && process.env.RESTRO_REQUIRE_DATABASE_TESTS === "true") {
  throw new Error("Financial lifecycle integration verification requires isolated PostgreSQL");
}
if (target) {
  isolatedDatabaseUrl(target);
  process.env.DATABASE_URL = target;
  process.env.DIRECT_URL = target;
}

const identity = vi.hoisted(() => ({ user: {} as Record<string, unknown> }));
vi.mock("@/auth", () => ({ auth: async () => ({ user: identity.user }) }));

import {
  allocatePayment,
  reversePayment,
  createRefund,
  PaymentLedgerError,
} from "../backend/src/lib/services/payment-ledger-service";
import {
  recordStockMovement,
  assertStockAvailable,
  StockLedgerError,
} from "../backend/src/lib/services/stock-ledger-service";
import { enqueueOutboxEvent } from "../backend/src/lib/services/outbox-service";
import { Prisma } from "@dynapos/db";

describe.skipIf(!target)("Phase 2: Financial Ledger, Payment Lifecycle & Stock Movement", () => {
  let db: import("@dynapos/db").PrismaClient;
  const businessId = randomUUID();
  const branchId = randomUUID();
  const userId = randomUUID();
  const customerId = randomUUID();
  const productId = randomUUID();

  beforeAll(async () => {
    const { PrismaClient } = await import("@dynapos/db");
    db = new PrismaClient({ datasourceUrl: target, log: [] });
    await db.$connect();

    // 1. Setup tenant fixtures
    await db.business.create({
      data: {
        id: businessId,
        slug: `lifecycle-${randomUUID().slice(0, 8)}`,
        name: "Financial Lifecycle Test Tenant",
      },
    });

    await db.branch.create({
      data: {
        id: branchId,
        businessId,
        name: "Main Lifecycle Branch",
      },
    });

    await db.user.create({
      data: {
        id: userId,
        businessId,
        branchId,
        email: `staff-${randomUUID().slice(0, 8)}@example.com`,
        passwordHash: "not-a-password",
        name: "Lifecycle Staff Member",
        role: "OWNER",
      },
    });

    await db.customer.create({
      data: {
        id: customerId,
        businessId,
        name: "Financial Test Customer",
        balance: 0,
        creditLimit: 50000,
      },
    });

    await db.product.create({
      data: {
        id: productId,
        businessId,
        name: "Inventory Test Product",
        costPrice: 50,
        sellingPrice: 100,
      },
    });
  });

  afterAll(async () => {
    if (!db) return;
    try {
      await db.outboxEvent.deleteMany({ where: { businessId } });
      await db.stockMovement.deleteMany({ where: { businessId } });
      await db.productStock.deleteMany({ where: { productId } });
      await db.refund.deleteMany({ where: { businessId } });
      await db.paymentReversal.deleteMany({ where: { businessId } });
      await db.paymentAllocation.deleteMany({ where: { businessId } });
      await db.payment.deleteMany({ where: { businessId } });
      await db.saleItem.deleteMany({ where: { sale: { businessId } } });
      await db.sale.deleteMany({ where: { businessId } });
      await db.customerLedger.deleteMany({ where: { customerId } });
      await db.customer.deleteMany({ where: { businessId } });
      await db.product.deleteMany({ where: { businessId } });
      await db.user.deleteMany({ where: { businessId } });
      await db.branch.deleteMany({ where: { businessId } });
      await db.business.deleteMany({ where: { id: businessId } });
    } finally {
      await db.$disconnect();
    }
  });

  describe("1. PaymentAllocation & Invoice Settlement", () => {
    it("allocates payment to an invoice and advances paymentStatus atomically", async () => {
      const saleId = randomUUID();
      const paymentId = randomUUID();

      // Create an invoice with total 1000, paidAmount 0
      await db.sale.create({
        data: {
          id: saleId,
          businessId,
          branchId,
          customerId,
          userId,
          invoiceNumber: `INV-${saleId.slice(0, 6)}`,
          status: "COMPLETED",
          subtotal: 1000,
          discount: 0,
          tax: 0,
          total: 1000,
          paidAmount: 0,
          paymentStatus: "PENDING",
        },
      });

      // Create a payment receipt of 1000
      await db.payment.create({
        data: {
          id: paymentId,
          businessId,
          branchId,
          userId,
          customerId,
          amount: 1000,
          method: "CASH",
          type: "RECEIVED",
          receiptNumber: `REC-${paymentId.slice(0, 6)}`,
        },
      });

      // Allocate 600 first
      await db.$transaction(async (tx) => {
        await allocatePayment(tx, {
          businessId,
          paymentId,
          saleId,
          amount: 600,
          allocatedById: userId,
        });
      });

      let updatedSale = await db.sale.findUnique({ where: { id: saleId } });
      expect(Number(updatedSale?.paidAmount)).toBe(600);
      expect(updatedSale?.paymentStatus).toBe("PARTIAL");

      // Allocate remaining 400
      await db.$transaction(async (tx) => {
        await allocatePayment(tx, {
          businessId,
          paymentId,
          saleId,
          amount: 400,
          allocatedById: userId,
        });
      });

      updatedSale = await db.sale.findUnique({ where: { id: saleId } });
      expect(Number(updatedSale?.paidAmount)).toBe(1000);
      expect(updatedSale?.paymentStatus).toBe("PAID");

      // Over-allocation (> 1000 total) must fail with 409
      await expect(
        db.$transaction(async (tx) => {
          await allocatePayment(tx, {
            businessId,
            paymentId,
            saleId,
            amount: 50,
            allocatedById: userId,
          });
        })
      ).rejects.toThrow(/Total allocated amount cannot exceed payment receipt amount/);
    });
  });

  describe("2. PaymentReversal Immutability & Customer Balance Rollback", () => {
    it("reverses payment, rolls back customer ledger, and preserves payment row immutability", async () => {
      const paymentId = randomUUID();

      // Customer receives a payment of 500
      await db.payment.create({
        data: {
          id: paymentId,
          businessId,
          branchId,
          userId,
          customerId,
          amount: 500,
          method: "FONE_PAY",
          type: "RECEIVED",
          receiptNumber: `REC-${paymentId.slice(0, 6)}`,
        },
      });

      // Customer balance was reduced by 500
      await db.customer.update({
        where: { id: customerId },
        data: { balance: 1000 },
      });

      // Reverse the payment with audited reason
      const reversal = await db.$transaction(async (tx) => {
        return await reversePayment(tx, {
          businessId,
          paymentId,
          reason: "Incorrect bank transaction reference entered by cashier",
          reversedById: userId,
        });
      });

      expect(reversal).toBeDefined();
      expect(reversal.paymentId).toBe(paymentId);
      expect(Number(reversal.amount)).toBe(500);

      // Invariant: Payment row still exists in database (NEVER hard-deleted)
      const paymentRecord = await db.payment.findUnique({ where: { id: paymentId } });
      expect(paymentRecord).not.toBeNull();
      expect(Number(paymentRecord?.amount)).toBe(500);

      // Invariant: Customer balance restored (1000 + 500 = 1500)
      const updatedCustomer = await db.customer.findUnique({ where: { id: customerId } });
      expect(Number(updatedCustomer?.balance)).toBe(1500);

      // Invariant: Reversing again fails with 409
      await expect(
        db.$transaction(async (tx) => {
          await reversePayment(tx, {
            businessId,
            paymentId,
            reason: "Attempt duplicate reversal",
            reversedById: userId,
          });
        })
      ).rejects.toThrow(/Payment has already been reversed/);
    });
  });

  describe("3. Append-Only StockMovement Ledger & Negative-Stock Locks", () => {
    it("records stock-in, asserts quantity reconciliation against ProductStock projection", async () => {
      // 1. Initial Opening Stock: +50 units
      await db.$transaction(async (tx) => {
        await recordStockMovement(tx, {
          businessId,
          branchId,
          productId,
          quantity: 50,
          unit: "pcs",
          sourceType: "OPENING",
          sourceId: "OP-001",
          actorId: userId,
        });
      });

      let stock = await db.productStock.findFirst({
        where: { productId, branchId },
      });
      expect(Number(stock?.quantity)).toBe(50);

      // 2. Sale: -15 units
      await db.$transaction(async (tx) => {
        await recordStockMovement(tx, {
          businessId,
          branchId,
          productId,
          quantity: -15,
          unit: "pcs",
          sourceType: "SALE",
          sourceId: "SALE-001",
          actorId: userId,
          allowNegativeStock: false,
        });
      });

      stock = await db.productStock.findFirst({
        where: { productId, branchId },
      });
      expect(Number(stock?.quantity)).toBe(35);

      // Verify reconciliation invariant: sum(StockMovement.quantity) === ProductStock.quantity
      const movements = await db.stockMovement.findMany({
        where: { productId, branchId },
      });
      const movementSum = movements.reduce(
        (sum, m) => sum.add(m.quantity),
        new Prisma.Decimal(0)
      );
      expect(Number(movementSum)).toBe(35);
      expect(Number(stock?.quantity)).toBe(Number(movementSum));
    });

    it("rejects stock deduction exceeding available quantity when allowNegativeStock = false", async () => {
      // Current stock is 35. Attempting to deduct 50 must throw 409
      await expect(
        db.$transaction(async (tx) => {
          await recordStockMovement(tx, {
            businessId,
            branchId,
            productId,
            quantity: -50,
            sourceType: "SALE",
            sourceId: "SALE-EXCESS",
            actorId: userId,
            allowNegativeStock: false,
          });
        })
      ).rejects.toThrow(/Insufficient stock available/);

      // Confirm stock was not modified
      const stock = await db.productStock.findFirst({
        where: { productId, branchId },
      });
      expect(Number(stock?.quantity)).toBe(35);
    });
  });

  describe("4. Transactional Outbox Pattern", () => {
    it("enqueues OutboxEvent atomically with business transaction", async () => {
      const testEventId = randomUUID();

      await db.$transaction(async (tx) => {
        await enqueueOutboxEvent(tx, {
          businessId,
          aggregateType: "Order",
          aggregateId: testEventId,
          eventType: "ORDER_CREATED",
          payload: { orderNumber: "ORD-999", tableId: "T-01", total: "150.00" },
        });
      });

      const outbox = await db.outboxEvent.findFirst({
        where: { businessId, aggregateId: testEventId },
      });
      expect(outbox).not.toBeNull();
      expect(outbox?.status).toBe("PENDING");
      expect(outbox?.eventType).toBe("ORDER_CREATED");
    });
  });
});

