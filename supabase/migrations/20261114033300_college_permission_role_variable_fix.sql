-- Avoid shadowing PostgreSQL's CURRENT_ROLE special expression.
-- The old PL/pgSQL variable name caused profile base-role comparisons to
-- resolve against the execution role in the SQL subquery.
CREATE OR REPLACE FUNCTION private.has_institution_permission(
  target_institution uuid,
  target_module text,
  target_action text,
  target_campus uuid DEFAULT NULL,
  target_department uuid DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog
AS $function$
DECLARE
  membership_role text;
  custom_access_configured boolean;
BEGIN
  SELECT m.role INTO membership_role
  FROM public.memberships m
  WHERE m.institution_id = target_institution
    AND m.user_id = (SELECT auth.uid())
    AND m.status = 'active'
  ORDER BY CASE WHEN m.role = 'owner' THEN 0 ELSE 1 END
  LIMIT 1;

  IF membership_role IS NULL THEN
    RETURN false;
  END IF;

  IF membership_role = 'owner' THEN
    RETURN true;
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.institution_user_role_assignments a
    WHERE a.institution_id = target_institution
      AND a.user_id = (SELECT auth.uid())
  ) INTO custom_access_configured;

  IF NOT custom_access_configured THEN
    RETURN true;
  END IF;

  RETURN EXISTS (
    SELECT 1
    FROM public.institution_user_role_assignments a
    JOIN public.institution_role_profiles p
      ON p.id = a.role_profile_id
      AND p.institution_id = a.institution_id
    WHERE a.institution_id = target_institution
      AND a.user_id = (SELECT auth.uid())
      AND a.status = 'active'
      AND a.starts_at <= now()
      AND (a.ends_at IS NULL OR a.ends_at > now())
      AND p.is_active = true
      AND p.base_role = membership_role
      AND jsonb_typeof(p.module_permissions -> target_module) = 'array'
      AND coalesce((p.module_permissions -> target_module) ? target_action, false)
      AND (a.campus_id IS NULL OR a.campus_id = target_campus)
      AND (a.department_id IS NULL OR a.department_id = target_department)
  );
END
$function$;

REVOKE ALL ON FUNCTION private.has_institution_permission(uuid,text,text,uuid,uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.has_institution_permission(uuid,text,text,uuid,uuid) TO authenticated;
