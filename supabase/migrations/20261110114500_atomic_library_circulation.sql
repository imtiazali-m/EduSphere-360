-- Atomic library checkout/return workflows. Invoker-security functions preserve RLS,
-- serialize checkout attempts per book, and calculate overdue fines on the server.
begin;

create or replace function public.issue_library_book(
  p_institution_id uuid,
  p_book_record_id uuid,
  p_student_id uuid,
  p_due_at date,
  p_notes text default null
) returns jsonb
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
  v_user uuid := auth.uid();
  v_book public.institutional_records%rowtype;
  v_student public.students%rowtype;
  v_total_raw text;
  v_total_copies numeric;
  v_issued_copies integer;
  v_duplicate_count integer;
  v_loan_id uuid;
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  if not public.has_institution_role(p_institution_id, array['owner','admin','teacher']) then
    raise exception 'Only institution staff can issue library books';
  end if;
  if p_due_at is null or p_due_at < current_date then
    raise exception 'The due date must be today or later';
  end if;

  -- Lock the catalogue row so concurrent checkouts cannot exceed the copy count.
  select * into v_book
  from public.institutional_records
  where id = p_book_record_id
    and institution_id = p_institution_id
    and module_key = 'library'
    and record_type = 'book-registration'
  for update;

  if not found then raise exception 'The selected book is not registered in this institution library'; end if;

  select * into v_student
  from public.students
  where id = p_student_id
    and institution_id = p_institution_id
    and status = 'active';

  if not found then raise exception 'The selected learner is not an active student in this institution'; end if;

  select count(*) into v_duplicate_count
  from public.library_loans
  where institution_id = p_institution_id
    and book_record_id = p_book_record_id
    and student_id = p_student_id
    and status = 'issued';

  if v_duplicate_count > 0 then
    raise exception 'This student already has this book checked out';
  end if;

  v_total_raw := nullif(btrim(coalesce(v_book.payload->>'total_copies','')), '');
  if v_total_raw is not null and v_total_raw ~ '^[0-9]+([.][0-9]+)?$' then
    v_total_copies := v_total_raw::numeric;
  else
    v_total_copies := coalesce(v_book.quantity, 1);
  end if;

  if v_total_copies is null or v_total_copies <= 0 or v_total_copies <> trunc(v_total_copies) then
    raise exception 'The book catalogue must have a positive whole-number copy count before issuing';
  end if;

  select count(*) into v_issued_copies
  from public.library_loans
  where institution_id = p_institution_id
    and book_record_id = p_book_record_id
    and status = 'issued';

  if v_issued_copies >= v_total_copies then
    raise exception 'All registered copies of this book are currently issued';
  end if;

  insert into public.library_loans (
    institution_id, book_record_id, student_id, due_at, status,
    fine_amount, notes, issued_by
  ) values (
    p_institution_id, p_book_record_id, p_student_id, p_due_at, 'issued',
    0, nullif(btrim(p_notes), ''), v_user
  )
  returning id into v_loan_id;

  return jsonb_build_object(
    'loan_id', v_loan_id,
    'book_record_id', p_book_record_id,
    'student_id', p_student_id,
    'issued_copies', v_issued_copies + 1,
    'total_copies', v_total_copies,
    'due_at', p_due_at
  );
end;
$$;

create or replace function public.return_library_book(
  p_institution_id uuid,
  p_loan_id uuid
) returns jsonb
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
  v_user uuid := auth.uid();
  v_loan public.library_loans%rowtype;
  v_book public.institutional_records%rowtype;
  v_fine_raw text;
  v_daily_fine numeric := 0;
  v_late_days integer := 0;
  v_fine_amount numeric := 0;
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  if not public.has_institution_role(p_institution_id, array['owner','admin','teacher']) then
    raise exception 'Only institution staff can record library returns';
  end if;

  select * into v_loan
  from public.library_loans
  where id = p_loan_id
    and institution_id = p_institution_id
  for update;

  if not found then raise exception 'The library loan was not found in this institution'; end if;
  if v_loan.status <> 'issued' then raise exception 'This library loan is no longer active'; end if;

  select * into v_book
  from public.institutional_records
  where id = v_loan.book_record_id
    and institution_id = p_institution_id
    and module_key = 'library'
    and record_type = 'book-registration';

  v_fine_raw := nullif(btrim(coalesce(v_book.payload->>'fine_per_day','')), '');
  if v_fine_raw is not null and v_fine_raw ~ '^[0-9]+([.][0-9]+)?$' then
    v_daily_fine := v_fine_raw::numeric;
  end if;

  v_late_days := greatest(current_date - v_loan.due_at, 0);
  v_fine_amount := v_late_days * v_daily_fine;

  update public.library_loans
  set status = 'returned',
      returned_at = current_date,
      received_by = v_user,
      fine_amount = v_fine_amount,
      updated_at = now()
  where id = p_loan_id
    and institution_id = p_institution_id
    and status = 'issued';

  if not found then raise exception 'This library loan is no longer active'; end if;

  return jsonb_build_object(
    'loan_id', p_loan_id,
    'returned_at', current_date,
    'late_days', v_late_days,
    'daily_fine', v_daily_fine,
    'fine_amount', v_fine_amount
  );
end;
$$;

revoke all on function public.issue_library_book(uuid,uuid,uuid,date,text) from public, anon;
revoke all on function public.return_library_book(uuid,uuid) from public, anon;
grant execute on function public.issue_library_book(uuid,uuid,uuid,date,text) to authenticated;
grant execute on function public.return_library_book(uuid,uuid) to authenticated;

commit;
