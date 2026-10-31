import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./backend/src", import.meta.url)) } },
  test: { environment: "node", include: ["tests/**/*.test.ts"], fileParallelism: false },
});
