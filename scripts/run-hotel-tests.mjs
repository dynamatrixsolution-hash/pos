import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { isolatedDatabaseUrl } from "./database-verification.mjs";

const config = Object.fromEntries(
  readFileSync(".env.restro.local", "utf8")
    .split(/\r?\n/)
    .filter(line => line.trim() && !line.trimStart().startsWith("#"))
    .map(line => {
      const idx = line.indexOf("=");
      return [line.slice(0, idx), line.slice(idx + 1)];
    })
);

isolatedDatabaseUrl(config.DATABASE_URL);

const env = {
  ...process.env,
  ...config,
  RESTRO_REQUIRE_DATABASE_TESTS: "true",
};

const result = spawnSync(
  process.execPath,
  ["node_modules/vitest/vitest.mjs", "run", "tests/phase5-hotel-stays.integration.test.ts"],
  { stdio: "inherit", env }
);

process.exit(result.status ?? 0);

