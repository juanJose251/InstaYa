import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/integration/**/*.test.ts"],
    // Las pruebas comparten una base de datos real: se ejecutan en serie.
    fileParallelism: false,
    testTimeout: 20_000,
    hookTimeout: 30_000,
  },
});
