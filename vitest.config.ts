import { defineConfig } from "vitest/config";
import { resolve } from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@gen-gaming/regen-runtime": resolve(
        __dirname,
        "packages/regen-runtime/src/index.ts",
      ),
      "@gen-gaming/aegis-gate": resolve(
        __dirname,
        "packages/aegis-gate/src/index.ts",
      ),
      "@gen-gaming/scene-store": resolve(
        __dirname,
        "packages/scene-store/src/index.ts",
      ),
    },
  },
  test: {
    environment: "node",
    include: ["test/**/*.test.ts"],
    globals: false,
  },
});
