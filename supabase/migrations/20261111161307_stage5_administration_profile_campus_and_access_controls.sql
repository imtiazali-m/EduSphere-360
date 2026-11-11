alter table public.institutions
  add column if not exists tagline text,
  add column if not exists phone text,
  add column if not exists email text,
  add column if not exists website text,
  add column if not exists address text,
  add column if not exists country text,
  add column if not exists logo_path text;

grant update (name, tagline, phone, email, website, address, country, logo_path)
  on public.institutions to authenticated;

drop policy if exists institutions_owner_admin_update on public.institutions;
create policy institutions_owner_admin_update
  on public.institutions
  for update
  to authenticated
  using (public.has_institution_role(id, array['owner','admin']::text[]))
  with check (public.has_institution_role(id, array['owner','admin']::text[]));

alter table public.campuses
  add column if not exists branch_head_name text,
  add column if not exists academic_settings jsonb not null default '{}'::jsonb,
  add column if not exists operational_settings jsonb not null default '{}'::jsonb;

alter table public.campuses
  drop constraint if exists campuses_academic_settings_object_check,
  add constraint campuses_academic_settings_object_check
    check (jsonb_typeof(academic_settings) = 'object'),
  drop constraint if exists campuses_operational_settings_object_check,
  add constraint campuses_operational_settings_object_check
    check (jsonb_typeof(operational_settings) = 'object');

create or replace function public.set_institution_membership_status(
  p_institution_id uuid,
  p_membership_id uuid,
  p_status text
)
returns public.memberships
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_membership public.memberships;
begin
  if auth.uid() is null then
    raise exception 'Authentication is required.';
  end if;

  if p_status not in ('active','suspended') then
    raise exception 'Choose active or suspended status.';
  end if;

  if not public.has_institution_role(p_institution_id, array['owner','admin']::text[]) then
    raise exception 'Only the institution owner or an administrator can manage account access.';
  end if;

  select * into v_membership
    from public.memberships
   where id = p_membership_id
     and institution_id = p_institution_id
   for update;

  if not found then
    raise exception 'The institution membership was not found.';
  end if;

  if v_membership.role = 'owner' then
    raise exception 'The institution owner account cannot be suspended from this workspace.';
  end if;

  if v_membership.user_id = auth.uid() then
    raise exception 'You cannot change the access status of your own account.';
  end if;

  update public.memberships
     set status = p_status
   where id = p_membership_id
     and institution_id = p_institution_id
   returning * into v_membership;

  return v_membership;
end;
$function$;

revoke all on function public.set_institution_membership_status(uuid,uuid,text) from public, anon;
grant execute on function public.set_institution_membership_status(uuid,uuid,text) to authenticated;
