-- =================================================================
-- MessKhata — Supabase SQL Functions  (canonical, conflict-free)
-- Run this entire file once in your Supabase SQL Editor.
-- All statements use CREATE OR REPLACE / IF NOT EXISTS, safe to re-run.
-- =================================================================


-- -----------------------------------------------------------------
-- 0. Schema migrations
--    Add daily-tracking columns to customers if they don't exist yet.
-- -----------------------------------------------------------------
ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS meals_consumed_today  integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS plates_added_today    integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_active_date      date;

-- Fix existing NULL rows
UPDATE public.customers
SET
  meals_consumed_today = 0,
  plates_added_today   = 0,
  last_active_date     = CURRENT_DATE
WHERE last_active_date IS NULL;

-- Add current_plan_total column (tracks plates in the current plan cycle)
ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS current_plan_total integer;

UPDATE public.customers
SET current_plan_total = total_plates
WHERE current_plan_total IS NULL;

-- Add customer_code column (human-friendly admin-assigned ID, unique per admin)
ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS customer_code text;

CREATE UNIQUE INDEX IF NOT EXISTS customers_customer_code_unique
  ON public.customers (admin_id, customer_code);


-- -----------------------------------------------------------------
-- 0b. Fix logs constraint to allow plates_deducted = 0
--     (renewal log entries legitimately have 0 plates deducted)
-- -----------------------------------------------------------------
ALTER TABLE public.logs
  DROP CONSTRAINT IF EXISTS logs_plates_deducted_check;

ALTER TABLE public.logs
  ADD CONSTRAINT logs_plates_deducted_check
  CHECK (plates_deducted >= 0);


-- -----------------------------------------------------------------
-- Drop all conflicting overloads so only our canonical signatures remain.
-- -----------------------------------------------------------------
DROP FUNCTION IF EXISTS public.consume_plate(uuid, integer, text);
DROP FUNCTION IF EXISTS public.consume_plate(uuid, integer);
DROP FUNCTION IF EXISTS public.add_plate(uuid, integer);
DROP FUNCTION IF EXISTS public.renew_plan(uuid, integer, timestamptz);
DROP FUNCTION IF EXISTS public.renew_plan(uuid, integer, timestamptz, text);


