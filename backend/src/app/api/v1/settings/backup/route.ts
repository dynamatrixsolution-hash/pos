import { NextResponse } from "next/server";
import { getSessionContext, authErrorResponse, roleErrorResponse } from "@/lib/api-helper";
import { BackupService } from "@/lib/backup-service";
import { db } from "@/lib/db";
import { z } from "zod";

const backupActionSchema = z.object({
  action: z.enum(["backup", "restore"]),
  filename: z.string().optional(),
});

export async function GET() {
  const context = await getSessionContext();
  if (!context) return authErrorResponse();

  if (context.role !== "OWNER" && context.role !== "SUPER_ADMIN" && context.role !== "MANAGER") {
    return roleErrorResponse();
  }

  try {
    const backups = await BackupService.listBackups(context.businessId);
    return NextResponse.json(backups);
  } catch (error: any) {
    console.error("GET backups list error:", error);
    return NextResponse.json({ error: "Failed to load backups list" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const context = await getSessionContext();
  if (!context) return authErrorResponse();

  // Backups and restores are strictly restricted to OWNER or SUPER_ADMIN
  if (context.role !== "OWNER" && context.role !== "SUPER_ADMIN") {
    return roleErrorResponse();
  }

  const headers = request.headers;
  const xForwardedFor = headers.get("x-forwarded-for");
  const ipAddress = xForwardedFor ? xForwardedFor.split(",")[0].trim() : (headers.get("x-real-ip") || "127.0.0.1");
  const deviceInfo = headers.get("user-agent") || "Unknown Device";

  try {
    const body = await request.json();
    const result = backupActionSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: "Validation failed", details: result.error.format() },
        { status: 400 }
      );
    }

    const { action, filename } = result.data;

    if (action === "backup") {
      const metadata = await BackupService.executeBackup(context.businessId);

      if (metadata.status === "SUCCESS") {
        await db.auditLog.create({
          data: {
            businessId: context.businessId,
            userId: context.userId,
            role: context.role,
            action: "BACKUP_CREATE",
            module: "BACKUP",
            details: `Created database backup file: ${metadata.filename}. Size: ${metadata.sizeBytes} bytes. Verified: true.`,
            newValue: JSON.parse(JSON.stringify(metadata)),
            ipAddress,
            deviceInfo,
          },
        });

        return NextResponse.json({
          message: "Database backup created successfully",
          metadata,
        });
      } else {
        await db.auditLog.create({
          data: {
            businessId: context.businessId,
            userId: context.userId,
            role: context.role,
            action: "BACKUP_FAILURE",
            module: "BACKUP",
            details: `Database backup failed. Error: ${metadata.errorMessage || "Unknown failure"}`,
            ipAddress,
            deviceInfo,
          },
        });

        return NextResponse.json({ error: "Backup execution failed: " + metadata.errorMessage }, { status: 500 });
      }
    }

    if (action === "restore") {
      if (!filename) {
        return NextResponse.json({ error: "Filename is required to restore" }, { status: 400 });
      }

      await BackupService.executeRestore(context.businessId, filename);

      await db.auditLog.create({
        data: {
          businessId: context.businessId,
          userId: context.userId,
          role: context.role,
          action: "BACKUP_RESTORE",
          module: "BACKUP",
          details: `Successfully restored database configuration from backup file: ${filename}`,
          ipAddress,
          deviceInfo,
        },
      });

      return NextResponse.json({
        message: "Database successfully restored from backup file",
      });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error: any) {
    console.error("POST backup/restore error:", error.message || error);
    return NextResponse.json({ error: error.message || "Failed to process backup operation" }, { status: 500 });
  }
}
