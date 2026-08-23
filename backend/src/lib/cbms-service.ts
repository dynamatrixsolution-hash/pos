import { db } from "@/lib/db";

export interface CbmsConfig {
  apiUrl?: string;
  username?: string;
  password?: string;
  isRealtime?: boolean;
}

export class CbmsService {
  /**
   * Retrieves CBMS Configuration from Business settings.
   */
  private static async getConfig(businessId: string): Promise<CbmsConfig> {
    const business = await db.business.findUnique({
      where: { id: businessId },
      select: { settings: true },
    });
    const settings = (business?.settings as any) || {};
    return {
      apiUrl: settings.cbmsApiUrl || "https://cbms.ird.gov.np/api/v1/invoice",
      username: settings.cbmsUsername || "",
      password: settings.cbmsPassword || "",
      isRealtime: settings.cbmsRealtime !== false, // default true
    };
  }

  /**
   * Serializes a Sale record into the IRD CBMS expected payload format.
   */
  private static async serializeInvoice(saleId: string) {
    const sale = await db.sale.findUnique({
      where: { id: saleId },
      include: {
        customer: true,
        user: true,
        business: true,
      },
    });

    if (!sale) throw new Error("Sale not found");

    const settings = (sale.business?.settings as any) || {};

    return {
      username: settings.cbmsUsername || "TEST_USER",
      password: settings.cbmsPassword || "TEST_PASS",
      seller_pan: settings.panNumber || "123456789",
      buyer_pan: sale.customer?.phone || sale.customer?.phone || "", // customer PAN falls back to PAN if registered
      buyer_name: sale.customer?.name || "Walk-in Customer",
      bill_no: sale.invoiceNumber,
      bill_date: sale.createdAt.toISOString().split("T")[0],
      amount: sale.subtotal,
      discount: sale.discount,
      taxable_amount: sale.subtotal - sale.discount,
      tax_amount: sale.tax,
      total_amount: sale.total,
      is_printed: sale.isPrinted,
      is_active: sale.isActive,
      printed_time: sale.firstPrintedAt?.toISOString() || "",
      entered_by: sale.user?.name || "System Cashier",
      printed_by: sale.user?.name || "System Cashier",
      is_realtime: sale.isRealtime,
      payment_method: sale.paymentMethod || "CASH",
      vat_refund_amount: sale.vatRefundAmount || 0,
      transaction_id: sale.transactionId || "",
    };
  }

  /**
   * Submits a finalized invoice to the CBMS system (or stubs the integration).
   */
  public static async submitInvoice(saleId: string): Promise<boolean> {
    try {
      const payload = await this.serializeInvoice(saleId);
      const sale = await db.sale.findUnique({ where: { id: saleId } });
      if (!sale) return false;

      const config = await this.getConfig(sale.businessId);

      // Create a CBMS Sync log entry in PENDING state
      const queueItem = await db.cbmsSyncQueue.create({
        data: {
          businessId: sale.businessId,
          saleId: sale.id,
          action: "INVOICE_SUBMIT",
          syncStatus: "SYNCING",
          attemptCount: 1,
          lastAttempt: new Date(),
          requestPayload: payload as any,
        },
      });

      // Execute mock submission
      const response = await this.executeMockRequest(payload, config);

      if (response.success) {
        await db.cbmsSyncQueue.update({
          where: { id: queueItem.id },
          data: {
            syncStatus: "SYNCED",
            responsePayload: response.data as any,
            errorMessage: null,
          },
        });

        await db.sale.update({
          where: { id: saleId },
          data: {
            syncWithIrd: "SYNCED",
            cbmsRequestId: queueItem.id,
            cbmsResponseId: response.transactionId,
            cbmsSyncTime: new Date(),
            cbmsError: null,
          },
        });
        return true;
      } else {
        await db.cbmsSyncQueue.update({
          where: { id: queueItem.id },
          data: {
            syncStatus: "FAILED",
            errorMessage: response.error,
            responsePayload: response.data as any,
          },
        });

        await db.sale.update({
          where: { id: saleId },
          data: {
            syncWithIrd: "FAILED",
            cbmsError: response.error,
          },
        });
        return false;
      }
    } catch (err: any) {
      console.error("CBMS Invoice Submit failed:", err.message || err);
      return false;
    }
  }

  /**
   * Submits a Credit Note to the CBMS system.
   */
  public static async submitCreditNote(creditNoteId: string): Promise<boolean> {
    try {
      const cn = await db.creditNote.findUnique({
        where: { id: creditNoteId },
        include: { sale: true, business: true, branch: true, createdBy: true },
      });
      if (!cn) return false;

      const settings = (cn.business?.settings as any) || {};
      const config = await this.getConfig(cn.businessId);

      const payload = {
        username: settings.cbmsUsername || "TEST_USER",
        password: settings.cbmsPassword || "TEST_PASS",
        seller_pan: settings.panNumber || "123456789",
        note_no: cn.noteNumber,
        original_bill_no: cn.sale.invoiceNumber,
        note_date: cn.createdAt.toISOString().split("T")[0],
        amount: cn.subtotal,
        discount: cn.discount,
        taxable_amount: cn.subtotal - cn.discount,
        tax_amount: cn.tax,
        total_amount: cn.total,
        reason: cn.reason,
        entered_by: cn.createdBy.name,
      };

      const queueItem = await db.cbmsSyncQueue.create({
        data: {
          businessId: cn.businessId,
          creditNoteId: cn.id,
          action: "CREDIT_NOTE_SUBMIT",
          syncStatus: "SYNCING",
          attemptCount: 1,
          lastAttempt: new Date(),
          requestPayload: payload as any,
        },
      });

      const response = await this.executeMockRequest(payload, config);

      if (response.success) {
        await db.cbmsSyncQueue.update({
          where: { id: queueItem.id },
          data: {
            syncStatus: "SYNCED",
            responsePayload: response.data as any,
          },
        });

        await db.creditNote.update({
          where: { id: creditNoteId },
          data: {
            syncWithIrd: "SYNCED",
            cbmsSyncTime: new Date(),
            cbmsError: null,
          },
        });
        return true;
      } else {
        await db.cbmsSyncQueue.update({
          where: { id: queueItem.id },
          data: {
            syncStatus: "FAILED",
            errorMessage: response.error,
            responsePayload: response.data as any,
          },
        });

        await db.creditNote.update({
          where: { id: creditNoteId },
          data: {
            syncWithIrd: "FAILED",
            cbmsError: response.error,
          },
        });
        return false;
      }
    } catch (err: any) {
      console.error("CBMS Credit Note Submit failed:", err.message || err);
      return false;
    }
  }

