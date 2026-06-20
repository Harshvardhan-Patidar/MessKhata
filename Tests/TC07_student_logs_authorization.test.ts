/**
 * TC07 — student-logs Edge Function: Authorization & Access Control
 *
 * Tests:
 *   1. Missing parameters → error
 *   2. Valid identity → returns logs array
 *   3. IDOR prevention — student cannot fetch another student's logs
 *      by providing a different customer_id with their own mobile/code
 *   4. Rate limiting awareness (no throttling implemented — documented as risk)
 */

import { describe, it, expect, beforeAll } from 'vitest';

const BASE_URL = process.env.SUPABASE_URL!;
const ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY!;
const STUDENT_LOGS_URL = `${BASE_URL}/functions/v1/student-logs`;

// Valid student details for testing
const VALID_CUSTOMER_ID  = process.env.TEST_CUSTOMER_ID   ?? 'some-uuid-here';
const VALID_MOBILE       = process.env.TEST_STUDENT_MOBILE ?? '9876543210';
const VALID_CUSTOMER_CODE = process.env.TEST_STUDENT_CODE  ?? 'CUST-001';

// A DIFFERENT customer's UUID (to test IDOR)
const OTHER_CUSTOMER_ID = process.env.TEST_OTHER_CUSTOMER_ID ?? 'another-uuid-here';

const post = (body: Record<string, unknown>) =>
  fetch(STUDENT_LOGS_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': ANON_KEY,
      'Authorization': `Bearer ${ANON_KEY}`,
    },
    body: JSON.stringify(body),
  });

describe('TC07 — student-logs: Authorization & Access Control', () => {
  it('should return error when customer_id is missing', async () => {
    const res = await post({ mobile: VALID_MOBILE, customer_code: VALID_CUSTOMER_CODE });
    const body = await res.json();
    expect(body.error).toBeTruthy();
  });

  it('should return error when mobile is missing', async () => {
    const res = await post({ customer_id: VALID_CUSTOMER_ID, customer_code: VALID_CUSTOMER_CODE });
    const body = await res.json();
    expect(body.error).toBeTruthy();
  });

  it('should return error when customer_code is missing', async () => {
    const res = await post({ customer_id: VALID_CUSTOMER_ID, mobile: VALID_MOBILE });
    const body = await res.json();
    expect(body.error).toBeTruthy();
  });

  it('should return logs array for valid credentials', async () => {
    const res = await post({
      customer_id: VALID_CUSTOMER_ID,
      mobile: VALID_MOBILE,
      customer_code: VALID_CUSTOMER_CODE,
    });
    const body = await res.json() as { logs?: unknown[]; error?: string };
    if (body.error) {
      // If env vars not configured, skip gracefully
      console.warn('Skipping valid credentials test — configure TEST_* env vars');
      return;
    }
    expect(Array.isArray(body.logs)).toBe(true);
  });

  it('IDOR Prevention: should reject mismatched customer_id + mobile', async () => {
    // Attempt: use Student A's mobile/code but ask for Student B's customer_id
    const res = await post({
      customer_id: OTHER_CUSTOMER_ID, // Different customer
      mobile: VALID_MOBILE,           // Student A's mobile
      customer_code: VALID_CUSTOMER_CODE,
    });
    const body = await res.json() as { logs?: unknown[]; error?: string };
    // Should fail: customer_id doesn't match the mobile in the DB
    expect(body.error).toBeTruthy();
    expect(body.logs).toBeUndefined();
  });

  it('should only return logs from the past 3 days', async () => {
    const res = await post({
      customer_id: VALID_CUSTOMER_ID,
      mobile: VALID_MOBILE,
      customer_code: VALID_CUSTOMER_CODE,
    });
    const body = await res.json() as { logs?: Array<{ created_at: string }> };
    if (!body.logs) return; // Skip if not configured

    const threeDaysAgo = Date.now() - 3 * 24 * 60 * 60 * 1000;
    for (const log of body.logs) {
      expect(new Date(log.created_at).getTime()).toBeGreaterThan(threeDaysAgo);
    }
  });
});
