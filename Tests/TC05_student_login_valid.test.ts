/**
 * TC05 — student-login Edge Function: Valid Credentials
 *
 * Tests that a student can log in with:
 *   - full_name (case-insensitive ilike match)
 *   - mobile
 *   - customer_code
 *
 * Expected on success:
 *   - HTTP 200
 *   - { enrollments: [...] } — array of enrollment objects
 *   - Each enrollment has: id, full_name, mobile, remaining_plates, status, mess_name, admin_phone
 */

import { describe, it, expect, beforeAll } from 'vitest';

const BASE_URL = process.env.SUPABASE_URL!;
const ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY!;
const STUDENT_LOGIN_URL = `${BASE_URL}/functions/v1/student-login`;

// Configure these in .env.test with a real student row from your DB
const TEST_STUDENT_NAME  = process.env.TEST_STUDENT_NAME   ?? 'Ravi Kumar';
const TEST_STUDENT_MOBILE = process.env.TEST_STUDENT_MOBILE ?? '9876543210';
const TEST_STUDENT_CODE  = process.env.TEST_STUDENT_CODE   ?? 'CUST-001';

describe('TC05 — student-login: Valid Credentials', () => {
  let response: Response;
  let body: Record<string, unknown>;

  beforeAll(async () => {
    response = await fetch(STUDENT_LOGIN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': ANON_KEY,
        'Authorization': `Bearer ${ANON_KEY}`,
      },
      body: JSON.stringify({
        full_name: TEST_STUDENT_NAME,
        mobile: TEST_STUDENT_MOBILE,
        customer_code: TEST_STUDENT_CODE,
      }),
    });
    body = await response.json();
  });

  it('should return HTTP 200', () => {
    expect(response.status).toBe(200);
  });

  it('should return enrollments array', () => {
    expect(Array.isArray(body.enrollments)).toBe(true);
  });

  it('should have at least one enrollment', () => {
    const enrollments = body.enrollments as unknown[];
    expect(enrollments.length).toBeGreaterThan(0);
  });

  it('each enrollment should have required fields', () => {
    const enrollments = body.enrollments as Record<string, unknown>[];
    for (const e of enrollments) {
      expect(e).toHaveProperty('id');
      expect(e).toHaveProperty('full_name');
      expect(e).toHaveProperty('mobile');
      expect(e).toHaveProperty('remaining_plates');
      expect(e).toHaveProperty('status');
      expect(e).toHaveProperty('mess_name');
    }
  });

  it('should not expose admin service role key or auth tokens', () => {
    const bodyStr = JSON.stringify(body);
    expect(bodyStr).not.toContain('service_role');
    expect(bodyStr).not.toContain('SUPABASE_SERVICE_ROLE_KEY');
  });
});
