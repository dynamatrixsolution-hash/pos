import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { isolatedDatabaseUrl } from "./database-verification.mjs";

const target = isolatedDatabaseUrl(process.env.TEST_DATABASE_URL);
if (process.env.DATABASE_URL !== target || process.env.DIRECT_URL !== target) throw new Error("Recovery suite requires the consistent isolated database target");
mkdirSync("scratch", { recursive: true });
const report = `scratch/recovery-results-${randomUUID()}.json`;
const result = spawnSync(process.execPath, ["node_modules/vitest/vitest.mjs", "run", "tests/recovery.integration.test.ts", "--reporter=default", "--reporter=json", `--outputFile=${report}`], { stdio: "inherit", env: { ...process.env, RESTRO_REQUIRE_DATABASE_TESTS: "true" } });
if (result.status !== 0) process.exit(result.status ?? 1);
const parsed = JSON.parse(readFileSync(report, "utf8"));
const cases = (parsed.testResults || []).flatMap(file => file.assertionResults || []);
if (!parsed.success || cases.length !== 8 || cases.some(test => test.status !== "passed")) throw new Error("Recovery verification requires eight executed cases, zero skips");
console.log("Recovery verification: 8 passed, zero skipped.");
