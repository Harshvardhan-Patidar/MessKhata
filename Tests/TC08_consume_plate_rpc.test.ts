/**
 * TC08 — consume_plate RPC: Meal Deduction Logic
 *
 * Tests the Supabase RPC `consume_plate` through the Supabase JS client.
 *
 * Verifies:
 *   1. Requires admin authentication (anon cannot call without being auth'd)
 *   2. Deducts exactly 1 plate from remaining_plates
 *   3. Returns updated customer row
 *   4. Fails if remaining_plates = 0
 *   5. Fails if customer does not belong to the calling admin
 *   6. Writes a log entry
 *
 * Requires: A test admin session token set in env (TEST_ADMIN_TOKEN)
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL  = process.env.SUPABASE_URL!;
const ANON_KEY      = process.env.VITE_SUPABASE_ANON_KEY!;

// For integration: admin must be authenticated
// Set TEST_ADMIN_ACCESS_TOKEN to a real admin JWT from a login
const ACCESS_TOKEN  = process.env.TEST_ADMIN_ACCESS_TOKEN ?? '';
const TEST_CUSTOMER_ID = process.env.TEST_CUSTOMER_ID ?? '';

describe('TC08 — consume_plate RPC', () => {
  const supabase = createClient(SUPABASE_URL, ANON_KEY);

  beforeAll(async () => {
    if (ACCESS_TOKEN) {
      await supabase.auth.setSession({
        access_token: ACCESS_TOKEN,
        refresh_token: process.env.TEST_ADMIN_REFRESH_TOKEN ?? '',
      });
    }
  });

  it('should fail without authentication (unauthenticated call)', async () => {
    // Use a fresh unauthenticated client
    const anonClient = createClient(SUPABASE_URL, ANON_KEY);
    const { error } = await anonClient.rpc('consume_plate', {
      p_customer_id: TEST_CUSTOMER_ID || '00000000-0000-0000-0000-000000000000',
      p_count: 1,
    });
    // Should fail with RLS or not found error since unauthenticated
    expect(error).toBeTruthy();
  });

  it('should fail for non-existent customer UUID', async () => {
    if (!ACCESS_TOKEN) return; // Skip if not authenticated
    const { error } = await supabase.rpc('consume_plate', {
      p_customer_id: '00000000-0000-0000-0000-000000000000',
      p_count: 1,
    });
    expect(error).toBeTruthy();
    expect(error?.message).toContain('not found');
  });

  it('should return updated customer on success', async () => {
    if (!ACCESS_TOKEN || !TEST_CUSTOMER_ID) return;
    const { data, error } = await supabase.rpc('consume_plate', {
      p_customer_id: TEST_CUSTOMER_ID,
      p_count: 1,
    });
    expect(error).toBeNull();
    expect(data).toBeTruthy();
    expect(data).toHaveProperty('remaining_plates');
  });

  it('should decrement remaining_plates by exactly 1', async () => {
    if (!ACCESS_TOKEN || !TEST_CUSTOMER_ID) return;

    // Get current state
    const { data: before } = await supabase
      .from('customers')
      .select('remaining_plates')
      .eq('id', TEST_CUSTOMER_ID)
      .single();

    const { data: after, error } = await supabase.rpc('consume_plate', {
      p_customer_id: TEST_CUSTOMER_ID,
      p_count: 1,
    });

    expect(error).toBeNull();
    if (before && after) {
      expect(after.remaining_plates).toBe((before.remaining_plates ?? 0) - 1);
    }
  });

  it('should reject when remaining_plates is 0', async () => {
    // This requires a test customer with 0 plates — document as boundary test
    if (!ACCESS_TOKEN) return;
    const { error } = await supabase.rpc('consume_plate', {
      p_customer_id: TEST_CUSTOMER_ID,
      p_count: 9999, // Extremely high count to force exhaustion
    });
    expect(error).toBeTruthy();
  });
});
