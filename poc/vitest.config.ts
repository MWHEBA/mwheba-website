import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    env: {
      DATABASE_URI: process.env.DATABASE_URI || 'postgres://postgres@127.0.0.1:5432/mwheba_poc',
    },
    testTimeout: 30000,
  },
});
