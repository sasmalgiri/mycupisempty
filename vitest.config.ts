import { defineConfig } from 'vitest/config';
import path from 'path';

/**
 * Vitest config.
 *
 * To run the test suite:
 *   npm install -D vitest @types/node
 *   npm run test           (see package.json scripts)
 *
 * Tests live alongside the lib they cover, under src/lib/__tests__/.
 * Covers the PURE logic layer — no network, no Supabase, no AI calls.
 */
export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    include: ['src/**/__tests__/**/*.test.ts', 'src/**/*.test.ts'],
    exclude: ['node_modules', '.next', 'dist'],
    environment: 'node',
    globals: true,
    testTimeout: 10000,
  },
});
