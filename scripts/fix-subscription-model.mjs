import fs from 'node:fs';

let content = fs.readFileSync('packages/db/prisma/schema.prisma', 'utf8');
content = content.replace(
  /branchLimit\s+Int\s+@default\(1\)/,
  `branchLimit     Int                   @default(1)
  billingCycle    String                @default("MONTHLY") // MONTHLY, ANNUAL
  trialEndsAt     DateTime?
  gracePeriodDays Int                   @default(7)
  packageType     String                @default("RESTAURANT") // RESTAURANT, HOTEL, BOTH
  enabledModules  String[]              @default([])
  customLimits    Json?
  invoices        SubscriptionInvoice[]`
);
fs.writeFileSync('packages/db/prisma/schema.prisma', content, 'utf8');
console.log('Subscription model updated successfully!');

