-- Migration: 003_storage.sql
-- Description: Storage bucket and policies for payment proofs
-- Created: 2026-02-05

-- Note: This SQL creates the storage bucket policies.
-- The bucket itself should be created via Supabase Dashboard or API.
-- Bucket name: payment-proofs
-- Path pattern: user/{user_id}/booking/{booking_id}/{filename}

-- Storage policies are managed through Supabase Storage API
-- Below are the policy definitions to be applied manually or via API:

/*
BUCKET CONFIGURATION:
- Name: payment-proofs
- Public: false (private bucket)

POLICIES:

1. Upload Policy (INSERT):
   - Name: "Users can upload their own proofs"
   - Target: authenticated
   - Policy: (bucket_id = 'payment-proofs' AND (storage.foldername(name))[1] = 'user' AND (storage.foldername(name))[2] = auth.uid()::text)

2. Select Policy (SELECT):
   - Name: "Users can view their own proofs"
   - Target: authenticated
   - Policy: (bucket_id = 'payment-proofs' AND (storage.foldername(name))[1] = 'user' AND (storage.foldername(name))[2] = auth.uid()::text)

3. Admin Select Policy (SELECT):
   - Name: "Admins can view all proofs"
   - Target: authenticated
   - Policy: (bucket_id = 'payment-proofs' AND public.is_admin(auth.uid()))

4. Delete Policy (DELETE):
   - Name: "Users can delete their own proofs"
   - Target: authenticated
   - Policy: (bucket_id = 'payment-proofs' AND (storage.foldername(name))[1] = 'user' AND (storage.foldername(name))[2] = auth.uid()::text)
*/

-- Create the bucket via SQL (if Supabase supports it)
insert into storage.buckets (id, name, public)
values ('payment-proofs', 'payment-proofs', false)
on conflict (id) do nothing;

-- Storage policies for payment-proofs bucket
-- Users can upload to their own folder
drop policy if exists "Users can upload their own proofs" on storage.objects;
create policy "Users can upload their own proofs"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'payment-proofs' 
  and (storage.foldername(name))[1] = 'user' 
  and (storage.foldername(name))[2] = auth.uid()::text
);

-- Users can view their own files
drop policy if exists "Users can view their own proofs" on storage.objects;
create policy "Users can view their own proofs"
on storage.objects for select
to authenticated
using (
  bucket_id = 'payment-proofs' 
  and (storage.foldername(name))[1] = 'user' 
  and (storage.foldername(name))[2] = auth.uid()::text
);

-- Admins can view all files
drop policy if exists "Admins can view all proofs" on storage.objects;
create policy "Admins can view all proofs"
on storage.objects for select
to authenticated
using (
  bucket_id = 'payment-proofs' 
  and public.is_admin(auth.uid())
);

-- Users can delete their own files
drop policy if exists "Users can delete their own proofs" on storage.objects;
create policy "Users can delete their own proofs"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'payment-proofs' 
  and (storage.foldername(name))[1] = 'user' 
  and (storage.foldername(name))[2] = auth.uid()::text
);
