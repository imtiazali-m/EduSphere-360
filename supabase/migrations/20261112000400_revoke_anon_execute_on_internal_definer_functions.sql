-- Reduce the exposed RPC surface of internal SECURITY DEFINER functions.
-- can_teach_class remains callable by authenticated RLS policies; anonymous
-- clients have no reason to probe class-teaching permissions.
-- prevent_academic_timetable_conflicts is trigger-only and must not be exposed
-- as a PostgREST RPC.

BEGIN;

REVOKE ALL ON FUNCTION public.can_teach_class(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_teach_class(uuid, uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.prevent_academic_timetable_conflicts() FROM PUBLIC, anon, authenticated;

COMMIT;
