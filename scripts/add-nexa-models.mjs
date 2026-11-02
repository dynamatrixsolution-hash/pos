import fs from "fs";
import path from "path";

const schemaPath = path.resolve(process.cwd(), "packages/db/prisma/schema.prisma");
let schema = fs.readFileSync(schemaPath, "utf8");

// 1. Update Business model
if (!schema.includes("platformSupportTickets     PlatformSupportTicket[]")) {
  schema = schema.replace(
    /(\s*platformSupportNotes\s+PlatformSupportNote\[\]\r?\n)(\})/,
    `$1  platformSupportTickets     PlatformSupportTicket[]\r\n$2`
  );
}

// 2. Update User model
if (!schema.includes("platformNoticesCreated     PlatformNotice[]")) {
  schema = schema.replace(
    /(\s*platformSupportNotes\s+PlatformSupportNote\[\]\s+@relation\("PlatformSupportAuthor"\)\r?\n)(\s*@@unique\(\[businessId,\s*id\]\))/,
    `$1  platformNoticesCreated     PlatformNotice[]            @relation("PlatformNoticeAuthor")\r\n  platformSupportTickets     PlatformSupportTicket[]     @relation("PlatformTicketAuthor")\r\n$2`
  );
}

// 3. Add models at the end
const newModels = `
model PlatformModuleConfig {
  id                  String   @id @default(uuid())
  code                String   @unique // POS, KDS, TABLES, ROOMS, RESERVATIONS, FOLIOS, HOUSEKEEPING, ROOM_SERVICE, GUEST_PORTAL, PILOT_OPS
  name                String
  category            String   // DINING, LODGING, INTEGRATION, OPERATIONS
  description         String
  iconName            String   @default("Box")
  restaurantIncluded  Boolean  @default(false)
  hotelIncluded       Boolean  @default(false)
  bothIncluded        Boolean  @default(true)
  starterIncluded     Boolean  @default(false)
  standardIncluded    Boolean  @default(true)
  proIncluded         Boolean  @default(true)
  enterpriseIncluded  Boolean  @default(true)
  isActive            Boolean  @default(true)
  sortOrder           Int      @default(0)
  createdAt           DateTime @default(now())
  updatedAt           DateTime @updatedAt

  @@index([category, sortOrder])
}

model PlatformNotice {
  id           String    @id @default(uuid())
  title        String
  subheading   String?
  body         String
  priority     String    @default("INFO") // INFO, WARNING, URGENT_MAINTENANCE
  audience     String    @default("ALL") // ALL, RESTAURANT_ONLY, HOTEL_ONLY, BOTH_ONLY
  targetRoles  String[]  @default(["OWNER", "MANAGER"]) // OWNER, MANAGER, CASHIER, ALL
  channels     String[]  @default(["IN_APP"]) // IN_APP, EMAIL, SMS
  startsAt     DateTime  @default(now())
  expiresAt    DateTime?
  isActive     Boolean   @default(true)
  createdById  String?
  createdBy    User?     @relation("PlatformNoticeAuthor", fields: [createdById], references: [id], onDelete: SetNull)
  createdAt    DateTime  @default(now())
  updatedAt    DateTime  @updatedAt

  @@index([isActive, priority, startsAt])
}

model PlatformSetting {
  id          String   @id @default(uuid())
  key         String   @unique // MAINTENANCE_MODE, SUBSCRIPTION_DEFAULTS, GATEWAY_SETTINGS, GENERAL_CONFIG
  value       Json
  category    String   @default("GENERAL") // GENERAL, SECURITY, GATEWAYS, MAINTENANCE, SUBSCRIPTION
  description String?
  updatedById String?
  updatedAt   DateTime @updatedAt

  @@index([category, key])
}

model PlatformSupportTicket {
  id           String    @id @default(uuid())
  ticketNumber String    @unique
  businessId   String
  business     Business  @relation(fields: [businessId], references: [id], onDelete: Cascade)
  userId       String?
  user         User?     @relation("PlatformTicketAuthor", fields: [userId], references: [id], onDelete: SetNull)
  subject      String
  category     String    @default("GENERAL") // BILLING, TECHNICAL, MODULE_ACCESS, URGENT_OUTAGE
  priority     String    @default("MEDIUM") // LOW, MEDIUM, HIGH, URGENT
  status       String    @default("OPEN") // OPEN, IN_PROGRESS, RESOLVED, CLOSED
  description  String
  assignedTo   String?
  resolution   String?
  resolvedAt   DateTime?
  createdAt    DateTime  @default(now())
  updatedAt    DateTime  @updatedAt

  @@index([businessId, status, priority])
}
`;

if (!schema.includes("model PlatformModuleConfig")) {
  schema = schema + "\n" + newModels;
}

fs.writeFileSync(schemaPath, schema, "utf8");
console.log("Updated schema.prisma with NexaEdu platform models!");

