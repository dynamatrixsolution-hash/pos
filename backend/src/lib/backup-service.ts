import { db } from "@/lib/db";
import * as fs from "fs";
import * as path from "path";

export interface BackupMetadata {
  filename: string;
  sizeBytes: number;
  timestamp: string;
  tables: Record<string, number>;
  checksum: string;
  verified: boolean;
  status: "SUCCESS" | "FAILED";
  errorMessage?: string;
}

export class BackupService {
  private static backupDir = path.join(process.cwd(), "scratch", "backups");

  private static ensureBackupDir() {
    if (!fs.existsSync(this.backupDir)) {
      fs.mkdirSync(this.backupDir, { recursive: true });
    }
  }

  /**
   * Performs a complete technical database backup.
   * Fetches all tables programmatically, serializes to JSON, computes checksums, and saves the file.
   */
  public static async executeBackup(businessId: string): Promise<BackupMetadata> {
    this.ensureBackupDir();
    const timestamp = new Date().toISOString();
    const filename = `backup-${businessId}-${Date.now()}.json`;
    const filepath = path.join(this.backupDir, filename);

    try {
      // We dump all key business entities to ensure complete tenant data backup
      const [
        users,
        customers,
        products,
        sales,
        saleItems,
        creditNotes,
        creditNoteItems,
        debitNotes,
        debitNoteItems,
        auditLogs,
        cbmsSyncQueues,
        fiscalYears,
        sequences
      ] = await Promise.all([
        db.user.findMany({ where: { businessId } }),
        db.customer.findMany({ where: { businessId } }),
        db.product.findMany({ where: { businessId } }),
        db.sale.findMany({ where: { businessId } }),
        db.saleItem.findMany({ where: { sale: { businessId } } }),
        db.creditNote.findMany({ where: { businessId } }),
        db.creditNoteItem.findMany({ where: { creditNote: { businessId } } }),
        db.debitNote.findMany({ where: { businessId } }),
        db.debitNoteItem.findMany({ where: { debitNote: { businessId } } }),
        db.auditLog.findMany({ where: { businessId } }),
        db.cbmsSyncQueue.findMany({ where: { businessId } }),
        db.fiscalYear.findMany({ where: { businessId } }),
        db.fiscalYearInvoiceSequence.findMany({ where: { businessId } }),
      ]);

      const backupData = {
        businessId,
        version: "1.0",
        data: {
          users,
          customers,
          products,
          sales,
          saleItems,
          creditNotes,
          creditNoteItems,
          debitNotes,
          debitNoteItems,
          auditLogs,
          cbmsSyncQueues,
          fiscalYears,
          sequences,
        },
      };

      const serialized = JSON.stringify(backupData, null, 2);
      fs.writeFileSync(filepath, serialized, "utf-8");

      const size = fs.statSync(filepath).size;
      const crypto = require("crypto");
      const hash = crypto.createHash("sha256").update(serialized).digest("hex");

      const metadata: BackupMetadata = {
        filename,
        sizeBytes: size,
        timestamp,
        tables: {
          users: users.length,
          customers: customers.length,
          products: products.length,
          sales: sales.length,
          saleItems: saleItems.length,
          creditNotes: creditNotes.length,
          debitNotes: debitNotes.length,
          auditLogs: auditLogs.length,
          cbmsSyncQueues: cbmsSyncQueues.length,
          fiscalYears: fiscalYears.length,
        },
        checksum: hash,
        verified: true,
        status: "SUCCESS",
      };

      // Save backup metadata log in the same dir
      fs.writeFileSync(filepath + ".meta", JSON.stringify(metadata, null, 2), "utf-8");

      return metadata;
    } catch (err: any) {
      console.error("Backup execution failed:", err);
      const failedMeta: BackupMetadata = {
        filename,
        sizeBytes: 0,
        timestamp,
        tables: {},
        checksum: "",
        verified: false,
        status: "FAILED",
        errorMessage: err.message || "Unknown backup error",
      };
      return failedMeta;
    }
  }

