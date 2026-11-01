import { PrismaClient } from "../../../packages/db/client";

const primaryUrl = "postgresql://restro_dev:3e0c38bc16116ed5e530270067a32f28ab59656a39dddd60@127.0.0.1:55439/restro_test";
const client = new PrismaClient({ datasourceUrl: primaryUrl });

async function main() {
  const logs = await client.auditLog.findMany();
  console.log("Total AuditLogs:", logs.length);
  for (const l of logs) {
    console.log(`- id=${l.id}, biz=${l.businessId}, action=${l.action}, entity=${l.entityType}`);
  }
  await client.$disconnect();
}

main().catch(console.error);
