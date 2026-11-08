-- Keep both new and legacy Administration field aliases synchronized on updates.
begin;
create or replace function public.sync_department_compat_columns()
returns trigger language plpgsql set search_path=public,pg_temp as $$
begin
  if tg_op='UPDATE' then
    if new.code is distinct from old.code and new.department_code is not distinct from old.department_code then new.department_code:=new.code;
    elsif new.department_code is distinct from old.department_code and new.code is not distinct from old.code then new.code:=new.department_code; end if;
  end if;
  if new.department_code is null or btrim(new.department_code)='' then new.department_code:=coalesce(nullif(btrim(new.code),''),'DEP-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,8))); end if;
  if new.code is null or btrim(new.code)='' then new.code:=new.department_code; end if;
  if tg_op='UPDATE' then
    if new.is_active is distinct from old.is_active then new.status:=case when new.is_active then 'active' else 'inactive' end;
    elsif new.status is distinct from old.status then new.is_active:=(new.status='active'); end if;
  else new.status:=case when new.is_active then 'active' else 'inactive' end; end if;
  return new;
end $$;
create or replace function public.sync_academic_session_compat_columns()
returns trigger language plpgsql set search_path=public,pg_temp as $$
begin
  if tg_op='UPDATE' then
    if new.name is distinct from old.name and new.session_name is not distinct from old.session_name then new.session_name:=new.name;
    elsif new.session_name is distinct from old.session_name and new.name is not distinct from old.name then new.name:=new.session_name; end if;
  end if;
  if new.session_name is null or btrim(new.session_name)='' then new.session_name:=new.name; end if;
  if new.name is null or btrim(new.name)='' then new.name:=new.session_name; end if;
  if tg_op='UPDATE' then
    if new.is_current is distinct from old.is_current then new.status:=case when new.is_current then 'active' else case when new.is_active then 'planned' else 'completed' end end;
    elsif new.is_active is distinct from old.is_active then new.status:=case when new.is_active then 'planned' else 'completed' end; if new.is_current then new.status:='active'; end if;
    elsif new.status is distinct from old.status then new.is_current:=(new.status='active'); new.is_active:=(new.status<>'completed'); end if;
  else
    if new.is_current then new.status:='active'; elsif not new.is_active then new.status:='completed'; elsif new.status is null then new.status:='planned'; end if;
  end if;
  return new;
end $$;
create or replace function public.sync_subject_compat_columns()
returns trigger language plpgsql set search_path=public,pg_temp as $$
begin
  if tg_op='UPDATE' then
    if new.code is distinct from old.code and new.subject_code is not distinct from old.subject_code then new.subject_code:=new.code;
    elsif new.subject_code is distinct from old.subject_code and new.code is not distinct from old.code then new.code:=new.subject_code; end if;
  end if;
  if new.subject_code is null or btrim(new.subject_code)='' then new.subject_code:=coalesce(nullif(btrim(new.code),''),'SUB-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,8))); end if;
  if new.code is null or btrim(new.code)='' then new.code:=new.subject_code; end if;
  if tg_op='UPDATE' then
    if new.is_active is distinct from old.is_active then new.status:=case when new.is_active then 'active' else 'inactive' end;
    elsif new.status is distinct from old.status then new.is_active:=(new.status='active'); end if;
  else new.status:=case when new.is_active then 'active' else 'inactive' end; end if;
  return new;
end $$;
commit;
