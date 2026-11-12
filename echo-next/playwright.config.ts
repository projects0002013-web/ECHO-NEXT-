import { defineConfig } from "@playwright/test";
export default defineConfig({
  timeout: 60000,
  testDir: "./tests/e2e",
  workers: 1,
  use: {
    baseURL: `http://127.0.0.1:4173${process.env.VITE_BASE_PATH || "/"}`,
    launchOptions: {
      executablePath:
        process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ||
        (process.env.CI ? undefined : "/usr/bin/chromium"),
      args: [
        "--no-sandbox",
        "--use-fake-device-for-media-stream",
        "--use-fake-ui-for-media-stream",
      ],
    },
  },
  webServer: {
    command: "npm run preview -- --port 4173 --strictPort",
    url: `http://127.0.0.1:4173${process.env.VITE_BASE_PATH || "/"}`,
    reuseExistingServer: !process.env.CI,
  },
});
