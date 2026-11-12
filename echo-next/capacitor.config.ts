import type { CapacitorConfig } from "@capacitor/cli";
const config: CapacitorConfig = {
  appId: "app.echo.communication",
  appName: "ECHO",
  webDir: "dist",
  android: { allowMixedContent: false },
};
export default config;
