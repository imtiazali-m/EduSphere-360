-- EduSphere 360: one-time manual creation of the first cloud institution owner.
-- BEFORE RUNNING:
-- 1) Create a user in Supabase Dashboard > Authentication > Users > Add user.
--    You may create the user directly or send an invitation and let the owner accept it.
-- 2) Copy that user's UUID from Authentication > Users.
-- 3) Replace the four owner/institution placeholders below.
-- 4) Run this once in SQL Editor in the SAME Supabase project as the website.
-- 5) Do not include passwords, API keys, or secret keys in this SQL.

DO $$
DECLARE
  v_user_id uuid := 'PASTE_AUTH_USER_UUID_HERE'::uuid;
  v_full_name text := 'YOUR FULL NAME';
  v_email text := 'YOUR EMAIL ADDRESS';
  v_institution_name text := 'EduSphere Academy';
  v_institution_type text := 'school'; -- school, college, university, multi_institution
  v_institution_id uuid;
BEGIN
  IF v_user_id::text = 'PASTE_AUTH_USER_UUID_HERE'
     OR v_full_name = 'YOUR FULL NAME'
     OR v_email = 'YOUR EMAIL ADDRESS' THEN
    RAISE EXCEPTION 'Replace the SQL placeholders with your Auth user ID, full name and email before running.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM auth.users u
    WHERE u.id = v_user_id AND lower(u.email) = lower(v_email)
  ) THEN
    RAISE EXCEPTION 'No Supabase Auth user matches the supplied UUID and email. Check Authentication > Users.';
  END IF;

  IF EXISTS (SELECT 1 FROM public.institutions) THEN
    RAISE EXCEPTION 'An institution already exists. Stop here; do not create a duplicate. Check existing institutions first.';
  END IF;

  IF v_institution_type NOT IN ('school','college','university','multi_institution') THEN
    RAISE EXCEPTION 'Invalid institution type.';
  END IF;

  INSERT INTO public.institutions (name, institution_type, created_by)
  VALUES (v_institution_name, v_institution_type, v_user_id)
  RETURNING id INTO v_institution_id;

  INSERT INTO public.profiles (id, full_name, email)
  VALUES (v_user_id, v_full_name, lower(v_email))
  ON CONFLICT (id) DO UPDATE
    SET full_name = EXCLUDED.full_name,
        email = EXCLUDED.email,
        updated_at = now();

  INSERT INTO public.memberships (institution_id, user_id, role, status)
  VALUES (v_institution_id, v_user_id, 'owner', 'active')
  ON CONFLICT (institution_id, user_id) DO UPDATE
    SET role = 'owner', status = 'active';

  UPDATE public.platform_setup_control
  SET status = 'completed', updated_at = now()
  WHERE singleton = true;

  RAISE NOTICE 'EduSphere 360 owner setup completed. Institution ID: %', v_institution_id;
END $$;
