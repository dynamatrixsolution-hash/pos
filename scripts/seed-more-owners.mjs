// scripts/seed-more-owners.mjs
import { PrismaClient } from "../packages/db/client/index.js";
import bcrypt from "bcryptjs";

const db = new PrismaClient();

async function main() {
  console.log("Seeding 3 additional hospitality property owners...");

  const superAdmin = await db.user.findFirst({
    where: { role: "SUPER_ADMIN" },
  });

  if (!superAdmin) throw new Error("Super admin not found");

  const passwordHash = await bcrypt.hash("Password123!", 10);

  const extraProperties = [
    {
      name: "Lumbini Peace Garden Resort",
      slug: "lumbini-resort",
      ownerName: "Aarav Sharma",
      ownerEmail: "aarav@lumbinigarden.com",
      ownerPhone: "+977-9841234567",
      packageType: "HOTEL",
      messages: [
        { text: "Good afternoon. We are configuring the seasonal cottage tariffs for the upcoming pilgrimage season.", fromAdmin: false, minAgo: 90 },
        { text: "Hello Aarav. The dynamic tariff calendar is active on your Enterprise plan. You can batch update room rates under Hotel & Stays.", fromAdmin: true, minAgo: 60 },
        { text: "Noted with thanks. We have updated all 24 garden cottages.", fromAdmin: false, minAgo: 15 },
      ],
    },
    {
      name: "Everest Heritage Bakery & Bistro",
      slug: "everest-bakery",
      ownerName: "Pooja Thapa",
      ownerEmail: "pooja@everestbakery.com",
      ownerPhone: "+977-9851098765",
      packageType: "RESTAURANT",
      messages: [
        { text: "Hi, can you verify if our barcode recipe ingredient tracking is active for pastry production?", fromAdmin: false, minAgo: 180 },
        { text: "Hello Pooja! Yes, automatic recipe consumption deduction is enabled on all KOT and bakery counter sales.", fromAdmin: true, minAgo: 120 },
      ],
    },
    {
      name: "Kathmandu Valley Rooftop Lounge",
      slug: "ktm-rooftop",
      ownerName: "Bikash Adhikari",
      ownerEmail: "bikash@ktmrooftop.com",
      ownerPhone: "+977-9801239876",
      packageType: "RESTAURANT",
      messages: [
        { text: "Hello. Our weekend live acoustic events bring high table turnover. The split bill feature has been very helpful.", fromAdmin: false, minAgo: 300 },
        { text: "Glad to hear that, Bikash! The multi-tender split payment supports eSewa, Fonepay, cash and card simultaneously.", fromAdmin: true, minAgo: 240 },
      ],
    },
  ];

  for (const item of extraProperties) {
    let business = await db.business.findUnique({
      where: { slug: item.slug },
    });

    if (!business) {
      business = await db.business.create({
        data: {
          name: item.name,
          slug: item.slug,
          status: "ACTIVE",
          phone: item.ownerPhone,
          email: item.ownerEmail,
          currency: "NPR",
          settings: { businessType: item.packageType },
        },
      });

      await db.subscription.create({
        data: {
          businessId: business.id,
          plan: "PROFESSIONAL",
          status: "ACTIVE",
          packageType: item.packageType,
          startDate: new Date(),
          endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
        },
      });
    }

    let owner = await db.user.findFirst({
      where: { email: item.ownerEmail },
    });

    if (!owner) {
      owner = await db.user.create({
        data: {
          businessId: business.id,
          name: item.ownerName,
          email: item.ownerEmail,
          phone: item.ownerPhone,
          passwordHash,
          role: "OWNER",
          isActive: true,
        },
      });
    }

    // Insert sample messages
    for (const msg of item.messages) {
      await db.platformDirectMessage.create({
        data: {
          businessId: business.id,
          senderId: msg.fromAdmin ? superAdmin.id : owner.id,
          receiverId: msg.fromAdmin ? owner.id : superAdmin.id,
          content: msg.text,
          isRead: true,
          createdAt: new Date(Date.now() - msg.minAgo * 60 * 1000),
        },
      });
    }
  }

  console.log("Seeding complete! 6 property owners are now active.");
}

main().finally(() => db.$disconnect());
