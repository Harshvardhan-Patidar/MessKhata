/**
 * TC02 — admin-login Edge Function: Invalid & Missing Credentials
 *
 * Tests that:
 *   1. Missing name/phone returns 400
 *   2. Wrong name/phone combination returns error (not success)
 *   3. Empty body returns 400
 *
 * Security: Ensures the function never returns success for bogus credentials.
 */

import { describe, it, expect } from 'vitest';

const BASE_URL = process.env.SUPABASE_URL!;
const ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY!;
const ADMIN_LOGIN_URL = `${BASE_URL}/functions/v1/admin-login`;

const post = (body: Record<string, unknown>) =>
  fetch(ADMIN_LOGIN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': ANON_KEY,
      'Authorization': `Bearer ${ANON_KEY}`,
    },
    body: JSON.stringify(body),
  });

describe('TC02 — admin-login: Invalid Credentials', () => {
  it('should return 400 when name is missing', async () => {
    const res = await post({ phone: '9999999999' });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBeTruthy();
  });

  it('should return 400 when phone is missing', async () => {
    const res = await post({ name: 'SomeAdmin' });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBeTruthy();
  });

  it('should return 400 for an empty body', async () => {
    const res = await post({});
    expect(res.status).toBe(400);
  });

  it('should return error (not success) for wrong name/phone combination', async () => {
    const res = await post({ name: 'NonExistentAdmin__XYZ', phone: '0000000000' });
    const body = await res.json();
    // The function returns 200 but with an error payload for auth failures
    expect(body.success).toBeUndefined();
    expect(body.error).toBeTruthy();
  });

  it('should NOT return a session for invalid admin', async () => {
    const res = await post({ name: 'FakeAdmin', phone: '1234567890' });
    const body = await res.json();
    expect(body).not.toHaveProperty('session');
  });
});