  /**
   * Submits an Invoice Cancellation request to the CBMS system.
   */
  public static async submitCancellation(saleId: string, reason: string): Promise<boolean> {
    try {
      const sale = await db.sale.findUnique({
        where: { id: saleId },
        include: { business: true },
      });
      if (!sale) return false;

      const settings = (sale.business?.settings as any) || {};
      const config = await this.getConfig(sale.businessId);

      const payload = {
        username: settings.cbmsUsername || "TEST_USER",
        password: settings.cbmsPassword || "TEST_PASS",
        seller_pan: settings.panNumber || "123456789",
        bill_no: sale.invoiceNumber,
        cancel_date: new Date().toISOString().split("T")[0],
        reason: reason,
      };

      const queueItem = await db.cbmsSyncQueue.create({
        data: {
          businessId: sale.businessId,
          saleId: sale.id,
          action: "INVOICE_CANCEL",
          syncStatus: "SYNCING",
          attemptCount: 1,
          lastAttempt: new Date(),
          requestPayload: payload as any,
        },
      });

      const response = await this.executeMockRequest(payload, config);

      if (response.success) {
        await db.cbmsSyncQueue.update({
          where: { id: queueItem.id },
          data: {
            syncStatus: "SYNCED",
            responsePayload: response.data as any,
          },
        });
        return true;
      } else {
        await db.cbmsSyncQueue.update({
          where: { id: queueItem.id },
          data: {
            syncStatus: "FAILED",
            errorMessage: response.error,
            responsePayload: response.data as any,
          },
        });
        return false;
      }
    } catch (err: any) {
      console.error("CBMS Invoice Cancellation failed:", err.message || err);
      return false;
    }
  }

  /**
   * Manually retries a queued sync item from the dashboard.
   */
  public static async manuallyRetryQueueItem(queueId: string): Promise<boolean> {
    const queue = await db.cbmsSyncQueue.findUnique({
      where: { id: queueId },
      include: { sale: true, creditNote: true },
    });
    if (!queue) return false;

    await db.cbmsSyncQueue.update({
      where: { id: queueId },
      data: {
        syncStatus: "RETRYING",
        attemptCount: { increment: 1 },
        lastAttempt: new Date(),
      },
    });

    const config = await this.getConfig(queue.businessId);
    const response = await this.executeMockRequest(queue.requestPayload, config);

    if (response.success) {
      await db.cbmsSyncQueue.update({
        where: { id: queueId },
        data: {
          syncStatus: "SYNCED",
          responsePayload: response.data as any,
          errorMessage: null,
        },
      });

      if (queue.saleId) {
        await db.sale.update({
          where: { id: queue.saleId },
          data: {
            syncWithIrd: "SYNCED",
            cbmsResponseId: response.transactionId,
            cbmsSyncTime: new Date(),
            cbmsError: null,
          },
        });
      }

      if (queue.creditNoteId) {
        await db.creditNote.update({
          where: { id: queue.creditNoteId },
          data: {
            syncWithIrd: "SYNCED",
            cbmsSyncTime: new Date(),
            cbmsError: null,
          },
        });
      }

      return true;
    } else {
      await db.cbmsSyncQueue.update({
        where: { id: queueId },
        data: {
          syncStatus: "FAILED",
          errorMessage: response.error,
          responsePayload: response.data as any,
        },
      });

      if (queue.saleId) {
        await db.sale.update({
          where: { id: queue.saleId },
          data: {
            syncWithIrd: "FAILED",
            cbmsError: response.error,
          },
        });
      }

      return false;
    }
  }

  /**
   * Simulates the HTTP post request to the IRD servers.
   * Leverages mock configurations to simulate periodic failures for testing resilience.
   */
  private static async executeMockRequest(payload: any, config: CbmsConfig): Promise<{ success: boolean; transactionId?: string; error?: string; data?: any }> {
    await new Promise((resolve) => setTimeout(resolve, 800)); // Network delay

    // If username or password is missing, fail it due to credentials validation
    if (!config.username && payload.username === "") {
      return {
        success: false,
        error: "CBMS Error: Authentication credentials missing or invalid.",
        data: { errorCode: "AUTH_FAILED" },
      };
    }

    // Simulate occasional random timeouts for testing queue retries
    if (Math.random() < 0.15) {
      return {
        success: false,
        error: "CBMS Connection Timeout: Connection to Central Billing Monitoring System failed. Will retry.",
        data: { errorCode: "TIMEOUT" },
      };
    }

    // Success response
    const mockRefId = "IRD-TXN-" + Math.floor(100000000 + Math.random() * 900000000);
    return {
      success: true,
      transactionId: mockRefId,
      data: {
        statusCode: 200,
        message: "Invoice successfully registered in CBMS.",
        referenceId: mockRefId,
        syncTimestamp: new Date().toISOString(),
      },
    };
  }
}
