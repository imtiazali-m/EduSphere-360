begin;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

alter table public.students
  add column if not exists application_status text not null default 'submitted',
  add column if not exists application_submitted_at timestamptz,
  add column if not exists application_reviewed_by uuid references auth.users(id) on delete set null,
  add column if not exists application_reviewed_at timestamptz,
  add column if not exists application_review_notes text,
  add column if not exists admission_date date;

alter table public.students drop constraint if exists students_application_status_check;
alter table public.students add constraint students_application_status_check
  check (application_status in ('draft','submitted','under_review','documents_required','approved','enrolled','rejected','withdrawn'));

update public.students
set application_status = case
      when status = 'active' then 'enrolled'
      when status = 'graduated' then 'enrolled'
      when status = 'inactive' then 'withdrawn'
      else 'submitted'
    end,
    application_submitted_at = coalesce(application_submitted_at, created_at)
where application_submitted_at is null or application_status = 'submitted';

create index if not exists students_application_queue_idx
  on public.students (institution_id, application_status, created_at desc);
create unique index if not exists students_id_institution_uq on public.students (id, institution_id);
create unique index if not exists classes_id_institution_uq on public.classes (id, institution_id);
create unique index if not exists parent_guardians_id_institution_uq on public.parent_guardians (id, institution_id);

alter table public.guardian_students add column if not exists relationship text not null default 'guardian';
alter table public.guardian_students drop constraint if exists guardian_students_student_id_fkey;
alter table public.guardian_students drop constraint if exists guardian_students_guardian_id_fkey;
alter table public.guardian_students add constraint guardian_students_student_institution_fk
  foreign key (student_id, institution_id) references public.students (id, institution_id) on delete cascade;
alter table public.guardian_students add constraint guardian_students_guardian_institution_fk
  foreign key (guardian_id, institution_id) references public.parent_guardians (id, institution_id) on delete cascade;

grant select, insert, update, delete on public.parent_guardians to authenticated;
grant select, insert, update, delete on public.guardian_students to authenticated;

create table if not exists public.student_placements (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  student_id uuid not null,
  class_id uuid not null,
  effective_from date not null default current_date,
  effective_to date,
  status text not null default 'active' check (status in ('active','transferred','completed','withdrawn')),
  placement_reason text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint student_placements_student_institution_fk
    foreign key (student_id, institution_id) references public.students (id, institution_id) on delete cascade,
  constraint student_placements_class_institution_fk
    foreign key (class_id, institution_id) references public.classes (id, institution_id) on delete restrict,
  constraint student_placements_date_range_check check (effective_to is null or effective_to >= effective_from)
);
create unique index if not exists student_placements_one_active_uq
  on public.student_placements (institution_id, student_id)
  where status = 'active' and effective_to is null;
create index if not exists student_placements_student_history_idx
  on public.student_placements (institution_id, student_id, effective_from desc);

create table if not exists public.student_documents (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  student_id uuid not null,
  document_type text not null check (document_type in ('birth_certificate','identity','previous_school','medical','residence','photo','consent','transfer','other')),
  title text not null,
  file_name text not null,
  storage_path text not null,
  mime_type text not null,
  file_size bigint not null check (file_size > 0 and file_size <= 10485760),
  issue_date date,
  expiry_date date,
  verification_status text not null default 'pending' check (verification_status in ('pending','verified','rejected','expired')),
  visibility text not null default 'staff_only' check (visibility in ('staff_only','student_guardian')),
  verified_by uuid references auth.users(id) on delete set null,
  verified_at timestamptz,
  notes text,
  uploaded_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint student_documents_student_institution_fk
    foreign key (student_id, institution_id) references public.students (id, institution_id) on delete cascade,
  constraint student_documents_path_unique unique (institution_id, storage_path),
  constraint student_documents_expiry_check check (expiry_date is null or issue_date is null or expiry_date >= issue_date)
);
create index if not exists student_documents_student_idx
  on public.student_documents (institution_id, student_id, created_at desc);

