import fs from "fs";
import path from "path";

// Load .env.restro.local
const envContent = fs.readFileSync(path.resolve(process.cwd(), ".env.restro.local"), "utf8");
for (const line of envContent.split(/\r?\n/)) {
  if (line.trim() && !line.trimStart().startsWith("#")) {
    const idx = line.indexOf("=");
    if (idx !== -1) {
      process.env[line.slice(0, idx)] = line.slice(idx + 1);
    }
  }
}

import { PrismaClient } from "../packages/db/client/index.js";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding PlatformModuleConfig, PlatformSetting, and PlatformNotice...");

  // 1. Seed PlatformModuleConfig
  const modules = [
    {
      code: "POS",
      name: "Touch POS & Multi-Payment",
      category: "DINING",
      description: "Fast touch terminal for order punching, bill settlement, split payments, and IRD fiscal receipts.",
      iconName: "Store",
      restaurantIncluded: true,
      hotelIncluded: false,
      bothIncluded: true,
      starterIncluded: true,
      standardIncluded: true,
      proIncluded: true,
      enterpriseIncluded: true,
      sortOrder: 1,
    },
    {
      code: "TABLES",
      name: "Table & Floor Plan Grid",
      category: "DINING",
      description: "Visual dining area table layouts, active occupancy states, table transfers, and merges.",
      iconName: "LayoutGrid",
      restaurantIncluded: true,
      hotelIncluded: false,
      bothIncluded: true,
      starterIncluded: true,
      standardIncluded: true,
      proIncluded: true,
      enterpriseIncluded: true,
      sortOrder: 2,
    },
    {
      code: "MENU",
      name: "Menu Engineering & Modifiers",
      category: "DINING",
      description: "Categories, modifier groups, recipe costing, and digital pricing catalogs.",
      iconName: "BookOpen",
      restaurantIncluded: true,
      hotelIncluded: false,
      bothIncluded: true,
      starterIncluded: true,
      standardIncluded: true,
      proIncluded: true,
      enterpriseIncluded: true,
      sortOrder: 3,
    },
    {
      code: "KDS",
      name: "Kitchen Display System (KDS)",
      category: "DINING",
      description: "Real-time kitchen order tickets (KOT), item station routing, course firing, and prep timer alerts.",
      iconName: "UtensilsCrossed",
      restaurantIncluded: true,
      hotelIncluded: false,
      bothIncluded: true,
      starterIncluded: false,
      standardIncluded: true,
      proIncluded: true,
      enterpriseIncluded: true,
      sortOrder: 4,
    },
    {
      code: "ROOMS",
      name: "Room Inventory & Tape Chart",
      category: "LODGING",
      description: "Visual multi-day calendar tape chart, room category assignment, and rate plan management.",
      iconName: "BedDouble",
      restaurantIncluded: false,
      hotelIncluded: true,
      bothIncluded: true,
      starterIncluded: false,
      standardIncluded: true,
      proIncluded: true,
      enterpriseIncluded: true,
      sortOrder: 5,
    },
    {
      code: "RESERVATIONS",
      name: "Reservations & Check-In",
      category: "LODGING",
      description: "Guest booking workflows, front-desk express check-in, key card allocation, and stay lifecycle.",
      iconName: "CalendarDays",
      restaurantIncluded: false,
      hotelIncluded: true,
      bothIncluded: true,
      starterIncluded: false,
      standardIncluded: true,
      proIncluded: true,
      enterpriseIncluded: true,
      sortOrder: 6,
    },
    {
      code: "HOUSEKEEPING",
      name: "Housekeeping Task Dispatch",
      category: "LODGING",
      description: "Room cleanliness tracking (Clean, Dirty, Inspected, Out of Order) and attendant task assignment.",
      iconName: "Sparkles",
      restaurantIncluded: false,
      hotelIncluded: true,
      bothIncluded: true,
      starterIncluded: false,
      standardIncluded: true,
      proIncluded: true,
      enterpriseIncluded: true,
      sortOrder: 7,
    },
    {
      code: "FOLIOS",
      name: "Guest Folio & Night Audit",
      category: "LODGING",
      description: "Master guest accounts, room charges, dining transfers, deposit ledger, and night audit rollover.",
      iconName: "Receipt",
      restaurantIncluded: false,
      hotelIncluded: true,
      bothIncluded: true,
      starterIncluded: false,
      standardIncluded: true,
      proIncluded: true,
      enterpriseIncluded: true,
      sortOrder: 8,
    },
    {
      code: "ROOM_SERVICE",
      name: "Room Service Dining Transfer",
      category: "INTEGRATION",
      description: "Post restaurant and minibar orders directly to active hotel guest folios for single-bill checkout.",
      iconName: "Coffee",
      restaurantIncluded: false,
      hotelIncluded: false,
      bothIncluded: true,
      starterIncluded: false,
      standardIncluded: false,
      proIncluded: true,
      enterpriseIncluded: true,
      sortOrder: 9,
    },
    {
      code: "GUEST_PORTAL",
      name: "Contactless QR Guest Portal",
      category: "OPERATIONS",
      description: "In-room QR code for contactless dining orders, concierge service requests, and bill review.",
      iconName: "QrCode",
      restaurantIncluded: true,
      hotelIncluded: true,
      bothIncluded: true,
      starterIncluded: false,
      standardIncluded: true,
      proIncluded: true,
      enterpriseIncluded: true,
      sortOrder: 10,
    },
    {
      code: "PILOT_OPS",
      name: "Offline Pilot Sync & Cash Float",
      category: "OPERATIONS",
      description: "Offline-resilient shift reconciliation, cash drawer audits, and dual-entry end-of-day signoffs.",
      iconName: "WifiOff",
      restaurantIncluded: true,
      hotelIncluded: true,
      bothIncluded: true,
      starterIncluded: true,
      standardIncluded: true,
      proIncluded: true,
      enterpriseIncluded: true,
      sortOrder: 11,
    },
  ];

  for (const m of modules) {
    await prisma.platformModuleConfig.upsert({
      where: { code: m.code },
      update: m,
      create: m,
    });
  }
  console.log(`✓ Upserted ${modules.length} platform module definitions`);

  // 2. Seed PlatformSettings
  const settings = [
    {
      key: "MAINTENANCE_MODE",
      category: "MAINTENANCE",
      description: "Global platform maintenance mode switch and visitor notice",
      value: {
        enabled: false,
        message: "RestroInn is currently undergoing scheduled platform upgrades. We will be back online shortly.",
        allowedIps: ["127.0.0.1", "::1"],
      },
    },
    {
      key: "SUBSCRIPTION_DEFAULTS",
      category: "SUBSCRIPTION",
      description: "Default subscription rules, grace periods, and payment terms",
      value: {
        trialDurationDays: 14,
        gracePeriodDays: 7,
        invoiceDueDays: 15,
        defaultCurrency: "NPR",
        autoReminderDaysBeforeDue: 3,
      },
    },
    {
      key: "GATEWAY_SETTINGS",
      category: "GATEWAYS",
      description: "Nepal SMS and transaction notification gateways",
      value: {
        smsProvider: "SPARROW_SMS",
        smsApiKey: "mock-sparrow-key-2026",
        smsSenderId: "RestroInn",
        emailProvider: "SMTP",
        emailSender: "noreply@restroinn.com",
      },
    },
    {
      key: "GENERAL_CONFIG",
      category: "GENERAL",
      description: "Core platform branding, support contact, and locale settings",
      value: {
        platformName: "RestroInn Platform",
        supportEmail: "support@restroinn.com",
        emergencyPhone: "+977-1-4400000",
        timeZone: "Asia/Kathmandu",
        taxSystem: "NEPAL_IRD_VAT",
      },
    },
  ];

  for (const s of settings) {
    await prisma.platformSetting.upsert({
      where: { key: s.key },
      update: s,
      create: s,
    });
  }
  console.log(`✓ Upserted ${settings.length} platform settings`);

  // 3. Seed PlatformNotice
  const noticeCount = await prisma.platformNotice.count();
  if (noticeCount === 0) {
    await prisma.platformNotice.create({
      data: {
        title: "Welcome to RestroInn Platform 2.0",
        subheading: "Hospitality Operations Reimagined",
        body: "We have rolled out our new high-speed KDS and Folio settlement workflows. If you need any assistance, reach out to our platform support team.",
        priority: "INFO",
        audience: "ALL",
        targetRoles: ["OWNER", "MANAGER"],
        channels: ["IN_APP"],
        isActive: true,
      },
    });
    console.log("✓ Created initial platform notice");
  }

  console.log("All NexaEdu platform models seeded successfully!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
