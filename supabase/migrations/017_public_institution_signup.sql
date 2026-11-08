-- EduSphere 360: public institution-owner registration with email verification.
-- Safe to re-run after the earlier 015 migration. Apply after the Phase One and Phase Two database migrations (including 016).
-- Public visitors can create only a NEW institution. The owner membership remains
-- invited until Supabase confirms the signup email, then becomes active.

do $$
begin
  if to_regclass('public.institutions') is null
     or to_regclass('public.profiles') is null
     or to_regclass('public.memberships') is null then
    raise exception 'EduSphere core schema is missing. Apply migrations 001+ before 017_public_institution_signup.sql.';
  end if;
end;
$$;

create or replace function public.handle_edu_institution_owner_signup()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  signup_kind text;
  owner_name text;
  new_institution_id uuid;
begin
  signup_kind := coalesce(new.raw_user_meta_data ->> 'edusphere_signup', '');
  if signup_kind <> 'institution_owner' then
    return new;
  end if;

  if new.email is null or length(trim(new.email)) = 0 then
    raise exception 'A valid email address is required to create an EduSphere 360 owner account.';
  end if;

  owner_name := nullif(trim(coalesce(new.raw_user_meta_data ->> 'full_name', '')), '');
  if owner_name is null then
    owner_name := initcap(regexp_replace(split_part(new.email, '@', 1), '[._-]+', ' ', 'g'));
  end if;
  if owner_name is null or length(trim(owner_name)) = 0 then
    owner_name := 'Institution Owner';
  end if;

  insert into public.institutions (name, institution_type, created_by)
  values ('New Institution', 'school', new.id)
  returning id into new_institution_id;

  insert into public.profiles (id, full_name, email)
  values (new.id, owner_name, lower(trim(new.email)))
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
$$;

revoke all on function public.handle_edu_institution_owner_signup() from public, anon, authenticated;

drop trigger if exists on_edu_institution_owner_signup on auth.users;
create trigger on_edu_institution_owner_signup
after insert on auth.users
for each row
execute function public.handle_edu_institution_owner_signup();

-- If the original 015 migration was already applied while email confirmation was
-- disabled, hold any still-unverified public owner account in invited status.
update public.memberships m
set status = 'invited'
from auth.users u
where m.user_id = u.id
  and m.role = 'owner'
  and m.status = 'active'
  and u.email_confirmed_at is null
  and coalesce(u.raw_user_meta_data ->> 'edusphere_signup', '') = 'institution_owner';

create or replace function public.activate_edu_owner_after_email_confirmation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.email_confirmed_at is null
     and new.email_confirmed_at is not null
     and coalesce(new.raw_user_meta_data ->> 'edusphere_signup', '') = 'institution_owner' then
    update public.memberships
       set status = 'active'
     where user_id = new.id
       and role = 'owner'
       and status = 'invited';
  end if;
  return new;
end;
$$;

revoke all on function public.activate_edu_owner_after_email_confirmation() from public, anon, authenticated;

drop trigger if exists on_edu_owner_email_confirmed on auth.users;
create trigger on_edu_owner_email_confirmed
after update of email_confirmed_at on auth.users
for each row
when (old.email_confirmed_at is null and new.email_confirmed_at is not null)
execute function public.activate_edu_owner_after_email_confirmation();

comment on function public.handle_edu_institution_owner_signup() is
  'Creates a separate EduSphere 360 tenant for a public owner signup; owner membership is invited until email confirmation.';
comment on function public.activate_edu_owner_after_email_confirmation() is
  'Activates a public EduSphere 360 owner membership only after Supabase confirms the owner email.';
