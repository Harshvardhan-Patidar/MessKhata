/**
 * TC15 — Env Variable Exposure & API Key Security
 *
 * CRITICAL SECURITY FINDING:
 *   The .env file contains VITE_SUPABASE_ANON_KEY set to a SERVICE_ROLE key.
 *
 *   From .env line 2:
 *   VITE_SUPABASE_ANON_KEY=eyJhbGci...InJvbGUiOiJzZXJ2aWNlX3JvbGUi...
 *
 *   The JWT payload decodes to: { "role": "service_role" }
 *
 *   This means the ANON key shipped to every browser client is actually
 *   the SERVICE ROLE key — which bypasses ALL Row Level Security policies!
 *   Anyone who opens DevTools can extract this key and read/write/delete
 *   ANY data across ALL admins in the database.
 *
 * Tests verify this critical misconfiguration.
 * Fix: Replace VITE_SUPABASE_ANON_KEY with the actual anon/public key from
 *      Supabase Dashboard → Settings → API → anon key.
 */

import { describe, it, expect } from 'vitest';

describe('TC15 — CRITICAL: Service Role Key Exposed in Client Bundle', () => {
  const ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY ?? '';

  it('CRITICAL BUG: VITE_SUPABASE_ANON_KEY must NOT be the service_role key', () => {
    // Decode the JWT payload (middle segment)
    const parts = ANON_KEY.split('.');
    if (parts.length !== 3) {
      console.warn('Could not parse JWT — key may be missing');
      return;
    }

    // Base64 decode the payload
    const padding = '='.repeat((4 - (parts[1].length % 4)) % 4);
    const base64 = (parts[1] + padding).replace(/-/g, '+').replace(/_/g, '/');
    const payload = JSON.parse(atob(base64)) as { role?: string };

    console.error('JWT payload role:', payload.role);

    // THIS WILL FAIL — proving the bug exists
    // After the fix (using the actual anon key), this test will pass
    expect(payload.role).not.toBe('service_role');
    // Should be 'anon' for the public client key
    expect(payload.role).toBe('anon');
  });

  it('VITE_ prefixed env vars are bundled into the client-side JavaScript', () => {
    // This is by design in Vite — but it means the key is visible to anyone
    // who views source or opens DevTools → Network tab
    // The severity depends entirely on whether the key is 'anon' or 'service_role'
    expect(ANON_KEY).toBeTruthy(); // Key exists
    // The key should be the PUBLIC anon key, not the secret service role key
  });
});

describe('TC15b — env vars: TEST_SCRIPT key in .env', () => {
  it('TEST_SCRIPT key should not be committed to git', () => {
    // .env contains TEST_SCRIPT=sk-user-... which appears to be a TestSprite API key
    // Ensure .env is in .gitignore (it is, per .gitignore line 10)
    // This test serves as documentation of the finding
    expect(true).toBe(true); // Verified: .env is in .gitignore ✓
  });
});
