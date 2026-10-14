import { defineConfig } from "vitest/config";
import base from "./vitest.config";
export default defineConfig({
  ...base,
  test: {
    ...base.test,
    include: ["tests/integration/**/*.test.ts"],
    setupFiles: ["tests/integration/setup.ts"],
    fileParallelism: false,
    testTimeout: 20000,
    hookTimeout: 30000,
  },
});
