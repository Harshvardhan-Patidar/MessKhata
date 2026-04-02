-- =================================================================
-- MessKhata — Supabase SQL Functions
-- Run this entire file in your Supabase SQL Editor (once).
-- All statements use CREATE OR REPLACE so they're safe to re-run.
-- =================================================================


-- -----------------------------------------------------------------
-- Drop any conflicting overloads of consume_plate first.
-- If a 3-param version (with p_note) already exists, Supabase
-- cannot choose between the two — drop it so only one remains.
-- -----------------------------------------------------------------
DROP FUNCTION IF EXISTS public.consume_plate(uuid, integer, text);
DROP FUNCTION IF EXISTS public.consume_plate(p_customer_id uuid, p_count integer, p_note text);


-- -----------------------------------------------------------------
-- 0. logs table (create if not already exists)
-- -----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS logs (
  id          uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id uuid        NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  created_at  timestamptz DEFAULT NOW()
);

-- Index for fast per-customer log queries
CREATE INDEX IF NOT EXISTS logs_customer_id_idx ON logs(customer_id);


-- -----------------------------------------------------------------
-- 1. consume_plate
--    Called by the EAT button.
--    Safely decrements remaining_plates by p_count (default 1),
--    logs the action, flips status to 'expired' if plates hit 0,
--    and returns the updated customer row as JSON.
-- -----------------------------------------------------------------
CREATE OR REPLACE FUNCTION consume_plate(
  p_customer_id uuid,
  p_count       int DEFAULT 1
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_customer customers%ROWTYPE;
BEGIN
  -- Lock the row to prevent a double-tap race condition
  SELECT * INTO v_customer
  FROM customers
  WHERE id = p_customer_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Customer not found';
  END IF;

  IF v_customer.status <> 'active' THEN
    RAISE EXCEPTION 'Customer plan is not active (status: %)', v_customer.status;
  END IF;

  IF v_customer.remaining_plates IS NULL OR v_customer.remaining_plates < p_count THEN
    RAISE EXCEPTION 'Not enough plates remaining (have %, need %)',
      COALESCE(v_customer.remaining_plates, 0), p_count;
  END IF;

  -- Decrement plates; flip to expired if this brings it to 0
  UPDATE customers
  SET
    remaining_plates = remaining_plates - p_count,
    status = CASE
               WHEN remaining_plates - p_count <= 0 THEN 'expired'
               ELSE status
             END
  WHERE id = p_customer_id
  RETURNING * INTO v_customer;

  -- Write an audit log entry
  INSERT INTO logs (customer_id, created_at)
  VALUES (p_customer_id, NOW());

  -- Return the updated row so the UI can update without a full refetch
  RETURN row_to_json(v_customer);
END;
$$;


-- -----------------------------------------------------------------
-- 2. renew_plan
--    Called by the RENEW modal.
--    Adds plates, optionally sets a new expiry, resets status to active.
-- -----------------------------------------------------------------
CREATE OR REPLACE FUNCTION renew_plan(
  p_customer_id       uuid,
  p_additional_plates int,
  p_new_expiry        timestamptz DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF p_additional_plates <= 0 THEN
    RAISE EXCEPTION 'Additional plates must be greater than 0';
  END IF;

  UPDATE customers
  SET
    remaining_plates  = COALESCE(remaining_plates, 0) + p_additional_plates,
    total_plates      = COALESCE(total_plates, 0) + p_additional_plates,
    current_plan_total = p_additional_plates,
    -- Keep existing expiry if caller passes NULL
    plan_expiry_date  = COALESCE(p_new_expiry, plan_expiry_date),
    status            = 'active'
  WHERE id = p_customer_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Customer not found';
  END IF;
END;
$$;


-- -----------------------------------------------------------------
-- 3. auto_update_expired_and_archived
--    Called on every dashboard load.
--    Step 1: Mark active customers as 'expired' if plates = 0 OR date passed.
--    Step 2: Archive customers who have been expired for > 10 days.
-- -----------------------------------------------------------------
CREATE OR REPLACE FUNCTION auto_update_expired_and_archived()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Expire active customers whose plan has run out
  UPDATE customers
  SET status = 'expired'
  WHERE status = 'active'
    AND (
      remaining_plates <= 0
      OR (plan_expiry_date IS NOT NULL AND plan_expiry_date < NOW())
    );

  -- Archive customers who have been expired for more than 10 days
  UPDATE customers
  SET status = 'archived'
  WHERE status = 'expired'
    AND plan_expiry_date IS NOT NULL
    AND plan_expiry_date < NOW() - INTERVAL '10 days';
END;
$$;


-- -----------------------------------------------------------------
-- 4. delete_stale_users
--    Called on every dashboard load (after auto_update_expired_and_archived).
--    Hard-deletes customers whose plan expired >= 3 months ago
--    and who have NOT been renewed (status is expired or archived).
--    Customers with NO expiry date are NEVER deleted by this job.
--    Returns the count of deleted rows.
-- -----------------------------------------------------------------
CREATE OR REPLACE FUNCTION delete_stale_users()
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_deleted int;
BEGIN
  DELETE FROM customers
  WHERE
    plan_expiry_date IS NOT NULL
    AND plan_expiry_date < NOW() - INTERVAL '3 months'
    AND status IN ('expired', 'archived');

  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$;
