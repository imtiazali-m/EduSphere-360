create table if not exists public.institution_messages (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  batch_id uuid not null default gen_random_uuid(),
  sender_user_id uuid not null references auth.users(id) on delete restrict,
  recipient_user_id uuid not null references auth.users(id) on delete cascade,
  message_type text not null default 'direct'
    check (message_type = any (array['direct'::text,'broadcast'::text,'complaint'::text])),
  subject text not null check (length(trim(subject)) between 1 and 180),
  body text not null check (length(trim(body)) between 1 and 12000),
  status text not null default 'sent'
    check (status = any (array['sent'::text,'read'::text,'archived'::text])),
  sent_at timestamp with time zone not null default now(),
  read_at timestamp with time zone,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint institution_messages_no_self_delivery check (sender_user_id <> recipient_user_id)
);

create index if not exists institution_messages_inbox_idx
  on public.institution_messages (institution_id, recipient_user_id, sent_at desc);
create index if not exists institution_messages_sender_idx
  on public.institution_messages (institution_id, sender_user_id, sent_at desc);
create index if not exists institution_messages_batch_idx
  on public.institution_messages (institution_id, batch_id);

alter table public.institution_messages enable row level security;

revoke all on table public.institution_messages from public, anon, authenticated;
grant select, insert on table public.institution_messages to authenticated;
grant update (status, read_at, updated_at) on table public.institution_messages to authenticated;

drop policy if exists institution_messages_read_participants on public.institution_messages;
create policy institution_messages_read_participants
  on public.institution_messages for select to authenticated
  using (
    sender_user_id = (select auth.uid())
    or recipient_user_id = (select auth.uid())
    or has_institution_role(institution_id, array['owner'::text,'admin'::text])
  );

drop policy if exists institution_messages_send_active_members on public.institution_messages;
create policy institution_messages_send_active_members
  on public.institution_messages for insert to authenticated
  with check (
    sender_user_id = (select auth.uid())
    and exists (
      select 1 from public.memberships sender
      where sender.institution_id = institution_messages.institution_id
        and sender.user_id = (select auth.uid())
        and sender.status = 'active'
    )
    and exists (
      select 1 from public.memberships recipient
      where recipient.institution_id = institution_messages.institution_id
        and recipient.user_id = institution_messages.recipient_user_id
        and recipient.status = 'active'
    )
    and (
      has_institution_role(institution_id, array['owner'::text,'admin'::text,'teacher'::text])
      or (
        has_institution_role(institution_id, array['student'::text,'parent'::text])
        and exists (
          select 1 from public.memberships recipient
          where recipient.institution_id = institution_messages.institution_id
            and recipient.user_id = institution_messages.recipient_user_id
            and recipient.status = 'active'
            and recipient.role = any (array['owner'::text,'admin'::text,'teacher'::text])
        )
      )
    )
  );

drop policy if exists institution_messages_recipient_receipt on public.institution_messages;
create policy institution_messages_recipient_receipt
  on public.institution_messages for update to authenticated
  using (recipient_user_id = (select auth.uid()))
  with check (
    recipient_user_id = (select auth.uid())
    and status = any (array['read'::text,'archived'::text])
  );
