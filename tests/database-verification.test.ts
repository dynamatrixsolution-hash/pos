import { expect, it } from "vitest";
import { isolatedDatabaseUrl, assertDatabaseReport } from "../scripts/database-verification.mjs";

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
