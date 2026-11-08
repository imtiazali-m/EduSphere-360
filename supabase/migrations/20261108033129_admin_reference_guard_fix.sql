-- Fix table-specific NEW-field access in the academic tenant reference trigger.
create or replace function public.enforce_academic_reference_tenant()
returns trigger language plpgsql set search_path=public,pg_temp as $$
declare v_institution uuid;
begin
  if tg_table_name='programs' then
    if new.department_id is not null then
      select institution_id into v_institution from public.departments where id=new.department_id;
      if v_institution is distinct from new.institution_id then raise exception 'The selected department must belong to this institution.'; end if;
    end if;
  elsif tg_table_name='classes' then
    if new.program_id is not null then
      select institution_id into v_institution from public.programs where id=new.program_id;
      if v_institution is distinct from new.institution_id then raise exception 'The selected program must belong to this institution.'; end if;
    end if;
    if new.academic_session_id is not null then
      select institution_id into v_institution from public.academic_sessions where id=new.academic_session_id;
      if v_institution is distinct from new.institution_id then raise exception 'The selected academic session must belong to this institution.'; end if;
    end if;
  elsif tg_table_name='subjects' then
    if new.department_id is not null then
      select institution_id into v_institution from public.departments where id=new.department_id;
      if v_institution is distinct from new.institution_id then raise exception 'The selected department must belong to this institution.'; end if;
    end if;
  end if;
  return new;
end $$;
