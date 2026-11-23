-- Safe withdrawal and creator cleanup in Front Office and procurement drafts.
begin;

drop policy if exists academic_calendar_creator_delete_draft on public.academic_calendar_events;
create policy academic_calendar_creator_delete_draft
on public.academic_calendar_events
for delete to authenticated
using (
  created_by = (select auth.uid())
  and public.has_institution_role(institution_id, array['teacher'])
  and status = 'draft'
);

drop policy if exists procurement_requests_creator_delete_draft on public.procurement_requests;
create policy procurement_requests_creator_delete_draft
on public.procurement_requests
for delete to authenticated
using (
  requested_by = (select auth.uid())
  and public.is_institution_member(institution_id)
  and status = 'draft'
  and not exists (
    select 1 from public.purchase_orders o
    where o.request_id = procurement_requests.id
      and o.institution_id = procurement_requests.institution_id
  )
  and not exists (
    select 1 from public.supplier_quotes q
    where q.request_id = procurement_requests.id
      and q.institution_id = procurement_requests.institution_id
  )
);

create or replace function public.withdraw_institution_helpdesk_ticket(
  p_institution_id uuid,
  p_ticket_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare changed integer;
begin
  if auth.uid() is null then
    raise exception 'Sign in before withdrawing a helpdesk ticket.';
  end if;

  update public.institution_helpdesk_tickets
  set status = 'closed',
      resolution_note = 'Withdrawn by requester',
      updated_at = now()
  where id = p_ticket_id
    and institution_id = p_institution_id
    and created_by = auth.uid()
    and status = 'open';

  get diagnostics changed = row_count;
  if changed <> 1 then
    raise exception 'Only the requester may withdraw their own open ticket.';
  end if;

  return true;
end;
$$;

revoke all on function public.withdraw_institution_helpdesk_ticket(uuid,uuid) from public, anon;
grant execute on function public.withdraw_institution_helpdesk_ticket(uuid,uuid) to authenticated;

commit;
