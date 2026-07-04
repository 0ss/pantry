import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    exclude: ["fixtures/**", "node_modules/**"],
    // perf-budget tests (hook latency, scan speed) need a quiet machine;
    // 12 parallel files spawning node processes isn't one. Serial costs a
    // few seconds and makes every timing number mean something.
    fileParallelism: false,
    coverage: {
      include: ["src/**"],
    },
  },
});
