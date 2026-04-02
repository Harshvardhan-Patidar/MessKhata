-- One-time Supabase setup required
-- Go to your Supabase Dashboard → Storage and create a bucket:

-- Click "New bucket"
-- Name: customer-photos
-- ✅ Check Public bucket (so photo URLs work without auth tokens)
-- Click Create
-- Then add this RLS policy so only your admin can upload:

-- sql
-- In Supabase SQL Editor:
CREATE POLICY "Admins can upload customer photos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'customer-photos');
CREATE POLICY "Public read of customer photos"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'customer-photos');