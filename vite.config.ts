import { defineConfig } from "vite";
import { resolve } from "node:path";

export default defineConfig({
  root: resolve(__dirname, "apps/demo"),
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
  build: {
    outDir: resolve(__dirname, "apps/demo/dist"),
    emptyOutDir: true,
    sourcemap: true,
    target: "es2022",
  },
  server: {
    port: 5173,
    host: true,
  },
});
