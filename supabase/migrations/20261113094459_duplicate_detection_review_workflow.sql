create table if not exists public.institution_duplicate_review_decisions (
 id uuid primary key default gen_random_uuid(),
 institution_id uuid not null references public.institutions(id) on delete cascade,
 entity_type text not null check(entity_type=any(array['student'::text,'teacher'::text])),
 record_a_id uuid not null,
 record_b_id uuid not null,
 matched_on text not null,
 decision text not null check(decision=any(array['confirmed_duplicate'::text,'false_positive'::text])),
 review_note text,
 reviewed_by uuid not null references auth.users(id) on delete restrict,
 reviewed_at timestamptz not null default now(),
 created_at timestamptz not null default now(),
 constraint institution_duplicate_review_distinct_records check(record_a_id<>record_b_id),
 constraint institution_duplicate_review_pair_uq unique(institution_id,entity_type,record_a_id,record_b_id,matched_on)
);
create index if not exists institution_duplicate_review_entity_idx
 on public.institution_duplicate_review_decisions(institution_id,entity_type,reviewed_at desc);
alter table public.institution_duplicate_review_decisions enable row level security;
revoke all on table public.institution_duplicate_review_decisions from public,anon,authenticated;
grant select on table public.institution_duplicate_review_decisions to authenticated;
drop policy if exists institution_duplicate_review_read on public.institution_duplicate_review_decisions;
create policy institution_duplicate_review_read on public.institution_duplicate_review_decisions for select to authenticated
using(has_institution_role(institution_id,array['owner'::text,'admin'::text]));

create or replace function public.review_possible_duplicate(
 p_institution_id uuid,p_entity_type text,p_record_a_id uuid,p_record_b_id uuid,p_matched_on text,p_decision text,p_review_note text default null
)
returns public.institution_duplicate_review_decisions
language plpgsql
security definer
set search_path=public
as $$
declare result_row public.institution_duplicate_review_decisions; a_exists boolean; b_exists boolean; left_id uuid; right_id uuid; 
begin
 if auth.uid() is null or not has_institution_role(p_institution_id,array['owner'::text,'admin'::text]) then
  raise exception 'Only an institution owner or administrator can review possible duplicates';
 end if;
 if p_entity_type not in ('student','teacher') or p_decision not in ('confirmed_duplicate','false_positive') then
  raise exception 'Unsupported duplicate review decision';
 end if;
 if p_record_a_id=p_record_b_id then raise exception 'A record cannot be compared with itself'; end if;
 left_id:=least(p_record_a_id,p_record_b_id);
 right_id:=greatest(p_record_a_id,p_record_b_id);
 if p_entity_type='student' then
  select exists(select 1 from public.students where id=left_id and institution_id=p_institution_id),
         exists(select 1 from public.students where id=right_id and institution_id=p_institution_id)
   into a_exists,b_exists;
 else
  select exists(select 1 from public.teachers where id=left_id and institution_id=p_institution_id),
         exists(select 1 from public.teachers where id=right_id and institution_id=p_institution_id)
   into a_exists,b_exists;
 end if;
 if not a_exists or not b_exists then raise exception 'Both records must belong to this institution'; end if;
 insert into public.institution_duplicate_review_decisions(
  institution_id,entity_type,record_a_id,record_b_id,matched_on,decision,review_note,reviewed_by,reviewed_at
 ) values(
  p_institution_id,p_entity_type,left_id,right_id,trim(p_matched_on),p_decision,nullif(trim(p_review_note),''),auth.uid(),now()
 )
 on conflict(institution_id,entity_type,record_a_id,record_b_id,matched_on)
 do update set decision=excluded.decision,review_note=excluded.review_note,reviewed_by=auth.uid(),reviewed_at=now()
 returning * into result_row;
 return result_row;
end;
$$;
revoke all on function public.review_possible_duplicate(uuid,text,uuid,uuid,text,text,text) from public;
grant execute on function public.review_possible_duplicate(uuid,text,uuid,uuid,text,text,text) to authenticated;
