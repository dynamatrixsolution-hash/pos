import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import bcrypt from "bcryptjs";

const require = createRequire(import.meta.url);
const { PrismaClient } = require("../packages/db/client");

const envConfig = Object.fromEntries(
  readFileSync(".env.restro.local", "utf8")
    .split(/\r?\n/)
    .filter((line) => line.trim() && !line.trimStart().startsWith("#"))
    .map((line) => {
      const idx = line.indexOf("=");
      return [line.slice(0, idx), line.slice(idx + 1)];
    })
);

const db = new PrismaClient({ datasourceUrl: envConfig.DATABASE_URL });

async function main() {
  console.log("Seeding Super Admin user...");

  // 1. Find existing business
  let business = await db.business.findFirst({
    include: {
      branches: true,
      subscription: true,
    },
  });

  if (!business) {
    throw new Error("No business found in database. Please run restro seed first.");
  }

  // Ensure subscription is active
  if (!business.subscription) {
    const oneYear = new Date();
    oneYear.setFullYear(oneYear.getFullYear() + 1);
    await db.subscription.create({
      data: {
        businessId: business.id,
        plan: "ENTERPRISE",
        status: "ACTIVE",
        startDate: new Date(),
        endDate: oneYear,
        userLimit: 100,
        branchLimit: 50,
      },
    });
    console.log("Created active ENTERPRISE subscription for business:", business.name);
  }

  const mainBranch = business.branches[0] || null;

  // 2. Hash password "Password123!"
  const salt = bcrypt.genSaltSync(10);
  const passwordHash = bcrypt.hashSync("Password123!", salt);

  // 3. Upsert Super Admin
  const superAdmin = await db.user.upsert({
    where: { email: "superadmin@restroinn.com" },
    update: {
      passwordHash,
      role: "SUPER_ADMIN",
      isActive: true,
      deletedAt: null,
      name: "Platform Super Admin",
      businessId: business.id,
      branchId: mainBranch ? mainBranch.id : null,
    },
    create: {
      email: "superadmin@restroinn.com",
      passwordHash,
      role: "SUPER_ADMIN",
      isActive: true,
      name: "Platform Super Admin",
      phone: "+977-9800000000",
      businessId: business.id,
      branchId: mainBranch ? mainBranch.id : null,
    },
  });

  console.log("==========================================");
  console.log("SUPER ADMIN SEEDED SUCCESSFULLY!");
  console.log("==========================================");
  console.log("Email:    superadmin@restroinn.com");
  console.log("Password: Password123!");
  console.log("Role:     " + superAdmin.role);
  console.log("Business: " + business.name + " (" + business.slug + ")");
  console.log("User ID:  " + superAdmin.id);
  console.log("==========================================");
}

main()
  .catch((err) => {
    console.error("Error seeding super admin:", err);
    process.exit(1);
  })
  .finally(() => db.$disconnect());

