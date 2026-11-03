export function isolatedDatabaseUrl(value) {
  let url;
  try { url = new URL(value || "invalid:"); }
  catch { throw new Error("Refusing invalid database target URL"); }
  if (!["postgres:", "postgresql:"].includes(url.protocol)) {
    throw new Error("Database URL must use postgres: or postgresql: protocol");
  }
  return value;
}

/**
 * The disposable recovery-rehearsal target: separate port, database and role from the
 * restro development/test database, which must never be used as a restore destination here.
 */
export function restoreTargetUrl(value, sourceValue) {
  let url;
  try { url = new URL(value || "invalid:"); }
  catch { throw new Error("Refusing invalid restore target"); }
  if (!["postgres:", "postgresql:"].includes(url.protocol)) {
    throw new Error("Restore target must use postgres: or postgresql: protocol");
  }
  if (sourceValue !== undefined) {
    try {
      if (new URL(sourceValue).href === url.href) {
        throw new Error("Restore target must differ from the source database");
      }
    } catch (e) {
      // Ignored if invalid URL
    }
  }
  return value;
}

export function assertDatabaseReport(report) {
  const cases = (report.testResults || []).flatMap(file => file.assertionResults || []);
  if (!report.success || cases.length < 14 || cases.some(test => test.status !== "passed")) {
    throw new Error(`Database verification incomplete: ${cases.filter(test => test.status === "passed").length}/${cases.length} passed; at least fourteen executed cases and zero skips required`);
  }
  return cases.length;
}
