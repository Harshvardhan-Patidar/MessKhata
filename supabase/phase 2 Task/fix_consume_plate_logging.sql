-- =================================================================
-- MessKhata — Fix: Ensure consume_plate and add_plate log to logs table
-- Run this in the Supabase SQL Editor to fix the missing meal logs.
--
-- PROBLEM: The currently deployed consume_plate function may be an
-- older version that does NOT insert into the logs table when
-- the EAT button is clicked. This causes the student "View History"
-- feature to show no meal records (only renewals appear).
--
-- FIX: Re-deploy consume_plate and add_plate with the correct
-- INSERT INTO public.logs statements, matching how renew_plan works.
-- =================================================================

-- Drop all conflicting overloads first
DROP FUNCTION IF EXISTS public.consume_plate(uuid, integer, text);
DROP FUNCTION IF EXISTS public.consume_plate(uuid, integer);

CREATE OR REPLACE FUNCTION public.consume_plate(
  p_customer_id UUID,
  p_count INT DEFAULT 1
)
RETURNS public.customers
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_customer public.customers;
BEGIN
  -- Lock row to prevent fast double-clicks and ensure admin owns the customer
  SELECT * INTO v_customer
  FROM public.customers
  WHERE id = p_customer_id
    AND admin_id = auth.uid()
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Customer not found or not owned by admin';
  END IF;

  -- Handle New Day Reset
  IF v_customer.last_active_date IS NULL OR v_customer.last_active_date < CURRENT_DATE THEN
    v_customer.meals_consumed_today := 0;
    v_customer.plates_added_today := 0;
    v_customer.last_active_date := CURRENT_DATE;
  END IF;

  v_customer.meals_consumed_today := COALESCE(v_customer.meals_consumed_today, 0);
  v_customer.plates_added_today := COALESCE(v_customer.plates_added_today, 0);

  IF v_customer.remaining_plates IS NULL OR v_customer.remaining_plates < p_count THEN
    RAISE EXCEPTION 'Not enough plates remaining.';
  END IF;

  -- Check expiry for fixed plans
  IF v_customer.plan_expiry_date IS NOT NULL AND v_customer.plan_expiry_date < now() THEN
    RAISE EXCEPTION 'Plan has already expired';
  END IF;

  -- Deduct plates and update daily counters
  UPDATE public.customers
  SET remaining_plates    = remaining_plates - p_count,
      meals_consumed_today = v_customer.meals_consumed_today + p_count,
      plates_added_today   = v_customer.plates_added_today,
      last_active_date     = CURRENT_DATE,
      last_visit_at        = now(),
      updated_at           = now()
  WHERE id = p_customer_id
  RETURNING * INTO v_customer;

  -- ✅ LOG THE EAT ACTION (this was missing in the deployed version)
  INSERT INTO public.logs (admin_id, customer_id, plates_deducted, note)
  VALUES (auth.uid(), p_customer_id, p_count, 'Meal consumed');

  RETURN v_customer;
END;
$$;


-- Also fix add_plate to ensure it logs consistently
DROP FUNCTION IF EXISTS public.add_plate(uuid, integer, text);
DROP FUNCTION IF EXISTS public.add_plate(uuid, integer);

CREATE OR REPLACE FUNCTION public.add_plate(
  p_customer_id UUID,
  p_count INT DEFAULT 1
)
RETURNS public.customers
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_customer public.customers;
BEGIN
  -- Lock row and verify admin owns customer
  SELECT * INTO v_customer
  FROM public.customers
  WHERE id = p_customer_id
    AND admin_id = auth.uid()
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Customer not found or not owned by admin';
  END IF;

  IF v_customer.last_active_date IS NULL OR v_customer.last_active_date < CURRENT_DATE THEN
    v_customer.meals_consumed_today := 0;
    v_customer.plates_added_today := 0;
    v_customer.last_active_date := CURRENT_DATE;
  END IF;

  v_customer.plates_added_today := COALESCE(v_customer.plates_added_today, 0);
  v_customer.meals_consumed_today := COALESCE(v_customer.meals_consumed_today, 0);

  -- You can only refund plates that were actually eaten today
  IF (v_customer.meals_consumed_today - v_customer.plates_added_today) < p_count THEN
    RAISE EXCEPTION 'Cannot refund more plates than consumed today.';
  END IF;

  UPDATE public.customers
  SET remaining_plates    = remaining_plates + p_count,
      plates_added_today   = v_customer.plates_added_today + p_count,
      meals_consumed_today = v_customer.meals_consumed_today,
      last_active_date     = CURRENT_DATE,
      updated_at           = now()
  WHERE id = p_customer_id
  RETURNING * INTO v_customer;

  -- ✅ LOG THE REFUND ACTION
  INSERT INTO public.logs (admin_id, customer_id, plates_deducted, note)
  VALUES (auth.uid(), p_customer_id, 0, '+1 plate added');

  RETURN v_customer;
END;
$$;
