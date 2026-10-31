import { ESLint } from "eslint";
import { resolve, relative } from "node:path";
import { readFileSync, writeFileSync, readdirSync } from "node:fs";

const result = {};
for (const app of ["frontend", "backend"]) {
  const current = resolve(app), baseline = resolve(process.env.RESTRO_BASELINE_WORKTREE || "scratch/baseline-review", app);
  if (readFileSync(`${current}/eslint.config.mjs`, "utf8") !== readFileSync(`${baseline}/eslint.config.mjs`, "utf8")) throw new Error("Lint configurations differ");
  const lint = async cwd => {
    const engine = new ESLint({ cwd });
    const paths = readdirSync(resolve(cwd, "src"), { recursive: true }).map(p => "src/" + p).concat(readdirSync(cwd).filter(p => /\.(mjs|ts|js)$/.test(p))).filter(p => /\.(tsx|ts|js|mjs)$/.test(p) && p !== "next-env.d.ts");
    const rows = [];
    for (const [index, file] of paths.entries()) {
      if (index % 20 === 0) console.log(`Linting ${cwd.includes("baseline") ? "baseline" : "current"}/${app}: ${index}/${paths.length} (${file})`);
      rows.push(...await engine.lintText(readFileSync(resolve(cwd, file), "utf8"), { filePath: resolve(cwd, file) }));
    }
    return rows;
  };
  const before = (process.argv.includes("--refresh-session-helpers") || process.argv.includes("--refresh-review-fixes")) ? JSON.parse(readFileSync(`scratch/lint-before-${app}.json`, "utf8")) : await lint(baseline);
  console.log(`${app} baseline source/config lint finished`);
  let after;
  if ((process.argv.includes("--refresh-session-helpers") || process.argv.includes("--refresh-review-fixes"))) {
    after = JSON.parse(readFileSync(`scratch/lint-after-${app}.json`, "utf8"));
    const files = ["src/lib/api-helper.ts", ...(app === "backend" ? ["credit-notes", "debit-notes", "payments", "sales/[id]/cancel", "sales/[id]/correct"].map(p => `src/app/api/v1/${p}/route.ts`) : [])];
    for (const file of files) {
      const filePath = resolve(current, file);
      const rows = await new ESLint({ cwd: current }).lintText(readFileSync(filePath, "utf8"), { filePath });
      after = after.filter(row => row.filePath !== filePath).concat(rows);
    }
  } else after = await lint(current);
  writeFileSync(`scratch/lint-before-${app}.json`, JSON.stringify(before));
  writeFileSync(`scratch/lint-after-${app}.json`, JSON.stringify(after));
  const counts = rows => rows.reduce((a, row) => ({ errors: a.errors + row.errorCount, warnings: a.warnings + row.warningCount }), { errors: 0, warnings: 0 });
  const signatures = new Map();
  const signature = (file, message, root) => JSON.stringify([file.replaceAll("\\", "/"), message.ruleId, message.severity, message.message.split(/\n\n(?:[A-Za-z]:[\\/]|\/)/)[0], readFileSync(resolve(root, file), "utf8").split(/\r?\n/)[message.line - 1]?.trim()]);
  for (const row of before) for (const message of row.messages) {
    const key = signature(relative(baseline, row.filePath), message, baseline);
    signatures.set(key, (signatures.get(key) || 0) + 1);
  }
  const introduced = [];
  for (const row of after) for (const message of row.messages) {
    const key = signature(relative(current, row.filePath), message, current), remaining = signatures.get(key) || 0;
    if (remaining) signatures.set(key, remaining - 1);
    else introduced.push({ file: relative(current, row.filePath), ...message });
  }
  result[app] = { baseline: counts(before), current: counts(after), introduced };
}
writeFileSync("scratch/lint-attribution.json", JSON.stringify(result, null, 2));
for (const [app, value] of Object.entries(result)) console.log(JSON.stringify({ app, baseline: value.baseline, current: value.current, introducedErrors: value.introduced.filter(m => m.severity === 2).map(m => ({file: m.file, line: m.line, rule: m.ruleId, message: m.message.split("\n")[0]})) }));
