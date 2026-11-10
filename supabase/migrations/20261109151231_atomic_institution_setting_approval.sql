-- Atomically apply approved institution-setting requests and record the approval decision.
begin;
create or replace function public.decide_institution_setting_approval(
  p_institution_id uuid,
  p_approval_id uuid,
  p_decision text,
  p_notes text default null
)
returns public.workflow_approvals
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_request public.workflow_approvals;
  v_payload jsonb;
  v_updated integer;
begin
  if auth.uid() is null then raise exception 'Authentication is required.'; end if;
  if p_decision not in ('approved','rejected') then
    raise exception 'Choose approve or reject.';
  end if;
  if not public.has_institution_role(p_institution_id,array['owner','admin']::text[]) then
    raise exception 'Only the institution owner or an administrator can decide settings requests.';
  end if;
  select * into v_request
    from public.workflow_approvals
   where id=p_approval_id and institution_id=p_institution_id
   for update;
  if not found then raise exception 'Approval request not found.'; end if;
  if v_request.status <> 'pending' then raise exception 'Only pending requests can be decided.'; end if;

  if v_request.workflow_key='institution_setting_change' and p_decision='approved' then
    v_payload:=v_request.payload;
    if jsonb_typeof(v_payload)<>'object'
       or nullif(btrim(coalesce(v_payload->>'setting_key','')),'') is null
       or nullif(btrim(coalesce(v_payload->>'category','')),'') is null
       or not (v_payload ? 'setting_value') then
      raise exception 'The settings request is incomplete. No setting was applied.';
    end if;

    update public.institution_settings
       set category=btrim(v_payload->>'category'),
           setting_key=btrim(v_payload->>'setting_key'),
           setting_value=v_payload->'setting_value',
           is_public=coalesce((v_payload->>'is_public')::boolean,false),
           updated_by=auth.uid(),
           updated_at=now()
     where id=v_request.target_id and institution_id=p_institution_id;
    get diagnostics v_updated = row_count;
    if v_updated=0 then
      insert into public.institution_settings(
        id,institution_id,category,setting_key,setting_value,is_public,updated_by
      ) values(
        v_request.target_id,p_institution_id,btrim(v_payload->>'category'),
        btrim(v_payload->>'setting_key'),v_payload->'setting_value',
        coalesce((v_payload->>'is_public')::boolean,false),auth.uid()
      );
    end if;
  end if;

  update public.workflow_approvals
     set status=p_decision,reviewed_by=auth.uid(),reviewed_at=now(),
         decision_notes=nullif(btrim(coalesce(p_notes,'')),''),
         updated_at=now()
   where id=p_approval_id and institution_id=p_institution_id
   returning * into v_request;
  return v_request;
end;
$function$;
revoke all on function public.decide_institution_setting_approval(uuid,uuid,text,text) from public,anon;
grant execute on function public.decide_institution_setting_approval(uuid,uuid,text,text) to authenticated;
commit;
