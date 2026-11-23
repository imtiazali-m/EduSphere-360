-- Restrict the QR/barcode attendance RPC to authenticated callers.
-- The existing RPC already enforces an active owner/admin/teacher membership
-- in the requested institution. Anonymous callers cannot satisfy that guard.
-- Keep the function body unchanged; remove only PUBLIC and anon EXECUTE.
begin;

do $migration$
declare
  v_scan_oid oid := to_regprocedure('public.record_student_attendance_scan(uuid,text,date,text,text,text,uuid)');
  v_scan_definition text;
  v_scan_settings text[];
  v_scan_security_definer boolean;
  v_role_oid oid := to_regprocedure('public.has_institution_role(uuid,text[])');
  v_role_definition text;
  v_role_settings text[];
  v_role_security_definer boolean;
begin
  if v_scan_oid is null then
    raise exception 'Expected public.record_student_attendance_scan(uuid,text,date,text,text,text,uuid) to exist before restricting its grants';
  end if;

  select p.prosecdef, p.proconfig, pg_get_functiondef(p.oid)
    into v_scan_security_definer, v_scan_settings, v_scan_definition
  from pg_proc p
  where p.oid = v_scan_oid;

  if not v_scan_security_definer then
    raise exception 'Attendance scan RPC is no longer SECURITY DEFINER; review this migration before applying';
  end if;
  if not coalesce(v_scan_settings @> array['search_path=public, private'], false) then
    raise exception 'Attendance scan RPC search_path changed; review this migration before applying';
  end if;

  v_scan_definition := lower(regexp_replace(v_scan_definition, '\s+', '', 'g'));
  if position('has_institution_role(p_institution_id,array[''owner'',''admin'',''teacher''])' in v_scan_definition) = 0 then
    raise exception 'Attendance scan RPC role gate changed; expected active owner/admin/teacher membership check';
  end if;

  if v_role_oid is null then
    raise exception 'Expected public.has_institution_role(uuid,text[]) to exist';
  end if;

  select p.prosecdef, p.proconfig, pg_get_functiondef(p.oid)
    into v_role_security_definer, v_role_settings, v_role_definition
  from pg_proc p
  where p.oid = v_role_oid;

  if not v_role_security_definer or not coalesce(v_role_settings @> array['search_path=public'], false) then
    raise exception 'Institution-role helper security settings changed; review this migration before applying';
  end if;

  v_role_definition := lower(regexp_replace(v_role_definition, '\s+', '', 'g'));
  if position('m.institution_id=target_institution' in v_role_definition) = 0
     or position('m.user_id=(selectauth.uid())' in v_role_definition) = 0
     or position('m.status=''active''' in v_role_definition) = 0
     or position('m.role=any(allowed_roles)' in v_role_definition) = 0 then
    raise exception 'Institution-role helper no longer enforces active caller membership in the requested institution';
  end if;
end;
$migration$;

revoke all on function public.record_student_attendance_scan(uuid,text,date,text,text,text,uuid) from public, anon;
grant execute on function public.record_student_attendance_scan(uuid,text,date,text,text,text,uuid) to authenticated, service_role;

commit;
