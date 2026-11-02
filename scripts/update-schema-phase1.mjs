import fs from 'node:fs';
import path from 'node:path';

const schemaPath = path.resolve(process.cwd(), 'packages/db/prisma/schema.prisma');
let schema = fs.readFileSync(schemaPath, 'utf8');

// 1. Update Business model
if (!schema.includes('subscriptionInvoices       SubscriptionInvoice[]')) {
  schema = schema.replace(
    /(pilotDailyReconciliations\s+PilotDailyReconciliation\[\]\r?\n)(\})/,
    `$1  status                     String                     @default("ACTIVE") // PENDING, ACTIVE, SUSPENDED, CLOSED
  suspendedReason            String?
  suspendedAt                DateTime?
  subscriptionInvoices       SubscriptionInvoice[]
  subscriptionPayments       SubscriptionPayment[]
  platformAuditLogs          PlatformAuditLog[]
  platformSupportNotes       PlatformSupportNote[]
$2`
  );
}

// 2. Update Subscription model
if (!schema.includes('packageType     String    @default("RESTAURANT")')) {
  schema = schema.replace(
    /(branchLimit\s+Int\s+@default\(1\)\r?\n)(\s*createdAt\s+DateTime\s+@default\(now\)\r?\n)/,
    `$1  billingCycle    String    @default("MONTHLY") // MONTHLY, ANNUAL
  trialEndsAt     DateTime?
  gracePeriodDays Int       @default(7)
  packageType     String    @default("RESTAURANT") // RESTAURANT, HOTEL, BOTH
  enabledModules  String[]  @default([])
  customLimits    Json?
  invoices        SubscriptionInvoice[]
$2`
  );
}

// 3. Update User model
if (!schema.includes('platformAuditLogs           PlatformAuditLog[]')) {
  schema = schema.replace(
    /(reconciledPilotAudits\s+PilotDailyReconciliation\[\]\s+@relation\("PilotReconciledBy"\)\r?\n)(\s*@@unique\(\[businessId,\s*id\]\))/,
    `$1  platformPaymentsRecorded    SubscriptionPayment[]       @relation("PlatformPaymentRecordedBy")
  platformAuditLogs           PlatformAuditLog[]          @relation("PlatformAuditActor")
  platformSupportNotes        PlatformSupportNote[]       @relation("PlatformSupportAuthor")

$2`
  );
}

// 4. Update BusinessRegistrationRequest model
if (!schema.includes('reviewedById      String?')) {
  schema = schema.replace(
    /(createdBusinessId\s+String\?\r?\n)(\s*createdAt\s+DateTime\s+@default\(now\)\r?\n)/,
    `$1  reviewedById      String?
  reviewedAt        DateTime?

$2`
  );
}

fs.writeFileSync(schemaPath, schema, 'utf8');
console.log('Regex update applied!');
