/// <reference types="vitest" />
import { defineConfig } from 'vitest/config';
import dotenv from 'dotenv';

// Load .env for VITE_SUPABASE_URL etc.
dotenv.config();

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['Tests/**/*.test.ts'],
    // Give API calls enough time
    testTimeout: 30000,
    hookTimeout: 15000,
    // Run sequentially to avoid DB race conditions
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true,
      },
    },
    // Env vars available in tests
    env: {
      SUPABASE_URL: process.env.VITE_SUPABASE_URL ?? '',
      VITE_SUPABASE_ANON_KEY: process.env.VITE_SUPABASE_ANON_KEY ?? '',
    },
    reporters: ['verbose'],
  },
});
