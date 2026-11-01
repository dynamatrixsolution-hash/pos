import { PrismaClient } from "../../../packages/db/client";

const primaryUrl = "postgresql://restro_dev:3e0c38bc16116ed5e530270067a32f28ab59656a39dddd60@127.0.0.1:55439/restro_test";
const client = new PrismaClient({ datasourceUrl: primaryUrl });

async function main() {
  const triggers = await client.$queryRaw<any[]>`
    SELECT tgname, relname, proname, prosrc
    FROM pg_trigger t
    JOIN pg_class c ON t.tgrelid = c.oid
    JOIN pg_proc p ON t.tgfoid = p.oid
    WHERE NOT tgisinternal;
  `;
  for (const t of triggers) {
    console.log(`- Trigger: ${t.tgname} on ${t.relname}`);
    console.log(`  Source:\n${t.prosrc}\n`);
  }
  await client.$disconnect();
}

main().catch(console.error);
