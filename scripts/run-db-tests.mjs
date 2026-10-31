import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { isolatedDatabaseUrl, assertDatabaseReport } from "./database-verification.mjs";

const target = isolatedDatabaseUrl(process.env.TEST_DATABASE_URL);
if (process.env.DATABASE_URL !== target || process.env.DIRECT_URL !== target) throw new Error("Database environment must consistently select the isolated target");
mkdirSync("scratch", { recursive: true });
const reportFile = `scratch/database-results-${randomUUID()}.json`;
const result = spawnSync(process.execPath, ["node_modules/vitest/vitest.mjs", "run", "--config", "vitest.config.mts", "tests/commerce.integration.test.ts", "--reporter=default", "--reporter=json", `--outputFile=${reportFile}`], {
  env: { ...process.env, RESTRO_REQUIRE_DATABASE_TESTS: "true", RESTRO_OBSERVE_RACES: "false" }, stdio: "inherit",
});
if (result.status !== 0) process.exit(result.status ?? 1);
const count = assertDatabaseReport(JSON.parse(readFileSync(reportFile, "utf8")));
console.log(`Database verification: ${count} passed, zero skipped.`);
