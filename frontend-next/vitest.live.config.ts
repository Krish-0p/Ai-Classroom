import { config } from "dotenv";
import { defineConfig } from "vitest/config";
import base from "./vitest.config";
config({ path: ".env.local", quiet: true });
export default defineConfig({
  ...base,
  test: {
    ...base.test,
    include: ["tests/live/**/*.test.ts"],
    testTimeout: 120_000,
  },
});