create table if not exists public.student_history (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  student_id uuid not null,
  event_type text not null,
  summary text not null,
  old_values jsonb,
  new_values jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists student_history_student_idx
  on public.student_history (institution_id, student_id, created_at desc);

alter table public.student_placements enable row level security;
alter table public.student_documents enable row level security;
alter table public.student_history enable row level security;

grant select, insert, update, delete on public.student_placements to authenticated;
grant select, insert, update, delete on public.student_documents to authenticated;
grant select on public.student_history to authenticated;

drop policy if exists student_placements_read_scoped on public.student_placements;
create policy student_placements_read_scoped on public.student_placements for select to authenticated
using (public.has_institution_role(institution_id, array['owner','admin','teacher','exam_officer']) or public.can_view_student(student_id));
drop policy if exists student_placements_admin_insert on public.student_placements;
create policy student_placements_admin_insert on public.student_placements for insert to authenticated
with check (public.has_institution_role(institution_id, array['owner','admin']));
drop policy if exists student_placements_admin_update on public.student_placements;
create policy student_placements_admin_update on public.student_placements for update to authenticated
using (public.has_institution_role(institution_id, array['owner','admin']))
with check (public.has_institution_role(institution_id, array['owner','admin']));
drop policy if exists student_placements_admin_delete on public.student_placements;
create policy student_placements_admin_delete on public.student_placements for delete to authenticated
using (public.has_institution_role(institution_id, array['owner','admin']));

drop policy if exists student_documents_read_scoped on public.student_documents;
create policy student_documents_read_scoped on public.student_documents for select to authenticated
using (
  public.has_institution_role(institution_id, array['owner','admin','teacher'])
  or (
    visibility = 'student_guardian'
    and (
      exists (select 1 from public.students s where s.id = student_documents.student_id and s.institution_id = student_documents.institution_id and s.user_id = (select auth.uid()))
      or exists (select 1 from public.student_guardians sg where sg.student_id = student_documents.student_id and sg.institution_id = student_documents.institution_id and sg.parent_user_id = (select auth.uid()))
    )
  )
);
drop policy if exists student_documents_staff_insert on public.student_documents;
create policy student_documents_staff_insert on public.student_documents for insert to authenticated
with check (uploaded_by = (select auth.uid()) and public.has_institution_role(institution_id, array['owner','admin','teacher']));
drop policy if exists student_documents_admin_update on public.student_documents;
create policy student_documents_admin_update on public.student_documents for update to authenticated
using (public.has_institution_role(institution_id, array['owner','admin']))
with check (public.has_institution_role(institution_id, array['owner','admin']));
drop policy if exists student_documents_admin_delete on public.student_documents;
create policy student_documents_admin_delete on public.student_documents for delete to authenticated
using (public.has_institution_role(institution_id, array['owner','admin']));

drop policy if exists student_history_read_scoped on public.student_history;
create policy student_history_read_scoped on public.student_history for select to authenticated
using (
  public.has_institution_role(institution_id, array['owner','admin','teacher'])
  or exists (select 1 from public.students s where s.id = student_history.student_id and s.institution_id = student_history.institution_id and s.user_id = (select auth.uid()))
  or exists (select 1 from public.student_guardians sg where sg.student_id = student_history.student_id and sg.institution_id = student_history.institution_id and sg.parent_user_id = (select auth.uid()))
);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('student-files', 'student-files', false, 10485760,
  array['application/pdf','image/png','image/jpeg','image/webp','text/plain','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists student_files_read_scoped on storage.objects;
create policy student_files_read_scoped on storage.objects for select to authenticated
using (
  bucket_id = 'student-files'
  and array_length(storage.foldername(name), 1) = 2
  and (
    exists (select 1 from public.memberships m where m.institution_id::text = (storage.foldername(name))[1] and m.user_id = (select auth.uid()) and m.status = 'active' and m.role in ('owner','admin','teacher'))
    or exists (
      select 1 from public.student_documents d
      join public.students s on s.id = d.student_id and s.institution_id = d.institution_id
      where d.storage_path = name and d.institution_id::text = (storage.foldername(name))[1]
        and d.visibility = 'student_guardian'
        and (
          s.user_id = (select auth.uid())
          or exists (select 1 from public.student_guardians sg where sg.student_id = s.id and sg.institution_id = s.institution_id and sg.parent_user_id = (select auth.uid()))
        )
    )
  )
);
drop policy if exists student_files_insert_staff on storage.objects;
create policy student_files_insert_staff on storage.objects for insert to authenticated
with check (
  bucket_id = 'student-files'
  and array_length(storage.foldername(name), 1) = 2
  and exists (select 1 from public.memberships m where m.institution_id::text = (storage.foldername(name))[1] and m.user_id = (select auth.uid()) and m.status = 'active' and m.role in ('owner','admin','teacher'))
);
drop policy if exists student_files_delete_admin on storage.objects;
create policy student_files_delete_admin on storage.objects for delete to authenticated
using (
  bucket_id = 'student-files'
  and array_length(storage.foldername(name), 1) = 2
  and exists (select 1 from public.memberships m where m.institution_id::text = (storage.foldername(name))[1] and m.user_id = (select auth.uid()) and m.status = 'active' and m.role in ('owner','admin'))
);

create or replace function private.close_previous_student_placement()
returns trigger language plpgsql security definer set search_path = pg_catalog, public as $$
begin
  perform 1 from public.students s where s.id = new.student_id and s.institution_id = new.institution_id for update;
  if new.status = 'active' and new.effective_to is null then
    update public.student_placements p
    set status = 'transferred', effective_to = greatest(p.effective_from, new.effective_from), updated_at = now()
    where p.institution_id = new.institution_id and p.student_id = new.student_id and p.status = 'active' and p.effective_to is null;
  end if;
  return new;
end;
$$;
revoke all on function private.close_previous_student_placement() from public, anon, authenticated;
drop trigger if exists student_placement_close_previous on public.student_placements;
create trigger student_placement_close_previous before insert on public.student_placements for each row execute function private.close_previous_student_placement();

create or replace function private.sync_student_class_name()
returns trigger language plpgsql security definer set search_path = pg_catalog, public as $$
declare v_class_name text;
begin
  if new.status = 'active' and new.effective_to is null then
    select c.name into v_class_name from public.classes c where c.id = new.class_id and c.institution_id = new.institution_id;
    if v_class_name is not null then
      update public.students set class_name = v_class_name, updated_at = now() where id = new.student_id and institution_id = new.institution_id;
    end if;
  end if;
  return new;
end;
$$;
revoke all on function private.sync_student_class_name() from public, anon, authenticated;
drop trigger if exists student_placement_sync_class_name on public.student_placements;
create trigger student_placement_sync_class_name after insert or update of class_id, status, effective_to on public.student_placements for each row execute function private.sync_student_class_name();

with matches as (
  select s.id as student_id, s.institution_id, min(c.id::text)::uuid as class_id, count(c.id) as match_count, min(s.created_at::date) as effective_from
  from public.students s
  left join public.classes c on c.institution_id = s.institution_id and lower(trim(c.name)) = lower(trim(s.class_name))
  group by s.id, s.institution_id
)
insert into public.student_placements (institution_id, student_id, class_id, effective_from, status, placement_reason)
select institution_id, student_id, class_id, effective_from, 'active',
       'Backfilled from an exact, unique match to the existing student class name.'
from matches where match_count = 1 on conflict do nothing;

insert into public.parent_guardians (institution_id, full_name, relationship, email)
select s.institution_id, trim(s.guardian_name), 'guardian', nullif(trim(s.guardian_email),'')
from public.students s
where nullif(trim(s.guardian_name),'') is not null
  and not exists (
    select 1 from public.parent_guardians g
    where g.institution_id = s.institution_id
      and ((nullif(trim(s.guardian_email),'') is not null and lower(trim(g.email)) = lower(trim(s.guardian_email)))
        or lower(trim(g.full_name)) = lower(trim(s.guardian_name)))
  );

insert into public.guardian_students (institution_id, student_id, guardian_id, relationship)
select s.institution_id, s.id, g.id, coalesce(nullif(trim(g.relationship),''),'guardian')
from public.students s
join public.parent_guardians g on g.institution_id = s.institution_id
  and ((nullif(trim(s.guardian_email),'') is not null and lower(trim(g.email)) = lower(trim(s.guardian_email)))
    or lower(trim(g.full_name)) = lower(trim(s.guardian_name)))
where nullif(trim(s.guardian_name),'') is not null
on conflict (guardian_id, student_id) do nothing;

create or replace function private.audit_student_record()
returns trigger language plpgsql security definer set search_path = pg_catalog, public as $$
declare v_old jsonb; v_new jsonb; v_event text; v_summary text;
begin
  v_new := jsonb_build_object('admission_no',new.admission_no,'full_name',new.full_name,'email',new.email,'class_name',new.class_name,'status',new.status,'application_status',new.application_status,'date_of_birth',new.date_of_birth,'admission_date',new.admission_date);
  if tg_op = 'INSERT' then
    insert into public.student_history(institution_id,student_id,event_type,summary,new_values,created_by,created_at)
    values(new.institution_id,new.id,'student_registered','Student record registered',v_new,auth.uid(),coalesce(new.created_at,now()));
    return new;
  end if;
  v_old := jsonb_build_object('admission_no',old.admission_no,'full_name',old.full_name,'email',old.email,'class_name',old.class_name,'status',old.status,'application_status',old.application_status,'date_of_birth',old.date_of_birth,'admission_date',old.admission_date);
  if v_old is distinct from v_new then
    if old.application_status is distinct from new.application_status then
      v_event := 'admission_status_changed'; v_summary := 'Admission status changed to ' || replace(new.application_status,'_',' ');
    else
      v_event := 'student_profile_updated'; v_summary := 'Student profile updated';
    end if;
    insert into public.student_history(institution_id,student_id,event_type,summary,old_values,new_values,created_by)
    values(new.institution_id,new.id,v_event,v_summary,v_old,v_new,auth.uid());
  end if;
  return new;
end;
$$;
revoke all on function private.audit_student_record() from public, anon, authenticated;
drop trigger if exists students_history_audit on public.students;
create trigger students_history_audit after insert or update on public.students for each row execute function private.audit_student_record();

create or replace function private.audit_student_placement()
returns trigger language plpgsql security definer set search_path = pg_catalog, public as $$
declare v_student uuid; v_institution uuid; v_event text; v_summary text; v_old jsonb; v_new jsonb;
begin
  v_student := case when tg_op='DELETE' then old.student_id else new.student_id end;
  v_institution := case when tg_op='DELETE' then old.institution_id else new.institution_id end;
  if tg_op='DELETE' then
    v_event := 'class_placement_removed'; v_summary := 'Class placement removed';
    v_old := jsonb_build_object('class_id',old.class_id,'effective_from',old.effective_from,'effective_to',old.effective_to,'status',old.status,'reason',old.placement_reason);
  elsif tg_op='INSERT' then
    v_event := 'class_placement_assigned'; v_summary := 'Class placement assigned';
    v_new := jsonb_build_object('class_id',new.class_id,'effective_from',new.effective_from,'status',new.status,'reason',new.placement_reason);
  else
    v_event := 'class_placement_updated'; v_summary := 'Class placement updated';
    v_old := jsonb_build_object('class_id',old.class_id,'effective_from',old.effective_from,'effective_to',old.effective_to,'status',old.status,'reason',old.placement_reason);
    v_new := jsonb_build_object('class_id',new.class_id,'effective_from',new.effective_from,'effective_to',new.effective_to,'status',new.status,'reason',new.placement_reason);
  end if;
  insert into public.student_history(institution_id,student_id,event_type,summary,old_values,new_values,created_by)
  values(v_institution,v_student,v_event,v_summary,v_old,v_new,auth.uid());
  return case when tg_op='DELETE' then old else new end;
end;
$$;
revoke all on function private.audit_student_placement() from public, anon, authenticated;
drop trigger if exists student_placements_history_audit on public.student_placements;
create trigger student_placements_history_audit after insert or update or delete on public.student_placements for each row execute function private.audit_student_placement();

create or replace function private.audit_student_guardian_link()
returns trigger language plpgsql security definer set search_path = pg_catalog, public as $$
declare v_event text; v_summary text; v_student uuid; v_institution uuid; v_old jsonb; v_new jsonb;
begin
  v_student := case when tg_op='DELETE' then old.student_id else new.student_id end;
  v_institution := case when tg_op='DELETE' then old.institution_id else new.institution_id end;
  if tg_op='DELETE' then
    v_event := 'guardian_unlinked'; v_summary := 'Guardian unlinked from student';
    v_old := jsonb_build_object('guardian_id',old.guardian_id,'relationship',old.relationship);
  else
    v_event := 'guardian_linked'; v_summary := 'Guardian linked to student';
    v_new := jsonb_build_object('guardian_id',new.guardian_id,'relationship',new.relationship);
  end if;
  insert into public.student_history(institution_id,student_id,event_type,summary,old_values,new_values,created_by)
  values(v_institution,v_student,v_event,v_summary,v_old,v_new,auth.uid());
  return case when tg_op='DELETE' then old else new end;
end;
$$;
revoke all on function private.audit_student_guardian_link() from public, anon, authenticated;
drop trigger if exists guardian_students_history_audit on public.guardian_students;
create trigger guardian_students_history_audit after insert or update or delete on public.guardian_students for each row execute function private.audit_student_guardian_link();

create or replace function private.audit_student_document()
returns trigger language plpgsql security definer set search_path = pg_catalog, public as $$
declare v_student uuid; v_institution uuid; v_event text; v_summary text; v_old jsonb; v_new jsonb;
begin
  v_student := case when tg_op='DELETE' then old.student_id else new.student_id end;
  v_institution := case when tg_op='DELETE' then old.institution_id else new.institution_id end;
  if tg_op='DELETE' then
    v_event := 'student_document_removed'; v_summary := 'Student document removed';
    v_old := jsonb_build_object('document_type',old.document_type,'title',old.title,'verification_status',old.verification_status);
  elsif tg_op='INSERT' then
    v_event := 'student_document_added'; v_summary := 'Student document uploaded: ' || new.title;
    v_new := jsonb_build_object('document_type',new.document_type,'title',new.title,'verification_status',new.verification_status);
  else
    v_event := 'student_document_verification_changed'; v_summary := 'Student document verification changed to ' || replace(new.verification_status,'_',' ');
    v_old := jsonb_build_object('document_type',old.document_type,'title',old.title,'verification_status',old.verification_status);
    v_new := jsonb_build_object('document_type',new.document_type,'title',new.title,'verification_status',new.verification_status);
  end if;
  if tg_op <> 'UPDATE' or old.verification_status is distinct from new.verification_status then
    insert into public.student_history(institution_id,student_id,event_type,summary,old_values,new_values,created_by)
    values(v_institution,v_student,v_event,v_summary,v_old,v_new,auth.uid());
  end if;
  return case when tg_op='DELETE' then old else new end;
end;
$$;
revoke all on function private.audit_student_document() from public, anon, authenticated;
drop trigger if exists student_documents_history_audit on public.student_documents;
create trigger student_documents_history_audit after insert or update or delete on public.student_documents for each row execute function private.audit_student_document();

create or replace function private.audit_parent_guardian()
returns trigger language plpgsql security definer set search_path = pg_catalog, public as $$
declare v_guardian uuid; v_institution uuid; v_old jsonb; v_new jsonb; linked record;
begin
  v_guardian := case when tg_op='DELETE' then old.id else new.id end;
  v_institution := case when tg_op='DELETE' then old.institution_id else new.institution_id end;
  if tg_op='DELETE' then
    v_old := jsonb_build_object('full_name',old.full_name,'relationship',old.relationship,'email',old.email,'phone',old.phone);
  else
    v_new := jsonb_build_object('full_name',new.full_name,'relationship',new.relationship,'email',new.email,'phone',new.phone);
    if tg_op='UPDATE' then
      v_old := jsonb_build_object('full_name',old.full_name,'relationship',old.relationship,'email',old.email,'phone',old.phone);
      if v_old = v_new then return new; end if;
    end if;
  end if;
  for linked in select gs.student_id from public.guardian_students gs where gs.guardian_id=v_guardian and gs.institution_id=v_institution loop
    insert into public.student_history(institution_id,student_id,event_type,summary,old_values,new_values,created_by)
    values(v_institution,linked.student_id,case when tg_op='DELETE' then 'guardian_contact_removed' else 'guardian_contact_updated' end,case when tg_op='DELETE' then 'Guardian contact removed' else 'Guardian contact updated' end,v_old,v_new,auth.uid());
  end loop;
  return case when tg_op='DELETE' then old else new end;
end;
$$;
revoke all on function private.audit_parent_guardian() from public, anon, authenticated;
drop trigger if exists parent_guardians_history_audit on public.parent_guardians;
create trigger parent_guardians_history_audit after update or delete on public.parent_guardians for each row execute function private.audit_parent_guardian();

insert into public.student_history(institution_id,student_id,event_type,summary,new_values,created_by,created_at)
select s.institution_id,s.id,'student_registered',
       'Original registration event (baseline; earlier edits were not audited)',
       jsonb_build_object('admission_no',s.admission_no,'full_name',s.full_name,'class_name',s.class_name,'status',s.status,'application_status',s.application_status),
       s.created_by,s.created_at
from public.students s
where not exists (select 1 from public.student_history h where h.institution_id=s.institution_id and h.student_id=s.id and h.event_type='student_registered');

commit;
