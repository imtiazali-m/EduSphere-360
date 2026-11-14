create table if not exists public.institution_form_definitions (
 id uuid primary key default gen_random_uuid(),
 institution_id uuid not null references public.institutions(id) on delete cascade,
 form_code text not null,
 title text not null check(length(trim(title)) between 3 and 180),
 form_type text not null default 'general' check(form_type=any(array['general'::text,'application'::text,'letter_request'::text,'consent'::text,'feedback'::text])),
 description text,
 field_schema jsonb not null default '[]'::jsonb check(jsonb_typeof(field_schema)='array'),
 audience_roles text[] not null default array['owner','admin','teacher','student','parent','accountant','exam_officer']::text[],
 status text not null default 'draft' check(status=any(array['draft'::text,'published'::text,'archived'::text])),
 allow_multiple_submissions boolean not null default true,
 created_by uuid not null references auth.users(id) on delete restrict,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 constraint institution_form_definitions_id_institution_uq unique(id,institution_id),
 constraint institution_form_definitions_code_uq unique(institution_id,form_code)
);
create index if not exists institution_form_definitions_status_idx
 on public.institution_form_definitions(institution_id,status,form_type,title);

create table if not exists public.institution_form_submissions (
 id uuid primary key default gen_random_uuid(),
 institution_id uuid not null references public.institutions(id) on delete cascade,
 form_id uuid not null,
 submission_number text not null,
 submitted_by uuid not null references auth.users(id) on delete restrict,
 submitted_at timestamptz not null default now(),
 answers jsonb not null default '{}'::jsonb check(jsonb_typeof(answers)='object'),
 status text not null default 'pending' check(status=any(array['pending'::text,'approved'::text,'rejected'::text,'returned'::text])),
 reviewed_by uuid references auth.users(id) on delete restrict,
 reviewed_at timestamptz,
 review_note text,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 constraint institution_form_submissions_form_fk foreign key(form_id,institution_id)
  references public.institution_form_definitions(id,institution_id) on delete restrict,
 constraint institution_form_submissions_number_uq unique(institution_id,submission_number)
);
create index if not exists institution_form_submissions_queue_idx
 on public.institution_form_submissions(institution_id,status,submitted_at desc);
create index if not exists institution_form_submissions_form_idx
 on public.institution_form_submissions(institution_id,form_id,submitted_at desc);

alter table public.institution_form_definitions enable row level security;
alter table public.institution_form_submissions enable row level security;
revoke all on table public.institution_form_definitions from public,anon,authenticated;
revoke all on table public.institution_form_submissions from public,anon,authenticated;
grant select,insert,update,delete on table public.institution_form_definitions to authenticated;
grant select,insert on table public.institution_form_submissions to authenticated;

drop policy if exists institution_forms_read on public.institution_form_definitions;
create policy institution_forms_read on public.institution_form_definitions for select to authenticated
using(has_institution_role(institution_id,array['owner'::text,'admin'::text,'teacher'::text,'student'::text,'parent'::text,'accountant'::text,'exam_officer'::text]));

drop policy if exists institution_forms_manage on public.institution_form_definitions;
create policy institution_forms_manage on public.institution_form_definitions for all to authenticated
using(has_institution_role(institution_id,array['owner'::text,'admin'::text]))
with check(has_institution_role(institution_id,array['owner'::text,'admin'::text]));

drop policy if exists institution_form_submissions_read on public.institution_form_submissions;
create policy institution_form_submissions_read on public.institution_form_submissions for select to authenticated
using(submitted_by=(select auth.uid()) or has_institution_role(institution_id,array['owner'::text,'admin'::text]));

drop policy if exists institution_form_submissions_insert on public.institution_form_submissions;
create policy institution_form_submissions_insert on public.institution_form_submissions for insert to authenticated
with check (
 submitted_by=(select auth.uid())
 and has_institution_role(institution_id,array['owner'::text,'admin'::text,'teacher'::text,'student'::text,'parent'::text,'accountant'::text,'exam_officer'::text])
 and exists(
  select 1 from public.institution_form_definitions f
  join public.memberships m on m.institution_id=f.institution_id and m.user_id=(select auth.uid()) and m.status='active'
  where f.id=form_id and f.institution_id=institution_form_submissions.institution_id
   and f.status='published' and m.role=any(f.audience_roles)
 )
);

create or replace function public.review_institution_form_submission(
 p_institution_id uuid,p_submission_id uuid,p_decision text,p_review_note text default null
)
returns public.institution_form_submissions
language plpgsql
security definer
set search_path=public
as $$
declare submission_row public.institution_form_submissions;
begin
 if auth.uid() is null or not has_institution_role(p_institution_id,array['owner'::text,'admin'::text]) then
  raise exception 'Only an institution owner or administrator can review form submissions';
 end if;
 if p_decision not in ('approved','rejected','returned') then raise exception 'Unsupported form submission decision'; end if;
 select * into submission_row from public.institution_form_submissions
 where id=p_submission_id and institution_id=p_institution_id for update;
 if not found then raise exception 'Form submission not found in this institution'; end if;
 if submission_row.status<>'pending' then raise exception 'Only pending submissions can be reviewed'; end if;
 if p_decision in ('rejected','returned') and length(trim(coalesce(p_review_note,'')))<3 then
  raise exception 'Add a review note before rejecting or returning a submission';
 end if;
 update public.institution_form_submissions set status=p_decision,reviewed_by=auth.uid(),
  reviewed_at=now(),review_note=nullif(trim(p_review_note),''),updated_at=now()
 where id=p_submission_id and institution_id=p_institution_id returning * into submission_row;
 return submission_row;
end;
$$;
revoke all on function public.review_institution_form_submission(uuid,uuid,text,text) from public,anon;
grant execute on function public.review_institution_form_submission(uuid,uuid,text,text) to authenticated,service_role;
