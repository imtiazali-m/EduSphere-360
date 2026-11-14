-- Dedicated report run history and class/section student grouping.
alter table public.students add column if not exists section_name text;
create index if not exists students_institution_class_section_idx
  on public.students(institution_id, class_name, section_name);

create table if not exists public.institution_report_run_history (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  report_definition_id uuid references public.institution_report_definitions(id) on delete set null,
  report_name text not null check (char_length(btrim(report_name)) between 1 and 180),
  source_modules text[] not null default '{}',
  output_format text not null check (output_format in ('csv','tsv','json','xls','xlsx','doc','docx','pdf')),
  row_count integer not null default 0 check (row_count >= 0),
  output_filename text not null,
  run_status text not null default 'completed' check (run_status in ('completed','failed')),
  filter_snapshot jsonb not null default '{}'::jsonb check (jsonb_typeof(filter_snapshot)='object'),
  executed_by uuid not null references auth.users(id) on delete restrict,
  executed_at timestamptz not null default now()
);
create index if not exists institution_report_run_history_recent_idx
  on public.institution_report_run_history(institution_id, executed_at desc);
alter table public.institution_report_run_history enable row level security;
grant select, insert on public.institution_report_run_history to authenticated;
drop policy if exists institution_report_run_history_select on public.institution_report_run_history;
create policy institution_report_run_history_select on public.institution_report_run_history
  for select to authenticated
  using (private.has_institution_permission(institution_id,'reports','view',null,null));
drop policy if exists institution_report_run_history_insert on public.institution_report_run_history;
create policy institution_report_run_history_insert on public.institution_report_run_history
  for insert to authenticated
  with check (
    executed_by = auth.uid()
    and private.has_institution_permission(institution_id,'reports','create',null,null)
  );
