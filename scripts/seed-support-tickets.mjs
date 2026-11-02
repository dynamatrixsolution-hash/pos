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
  const count = await prisma.platformSupportTicket.count();
  console.log(`Current PlatformSupportTicket count: ${count}`);

  if (count === 0) {
    const businesses = await prisma.business.findMany({ take: 3 });
    if (businesses.length === 0) {
      console.log("No businesses found to link tickets to.");
      return;
    }

    const ticketsData = [
      {
        ticketNumber: "TICK-2026-081",
        businessId: businesses[0].id,
        subject: "Kitchen Display System (KDS) prep alert audio latency",
        category: "TECHNICAL",
        priority: "HIGH",
        status: "OPEN",
        description: "Our kitchen crew noted that sound alerts on KDS orders take 4-5 seconds when tablet is in background battery saving mode. Need optimization guidance.",
        assignedTo: "superadmin@restroinn.com",
      },
      {
        ticketNumber: "TICK-2026-082",
        businessId: businesses[0].id,
        subject: "Request for pilot ops override on room folio split bill",
        category: "MODULE_ACCESS",
        priority: "MEDIUM",
        status: "IN_PROGRESS",
        description: "Guest requested 50% folio settlement via corporate voucher and 50% cash. We need the advanced folio integration enabled on our account.",
        assignedTo: "superadmin@restroinn.com",
      },
      {
        ticketNumber: "TICK-2026-083",
        businessId: businesses[businesses.length - 1].id,
        subject: "Monthly VAT invoice copy request for tax filing",
        category: "BILLING",
        priority: "LOW",
        status: "RESOLVED",
        description: "Please send our monthly subscription invoice with IRD verification stamp for fiscal accounting.",
        assignedTo: "superadmin@restroinn.com",
        resolution: "Tax stamped invoice sent via email and available in Subscription Invoices tab.",
        resolvedAt: new Date(),
      },
    ];

    for (const t of ticketsData) {
      await prisma.platformSupportTicket.create({ data: t });
    }
    console.log(`✓ Seeded ${ticketsData.length} platform support tickets`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

