create table if not exists public.announcement_reads (
  institution_id uuid not null references public.institutions(id) on delete cascade,
  announcement_id uuid not null references public.announcements(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  read_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint announcement_reads_pkey primary key (announcement_id, user_id)
);

create index if not exists announcement_reads_institution_user_read_idx
  on public.announcement_reads (institution_id, user_id, read_at desc);
create index if not exists announcement_reads_announcement_idx
  on public.announcement_reads (announcement_id);

alter table public.announcement_reads enable row level security;

revoke all on public.announcement_reads from anon, authenticated;
grant select, insert, update on public.announcement_reads to authenticated;

create policy "users read own announcement receipts"
on public.announcement_reads
for select
to authenticated
using (
  user_id = (select auth.uid())
  and exists (
    select 1 from public.memberships m
    where m.institution_id = announcement_reads.institution_id
      and m.user_id = (select auth.uid())
      and m.status = 'active'
  )
);

create policy "users create own announcement receipts"
on public.announcement_reads
for insert
to authenticated
with check (
  user_id = (select auth.uid())
  and exists (
    select 1 from public.memberships m
    where m.institution_id = announcement_reads.institution_id
      and m.user_id = (select auth.uid())
      and m.status = 'active'
  )
  and exists (
    select 1 from public.announcements a
    where a.id = announcement_reads.announcement_id
      and a.institution_id = announcement_reads.institution_id
  )
);

create policy "users update own announcement receipts"
on public.announcement_reads
for update
to authenticated
using (
  user_id = (select auth.uid())
  and exists (
    select 1 from public.memberships m
    where m.institution_id = announcement_reads.institution_id
      and m.user_id = (select auth.uid())
      and m.status = 'active'
  )
)
with check (
  user_id = (select auth.uid())
  and exists (
    select 1 from public.memberships m
    where m.institution_id = announcement_reads.institution_id
      and m.user_id = (select auth.uid())
      and m.status = 'active'
  )
  and exists (
    select 1 from public.announcements a
    where a.id = announcement_reads.announcement_id
      and a.institution_id = announcement_reads.institution_id
  )
);
