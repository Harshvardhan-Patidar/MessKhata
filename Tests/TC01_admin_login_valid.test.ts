/**
 * TC01 — admin-login Edge Function: Valid OTP Request
 *
 * Tests that a valid admin name + phone combination:
 *   1. Returns HTTP 200
 *   2. Returns { success: true }
 *   3. Does NOT leak the generated OTP in the response body
 *
 * Requires env vars:
 *   SUPABASE_URL, SUPABASE_ANON_KEY — set in .env.test
 *   TEST_ADMIN_NAME, TEST_ADMIN_PHONE — a real row in the admins table
 */

import { describe, it, expect, beforeAll } from 'vitest';

const BASE_URL = process.env.SUPABASE_URL!;
const ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY!;
const ADMIN_LOGIN_URL = `${BASE_URL}/functions/v1/admin-login`;

// Use a real admin that exists in your Supabase `admins` table for integration testing
const TEST_ADMIN_NAME  = process.env.TEST_ADMIN_NAME  ?? 'Harsh';
const TEST_ADMIN_PHONE = process.env.TEST_ADMIN_PHONE ?? '9999999999';

describe('TC01 — admin-login: Valid Request', () => {
  let response: Response;
  let body: Record<string, unknown>;

  beforeAll(async () => {
    response = await fetch(ADMIN_LOGIN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': ANON_KEY,
        'Authorization': `Bearer ${ANON_KEY}`,
      },
      body: JSON.stringify({ name: TEST_ADMIN_NAME, phone: TEST_ADMIN_PHONE }),
    });
    body = await response.json();
  });

  it('should return HTTP 200', () => {
    expect(response.status).toBe(200);
  });

  it('should return success: true', () => {
    expect(body.success).toBe(true);
  });

  it('should not expose OTP in response body', () => {
    expect(body).not.toHaveProperty('otp');
  });

  it('should return a message string', () => {
    expect(typeof body.message).toBe('string');
  });
});
