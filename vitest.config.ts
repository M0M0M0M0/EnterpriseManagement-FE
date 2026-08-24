import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [
      {
        find: "@fluentui/react-components",
        replacement: fileURLToPath(
          new URL(
            "./node_modules/@fluentui/react-components/lib-commonjs/index.cjs",
            import.meta.url,
          ),
        ),
      },
      {
        find: "@fluentui/react-charts",
        replacement: fileURLToPath(
          new URL(
            "./node_modules/@fluentui/react-charts/lib-commonjs/index.cjs",
            import.meta.url,
          ),
        ),
      },
    ],
  },
  test: {
    include: ["src/**/*.test.{ts,tsx}"],
    environment: "jsdom",
    setupFiles: "./src/test/setup.ts",
    css: true,
    deps: {
      optimizer: {
        ssr: {
          enabled: true,
          include: [
            "@fluentui/react-components",
            "@fluentui/react-tabster",
            "tabster",
          ],
        },
      },
    },
  },
});
