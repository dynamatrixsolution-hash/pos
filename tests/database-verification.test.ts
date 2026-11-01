import { expect, it } from "vitest";
import { isolatedDatabaseUrl, assertDatabaseReport, restoreTargetUrl } from "../scripts/database-verification.mjs";

it("rejects missing, remote and query-overridden database targets", () => {
  for (const url of [undefined, "malformed-synthetic-secret", "postgresql://restro_dev:x@remote:55439/restro_test", "postgresql://restro_dev:x@127.0.0.1:55439/restro_test?host=remote"]) expect(() => isolatedDatabaseUrl(url)).toThrow(/Refusing/);
});
it("fails zero-case and skipped database reports", () => {
  expect(() => assertDatabaseReport({ success: true, testResults: [] })).toThrow();
  expect(() => assertDatabaseReport({ success: true, testResults: [{ assertionResults: Array.from({ length: 14 }, () => ({ status: "pending" })) }] })).toThrow();
});
it("rejects a partial run with fewer than fourteen database cases", () => {
  expect(() => assertDatabaseReport({ success: true, testResults: [{ assertionResults: Array.from({ length: 13 }, () => ({ status: "passed" })) }] })).toThrow();
});
it("accepts at least fourteen actually passed database cases", () => {
  expect(assertDatabaseReport({ success: true, testResults: [{ assertionResults: Array.from({ length: 14 }, () => ({ status: "passed" })) }] })).toBe(14);
});

it("accepts only the disposable restore target and never the restro source database", () => {
  const source = "postgresql://restro_dev:x@127.0.0.1:55439/restro_test";
  expect(restoreTargetUrl("postgresql://restro_restore:x@127.0.0.1:55440/restro_restore", source)).toContain("55440");
  for (const url of [undefined, source, "postgresql://restro_dev:x@127.0.0.1:55440/restro_restore", "postgresql://restro_restore:x@remote:55440/restro_restore", "postgresql://restro_restore:x@127.0.0.1:55440/restro_test", "postgresql://restro_restore:x@127.0.0.1:55440/restro_restore?host=remote"]) {
    expect(() => restoreTargetUrl(url, source)).toThrow(/Refusing/);
  }
  expect(() => restoreTargetUrl("postgresql://restro_restore:x@127.0.0.1:55440/restro_restore", "postgresql://a:x@127.0.0.1:55440/b")).toThrow(/differ/);
});
