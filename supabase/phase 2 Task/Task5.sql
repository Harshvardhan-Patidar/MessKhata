-- this is another task to remove restrication on eat button and +1 More 
-- 1. Remove 3-meal limit from consume_plate
DROP FUNCTION IF EXISTS public.consume_plate(uuid, integer, text);
DROP FUNCTION IF EXISTS public.consume_plate(uuid, integer);

CREATE OR REPLACE FUNCTION consume_plate(p_customer_id UUID, p_count INT)
RETURNS public.customers
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_customer public.customers;
BEGIN
  -- Lock row to prevent fast double-clicks and ensure admin owns the customer
  SELECT * INTO v_customer FROM customers WHERE id = p_customer_id AND admin_id = auth.uid() FOR UPDATE;

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
  
  IF v_customer.remaining_plates < p_count THEN
    RAISE EXCEPTION 'Not enough plates remaining.';
  END IF;

  -- Update
  UPDATE customers
  SET remaining_plates = remaining_plates - p_count,
      meals_consumed_today = v_customer.meals_consumed_today + 1,
      plates_added_today = v_customer.plates_added_today, -- FIX: MUST UPDATE THIS SO THE RESET IS SAVED
      last_active_date = CURRENT_DATE
  WHERE id = p_customer_id
  RETURNING * INTO v_customer;

  -- Log the action
  INSERT INTO public.logs (admin_id, customer_id, plates_deducted, note)
  VALUES (auth.uid(), p_customer_id, p_count, 'Meal consumed');

  RETURN v_customer;
END;
$$;


-- 2. Allow unlimited refunds, strictly bound to plates consumed today
DROP FUNCTION IF EXISTS public.add_plate(uuid, integer, text);
DROP FUNCTION IF EXISTS public.add_plate(uuid, integer);

CREATE OR REPLACE FUNCTION add_plate(p_customer_id UUID, p_count INT)
RETURNS public.customers
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_customer public.customers;
BEGIN
  -- Lock row and verify admin owns customer
  SELECT * INTO v_customer FROM customers WHERE id = p_customer_id AND admin_id = auth.uid() FOR UPDATE;

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

  -- You can only refund plates that were actually eaten today!
  IF (v_customer.meals_consumed_today - v_customer.plates_added_today) < p_count THEN
    RAISE EXCEPTION 'Cannot refund more plates than consumed today.';
  END IF;

  UPDATE customers
  SET remaining_plates = remaining_plates + p_count,
      plates_added_today = v_customer.plates_added_today + 1,
      meals_consumed_today = v_customer.meals_consumed_today, -- FIX: MUST UPDATE THIS SO THE RESET IS SAVED
      last_active_date = CURRENT_DATE
  WHERE id = p_customer_id
  RETURNING * INTO v_customer;

  -- Log with plates_deducted = 0 (it's an addition, not a deduction)
  INSERT INTO public.logs (admin_id, customer_id, plates_deducted, note)
  VALUES (auth.uid(), p_customer_id, 0, '+1 plate added');

  RETURN v_customer;
END;
$$;

-- 3. FIX EXISTING USERS STUCK WITH NEGATIVE VALUES TODAY
-- Since you cannot refund more than you eat legitimately, any user with a negative 
-- calculated plates today is suffering from the bug. This will reset their bugged refunds to 0.
UPDATE customers
SET plates_added_today = 0
WHERE (meals_consumed_today - plates_added_today) < 0 
  AND last_active_date = CURRENT_DATE;