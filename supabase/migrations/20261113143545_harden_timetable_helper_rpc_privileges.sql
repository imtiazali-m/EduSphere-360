revoke all on function public.can_teach_class(uuid,uuid) from public,anon;
grant execute on function public.can_teach_class(uuid,uuid) to authenticated,service_role;

revoke all on function public.prevent_academic_timetable_conflicts() from public,anon,authenticated;
grant execute on function public.prevent_academic_timetable_conflicts() to service_role;
