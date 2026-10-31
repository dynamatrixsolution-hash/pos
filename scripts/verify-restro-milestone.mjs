import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync, openSync, closeSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { isolatedDatabaseUrl } from "./database-verification.mjs";

const mode = process.argv[2];
const names = {
  failed: [
    "rejects negative amounts and mismatched splits without stock or accounting effects",
    "rejects paid cancellation, settled correction and linked payment reversal without partial effects",
  ],
  races: [
    "replays a concurrent duplicate without duplicating any effects",
    "sells the last unit once when negative stock is forbidden",
    "preserves every decrement when configured to allow negative stock",
    "authorizes manual payments and replays them without duplicate settlement",
    "uses independent overlapping PostgreSQL transactions",
    "posts concurrent and repeated opening-stock approvals exactly once",
  ],
}[mode];
if (!names) throw new Error("Expected failed or races verification mode");
const target = isolatedDatabaseUrl(process.env.TEST_DATABASE_URL);
if (process.env.DATABASE_URL !== target || process.env.DIRECT_URL !== target) throw new Error("Isolated URL mismatch");
mkdirSync("scratch", { recursive: true });
const summary = { mode, success: false, rounds: [] };
const rounds = mode === "races" ? 10 : 1;
const pattern = names.map(name => name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|");
try {
  for (let round = 1; round <= rounds; round++) {
    const stem = `scratch/verification-${mode}-${round}-${randomUUID()}`;
    const log = openSync(`${stem}.txt`, "w");
    const result = spawnSync(process.execPath, ["node_modules/vitest/vitest.mjs", "run", "--config", "vitest.config.mts", "tests/commerce.integration.test.ts", "-t", pattern, "--reporter=default", "--reporter=json", `--outputFile=${stem}.json`], {
      env: { ...process.env, RESTRO_REQUIRE_DATABASE_TESTS: "true", RESTRO_OBSERVE_RACES: String(mode === "races"), FORCE_COLOR: "0" },
      stdio: ["ignore", log, log],
    });
    closeSync(log);
    const report = JSON.parse(readFileSync(`${stem}.json`, "utf8"));
    const assertions = report.testResults.flatMap(file => file.assertionResults);
    const selected = assertions.filter(test => names.includes(test.title));
    const witnesses = readFileSync(`${stem}.txt`, "utf8").split(/\r?\n/).filter(line => line.includes("RACE_CONNECTIONS ")).map(line => JSON.parse(line.slice(line.indexOf("RACE_CONNECTIONS ") + 17)));
    const record = { round, exit: result.status, report: `${stem}.json`, log: `${stem}.txt`, passed: selected.filter(test => test.status === "passed").length, deselected: assertions.length - selected.length, witnesses };
    summary.rounds.push(record);
    if (result.status !== 0 || !report.success || selected.length !== names.length || selected.some(test => test.status !== "passed")) {
      throw new Error(`Selected PostgreSQL verification failed in round ${round}; see ${stem}.txt`);
    }
    if (mode === "races" && (witnesses.length !== names.length || names.some(name => !witnesses.some(witness => witness.test === name && new Set(witness.pids).size >= 2)))) {
      throw new Error(`Missing independent-transaction evidence in round ${round}`);
    }
    console.log(`${mode} round ${round}/${rounds}: ${selected.length} selected tests passed; ${record.deselected} intentionally unselected; ${witnesses.length} connection witnesses.`);
  }
  summary.success = true;
} finally {
  writeFileSync(`scratch/verification-${mode}-summary.json`, JSON.stringify(summary, null, 2));
}
