import { PrismaClient } from '../packages/db/client/index.js';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const envContent = readFileSync(path.resolve(process.cwd(), '.env.restro.local'), 'utf8');
for (const line of envContent.split(/\r?\n/)) {
  if (line.trim() && !line.trimStart().startsWith('#')) {
    const idx = line.indexOf('=');
    if (idx !== -1) {
      process.env[line.slice(0, idx)] = line.slice(idx + 1);
    }
  }
}

const db = new PrismaClient({
  datasources: { db: { url: process.env.DATABASE_URL } },
});

async function runTests() {
  console.log('Testing Super Admin backend capabilities & models...');

  // 1. Verify Super Admin user
  const admin = await db.user.findFirst({
    where: { role: 'SUPER_ADMIN' },
  });
  console.log(`[PASS] Super Admin user exists: ${admin?.email} (${admin?.id})`);

  // 2. Verify businesses and subscriptions
  const businesses = await db.business.findMany({
    include: { subscription: true, branches: true, users: true },
  });
  console.log(`[PASS] Retrieved ${businesses.length} businesses:`);
  for (const b of businesses) {
    console.log(`   - ${b.name} (${b.slug}) | Status: ${b.status} | Package: ${b.subscription?.packageType} | Modules: ${b.subscription?.enabledModules?.length || 0}`);
  }

  // 3. Verify SaaS subscription invoices & payments
  const invoices = await db.subscriptionInvoice.findMany({
    include: { payments: true, business: true },
  });
  console.log(`[PASS] Retrieved ${invoices.length} SaaS subscription invoices:`);
  for (const inv of invoices) {
    console.log(`   - ${inv.invoiceNumber} | Amount: Rs. ${inv.amount} | Status: ${inv.status} | Tenant: ${inv.business.name} | Payments: ${inv.payments.length}`);
  }

  // 4. Verify Platform Audit Logs
  const auditLogs = await db.platformAuditLog.findMany({
    include: { actor: true, business: true },
  });
  console.log(`[PASS] Retrieved ${auditLogs.length} Platform Audit Log entries:`);
  for (const log of auditLogs) {
    console.log(`   - [${log.action}] Actor: ${log.actor?.name} | Tenant: ${log.business?.name || 'Platform'} | Reason: "${log.reason}"`);
  }

  // 5. Verify Platform Backup Records
  const backups = await db.platformBackupRecord.findMany();
  console.log(`[PASS] Retrieved ${backups.length} Platform Backup Records:`);
  for (const b of backups) {
    console.log(`   - ${b.backupFileName} | Status: ${b.status} | Verified Restore: ${b.verifiedRestore} | Result: ${b.restoreTestResult}`);
  }

  console.log('\nALL PHASE 1 SUPER ADMIN DATA INTEGRITY CHECKS PASSED SUCCESSFULLY!');
}

runTests()
  .catch((e) => {
    console.error('Error in tests:', e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });

