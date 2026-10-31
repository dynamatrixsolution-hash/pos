import { randomBytes } from "node:crypto";
import { existsSync, writeFileSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { isolatedDatabaseUrl } from "./database-verification.mjs";

const file = new URL("../.env.restro.local", import.meta.url);
if (process.argv[2] === "init") {
  if (existsSync(file)) throw new Error("Isolated environment already exists; refusing to overwrite");
  const password = randomBytes(24).toString("hex");
  const url = `postgresql://restro_dev:${password}@127.0.0.1:55439/restro_test`;
  writeFileSync(file, `RESTRO_DB_PASSWORD=${password}\nDATABASE_URL=${url}\nDIRECT_URL=${url}\nTEST_DATABASE_URL=${url}\nAUTH_SECRET=${randomBytes(32).toString("hex")}\nAUTH_TRUST_HOST=true\nBACKEND_URL=http://127.0.0.1:3001\nENABLE_MOCK_CBMS=false\n`, { mode: 0o600 });
  console.log("Created ignored isolated environment; no credentials printed.");
} else {
  const config = Object.fromEntries(readFileSync(file, "utf8").trim().split(/\r?\n/).map(line => {
    const index = line.indexOf("="); return [line.slice(0, index), line.slice(index + 1)];
  }));
  isolatedDatabaseUrl(config.DATABASE_URL);
  if (config.DIRECT_URL !== config.DATABASE_URL || config.TEST_DATABASE_URL !== config.DATABASE_URL) {
    throw new Error("Refusing non-isolated database target");
  }
  const commands = {
    db: ["docker", ["compose", "--env-file", ".env.restro.local", "-p", "prayassh-restro", "-f", "compose.restro.yml", "up", "-d", "--wait"]],
    migrate: ["node", ["node_modules/prisma/build/index.js", "migrate", "deploy", "--schema", "packages/db/prisma/schema.prisma"]],
    dev: ["node", ["node_modules/concurrently/dist/bin/concurrently.js", "npm run dev --workspace=frontend", "npm run dev --workspace=backend"]],
    integration: ["node", ["scripts/run-db-tests.mjs"]],
    "verify-failed": ["node", ["scripts/verify-restro-milestone.mjs", "failed"]],
    "verify-races": ["node", ["scripts/verify-restro-milestone.mjs", "races"]],
    "backend-build": ["node", ["node_modules/next/dist/bin/next", "build", "backend"]],
    "frontend-build": ["node", ["node_modules/next/dist/bin/next", "build", "frontend"]],
  };
  const command = commands[process.argv[2]];
  if (!command) throw new Error("Expected init, db, migrate, dev, integration, backend-build or frontend-build");
  if (process.argv[2] === "migrate") {
    const require = createRequire(import.meta.url);
    const { PrismaClient } = require("../packages/db/client");
    const client = new PrismaClient({ datasourceUrl: config.DATABASE_URL });
    try {
      const tables = await client.$queryRaw`SELECT tablename FROM pg_tables WHERE schemaname = 'public'`;
      if (tables.some(table => table.tablename !== "_prisma_migrations")) {
        const recorded = tables.some(table => table.tablename === "_prisma_migrations") &&
          await client.$queryRaw`SELECT migration_name FROM "_prisma_migrations" WHERE migration_name = '202610300001_retail_baseline' AND finished_at IS NOT NULL AND rolled_back_at IS NULL`;
        if (!recorded || recorded.length !== 1) throw new Error("Existing unbaselined schema: adoption requires separate review; refusing baseline CREATE");
        console.log("Recognized isolated migration history; applying pending migrations only.");
      } else console.log("Verified empty isolated public schema.");
    } finally { await client.$disconnect(); }
  }
  // Explicit config overrides inherited database variables; Next env files cannot override these values.
  const result = spawnSync(command[0], command[1], { env: { ...process.env, ...config }, stdio: "inherit", shell: false });
  process.exit(result.status ?? 1);
}
