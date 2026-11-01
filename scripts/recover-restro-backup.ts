import { isolatedDatabaseUrl } from "./database-verification.mjs";

async function main() {
  const target = isolatedDatabaseUrl(process.env.DATABASE_URL);
  if (process.env.DIRECT_URL !== target || process.env.TEST_DATABASE_URL !== target) throw new Error("Recovery requires the consistent isolated restro environment");
  const { configuredBackupStore } = await import("../backend/src/lib/backup-service");
  const { db } = await import("@dynapos/db");
  try {
    const [action, businessId, filename] = process.argv.slice(2);
    if (!businessId) throw new Error("Usage: recovery create <businessId> | recovery restore <businessId> <filename>");
    const store = configuredBackupStore();
    if (action === "create") {
      const metadata = await store.executeBackup(businessId);
      console.log(JSON.stringify(metadata));
    } else if (action === "restore" && filename) {
      await store.restoreMissingTenant(businessId, filename);
      console.log("Missing tenant recovered atomically in isolated PostgreSQL; validate business balances before use.");
    } else throw new Error("Invalid recovery action");
  } finally { await db.$disconnect(); }
}
main().catch(error => { console.error(error instanceof Error ? error.message : "Recovery failed"); process.exitCode = 1; });
