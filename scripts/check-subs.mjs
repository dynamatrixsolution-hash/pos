import { PrismaClient } from "../packages/db/client/index.js";

const db = new PrismaClient();

async function main() {
  const subs = await db.subscription.findMany({
    include: { business: true },
  });
  console.log("SUBSCRIPTIONS:", subs);

  const businesses = await db.business.findMany({
    include: { subscription: true },
  });
  console.log("BUSINESSES:", businesses.map(b => ({ id: b.id, name: b.name, slug: b.slug, sub: b.subscription?.plan })));
}

main().finally(() => db.$disconnect());

