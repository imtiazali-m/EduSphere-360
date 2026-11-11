alter table public.student_behaviour_events
  add column if not exists location text,
  add column if not exists responsible_staff_id uuid;
do $$
begin
  if not exists(select 1 from pg_constraint where conname='student_behaviour_responsible_staff_fk' and conrelid='public.student_behaviour_events'::regclass) then
    alter table public.student_behaviour_events
      add constraint student_behaviour_responsible_staff_fk
      foreign key(responsible_staff_id,institution_id)
      references public.teachers(id,institution_id) on delete set null;
  end if;
end $$;
create index if not exists student_behaviour_responsible_staff_idx
  on public.student_behaviour_events(institution_id,responsible_staff_id,event_date desc);

drop policy if exists stage7_student_behaviour_read on public.student_behaviour_events;
create policy stage7_student_behaviour_read on public.student_behaviour_events for select to authenticated using(
  public.has_institution_role(institution_id,array['owner','admin'])
  or exists(select 1 from public.student_care_access a
    where a.institution_id=student_behaviour_events.institution_id and a.user_id=(select auth.uid())
      and a.area='discipline' and a.can_read)
);

drop policy if exists stage7_counselling_appointments_read on public.student_counselling_appointments;
create policy stage7_counselling_appointments_read on public.student_counselling_appointments for select to authenticated using(
  public.has_institution_role(institution_id,array['owner','admin'])
  or requested_by=(select auth.uid())
  or assigned_to=(select auth.uid())
  or exists(select 1 from public.student_care_access a
    where a.institution_id=student_counselling_appointments.institution_id and a.user_id=(select auth.uid())
      and a.area='counselling' and a.can_read)
);

drop policy if exists stage7_attendance_files_own_delete on storage.objects;
create policy stage7_attendance_files_own_delete on storage.objects for delete to authenticated using(
  bucket_id='attendance-private' and array_length(storage.foldername(name),1)=3 and (
    public.has_institution_role(((storage.foldername(name))[1])::uuid,array['owner','admin'])
    or ((storage.foldername(name))[2]='students' and (
      exists(select 1 from public.students s where s.id=((storage.foldername(name))[3])::uuid and s.institution_id=((storage.foldername(name))[1])::uuid and s.user_id=(select auth.uid()))
      or exists(select 1 from public.student_guardians g where g.student_id=((storage.foldername(name))[3])::uuid and g.institution_id=((storage.foldername(name))[1])::uuid and g.parent_user_id=(select auth.uid()))
    ))
    or ((storage.foldername(name))[2]='employees' and exists(
      select 1 from public.teachers t where t.id=((storage.foldername(name))[3])::uuid and t.institution_id=((storage.foldername(name))[1])::uuid and t.user_id=(select auth.uid())
    ))
  )
);
