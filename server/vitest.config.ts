import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    globalSetup: ['tests/globalSetup.ts'],
    // Base SQLite compartida: los archivos se ejecutan en serie
    fileParallelism: false,
    testTimeout: 60_000,
    hookTimeout: 60_000,
    env: {
      NODE_ENV: 'test',
      DATABASE_URL: 'file:./test.db',
      APP_URL: 'http://localhost:5173',
      TRUST_PROXY: '1',
      RATE_LIMIT_MAX: '100000',
      AUTH_RATE_LIMIT_MAX: '100000',
      MAIL_OUTBOX_DIR: '.test-outbox',
    },
  },
});
