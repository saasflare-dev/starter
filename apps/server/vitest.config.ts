import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  cloudflareTest,
  readD1Migrations,
} from '@cloudflare/vitest-pool-workers';
import { defineConfig } from 'vitest/config';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig(async () => {
  const migrationsPath = path.resolve(
    __dirname,
    '../../packages/db/migrations',
  );
  const migrations = await readD1Migrations(migrationsPath);

  return {
    plugins: [
      cloudflareTest({
        main: './src/index.ts',
        miniflare: {
          compatibilityDate: '2025-01-01',
          compatibilityFlags: ['nodejs_compat'],
          bindings: {
            CORS_ORIGIN: 'http://localhost:3000',
            TEST_MIGRATIONS: migrations,
            // Dummy R2 credentials so storage.presign can be smoke-tested.
            // getSignedUrl() signs locally (no network), so fake values are
            // enough to exercise the @aws-sdk/* code path end-to-end.
            R2_ACCOUNT_ID: 'test-account',
            R2_ACCESS_KEY_ID: 'test-access-key',
            R2_SECRET_ACCESS_KEY: 'test-secret-key',
            R2_BUCKET_NAME: 'test-bucket',
          },
          d1Databases: {
            DB: {
              id: 'test-db',
            },
          },
          kvNamespaces: {
            KV: {
              id: 'test-kv',
            },
          },
          r2Buckets: {
            BUCKET: {
              id: 'test-bucket',
            },
          },
        },
      }),
    ],
    test: {
      setupFiles: ['./tests/setup.ts'],
    },
  };
});
