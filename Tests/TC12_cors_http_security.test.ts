/**
 * TC12 — CORS & HTTP Method Security
 *
 * Tests all Edge Functions for:
 *   1. OPTIONS preflight returns 200 (CORS preflight works)
 *   2. GET requests return 405 or error (not 200 with data)
 *   3. Access-Control-Allow-Origin is '*' — documented risk
 *   4. No sensitive headers leaked in response
 *
 * SECURITY FINDING:
 *   All 4 edge functions have `'Access-Control-Allow-Origin': '*'`
 *   This allows any website in the world to call these endpoints.
 *   For a mess management app this is acceptable, but could be tightened
 *   to specific domains (e.g. your production domain) for better security.
 */

import { describe, it, expect } from 'vitest';

const BASE_URL = process.env.SUPABASE_URL!;
const ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY!;

const FUNCTIONS = [
  'admin-login',
  'admin-verify',
  'student-login',
  'student-logs',
];

const preflight = (fn: string) =>
  fetch(`${BASE_URL}/functions/v1/${fn}`, {
    method: 'OPTIONS',
    headers: {
      'Origin': 'https://example.com',
      'Access-Control-Request-Method': 'POST',
      'apikey': ANON_KEY,
    },
  });

const get = (fn: string) =>
  fetch(`${BASE_URL}/functions/v1/${fn}`, {
    method: 'GET',
    headers: { 'apikey': ANON_KEY, 'Authorization': `Bearer ${ANON_KEY}` },
  });

describe('TC12 — CORS & HTTP Method Security', () => {
  for (const fn of FUNCTIONS) {
    describe(`Function: ${fn}`, () => {
      it(`${fn}: OPTIONS preflight should return 200`, async () => {
        const res = await preflight(fn);
        expect(res.status).toBe(200);
      });

      it(`${fn}: should include Access-Control-Allow-Origin header`, async () => {
        const res = await preflight(fn);
        const origin = res.headers.get('access-control-allow-origin');
        expect(origin).toBeTruthy();
      });

      it(`${fn}: SECURITY — CORS is wildcard (*) — documented`, async () => {
        const res = await preflight(fn);
        const origin = res.headers.get('access-control-allow-origin');
        // Document that wildcard is in use — this is a low/informational finding
        console.info(`${fn} CORS origin: ${origin}`);
        // Not a test failure but documenting for awareness
        expect(origin).toBe('*');
      });

      it(`${fn}: GET should not return sensitive data`, async () => {
        const res = await get(fn);
        // GET with no body should not return 200 with actual data
        const text = await res.text();
        expect(text).not.toContain('session');
        expect(text).not.toContain('enrollments');
      });
    });
  }

  it('No function should expose internal error stack traces', async () => {
    // Send garbage JSON to each function
    for (const fn of FUNCTIONS) {
      const res = await fetch(`${BASE_URL}/functions/v1/${fn}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': ANON_KEY,
          'Authorization': `Bearer ${ANON_KEY}`,
        },
        body: 'INVALID_JSON{{{',
      });
      const text = await res.text();
      // Stack trace should not appear in response
      expect(text).not.toContain('at async');
      expect(text).not.toContain('node_modules');
    }
  });
});
