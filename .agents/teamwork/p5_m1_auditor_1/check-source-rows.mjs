import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { PrismaClient } = require("../../../packages/db/client");
const { backupModels } = require("../../../backend/src/lib/backup-format");

const primaryUrl = "postgresql://restro_dev:3e0c38bc16116ed5e530270067a32f28ab59656a39dddd60@127.0.0.1:55439/restro_test";
const client = new PrismaClient({ datasourceUrl: primaryUrl });

const ident = (name) => `"${name}"`;

async function main() {
  const tableNames = [...backupModels.map(entity => entity.name), "BusinessRegistrationRequest"];
  console.log("Checking row count for all tables in source:");
  let totalRows = 0;
  for (const name of tableNames) {
    const [row] = await client.$queryRawUnsafe(`SELECT count(*)::int AS n, coalesce(md5(string_agg(t::text, '|' ORDER BY t."id")), '') AS h FROM ${ident(name)} t`);
    if (row.n > 0) {
      console.log(`Table ${name}: n=${row.n}, hash=${row.h}`);
      totalRows += row.n;
    }
  }
  console.log(`Total non-empty tables rows: ${totalRows}`);
  await client.$disconnect();
}

main().catch(console.error);
