import path from "node:path";
import { defineConfig } from "vitest/config";

const alias = {
  "@": path.resolve(import.meta.dirname, "src"),
};

export default defineConfig({
  test: {
    projects: [
      {
        resolve: { alias },
        test: {
          name: "unit",
          environment: "node",
          include: ["src/lib/**/*.test.ts"],
        },
      },
      {
        resolve: { alias },
        test: {
          name: "component",
          environment: "jsdom",
          setupFiles: ["./vitest.setup.ts"],
          include: ["src/components/**/*.test.tsx"],
        },
      },
    ],
  },
});
