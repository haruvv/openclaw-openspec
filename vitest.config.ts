import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    pool: "forks",
    fileParallelism: false,
    env: {
      DB_PATH: ":memory:",
      SEO_SCORE_THRESHOLD: "50",
      MAX_BATCH_SIZE: "50",
      MAX_DAILY_EMAILS: "50",
      OUTREACH_COOLDOWN_DAYS: "30",
      HIL_APPROVAL_BASE_URL: "http://localhost:3000",
      HIL_APPROVAL_TOKEN_SECRET: "test-secret",
      SENDGRID_FROM_EMAIL: "test@example.com",
    },
  },
});