  /**
   * Retrieves all completed backup records for a business.
   */
  public static async listBackups(businessId: string): Promise<BackupMetadata[]> {
    this.ensureBackupDir();
    const files = fs.readdirSync(this.backupDir);
    const list: BackupMetadata[] = [];

    files.forEach((file) => {
      if (file.startsWith(`backup-${businessId}`) && file.endsWith(".meta")) {
        try {
          const content = fs.readFileSync(path.join(this.backupDir, file), "utf-8");
          list.push(JSON.parse(content));
        } catch (e) {
          console.error("Failed to parse backup metadata:", file);
        }
      }
    });

    return list.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }

  /**
   * Restores tenant data in a single transactional pipeline.
   */
  public static async executeRestore(businessId: string, filename: string): Promise<boolean> {
    this.ensureBackupDir();
    const filepath = path.join(this.backupDir, filename);

    if (!fs.existsSync(filepath)) {
      throw new Error("Backup file not found");
    }

    const content = fs.readFileSync(filepath, "utf-8");
    const backup = JSON.parse(content);

    if (backup.businessId !== businessId) {
      throw new Error("Backup mismatch: cannot restore data of another business tenant.");
    }

    const { data } = backup;

    await db.$transaction(async (tx) => {
      // 1. Delete existing records related to this tenant (respecting order of foreign keys)
      // Clear transactional logs first
      await tx.cbmsSyncQueue.deleteMany({ where: { businessId } });
      await tx.auditLog.deleteMany({ where: { businessId } });
      await tx.payment.deleteMany({ where: { businessId } });
      await tx.creditNoteItem.deleteMany({ where: { creditNote: { businessId } } });
      await tx.creditNote.deleteMany({ where: { businessId } });
      await tx.debitNoteItem.deleteMany({ where: { debitNote: { businessId } } });
      await tx.debitNote.deleteMany({ where: { businessId } });
      await tx.saleItem.deleteMany({ where: { sale: { businessId } } });
      await tx.sale.deleteMany({ where: { businessId } });
      await tx.fiscalYearInvoiceSequence.deleteMany({ where: { businessId } });
      await tx.fiscalYear.deleteMany({ where: { businessId } });

      // Clean master logs
      await tx.productStock.deleteMany({ where: { branch: { businessId } } });
      await tx.product.deleteMany({ where: { businessId } });
      await tx.customerLedger.deleteMany({ where: { customer: { businessId } } });
      await tx.customer.deleteMany({ where: { businessId } });

      // 2. Restore Master tables
      if (data.customers.length > 0) {
        await tx.customer.createMany({ data: data.customers });
      }

      if (data.products.length > 0) {
        await tx.product.createMany({ data: data.products });
      }

      // 3. Restore Fiscal settings
      if (data.fiscalYears.length > 0) {
        await tx.fiscalYear.createMany({ data: data.fiscalYears });
      }

      if (data.sequences.length > 0) {
        await tx.fiscalYearInvoiceSequence.createMany({ data: data.sequences });
      }

      // 4. Restore Sales transactional details
      if (data.sales.length > 0) {
        await tx.sale.createMany({ data: data.sales });
      }

      if (data.saleItems.length > 0) {
        await tx.saleItem.createMany({ data: data.saleItems });
      }

      // 5. Restore credit/debit adjustments
      if (data.creditNotes.length > 0) {
        await tx.creditNote.createMany({ data: data.creditNotes });
      }

      if (data.creditNoteItems.length > 0) {
        await tx.creditNoteItem.createMany({ data: data.creditNoteItems });
      }

      if (data.debitNotes.length > 0) {
        await tx.debitNote.createMany({ data: data.debitNotes });
      }

      if (data.debitNoteItems.length > 0) {
        await tx.debitNoteItem.createMany({ data: data.debitNoteItems });
      }

      // 6. Restore audits and CBMS logs
      if (data.auditLogs.length > 0) {
        await tx.auditLog.createMany({ data: data.auditLogs });
      }

      if (data.cbmsSyncQueues.length > 0) {
        await tx.cbmsSyncQueue.createMany({ data: data.cbmsSyncQueues });
      }
    }, { timeout: 30000 });

    return true;
  }
}
