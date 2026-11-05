-- EduSphere 360: store private Supabase Storage path for student profile photos.
-- Safe to run more than once.
ALTER TABLE public.students
  ADD COLUMN IF NOT EXISTS photo_path text;
