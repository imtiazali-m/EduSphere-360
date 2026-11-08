-- PROPOSED (not applied): allow a 'leave' status on student attendance.
-- Replaces one CHECK constraint. Existing rows ('present','absent','late','excused') stay valid.
-- Confirm the live constraint name first:  select conname from pg_constraint where conrelid = 'public.attendance'::regclass and contype = 'c';
alter table public.attendance drop constraint if exists attendance_status_check;
alter table public.attendance add constraint attendance_status_check
  check (status in ('present','absent','late','excused','leave'));
