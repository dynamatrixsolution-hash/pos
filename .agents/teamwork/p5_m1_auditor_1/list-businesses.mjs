import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { PrismaClient } = require("../../../packages/db/client");

const primaryUrl = "postgresql://restro_dev:3e0c38bc16116ed5e530270067a32f28ab59656a39dddd60@127.0.0.1:55439/restro_test";
const client = new PrismaClient({ datasourceUrl: primaryUrl });

async function main() {
  const businesses = await client.business.findMany();
  console.log("Found businesses:", businesses.map(b => ({ id: b.id, name: b.name, slug: b.slug, createdAt: b.createdAt })));
  await client.$disconnect();
}

main().catch(console.error);
