/**
 * TC16 — OTP Rate Limiting & Brute Force Prevention
 *
 * Tests the absence of rate limiting on admin-login (OTP request) and admin-verify.
 *
 * SECURITY FINDINGS:
 *   1. admin-login has NO rate limiting — attacker can request infinite OTPs.
 *   2. admin-verify has NO rate limiting — attacker can brute-force 6-digit OTP
 *      (only 900,000 combinations) with automated requests.
 *   3. OTP uses Math.random() which is NOT cryptographically secure.
 *      Should use crypto.getRandomValues() for OTP generation.
 *
 * These tests document the risk. Fixing requires adding rate limiting middleware
 * (e.g., via Supabase Edge Function + Redis/Upstash, or a Deno-based rate limiter).
 */

import { describe, it, expect } from 'vitest';

const BASE_URL = process.env.SUPABASE_URL!;
const ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY!;

describe('TC16 — OTP Rate Limiting & Brute Force', () => {
  it('BUG: No rate limiting on admin-login — 10 rapid requests should succeed', async () => {
    // Send 10 rapid login requests — all should succeed (no throttling)
    const requests = Array.from({ length: 10 }, () =>
      fetch(`${BASE_URL}/functions/v1/admin-login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': ANON_KEY,
          'Authorization': `Bearer ${ANON_KEY}`,
        },
        body: JSON.stringify({ name: 'TestAdmin', phone: '0000000000' }),
      })
    );

    const responses = await Promise.all(requests);
    const statuses = responses.map(r => r.status);

    // All 10 should return 200 (even if with an error body) — none are rate limited (429)
    const rateLimited = statuses.filter(s => s === 429);
    
    // This documents the bug: 0 requests are rate limited
    console.warn(`Rate limited responses: ${rateLimited.length}/10 (should be >0 for security)`);
    
    // After fixing (adding rate limiting), this should show some 429s
    // For now, we just document the finding
    expect(rateLimited.length).toBe(0); // Will change to > 0 after fix
  });

  it('SECURITY DOC: OTP uses Math.random() — not cryptographically secure', () => {
    // admin-login/index.ts line 51:
    //   const otp = Math.floor(100000 + Math.random() * 900000).toString()
    //
    // Math.random() is NOT cryptographically secure.
    // Fix: Use crypto.getRandomValues() for OTP generation:
    //   const arr = new Uint32Array(1);
    //   crypto.getRandomValues(arr);
    //   const otp = (100000 + (arr[0] % 900000)).toString();
    expect(true).toBe(true); // Documented finding
  });

  it('SECURITY DOC: admin-verify has no brute-force lockout', () => {
    // With 6-digit OTPs and no lockout, an attacker has 900,000 possible codes.
    // At 100 req/sec, the entire space can be exhausted in ~2.5 hours.
    // Fix: Add lockout after 5 failed attempts per phone number.
    expect(true).toBe(true); // Documented finding
  });

  it('SECURITY DOC: admin-login password uses insecure Math.random()', () => {
    // admin-verify/index.ts generateRandomPassword() also uses Math.random()
    // while better than OTP security, for a password used in auth.signInWithPassword
    // it should use crypto.getRandomValues() for cryptographic randomness
    expect(true).toBe(true); // Documented finding
  });
});
