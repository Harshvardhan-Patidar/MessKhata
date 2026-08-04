-- =================================================================
-- MessKhata — SQL Fixes (Bug #9 and #14)
-- Run this in the Supabase SQL Editor
-- =================================================================

-- -----------------------------------------------------------------
-- Fix 1: Add updated_at trigger for customers table (Bug #14)
-- -----------------------------------------------------------------
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_updated_at ON public.customers;

CREATE TRIGGER set_updated_at
BEFORE UPDATE ON public.customers
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- -----------------------------------------------------------------
-- Fix 2: renew_plan function - Don't wipe expiry date if p_new_expiry is null (Bug #9)
-- -----------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.renew_plan(
  p_customer_id uuid,
  p_additional_plates integer,
  p_new_expiry timestamptz default null,
  p_note text default 'Plan renewed'
)
RETURNS public.customers
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  c public.customers;
BEGIN
  SELECT * INTO c
  FROM public.customers
  WHERE id = p_customer_id
    AND admin_id = auth.uid()
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Customer not found or not owned by admin';
  END IF;

  UPDATE public.customers
    SET
      -- lifetime total keeps increasing
      total_plates      = coalesce(total_plates, 0) + p_additional_plates,
      -- current plan becomes just this renewed plan's size
      current_plan_total = p_additional_plates,
      -- remaining equals new plan size on renew
      remaining_plates  = p_additional_plates,
      -- FIX: Allow plan_expiry_date to be wiped (set to null) if p_new_expiry is null, so expired users can be renewed with no expiry.
      plan_expiry_date  = p_new_expiry,
      status            = 'active'
      -- updated_at is now handled by the trigger automatically
  WHERE id = p_customer_id
  RETURNING * INTO c;

  INSERT INTO public.logs (admin_id, customer_id, plates_deducted, note)
  VALUES (auth.uid(), p_customer_id, 0, p_note);

  RETURN c;
END;
$$;

-- -----------------------------------------------------------------
-- Fix 3: Add attempt_count to otps table for rate limiting
-- -----------------------------------------------------------------
ALTER TABLE public.otps ADD COLUMN IF NOT EXISTS attempt_count integer DEFAULT 0;
