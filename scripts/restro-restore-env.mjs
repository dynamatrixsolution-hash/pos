import { randomBytes } from "node:crypto";
import { existsSync, writeFileSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { isolatedDatabaseUrl, restoreTargetUrl } from "./database-verification.mjs";

// Launcher for the DISPOSABLE restore target (127.0.0.1:55440/restro_restore).
// The source remains the existing restro development database, which is only ever read.
const targetFile = new URL("../.env.restro-restore.local", import.meta.url);
const sourceFile = new URL("../.env.restro.local", import.meta.url);

function parse(file) {
  return Object.fromEntries(readFileSync(file, "utf8").split(/\r?\n/).filter(line => line.trim() && !line.trimStart().startsWith("#")).map(line => {
    if (!/^[A-Z][A-Z0-9_]*=/.test(line)) throw new Error("Invalid environment entry; expected KEY=value");
    const index = line.indexOf("="); return [line.slice(0, index), line.slice(index + 1)];
  }));
}

if (process.argv[2] === "init") {
  if (existsSync(targetFile)) throw new Error("Restore-target environment already exists; refusing to overwrite");
  const password = randomBytes(24).toString("hex");
  const url = `postgresql://restro_restore:${password}@127.0.0.1:55440/restro_restore`;
  writeFileSync(targetFile, `RESTRO_RESTORE_DB_PASSWORD=${password}\nRESTORE_TARGET_DATABASE_URL=${url}\n`, { mode: 0o600 });
  console.log("Created ignored restore-target environment; no credentials printed.");
} else {
  const target = parse(targetFile);
  const source = parse(sourceFile);
  restoreTargetUrl(target.RESTORE_TARGET_DATABASE_URL, source.DATABASE_URL);
  isolatedDatabaseUrl(source.DATABASE_URL);
  const commands = {
    db: ["docker", ["compose", "--env-file", ".env.restro-restore.local", "-p", "prayassh-restro-restore", "-f", "compose.restro-restore.yml", "up", "-d", "--wait"]],
    migrate: ["node", ["node_modules/prisma/build/index.js", "migrate", "deploy", "--schema", "packages/db/prisma/schema.prisma"]],
    rehearse: ["node", ["node_modules/tsx/dist/cli.mjs", "scripts/rehearse-recovery.ts"]],
  };
  const command = commands[process.argv[2]];
  if (!command) throw new Error("Expected init, db, migrate or rehearse");
  if (process.argv[2] === "migrate") {
    // Only the disposable target is ever migrated, and only while it is empty or already at the baseline.
    const require = createRequire(import.meta.url);
    const { PrismaClient } = require("../packages/db/client");
    const client = new PrismaClient({ datasourceUrl: target.RESTORE_TARGET_DATABASE_URL });
    try {
      const tables = await client.$queryRaw`SELECT tablename FROM pg_tables WHERE schemaname = 'public'`;
      if (tables.some(table => table.tablename !== "_prisma_migrations") && !tables.some(table => table.tablename === "_prisma_migrations")) {
        throw new Error("Restore target holds an unbaselined schema; refusing");
      }
    } finally { await client.$disconnect(); }
  }
  // migrate deploys to the restore target; every other command receives source + target explicitly.
  const env = process.argv[2] === "migrate"
    ? { ...process.env, DATABASE_URL: target.RESTORE_TARGET_DATABASE_URL, DIRECT_URL: target.RESTORE_TARGET_DATABASE_URL }
    : { ...process.env, ...source, RESTORE_TARGET_DATABASE_URL: target.RESTORE_TARGET_DATABASE_URL, RESTORE_ENV_PASSWORD: target.RESTRO_RESTORE_DB_PASSWORD };
  const result = spawnSync(command[0], command[1], { env, stdio: "inherit", shell: false });
  if (result.error) console.error(`Command could not start: ${result.error.code || "spawn error"}`);
  process.exit(result.status ?? 1);
}

