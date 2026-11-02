import { readFileSync } from "node:fs";
import { createRequire } from "node:module";

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
  const users = await db.user.findMany({
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      businessId: true,
      business: { select: { name: true, slug: true } }
    }
  });

  console.log("Total users in database:", users.length);
  users.forEach(u => {
    console.log(`- ${u.name} | ${u.email} | ${u.role} | Business: ${u.business?.name} (${u.business?.slug})`);
  });
}

main()
  .catch(console.error)
  .finally(() => db.$disconnect());
