import { NextResponse } from "next/server";
import { getSessionContext, authErrorResponse, roleErrorResponse } from "@/lib/api-helper";
import { BackupError, BackupService } from "@/lib/backup-service";
import { db } from "@/lib/db";
import { z } from "zod";

const actionSchema = z.object({ action: z.enum(["backup", "restore"]), filename: z.string().optional() }).strict();
function failure(error: unknown) {
  return NextResponse.json({ error: error instanceof BackupError ? error.message : "Backup operation failed" }, { status: error instanceof BackupError ? error.status : 500 });
}
export async function GET() {
  const context = await getSessionContext();
  if (!context) return authErrorResponse();
  if (!["OWNER", "SUPER_ADMIN"].includes(context.role)) return roleErrorResponse();
  try { return NextResponse.json(await BackupService.listBackups(context.businessId)); }
  catch (error) { return failure(error); }
}
export async function POST(request: Request) {
  const context = await getSessionContext();
  if (!context) return authErrorResponse();
  if (!["OWNER", "SUPER_ADMIN"].includes(context.role)) return roleErrorResponse();
  const parsed = actionSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid backup action" }, { status: 400 });
  try {
    if (parsed.data.action === "restore") return await BackupService.executeRestore(context.businessId, parsed.data.filename || "");
    const metadata = await BackupService.executeBackup(context.businessId);
    await db.auditLog.create({ data: {
      businessId: context.businessId, userId: context.userId, role: context.role,
      action: "BACKUP_CREATE", module: "BACKUP",
      details: `Encrypted tenant archive ${metadata.filename} created. Integrity authenticated; recovery NOT rehearsed.`,
      newValue: JSON.parse(JSON.stringify(metadata)),
    } });
    return NextResponse.json({ message: "Encrypted tenant snapshot created; recovery rehearsal is still required", metadata });
  } catch (error) { return failure(error); }
}
