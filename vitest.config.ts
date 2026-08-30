import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    testTimeout: 10 * 60_000,
    hookTimeout: 10 * 60_000,
    fileParallelism: false,
  },
});

