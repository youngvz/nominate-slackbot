import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: "unit",
          include: ["packages/**/*.test.ts", "apps/**/*.test.ts"],
          exclude: ["**/*.integration.test.ts", "**/node_modules/**", "**/dist/**"],
          environment: "node",
        },
      },
      {
        test: {
          name: "integration",
          include: ["packages/**/*.integration.test.ts", "apps/**/*.integration.test.ts"],
          environment: "node",
          testTimeout: 30_000,
        },
      },
    ],
  },
});
