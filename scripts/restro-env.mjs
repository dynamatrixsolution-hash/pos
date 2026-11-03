import { randomBytes } from "node:crypto";
import { existsSync, writeFileSync, readFileSync, appendFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { isolatedDatabaseUrl } from "./database-verification.mjs";

const envFile = existsSync(new URL("../.env", import.meta.url))
  ? new URL("../.env", import.meta.url)
  : new URL("../.env.restro.local", import.meta.url);

if (process.argv[2] === "init") {
  if (existsSync(envFile)) throw new Error("Environment configuration file already exists; refusing to overwrite");
  const password = randomBytes(24).toString("hex");
  const url = `postgresql://postgres:${password}@127.0.0.1:5432/restro_pos`;
  writeFileSync(envFile, `RESTRO_DB_PASSWORD=${password}\nDATABASE_URL=${url}\nDIRECT_URL=${url}\nTEST_DATABASE_URL=${url}\nAUTH_SECRET=${randomBytes(32).toString("hex")}\nAUTH_TRUST_HOST=true\nBACKEND_URL=http://127.0.0.1:3001\nENABLE_MOCK_CBMS=false\n`, { mode: 0o600 });
  console.log("Created environment file.");
} else {
  if (!existsSync(envFile)) {
    throw new Error(`Configuration file not found. Create .env or .env.restro.local`);
  }
  const config = Object.fromEntries(readFileSync(envFile, "utf8").split(/\r?\n/).filter(line => line.trim() && !line.trimStart().startsWith("#")).map(line => {
    if (!/^[A-Z][A-Z0-9_]*=/.test(line)) throw new Error("Invalid environment entry; expected KEY=value");
    const index = line.indexOf("="); return [line.slice(0, index), line.slice(index + 1)];
  }));

  if (config.DATABASE_URL) {
    isolatedDatabaseUrl(config.DATABASE_URL);
    if (!config.DIRECT_URL) config.DIRECT_URL = config.DATABASE_URL;
    if (!config.TEST_DATABASE_URL) config.TEST_DATABASE_URL = config.DATABASE_URL;
  }

  if (process.argv[2] === "recovery-config") {
    const additions = [];
    if (!config.BACKUP_ENCRYPTION_KEY) additions.push(`BACKUP_ENCRYPTION_KEY=${randomBytes(32).toString("hex")}`);
    if (!config.BACKUP_DIRECTORY) additions.push(`BACKUP_DIRECTORY=${fileURLToPath(new URL("../scratch/restro-backups", import.meta.url))}`);
    if (additions.length) appendFileSync(envFile, `\n${additions.join("\n")}\n`);
    console.log("Isolated recovery settings present; credentials not printed.");
    process.exit(0);
  }
  const commands = {
    db: ["docker", ["compose", "--env-file", ".env.restro.local", "-p", "prayassh-restro", "-f", "compose.restro.yml", "up", "-d", "--wait"]],
    migrate: ["node", ["node_modules/prisma/build/index.js", "migrate", "deploy", "--schema", "packages/db/prisma/schema.prisma"]],
    push: ["node", ["node_modules/prisma/build/index.js", "db", "push", "--schema", "packages/db/prisma/schema.prisma"]],
    seed: ["node", ["node_modules/tsx/dist/cli.mjs", "packages/db/prisma/seed.ts"]],
    dev: ["node", ["node_modules/concurrently/dist/bin/concurrently.js", "npm run dev --workspace=frontend", "npm run dev --workspace=backend"]],
    integration: ["node", ["scripts/run-db-tests.mjs"]],
    "recovery-test": ["node", ["scripts/run-recovery-tests.mjs"]],
    "security-test": ["node", ["scripts/run-security-tests.mjs"]],
    "lifecycle-test": ["node", ["scripts/run-lifecycle-tests.mjs"]],
    "restaurant-test": ["node", ["scripts/run-restaurant-tests.mjs"]],
    "kitchen-test": ["node", ["scripts/run-kitchen-tests.mjs"]],
    "hotel-test": ["node", ["scripts/run-hotel-tests.mjs"]],
    "folio-test": ["node", ["scripts/run-folio-tests.mjs"]],
    "guest-qr-test": ["node", ["scripts/run-guest-qr-tests.mjs"]],
    "pilot-test": ["node", ["scripts/run-pilot-tests.mjs"]],
    recovery: ["node", ["node_modules/tsx/dist/cli.mjs", "scripts/recover-restro-backup.ts", ...process.argv.slice(3)]],
    "verify-failed": ["node", ["scripts/verify-restro-milestone.mjs", "failed"]],
    "verify-races": ["node", ["scripts/verify-restro-milestone.mjs", "races"]],
    "backend-build": ["node", ["node_modules/next/dist/bin/next", "build", "backend"]],
  };
  const command = commands[process.argv[2]];
  if (!command) throw new Error(`Unknown command ${process.argv[2]}`);
  const env = { ...process.env, ...config };
  const child = spawnSync(command[0], command[1], { stdio: "inherit", env });
  process.exit(child.status ?? 1);
}
