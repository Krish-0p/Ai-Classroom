import { defineConfig, devices } from "@playwright/test";
import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
const url = process.env.TEST_DATABASE_URL;
if (
  !url ||
  url === process.env.DATABASE_URL ||
  new URL(url).pathname !== "/openlearn_test" ||
  !["localhost", "127.0.0.1"].includes(new URL(url).hostname)
)
  throw new Error(
    "Browser tests require a separate local openlearn_test database.",
  );
const baseURL = "http://127.0.0.1:3100";
export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 60000,
  use: { baseURL, trace: "retain-on-failure" },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    {
      name: "mobile",
      use: { ...devices["Pixel 7"], defaultBrowserType: "chromium" },
    },
  ],
  webServer: {
    command: "npm run dev -- --hostname 127.0.0.1 --port 3100",
    url: baseURL,
    reuseExistingServer: false,
    timeout: 120000,
    env: { DATABASE_URL: url, BETTER_AUTH_URL: baseURL },
  },
});
