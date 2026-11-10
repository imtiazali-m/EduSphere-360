-- EduSphere 360: double-entry accounting and employee compensation workflows.
-- Additive only. Existing fee and payroll records are preserved.
begin;

create table public.finance_accounts (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  account_code text not null,
  name text not null,
  account_type text not null check (account_type in ('asset','liability','equity','income','expense')),
  normal_balance text not null check (normal_balance in ('debit','credit')),
  parent_account_id uuid,
  is_system boolean not null default false,
  is_active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint finance_accounts_id_institution_uq unique (id,institution_id),
  constraint finance_accounts_parent_fk foreign key (parent_account_id,institution_id)
    references public.finance_accounts(id,institution_id) on delete restrict,
  constraint finance_accounts_no_self_parent check (parent_account_id is null or parent_account_id <> id)
);
create unique index finance_accounts_code_uq
  on public.finance_accounts(institution_id,lower(btrim(account_code)));
create index finance_accounts_parent_idx
  on public.finance_accounts(institution_id,parent_account_id) where parent_account_id is not null;

create table public.finance_journals (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  journal_no text not null,
  journal_date date not null,
  description text not null,
  reference text,
  status text not null default 'draft' check (status in ('draft','posted','void')),
  created_by uuid not null references auth.users(id) on delete restrict,
  posted_by uuid references auth.users(id) on delete set null,
  posted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint finance_journals_id_institution_uq unique (id,institution_id),
  constraint finance_journals_post_state_check check (
    (status = 'posted' and posted_by is not null and posted_at is not null)
    or (status <> 'posted')
  )
);
create unique index finance_journals_number_uq
  on public.finance_journals(institution_id,lower(btrim(journal_no)));
create index finance_journals_date_idx
  on public.finance_journals(institution_id,journal_date desc,status);

create table public.finance_journal_lines (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  journal_id uuid not null,
  account_id uuid not null,
  description text,
  debit numeric(14,2) not null default 0 check (debit >= 0),
  credit numeric(14,2) not null default 0 check (credit >= 0),
  created_at timestamptz not null default now(),
  constraint finance_journal_lines_one_side check (
    (debit > 0 and credit = 0) or (credit > 0 and debit = 0)
  ),
  constraint finance_journal_lines_journal_fk foreign key (journal_id,institution_id)
    references public.finance_journals(id,institution_id) on delete cascade,
  constraint finance_journal_lines_account_fk foreign key (account_id,institution_id)
    references public.finance_accounts(id,institution_id) on delete restrict
);
create index finance_journal_lines_journal_idx
  on public.finance_journal_lines(institution_id,journal_id);
create index finance_journal_lines_account_idx
  on public.finance_journal_lines(institution_id,account_id);

create table public.employee_salary_profiles (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  teacher_id uuid not null,
  base_salary numeric(14,2) not null check (base_salary >= 0),
  monthly_allowances numeric(14,2) not null default 0 check (monthly_allowances >= 0),
  monthly_deductions numeric(14,2) not null default 0 check (monthly_deductions >= 0),
  currency text not null default 'PKR' check (currency = 'PKR'),
  pay_frequency text not null default 'monthly' check (pay_frequency in ('monthly')),
  effective_from date not null default current_date,
  effective_to date,
  status text not null default 'active' check (status in ('active','inactive')),
  notes text,
  created_by uuid not null references auth.users(id) on delete restrict,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint employee_salary_profiles_teacher_fk foreign key (teacher_id,institution_id)
    references public.teachers(id,institution_id) on delete restrict,
  constraint employee_salary_profiles_dates_check check (effective_to is null or effective_to >= effective_from),
  constraint employee_salary_profiles_net_check check (base_salary + monthly_allowances >= monthly_deductions)
);
create unique index employee_salary_profiles_one_active_uq
  on public.employee_salary_profiles(institution_id,teacher_id) where status = 'active';
create index employee_salary_profiles_effective_idx
  on public.employee_salary_profiles(institution_id,effective_from,effective_to,status);

