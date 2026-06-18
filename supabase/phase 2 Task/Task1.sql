Task 1 Create this table in supbase for task 1
-- 4. Admins table for authentication and profile management
CREATE TABLE public.admins (
  uid UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone TEXT NOT NULL UNIQUE,
  mess_name TEXT ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.admins ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins see own row"
  ON public.admins
  FOR SELECT
  USING (auth.uid() = auth_id);
CREATE POLICY "Admins update own row"
  ON public.admins
  FOR UPDATE
  USING (auth.uid() = auth_id);
CREATE POLICY "Admins insert own row"
  ON public.admins
  FOR INSERT
  WITH CHECK (auth.uid() = auth_id);  

ALTER TABLE public.admins 
ADD COLUMN IF NOT EXISTS menu_data JSONB DEFAULT '{"morning": [], "evening": []}'::jsonb, 
ADD COLUMN IF NOT EXISTS menu_last_updated TIMESTAMPTZ;
