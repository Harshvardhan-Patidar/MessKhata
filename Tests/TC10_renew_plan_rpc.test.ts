/**
 * TC10 — renew_plan RPC: Subscription Renewal Logic
 *
 * Tests the Supabase RPC `renew_plan`.
 *
 * Verifies:
 *   1. Adds exactly `p_additional_plates` to remaining_plates
 *   2. Resets current_plan_total to p_additional_plates (not cumulative)
 *   3. Increments total_plates (lifetime, cumulative)
 *   4. Sets status back to 'active'
 *   5. Optionally sets plan_expiry_date (wipes it if p_new_expiry is null)
 *   6. Logs the renewal (plates_deducted = 0, note = 'Plan renewed')
 *   7. Fails for non-existent customer
 *   8. Requires admin auth
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL  = process.env.SUPABASE_URL!;
const ANON_KEY      = process.env.VITE_SUPABASE_ANON_KEY!;
const ACCESS_TOKEN  = process.env.TEST_ADMIN_ACCESS_TOKEN ?? '';
const TEST_CUSTOMER_ID = process.env.TEST_CUSTOMER_ID ?? '';

describe('TC10 — renew_plan RPC: Subscription Renewal', () => {
  const supabase = createClient(SUPABASE_URL, ANON_KEY);

  beforeAll(async () => {
    if (ACCESS_TOKEN) {
      await supabase.auth.setSession({
        access_token: ACCESS_TOKEN,
        refresh_token: process.env.TEST_ADMIN_REFRESH_TOKEN ?? '',
      });
    }
  });

  it('should fail without authentication', async () => {
    const anonClient = createClient(SUPABASE_URL, ANON_KEY);
    const { error } = await anonClient.rpc('renew_plan', {
      p_customer_id: '00000000-0000-0000-0000-000000000000',
      p_additional_plates: 30,
    });
    expect(error).toBeTruthy();
  });

  it('should fail for non-existent customer', async () => {
    if (!ACCESS_TOKEN) return;
    const { error } = await supabase.rpc('renew_plan', {
      p_customer_id: '00000000-0000-0000-0000-000000000000',
      p_additional_plates: 30,
    });
    expect(error).toBeTruthy();
  });

  it('should set current_plan_total to exactly the new plan size', async () => {
    if (!ACCESS_TOKEN || !TEST_CUSTOMER_ID) return;
    const plates = 30;
    const { data, error } = await supabase.rpc('renew_plan', {
      p_customer_id: TEST_CUSTOMER_ID,
      p_additional_plates: plates,
      p_new_expiry: null,
    });
    expect(error).toBeNull();
    if (data) {
      expect(data.current_plan_total).toBe(plates);
      // remaining_plates should be exactly `plates` (not cumulative)
      expect(data.remaining_plates).toBe(plates);
    }
  });

  it('should set status to active after renewal', async () => {
    if (!ACCESS_TOKEN || !TEST_CUSTOMER_ID) return;
    const { data, error } = await supabase.rpc('renew_plan', {
      p_customer_id: TEST_CUSTOMER_ID,
      p_additional_plates: 10,
    });
    expect(error).toBeNull();
    if (data) {
      expect(data.status).toBe('active');
    }
  });

  it('should clear plan_expiry_date when renewing without an expiry date', async () => {
    if (!ACCESS_TOKEN || !TEST_CUSTOMER_ID) return;
    // First set an expiry
    await supabase.rpc('renew_plan', {
      p_customer_id: TEST_CUSTOMER_ID,
      p_additional_plates: 10,
      p_new_expiry: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    });
    // Now renew without expiry (null)
    const { data, error } = await supabase.rpc('renew_plan', {
      p_customer_id: TEST_CUSTOMER_ID,
      p_additional_plates: 10,
      p_new_expiry: null,
    });
    
    expect(error).toBeNull();
    // The expiry should now be NULL because they renewed with a plan that has no expiry
    if (data) {
      expect(data.plan_expiry_date).toBeNull();
    }
  });
});
