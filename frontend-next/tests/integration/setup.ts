import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
config({ quiet: true });
const testURL = process.env.TEST_DATABASE_URL;
if (
  !testURL ||
  testURL === process.env.DATABASE_URL ||
  new URL(testURL).pathname !== "/openlearn_test" ||
  !["localhost", "127.0.0.1"].includes(new URL(testURL).hostname)
)
  throw new Error(
    "Integration tests require a separate local openlearn_test database.",
  );
process.env.DATABASE_URL = testURL;
