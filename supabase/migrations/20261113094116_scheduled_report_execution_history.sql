create table if not exists public.scheduled_report_execution_history (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  report_record_id uuid not null,
  report_name text not null,
  source_module text not null,
  output_format text not null default 'csv' check(output_format='csv'),
  row_count integer not null default 0 check(row_count>=0),
  output_filename text not null,
  run_status text not null check(run_status=any(array['completed'::text,'failed'::text])),
  filter_snapshot jsonb not null default '{}'::jsonb,
  executed_by uuid not null references auth.users(id) on delete restrict,
  executed_at timestamptz not null default now(),
  constraint scheduled_report_execution_history_report_fk foreign key(report_record_id)
    references public.institutional_records(id) on delete restrict
);
create index if not exists scheduled_report_execution_history_idx
  on public.scheduled_report_execution_history(institution_id,report_record_id,executed_at desc);
alter table public.scheduled_report_execution_history enable row level security;
revoke all on table public.scheduled_report_execution_history from public,anon,authenticated;
grant select on table public.scheduled_report_execution_history to authenticated;
drop policy if exists scheduled_report_execution_history_read on public.scheduled_report_execution_history;
create policy scheduled_report_execution_history_read on public.scheduled_report_execution_history
 for select to authenticated using(has_institution_role(institution_id,array['owner'::text,'admin'::text,'accountant'::text]));

create or replace function public.log_scheduled_report_execution(
 p_institution_id uuid,
 p_report_record_id uuid,
 p_report_name text,
 p_source_module text,
 p_output_filename text,
 p_row_count integer,
 p_filter_snapshot jsonb default '{}'::jsonb
)
returns public.scheduled_report_execution_history
language plpgsql
security definer
set search_path=public
as $$
declare result_row public.scheduled_report_execution_history;
begin
 if auth.uid() is null or not has_institution_role(p_institution_id,array['owner'::text,'admin'::text,'accountant'::text]) then
  raise exception 'Owner, administrator or accountant access is required to run institution reports';
 end if;
 if p_row_count<0 or p_row_count>5000 then raise exception 'Report row count is outside the supported limit'; end if;
 if not exists(
  select 1 from public.institutional_records r
  where r.id=p_report_record_id and r.institution_id=p_institution_id
    and r.module_key='reports' and r.record_type='scheduled-reports'
 ) then
  raise exception 'The scheduled report does not belong to this institution';
 end if;
 insert into public.scheduled_report_execution_history(
  institution_id,report_record_id,report_name,source_module,output_format,row_count,output_filename,run_status,filter_snapshot,executed_by
 ) values (
  p_institution_id,p_report_record_id,trim(p_report_name),p_source_module,'csv',p_row_count,trim(p_output_filename),'completed',coalesce(p_filter_snapshot,'{}'::jsonb),auth.uid()
 ) returning * into result_row;
 return result_row;
end;
$$;
revoke all on function public.log_scheduled_report_execution(uuid,uuid,text,text,text,integer,jsonb) from public;
grant execute on function public.log_scheduled_report_execution(uuid,uuid,text,text,text,integer,jsonb) to authenticated;
