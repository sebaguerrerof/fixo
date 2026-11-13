import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    env: { NEXT_PUBLIC_DEMO_MODE: "true" },
    include: ["src/**/*.test.ts"],
  },
});
