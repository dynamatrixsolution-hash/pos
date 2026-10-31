export function isolatedDatabaseUrl(value) {
  let url;
  try { url = new URL(value || "invalid:"); }
  catch { throw new Error("Refusing invalid isolated database target"); }
  if (!["postgres:", "postgresql:"].includes(url.protocol) || url.hostname !== "127.0.0.1" || url.port !== "55439" || url.pathname !== "/restro_test" || url.username !== "restro_dev" || url.search || url.hash) {
    throw new Error("Refusing non-isolated database target");
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