-- -----------------------------------------------------------------
-- 1. consume_plate
--    Called by the EAT button.
--    • Resets daily counters if it's a new day.
--    • Enforces a hard cap of 3 meals per customer per day.
--    • Decrements remaining_plates, logs the action.
--    • Returns the updated customer row.
-- -----------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.consume_plate(
  p_customer_id uuid,
  p_count       integer DEFAULT 1
)
RETURNS public.customers
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_customer public.customers;
  v_today    date := (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata')::date;
BEGIN
  -- Lock row to prevent fast double-clicks from bypassing the limit
  SELECT * INTO v_customer
  FROM public.customers
  WHERE id = p_customer_id
    AND admin_id = auth.uid()
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Customer not found or not owned by admin';
  END IF;

  IF v_customer.status <> 'active' THEN
    RAISE EXCEPTION 'Customer plan is not active (status: %)', v_customer.status;
  END IF;

  -- Reset daily counters if it's a new day (using IST midnight)
  IF v_customer.last_active_date IS NULL OR v_customer.last_active_date < v_today THEN
    v_customer.meals_consumed_today := 0;
    v_customer.plates_added_today   := 0;
    v_customer.last_active_date     := v_today;
  END IF;

  -- Ensure no NULLs
  v_customer.meals_consumed_today := COALESCE(v_customer.meals_consumed_today, 0);

  -- Check plates
  IF v_customer.remaining_plates IS NULL OR v_customer.remaining_plates < p_count THEN
    RAISE EXCEPTION 'Not enough plates remaining (have %, need %)',
      COALESCE(v_customer.remaining_plates, 0), p_count;
  END IF;

  -- Check expiry
  IF v_customer.plan_expiry_date IS NOT NULL AND v_customer.plan_expiry_date < NOW() THEN
    RAISE EXCEPTION 'Plan has already expired';
  END IF;

  -- Enforce 3 meals/day cap
  IF v_customer.meals_consumed_today >= 3 THEN
    RAISE EXCEPTION 'Daily limit of 3 meals reached';
  END IF;

  -- Decrement; flip to expired if plates hit 0
  UPDATE public.customers
  SET
    remaining_plates      = remaining_plates - p_count,
    meals_consumed_today  = v_customer.meals_consumed_today + p_count,
    plates_added_today    = v_customer.plates_added_today,
    last_active_date      = v_today,
    last_visit_at         = NOW(),
    updated_at            = NOW(),
    status = CASE
               WHEN remaining_plates - p_count <= 0 THEN 'expired'
               ELSE status
             END
  WHERE id = p_customer_id
  RETURNING * INTO v_customer;

  -- Log the action
  INSERT INTO public.logs (admin_id, customer_id, plates_deducted, note)
  VALUES (auth.uid(), p_customer_id, p_count, 'Meal consumed');

  RETURN v_customer;
END;
$$;


-- -----------------------------------------------------------------
-- 2. add_plate
--    Called by the "+1 More" button.
--    • Only allowed after the customer has eaten all 3 meals today.
--    • Can be used at most once per day.
--    • Increments remaining_plates by p_count.
--    • Returns the updated customer row.
-- -----------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.add_plate(
  p_customer_id uuid,
  p_count       integer DEFAULT 1
)
RETURNS public.customers
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_customer public.customers;
  v_today    date := (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata')::date;
BEGIN
  SELECT * INTO v_customer
  FROM public.customers
  WHERE id = p_customer_id
    AND admin_id = auth.uid()
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Customer not found or not owned by admin';
  END IF;

  IF v_customer.status <> 'active' THEN
    RAISE EXCEPTION 'Customer plan is not active (status: %)', v_customer.status;
  END IF;

  -- Reset daily counters if it's a new day (using IST midnight)
  IF v_customer.last_active_date IS NULL OR v_customer.last_active_date < v_today THEN
    v_customer.meals_consumed_today := 0;
    v_customer.plates_added_today   := 0;
    v_customer.last_active_date     := v_today;
  END IF;

  v_customer.plates_added_today := COALESCE(v_customer.plates_added_today, 0);
  v_customer.meals_consumed_today := COALESCE(v_customer.meals_consumed_today, 0);

  -- Can only add a plate after eating all 3 meals today
  IF v_customer.meals_consumed_today < 3 THEN
    RAISE EXCEPTION 'Cannot add plate: customer has not yet eaten all 3 meals today (eaten: %)',
      v_customer.meals_consumed_today;
  END IF;

  -- Enforce 1 addition per day
  IF v_customer.plates_added_today >= 1 THEN
    RAISE EXCEPTION 'Daily limit of 1 plate addition reached';
  END IF;

  UPDATE public.customers
  SET
    remaining_plates     = remaining_plates + p_count,
    plates_added_today   = v_customer.plates_added_today + 1,
    meals_consumed_today = v_customer.meals_consumed_today,
    last_active_date     = v_today,
    updated_at           = NOW()
  WHERE id = p_customer_id
  RETURNING * INTO v_customer;

  -- Log with plates_deducted = 0 (it's an addition, not a deduction)
  INSERT INTO public.logs (admin_id, customer_id, plates_deducted, note)
  VALUES (auth.uid(), p_customer_id, 0, '+1 plate added');

  RETURN v_customer;
END;
$$;


-- -----------------------------------------------------------------
-- 3. renew_plan
--    Called by the RENEW modal.
--    • Resets remaining_plates to the new plan size (not additive).
--    • Increments lifetime total_plates.
--    • Sets current_plan_total to the new plan size.
--    • Optionally updates expiry date.
--    • Resets status to active and clears daily counters.
-- -----------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.renew_plan(
  p_customer_id       uuid,
  p_additional_plates integer,
  p_new_expiry        timestamptz DEFAULT NULL,
  p_note              text        DEFAULT 'Plan renewed'
)
RETURNS public.customers
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_customer public.customers;
BEGIN
  IF p_additional_plates <= 0 THEN
    RAISE EXCEPTION 'Additional plates must be greater than 0';
  END IF;

  SELECT * INTO v_customer
  FROM public.customers
  WHERE id = p_customer_id
    AND admin_id = auth.uid()
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Customer not found or not owned by admin';
  END IF;

  UPDATE public.customers
  SET
    -- Lifetime total always increases
    total_plates         = COALESCE(total_plates, 0) + p_additional_plates,
    -- Current plan resets to this plan's size
    current_plan_total   = p_additional_plates,
    -- Remaining resets to the new plan size
    remaining_plates     = p_additional_plates,
    plan_expiry_date     = COALESCE(p_new_expiry, plan_expiry_date),
    status               = 'active',
    -- Reset daily counters on renew
    meals_consumed_today = 0,
    plates_added_today   = 0,
    last_active_date     = CURRENT_DATE,
    updated_at           = NOW()
  WHERE id = p_customer_id
  RETURNING * INTO v_customer;

  INSERT INTO public.logs (admin_id, customer_id, plates_deducted, note)
  VALUES (auth.uid(), p_customer_id, 0, p_note);

  RETURN v_customer;
END;
$$;


-- -----------------------------------------------------------------
-- 4. auto_update_expired_and_archived
--    Called on every dashboard load.
--    Step 1: Mark active customers as 'expired' if plates = 0 OR date passed.
--    Step 2: Archive customers who have been expired for > 10 days.
-- -----------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.auto_update_expired_and_archived()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Mark expired: 0 plates OR expiry passed
  UPDATE public.customers
  SET status = 'expired', updated_at = NOW()
  WHERE admin_id = auth.uid()
    AND status = 'active'
    AND (
      (current_plan_type = 'fixed_plates' AND remaining_plates <= 0)
      OR (plan_expiry_date IS NOT NULL AND plan_expiry_date < NOW())
    );

  -- Auto-archive: expired for > 10 days
  UPDATE public.customers
  SET status = 'archived', updated_at = NOW()
  WHERE admin_id = auth.uid()
    AND status = 'expired'
    AND plan_expiry_date IS NOT NULL
    AND plan_expiry_date < (NOW() - INTERVAL '10 days');
END;
$$;


-- -----------------------------------------------------------------
-- 5. delete_stale_users
--    Called on every dashboard load (after auto_update_expired_and_archived).
--    Hard-deletes customers whose plan expired >= 3 months ago
--    and who have NOT been renewed (status is expired or archived).
--    Customers with NO expiry date are NEVER deleted by this job.
--    Returns the count of deleted rows.
-- -----------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.delete_stale_users()
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deleted int;
BEGIN
  DELETE FROM public.customers
  WHERE admin_id = auth.uid()
    AND plan_expiry_date IS NOT NULL
    AND plan_expiry_date < NOW() - INTERVAL '3 months'
    AND status IN ('expired', 'archived');

  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$;
