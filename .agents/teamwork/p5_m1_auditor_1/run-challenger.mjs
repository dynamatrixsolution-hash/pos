import fs from "node:fs";
import { spawnSync } from "node:child_process";

const env = Object.fromEntries(
  fs.readFileSync(".env.restro.local", "utf8")
    .split(/\r?\n/)
    .filter(l => l.includes("="))
    .map(l => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)])
);

const res = spawnSync(
  process.execPath,
  ["node_modules/vitest/vitest.mjs", "run", "tests/challenger-p5-m1-schema-acyclicity.test.ts"],
  {
    env: { ...process.env, ...env, TEST_DATABASE_URL: env.DATABASE_URL },
    stdio: "inherit"
  }
);

process.exit(res.status ?? 1);
