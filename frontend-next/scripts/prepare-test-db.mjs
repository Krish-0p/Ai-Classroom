import { config } from "dotenv";
import { spawnSync } from "node:child_process";
config({ path: ".env.local", quiet: true });
config({ quiet: true });
const url = process.env.TEST_DATABASE_URL;
if (
  !url ||
  url === process.env.DATABASE_URL ||
  new URL(url).pathname !== "/openlearn_test" ||
  !["localhost", "127.0.0.1"].includes(new URL(url).hostname)
)
  throw new Error(
    "Set TEST_DATABASE_URL to a separate local openlearn_test database.",
  );
const result = spawnSync(
  process.execPath,
  ["node_modules/prisma/build/index.js", "migrate", "deploy"],
  { env: { ...process.env, DATABASE_URL: url }, stdio: "inherit" },
);
process.exit(result.status ?? 1);
