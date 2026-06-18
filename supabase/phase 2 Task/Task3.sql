-- Task 3 for task3 we have to only alter the table admin which is already done in task 1  

ALTER TABLE public.admins 
ADD COLUMN IF NOT EXISTS menu_data JSONB DEFAULT '{"morning": [], "evening": []}'::jsonb, 
ADD COLUMN IF NOT EXISTS menu_last_updated TIMESTAMPTZ;