alter table public.finance_accounts enable row level security;
alter table public.finance_journals enable row level security;
alter table public.finance_journal_lines enable row level security;
alter table public.employee_salary_profiles enable row level security;

create policy finance_accounts_read on public.finance_accounts
  for select to authenticated
  using (public.has_institution_role(institution_id,array['owner','admin','accountant']::text[]));
create policy finance_accounts_admin_insert on public.finance_accounts
  for insert to authenticated
  with check (public.has_institution_role(institution_id,array['owner','admin']::text[]));
create policy finance_accounts_admin_update on public.finance_accounts
  for update to authenticated
  using (public.has_institution_role(institution_id,array['owner','admin']::text[]))
  with check (public.has_institution_role(institution_id,array['owner','admin']::text[]));
create policy finance_accounts_admin_delete on public.finance_accounts
  for delete to authenticated
  using (public.has_institution_role(institution_id,array['owner','admin']::text[]));

create policy finance_journals_read on public.finance_journals
  for select to authenticated
  using (public.has_institution_role(institution_id,array['owner','admin','accountant']::text[]));
create policy finance_journals_insert on public.finance_journals
  for insert to authenticated
  with check (
    created_by = (select auth.uid())
    and public.has_institution_role(institution_id,array['owner','admin','accountant']::text[])
  );
create policy finance_journals_update on public.finance_journals
  for update to authenticated
  using (public.has_institution_role(institution_id,array['owner','admin','accountant']::text[]))
  with check (public.has_institution_role(institution_id,array['owner','admin','accountant']::text[]));
create policy finance_journals_admin_delete on public.finance_journals
  for delete to authenticated
  using (public.has_institution_role(institution_id,array['owner','admin']::text[]));

create policy finance_journal_lines_read on public.finance_journal_lines
  for select to authenticated
  using (public.has_institution_role(institution_id,array['owner','admin','accountant']::text[]));
create policy finance_journal_lines_insert_draft on public.finance_journal_lines
  for insert to authenticated
  with check (
    public.has_institution_role(institution_id,array['owner','admin','accountant']::text[])
    and exists (
      select 1 from public.finance_journals j
      where j.id = finance_journal_lines.journal_id and j.institution_id = finance_journal_lines.institution_id and j.status = 'draft'
    )
  );
create policy finance_journal_lines_update_draft on public.finance_journal_lines
  for update to authenticated
  using (
    public.has_institution_role(institution_id,array['owner','admin','accountant']::text[])
    and exists (
      select 1 from public.finance_journals j
      where j.id = journal_id and j.institution_id = institution_id and j.status = 'draft'
    )
  )
  with check (
    public.has_institution_role(institution_id,array['owner','admin','accountant']::text[])
    and exists (
      select 1 from public.finance_journals j
      where j.id = journal_id and j.institution_id = institution_id and j.status = 'draft'
    )
  );
create policy finance_journal_lines_delete_draft on public.finance_journal_lines
  for delete to authenticated
  using (
    public.has_institution_role(institution_id,array['owner','admin','accountant']::text[])
    and exists (
      select 1 from public.finance_journals j
      where j.id = journal_id and j.institution_id = institution_id and j.status = 'draft'
    )
  );

create policy employee_salary_profiles_finance_read on public.employee_salary_profiles
  for select to authenticated
  using (
    public.has_institution_role(institution_id,array['owner','admin','accountant']::text[])
    or exists (
      select 1 from public.teachers t
      where t.id = employee_salary_profiles.teacher_id and t.institution_id = employee_salary_profiles.institution_id and t.user_id = (select auth.uid())
    )
  );
create policy employee_salary_profiles_finance_insert on public.employee_salary_profiles
  for insert to authenticated
  with check (
    created_by = (select auth.uid())
    and public.has_institution_role(institution_id,array['owner','admin','accountant']::text[])
  );
create policy employee_salary_profiles_finance_update on public.employee_salary_profiles
  for update to authenticated
  using (public.has_institution_role(institution_id,array['owner','admin','accountant']::text[]))
  with check (public.has_institution_role(institution_id,array['owner','admin','accountant']::text[]));
