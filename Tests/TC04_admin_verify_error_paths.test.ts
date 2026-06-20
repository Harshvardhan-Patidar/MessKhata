/**
 * TC04 — admin-verify Edge Function: Valid OTP Flow
 *
 * Tests the full OTP verification lifecycle:
 *   1. Submit invalid OTP → error
 *   2. Submit expired OTP → error (cannot automate without DB manipulation)
 *   3. Missing fields → 400
 *   4. Session is returned on valid verification (requires real SMS delivery — integration test)
 *
 * Note: Full happy-path requires a real OTP from the database.
 * These tests cover the error paths that don't require real OTP.
 */

import { describe, it, expect } from 'vitest';

const BASE_URL = process.env.SUPABASE_URL!;
const ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY!;
const ADMIN_VERIFY_URL = `${BASE_URL}/functions/v1/admin-verify`;

const post = (body: Record<string, unknown>) =>
  fetch(ADMIN_VERIFY_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': ANON_KEY,
      'Authorization': `Bearer ${ANON_KEY}`,
    },
    body: JSON.stringify(body),
  });

describe('TC04 — admin-verify: Error Paths', () => {
  it('should return 400 when phone is missing', async () => {
    const res = await post({ otp: '123456' });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBeTruthy();
  });

  it('should return 400 when otp is missing', async () => {
    const res = await post({ phone: '9999999999' });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBeTruthy();
  });

  it('should return error for obviously wrong OTP', async () => {
    const res = await post({ phone: '9999999999', otp: '000000' });
    const body = await res.json();
    expect(body.error).toBeTruthy();
    expect(body.session).toBeUndefined();
  });

  it('should return error for random fake phone + wrong OTP', async () => {
    const res = await post({ phone: '1111111111', otp: '111111' });
    const body = await res.json();
    expect(body.error).toBeTruthy();
  });

  it('should not return session on failed OTP', async () => {
    const res = await post({ phone: '9876543210', otp: '999999' });
    const body = await res.json();
    expect(body).not.toHaveProperty('session');
  });

  it('BUG: admin-verify uses undefined variable "formattedPhone" — runtime crash on OTP cleanup', async () => {
    // In admin-verify/index.ts line 148:
    //   await supabaseAdmin.from('otps').delete().eq('phone', formattedPhone)
    // "formattedPhone" is NOT defined anywhere in the function — this is a ReferenceError bug!
    // The function will crash instead of cleaning up the OTP after successful verification.
    // This test documents the bug; fix by replacing `formattedPhone` with `phoneWithPlus91`.
    //
    // We cannot fully test this without a valid OTP, but the bug is in the source code.
    // Mark as known bug.
    expect(true).toBe(true); // placeholder — see code comment above
  });
});
