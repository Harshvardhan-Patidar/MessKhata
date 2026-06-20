/**
 * TC14 — Customer CRUD: Direct Table Operations via Supabase Client
 *
 * Tests authenticated admin's direct table-level operations:
 *   1. INSERT new customer — required fields
 *   2. SELECT own customers — returns data
 *   3. UPDATE own customer — changes persist
 *   4. DELETE / Archive own customer — soft-delete via status
 *   5. Unique constraint: customer_code must be unique per admin
 *   6. Attempt to insert negative remaining_plates — rejected by constraint
 *   7. Attempt to set status to invalid value — rejected by enum
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL  = process.env.SUPABASE_URL!;
const ANON_KEY      = process.env.VITE_SUPABASE_ANON_KEY!;
const ACCESS_TOKEN  = process.env.TEST_ADMIN_ACCESS_TOKEN ?? '';
const REFRESH_TOKEN = process.env.TEST_ADMIN_REFRESH_TOKEN ?? '';

const TEST_CODE = `TEST_${Date.now()}`;
let createdId: string | null = null;

describe('TC14 — Customer CRUD Operations', () => {
  const supabase = createClient(SUPABASE_URL, ANON_KEY);

  beforeAll(async () => {
    if (ACCESS_TOKEN) {
      await supabase.auth.setSession({ access_token: ACCESS_TOKEN, refresh_token: REFRESH_TOKEN });
    }
  });

  afterAll(async () => {
    // Cleanup test customer
    if (createdId) {
      await supabase.from('customers').delete().eq('id', createdId);
    }
  });

  it('should INSERT a new customer with required fields', async () => {
    if (!ACCESS_TOKEN) { console.warn('Skipping — needs auth'); return; }
    const { data, error } = await supabase
      .from('customers')
      .insert({
        customer_code: TEST_CODE,
        full_name: 'TC14 Test Customer',
        mobile: '9876500000',
        current_plan_type: 'fixed_plates',
        total_plates: 30,
        remaining_plates: 30,
        status: 'active',
      })
      .select('id')
      .single();

    expect(error).toBeNull();
    expect(data?.id).toBeTruthy();
    createdId = data?.id ?? null;
  });

  it('should SELECT own customer back', async () => {
    if (!ACCESS_TOKEN || !createdId) return;
    const { data, error } = await supabase
      .from('customers')
      .select('full_name, remaining_plates, status')
      .eq('id', createdId)
      .single();
    
    expect(error).toBeNull();
    expect(data?.full_name).toBe('TC14 Test Customer');
    expect(data?.remaining_plates).toBe(30);
    expect(data?.status).toBe('active');
  });

  it('should UPDATE customer full_name', async () => {
    if (!ACCESS_TOKEN || !createdId) return;
    const { error } = await supabase
      .from('customers')
      .update({ full_name: 'TC14 Updated Name' })
      .eq('id', createdId);

    expect(error).toBeNull();

    const { data } = await supabase
      .from('customers')
      .select('full_name')
      .eq('id', createdId)
      .single();
    expect(data?.full_name).toBe('TC14 Updated Name');
  });

  it('should reject duplicate customer_code for same admin', async () => {
    if (!ACCESS_TOKEN) return;
    const { error } = await supabase
      .from('customers')
      .insert({
        customer_code: TEST_CODE, // Same code as above — should fail
        full_name: 'Duplicate Customer',
        mobile: '9876500001',
        current_plan_type: 'fixed_plates',
        total_plates: 10,
        remaining_plates: 10,
        status: 'active',
      });
    // Should fail: unique constraint on (admin_id, customer_code)
    expect(error).toBeTruthy();
  });

  it('should reject negative remaining_plates', async () => {
    if (!ACCESS_TOKEN) return;
    const { error } = await supabase
      .from('customers')
      .insert({
        customer_code: `NEG_${Date.now()}`,
        full_name: 'Negative Plates',
        mobile: '9876500002',
        current_plan_type: 'fixed_plates',
        total_plates: 10,
        remaining_plates: -5, // Should violate CHECK constraint
        status: 'active',
      });
    expect(error).toBeTruthy();
  });

  it('should reject invalid status enum value', async () => {
    if (!ACCESS_TOKEN || !createdId) return;
    const { error } = await supabase
      .from('customers')
      .update({ status: 'INVALID_STATUS' as 'active' })
      .eq('id', createdId);
    expect(error).toBeTruthy();
  });

  it('should soft-delete by setting status to archived', async () => {
    if (!ACCESS_TOKEN || !createdId) return;
    const { error } = await supabase
      .from('customers')
      .update({ status: 'archived' })
      .eq('id', createdId);
    expect(error).toBeNull();

    const { data } = await supabase
      .from('customers')
      .select('status')
      .eq('id', createdId)
      .single();
    expect(data?.status).toBe('archived');
  });
});