create policy employee_salary_profiles_admin_delete on public.employee_salary_profiles
  for delete to authenticated
  using (public.has_institution_role(institution_id,array['owner','admin']::text[]));

-- New public tables are explicitly exposed only to signed-in institution users.
grant select,insert,update,delete on public.finance_accounts to authenticated;
grant select,insert,update,delete on public.finance_journals to authenticated;
grant select,insert,update,delete on public.finance_journal_lines to authenticated;
grant select,insert,update,delete on public.employee_salary_profiles to authenticated;
revoke all on public.finance_accounts,public.finance_journals,public.finance_journal_lines,public.employee_salary_profiles from anon;

-- Status transitions are performed through the validated posting/approval functions.
revoke update on public.finance_journals from authenticated;
grant update (journal_date,description,reference) on public.finance_journals to authenticated;
revoke update on public.payroll_runs from authenticated;
grant update (notes,pay_date) on public.payroll_runs to authenticated;
revoke update on public.payroll_items from authenticated;
grant update (payment_status,payslip_reference,notes) on public.payroll_items to authenticated;

create or replace function public.post_finance_journal(p_institution_id uuid,p_journal_id uuid)
returns public.finance_journals
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_journal public.finance_journals;
  v_count integer;
  v_debit numeric(14,2);
  v_credit numeric(14,2);
begin
  if auth.uid() is null then raise exception 'Authentication is required.'; end if;
  if not public.has_institution_role(p_institution_id,array['owner','admin','accountant']::text[]) then
    raise exception 'You do not have permission to post journals for this institution.';
  end if;
  select * into v_journal from public.finance_journals
   where id=p_journal_id and institution_id=p_institution_id for update;
  if not found then raise exception 'Journal not found.'; end if;
  if v_journal.status <> 'draft' then raise exception 'Only draft journals can be posted.'; end if;
  select count(*),coalesce(sum(debit),0),coalesce(sum(credit),0)
    into v_count,v_debit,v_credit
    from public.finance_journal_lines
   where institution_id=p_institution_id and journal_id=p_journal_id;
  if v_count < 2 then raise exception 'A journal must contain at least two lines.'; end if;
  if v_debit <= 0 or round(v_debit,2) <> round(v_credit,2) then
    raise exception 'Journal totals must balance before posting. Debits: %, credits: %.',v_debit,v_credit;
  end if;
  update public.finance_journals
     set status='posted',posted_by=auth.uid(),posted_at=now(),updated_at=now()
   where id=p_journal_id and institution_id=p_institution_id
   returning * into v_journal;
  return v_journal;
end;
$function$;
revoke all on function public.post_finance_journal(uuid,uuid) from public,anon;
grant execute on function public.post_finance_journal(uuid,uuid) to authenticated;

