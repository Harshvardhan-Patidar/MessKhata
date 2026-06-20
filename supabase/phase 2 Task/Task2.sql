-- Task 2 create a otp table in supabse nd the otp will be autodeleted in 5 minutes 

-- edge function ko frontend se request jati hai aur data fetch karta hai db se ye security ke liye implement kara hai 
-- (An Edge Function in Supabase is backend code that runs on Supabase's servers (using Deno) and can be called from your frontend.)

-- 5. OTPs table for custom Fast2SMS authentication flow
CREATE TABLE public.otps (
  phone TEXT PRIMARY KEY,
  otp TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL
);

-- Enable RLS but add NO policies, meaning ONLY the service_role key can access this table.
ALTER TABLE public.otps ENABLE ROW LEVEL SECURITY;

-- Garbage collection function to delete expired OTPs
CREATE OR REPLACE FUNCTION delete_expired_otps() RETURNS void AS $$
BEGIN
  DELETE FROM public.otps WHERE expires_at < now();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER


-- deploy two edge function in supabase (supabase -> Project -> edge function)
-- 1 admin-login 
-- 2 admin-verify
-- you will find the code in the supabase folder then phase 2 then functions then their respective folder then index.ts(make sure you deploy with their respective name admin-login and admin-verify)
-- and .env me api key dalna hai fast2SMS.com so account banao aur waha se api key .env me variable name VITE_FASTAPI se dalna 
-- and yahi api key edge function me 2 things aati hai ek function jaha pe function deploy hoga nd second secrets waha pe dalna variable name FAST2SMS_API_KEY se dalna 