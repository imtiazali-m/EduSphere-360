create table if not exists public.institution_helpdesk_tickets (
 id uuid primary key default gen_random_uuid(),
 institution_id uuid not null references public.institutions(id) on delete cascade,
 ticket_number text not null,
 title text not null check(length(trim(title)) between 4 and 180),
 description text not null check(length(trim(description)) between 10 and 6000),
 category text not null default 'general',
 priority text not null default 'normal' check(priority=any(array['low'::text,'normal'::text,'high'::text,'urgent'::text])),
 status text not null default 'open' check(status=any(array['open'::text,'in_progress'::text,'waiting_on_requester'::text,'resolved'::text,'closed'::text])),
 created_by uuid not null references auth.users(id) on delete restrict,
 assigned_to uuid references auth.users(id) on delete set null,
 assigned_at timestamptz,
 resolved_by uuid references auth.users(id) on delete restrict,
 resolved_at timestamptz,
 resolution_note text,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 constraint institution_helpdesk_ticket_number_uq unique(institution_id,ticket_number),
 constraint institution_helpdesk_ticket_id_institution_uq unique(id,institution_id)
);
create index if not exists institution_helpdesk_ticket_queue_idx
 on public.institution_helpdesk_tickets(institution_id,status,priority,created_at desc);
create index if not exists institution_helpdesk_ticket_requester_idx
 on public.institution_helpdesk_tickets(institution_id,created_by,created_at desc);

create table if not exists public.institution_helpdesk_comments (
 id uuid primary key default gen_random_uuid(),
 institution_id uuid not null references public.institutions(id) on delete cascade,
 ticket_id uuid not null,
 author_id uuid not null references auth.users(id) on delete restrict,
 comment_body text not null check(length(trim(comment_body)) between 2 and 4000),
 is_internal boolean not null default false,
 created_at timestamptz not null default now(),
 constraint institution_helpdesk_comment_ticket_fk foreign key(ticket_id,institution_id)
  references public.institution_helpdesk_tickets(id,institution_id) on delete cascade
);
create index if not exists institution_helpdesk_comments_ticket_idx
 on public.institution_helpdesk_comments(institution_id,ticket_id,created_at);

alter table public.institution_helpdesk_tickets enable row level security;
alter table public.institution_helpdesk_comments enable row level security;
revoke all on table public.institution_helpdesk_tickets from public,anon,authenticated;
revoke all on table public.institution_helpdesk_comments from public,anon,authenticated;
grant select,insert on table public.institution_helpdesk_tickets to authenticated;
grant select,insert on table public.institution_helpdesk_comments to authenticated;

drop policy if exists institution_helpdesk_ticket_read on public.institution_helpdesk_tickets;
create policy institution_helpdesk_ticket_read on public.institution_helpdesk_tickets for select to authenticated
using (
 created_by=(select auth.uid())
 or assigned_to=(select auth.uid())
 or has_institution_role(institution_id,array['owner'::text,'admin'::text])
);
drop policy if exists institution_helpdesk_ticket_insert on public.institution_helpdesk_tickets;
create policy institution_helpdesk_ticket_insert on public.institution_helpdesk_tickets for insert to authenticated
with check (
 created_by=(select auth.uid())
 and has_institution_role(institution_id,array['owner'::text,'admin'::text,'teacher'::text,'student'::text,'parent'::text,'accountant'::text,'exam_officer'::text])
);

drop policy if exists institution_helpdesk_comments_read on public.institution_helpdesk_comments;
create policy institution_helpdesk_comments_read on public.institution_helpdesk_comments for select to authenticated
using (
 exists(select 1 from public.institution_helpdesk_tickets t
  where t.id=ticket_id and t.institution_id=institution_helpdesk_comments.institution_id
   and (t.created_by=(select auth.uid()) or t.assigned_to=(select auth.uid())
    or has_institution_role(t.institution_id,array['owner'::text,'admin'::text])))
 and (
  not is_internal
  or has_institution_role(institution_id,array['owner'::text,'admin'::text])
 )
);
drop policy if exists institution_helpdesk_comments_insert on public.institution_helpdesk_comments;
create policy institution_helpdesk_comments_insert on public.institution_helpdesk_comments for insert to authenticated
with check (
 author_id=(select auth.uid())
 and exists(select 1 from public.institution_helpdesk_tickets t
  where t.id=ticket_id and t.institution_id=institution_helpdesk_comments.institution_id
   and (t.created_by=(select auth.uid()) or t.assigned_to=(select auth.uid())
    or has_institution_role(t.institution_id,array['owner'::text,'admin'::text])))
 and (not is_internal or has_institution_role(institution_id,array['owner'::text,'admin'::text]))
);

create or replace function public.update_institution_helpdesk_ticket(
 p_institution_id uuid,p_ticket_id uuid,p_status text,p_assign_to_self boolean default false,p_resolution_note text default null
)
returns public.institution_helpdesk_tickets
language plpgsql
security definer
set search_path=public
as $$
declare ticket_row public.institution_helpdesk_tickets;
begin
 if auth.uid() is null or not has_institution_role(p_institution_id,array['owner'::text,'admin'::text]) then
  raise exception 'Only an owner or administrator can manage support tickets';
 end if;
 if p_status not in ('open','in_progress','waiting_on_requester','resolved','closed') then
  raise exception 'Unsupported ticket status';
 end if;
 select * into ticket_row from public.institution_helpdesk_tickets
 where id=p_ticket_id and institution_id=p_institution_id for update;
 if not found then raise exception 'Ticket not found in this institution'; end if;
 if p_status in ('resolved','closed') and length(trim(coalesce(p_resolution_note,'')))<3 then
  raise exception 'Add a resolution note before resolving or closing the ticket';
 end if;
 update public.institution_helpdesk_tickets set
  status=p_status,
  assigned_to=case when p_assign_to_self then auth.uid() else assigned_to end,
  assigned_at=case when p_assign_to_self then now() else assigned_at end,
  resolved_by=case when p_status in ('resolved','closed') then auth.uid() else null end,
  resolved_at=case when p_status in ('resolved','closed') then now() else null end,
  resolution_note=case when p_status in ('resolved','closed') then trim(p_resolution_note) else resolution_note end,
  updated_at=now()
 where id=p_ticket_id and institution_id=p_institution_id
 returning * into ticket_row;
 return ticket_row;
end;
$$;
revoke all on function public.update_institution_helpdesk_ticket(uuid,uuid,text,boolean,text) from public;
grant execute on function public.update_institution_helpdesk_ticket(uuid,uuid,text,boolean,text) to authenticated;