create or replace function public.generate_payroll_run(
  p_institution_id uuid,
  p_period_start date,
  p_period_end date,
  p_pay_date date,
  p_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_run_id uuid;
  v_count integer;
begin
  if auth.uid() is null then raise exception 'Authentication is required.'; end if;
  if not public.has_institution_role(p_institution_id,array['owner','admin','accountant']::text[]) then
    raise exception 'You do not have permission to generate payroll for this institution.';
  end if;
  if p_period_start is null or p_period_end is null or p_period_end < p_period_start then
    raise exception 'Enter a valid payroll period.';
  end if;
  if p_pay_date is null then raise exception 'Enter a payroll payment date.'; end if;

  insert into public.payroll_runs(institution_id,period_start,period_end,pay_date,status,notes,created_by)
  values(p_institution_id,p_period_start,p_period_end,p_pay_date,'draft',nullif(btrim(coalesce(p_notes,'')),''),auth.uid())
  returning id into v_run_id;

  insert into public.payroll_items(
    institution_id,payroll_run_id,teacher_id,base_salary,allowances,deductions,
    advance_recovery,gross_pay,net_pay,payment_status,notes
  )
  select
    p_institution_id,v_run_id,p.teacher_id,p.base_salary,p.monthly_allowances,p.monthly_deductions,
    0,round(p.base_salary+p.monthly_allowances,2),
    round(p.base_salary+p.monthly_allowances-p.monthly_deductions,2),
    'unpaid',nullif(btrim(coalesce(p.notes,'')),'')
  from public.employee_salary_profiles p
  join public.teachers t on t.id=p.teacher_id and t.institution_id=p.institution_id
  where p.institution_id=p_institution_id
    and p.status='active'
    and p.effective_from <= p_period_end
    and (p.effective_to is null or p.effective_to >= p_period_start)
    and coalesce(t.employment_status,'active')='active';

  get diagnostics v_count = row_count;
  if v_count = 0 then
    raise exception 'No active employees have an effective salary profile for this period. Add salary profiles before generating payroll.';
  end if;
  return v_run_id;
end;
$function$;
revoke all on function public.generate_payroll_run(uuid,date,date,date,text) from public,anon;
grant execute on function public.generate_payroll_run(uuid,date,date,date,text) to authenticated;

create or replace function public.approve_payroll_run(p_institution_id uuid,p_payroll_run_id uuid)
returns public.payroll_runs
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_run public.payroll_runs;
  v_count integer;
  v_invalid integer;
begin
  if auth.uid() is null then raise exception 'Authentication is required.'; end if;
  if not public.has_institution_role(p_institution_id,array['owner','admin']::text[]) then
    raise exception 'Only an institution owner or administrator can approve payroll.';
  end if;
  select * into v_run from public.payroll_runs
   where id=p_payroll_run_id and institution_id=p_institution_id for update;
  if not found then raise exception 'Payroll run not found.'; end if;
  if v_run.status <> 'draft' and v_run.status <> 'review' then
    raise exception 'Only draft or review payroll runs can be approved.';
  end if;
  select count(*),count(*) filter (where net_pay < 0 or gross_pay < 0)
    into v_count,v_invalid
    from public.payroll_items
   where institution_id=p_institution_id and payroll_run_id=p_payroll_run_id;
  if v_count=0 then raise exception 'Payroll run has no employee entries.'; end if;
  if v_invalid>0 then raise exception 'Payroll contains an invalid negative amount.'; end if;
  update public.payroll_runs
     set status='approved',approved_by=auth.uid(),approved_at=now(),updated_at=now()
   where id=p_payroll_run_id and institution_id=p_institution_id
   returning * into v_run;
  return v_run;
end;
$function$;
revoke all on function public.approve_payroll_run(uuid,uuid) from public,anon;
grant execute on function public.approve_payroll_run(uuid,uuid) to authenticated;


create or replace function public.mark_payroll_run_paid(p_institution_id uuid,p_payroll_run_id uuid)
returns public.payroll_runs
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_run public.payroll_runs;
  v_unpaid integer;
begin
  if auth.uid() is null then raise exception 'Authentication is required.'; end if;
  if not public.has_institution_role(p_institution_id,array['owner','admin','accountant']::text[]) then
    raise exception 'You do not have permission to close payroll for this institution.';
  end if;
  select * into v_run from public.payroll_runs
   where id=p_payroll_run_id and institution_id=p_institution_id for update;
  if not found then raise exception 'Payroll run not found.'; end if;
  if v_run.status <> 'approved' then raise exception 'Only approved payroll runs can be marked paid.'; end if;
  select count(*) into v_unpaid
    from public.payroll_items
   where institution_id=p_institution_id and payroll_run_id=p_payroll_run_id
     and payment_status <> 'paid';
  if v_unpaid>0 then raise exception 'All employee payments must be marked paid before closing the payroll run.'; end if;
  update public.payroll_runs set status='paid',updated_at=now()
   where id=p_payroll_run_id and institution_id=p_institution_id
   returning * into v_run;
  return v_run;
end;
$function$;
revoke all on function public.mark_payroll_run_paid(uuid,uuid) from public,anon;
grant execute on function public.mark_payroll_run_paid(uuid,uuid) to authenticated;

commit;
