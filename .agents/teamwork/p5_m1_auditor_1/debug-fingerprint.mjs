import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { PrismaClient } = require("../../../packages/db/client");
const { backupModels } = require("../../../backend/src/lib/backup-format");

const primaryUrl = "postgresql://restro_dev:3e0c38bc16116ed5e530270067a32f28ab59656a39dddd60@127.0.0.1:55439/restro_test";
const client = new PrismaClient({ datasourceUrl: primaryUrl });

const ident = (name) => `"${name}"`;

async function main() {
  const tableNames = [...backupModels.map(entity => entity.name), "BusinessRegistrationRequest"];
  
  async function fingerprint() {
    const result = {};
    for (const name of tableNames) {
      const [row] = await client.$queryRawUnsafe(`SELECT count(*)::int AS n, coalesce(md5(string_agg(t::text, '|' ORDER BY t."id")), '') AS h FROM ${ident(name)} t`);
      result[name] = `${row.n}:${row.h}`;
    }
    return result;
  }

  const fp1 = await fingerprint();
  console.log("Fingerprint captured: sample tables:");
  console.log("Business:", fp1["Business"]);
  console.log("Room:", fp1["Room"]);
  console.log("RoomType:", fp1["RoomType"]);
  console.log("RoomAllocation:", fp1["RoomAllocation"]);
  await client.$disconnect();
}

main().catch(console.error);
