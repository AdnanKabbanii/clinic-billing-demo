import { configDefaults, defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    fileParallelism: false,
    testTimeout: 20000,
    exclude: [...configDefaults.exclude, '.review/**'],
  },
});
