-- Capture the institution details submitted by the first owner during public signup.
-- This replaces only the auth.users INSERT trigger function. Existing institutions,
-- profiles and memberships are not updated or migrated by this change.
create or replace function public.handle_edu_institution_owner_signup()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
declare
  signup_kind text;
  owner_name text;
  institution_name text;
  institution_type text;
  new_institution_id uuid;
begin
  signup_kind := coalesce(new.raw_user_meta_data ->> 'edusphere_signup', '');
  if signup_kind <> 'institution_owner' then
    return new;
  end if;

  if new.email is null or length(pg_catalog.btrim(new.email)) = 0 then
    raise exception 'A valid email address is required to create an EduSphere 360 owner account.';
  end if;

  owner_name := nullif(pg_catalog.btrim(coalesce(new.raw_user_meta_data ->> 'full_name', '')), '');
  institution_name := nullif(pg_catalog.btrim(coalesce(new.raw_user_meta_data ->> 'institution_name', '')), '');
  institution_type := coalesce(nullif(pg_catalog.btrim(coalesce(new.raw_user_meta_data ->> 'institution_type', '')), ''), 'school');

  if owner_name is null then
    raise exception 'Enter your full name before creating an institution owner account.';
  end if;
  if institution_name is null then
    raise exception 'Enter your institution name before creating an institution owner account.';
  end if;
  if institution_type not in ('school', 'college', 'university', 'multi_institution') then
    raise exception 'Select a valid institution type.';
  end if;

  insert into public.institutions (name, institution_type, created_by)
  values (institution_name, institution_type, new.id)
  returning id into new_institution_id;

  insert into public.profiles (id, full_name, email)
  values (new.id, owner_name, pg_catalog.lower(pg_catalog.btrim(new.email)))
  on conflict (id) do update
    set full_name = excluded.full_name,
        email = excluded.email,
        updated_at = pg_catalog.now();

  insert into public.memberships (institution_id, user_id, role, status)
  values (
    new_institution_id,
    new.id,
    'owner',
    case when new.email_confirmed_at is null then 'invited' else 'active' end
  )
  on conflict (institution_id, user_id) do update
    set status = excluded.status;

  return new;
end;
$function$;

revoke all on function public.handle_edu_institution_owner_signup() from public, anon, authenticated;
comment on function public.handle_edu_institution_owner_signup() is
  'Creates a new institution tenant and owner membership using full_name, institution_name and institution_type signup metadata. Existing tenant data is not modified.';
