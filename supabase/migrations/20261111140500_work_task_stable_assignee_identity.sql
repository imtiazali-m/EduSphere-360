-- Replace email-only task ownership with stable, tenant-scoped Auth identity.
-- Legacy email access is retained only for rows that cannot be uniquely linked.
-- This migration is staged in Git; it must not be applied without release approval.

ALTER TABLE public.work_tasks
  ADD COLUMN IF NOT EXISTS assigned_to_user_id uuid;

ALTER TABLE public.work_tasks
  ADD COLUMN IF NOT EXISTS assigned_to_legacy_email_access boolean NOT NULL DEFAULT false;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.work_tasks'::regclass
      AND conname = 'work_tasks_assigned_to_user_id_fkey'
  ) THEN
    ALTER TABLE public.work_tasks
      ADD CONSTRAINT work_tasks_assigned_to_user_id_fkey
      FOREIGN KEY (assigned_to_user_id)
      REFERENCES auth.users(id)
      ON DELETE SET NULL;
  END IF;
END
$$;

-- Backfill only exact, unique active staff matches inside the same institution.
-- Ambiguous or missing matches remain explicitly marked as legacy-only.
WITH uniquely_matched_staff AS (
  SELECT
    m.institution_id,
    lower(btrim(p.email)) AS email_key,
    (array_agg(DISTINCT m.user_id ORDER BY m.user_id))[1] AS user_id
  FROM public.memberships AS m
  INNER JOIN public.profiles AS p
    ON p.id = m.user_id
  WHERE m.status = 'active'
    AND m.role IN ('owner', 'admin', 'teacher', 'accountant', 'exam_officer')
    AND p.email IS NOT NULL
    AND btrim(p.email) <> ''
  GROUP BY m.institution_id, lower(btrim(p.email))
  HAVING count(DISTINCT m.user_id) = 1
)
UPDATE public.work_tasks AS wt
SET
  assigned_to_user_id = matched.user_id,
  assigned_to_legacy_email_access = false
FROM uniquely_matched_staff AS matched
WHERE wt.institution_id = matched.institution_id
  AND lower(btrim(wt.assigned_to_email)) = matched.email_key
  AND wt.assigned_to_user_id IS NULL;

-- Leave unmatched or ambiguous historical rows unassigned and inaccessible
-- to staff by default. An administrator must explicitly review and reassign
-- those records; never infer legacy access solely from a mutable email.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.work_tasks'::regclass
      AND conname = 'work_tasks_assignee_identity_check'
  ) THEN
    ALTER TABLE public.work_tasks
      ADD CONSTRAINT work_tasks_assignee_identity_check
      CHECK (
        assigned_to_user_id IS NULL
        OR assigned_to_legacy_email_access = false
      );
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS work_tasks_assignee_user_idx
  ON public.work_tasks(institution_id, assigned_to_user_id, status)
  WHERE assigned_to_user_id IS NOT NULL;

DROP POLICY IF EXISTS "staff view assigned work and admins view all" ON public.work_tasks;
CREATE POLICY "staff view assigned work and admins view all"
ON public.work_tasks
FOR SELECT TO authenticated
USING (
  public.has_institution_role(institution_id, ARRAY['owner', 'admin'])
  OR (
    public.has_institution_role(institution_id, ARRAY['teacher', 'accountant', 'exam_officer'])
    AND (
      assigned_to_user_id = (SELECT auth.uid())
      OR (
        assigned_to_user_id IS NULL
        AND assigned_to_legacy_email_access IS TRUE
        AND lower(btrim(assigned_to_email)) = lower(btrim((SELECT auth.jwt() ->> 'email')))
      )
    )
  )
);

DROP POLICY IF EXISTS "admins and assignees update work tasks" ON public.work_tasks;
CREATE POLICY "admins and assignees update work tasks"
ON public.work_tasks
FOR UPDATE TO authenticated
USING (
  public.has_institution_role(institution_id, ARRAY['owner', 'admin'])
  OR (
    public.has_institution_role(institution_id, ARRAY['teacher', 'accountant', 'exam_officer'])
    AND (
      assigned_to_user_id = (SELECT auth.uid())
      OR (
        assigned_to_user_id IS NULL
        AND assigned_to_legacy_email_access IS TRUE
        AND lower(btrim(assigned_to_email)) = lower(btrim((SELECT auth.jwt() ->> 'email')))
      )
    )
  )
)
WITH CHECK (
  public.has_institution_role(institution_id, ARRAY['owner', 'admin'])
  OR (
    public.has_institution_role(institution_id, ARRAY['teacher', 'accountant', 'exam_officer'])
    AND (
      assigned_to_user_id = (SELECT auth.uid())
      OR (
        assigned_to_user_id IS NULL
        AND assigned_to_legacy_email_access IS TRUE
        AND lower(btrim(assigned_to_email)) = lower(btrim((SELECT auth.jwt() ->> 'email')))
      )
    )
  )
);

-- Resolve every new/reassigned task to exactly one active staff Auth identity.
-- A deleted Auth identity stays unlinked and is not granted legacy email access.
CREATE OR REPLACE FUNCTION public.guard_work_task_assignment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_assignee_name text;
  v_resolved_user_id uuid;
  v_match_count integer;
  v_email_changed boolean := false;
  v_identity_changed boolean := false;
  v_deleted_identity boolean := false;
BEGIN
  -- A task belongs to one institution for its lifetime. Cross-tenant transfers
  -- must create a new destination task so its assignee is resolved in that tenant.
  IF TG_OP = 'UPDATE' AND NEW.institution_id IS DISTINCT FROM OLD.institution_id THEN
    RAISE EXCEPTION 'Institutional work tasks cannot be transferred between institutions. Create a new task in the destination institution.';
  END IF;

  IF TG_OP = 'INSERT' THEN
    v_email_changed := true;
  ELSE
    v_email_changed := NEW.assigned_to_email IS DISTINCT FROM OLD.assigned_to_email;
    v_identity_changed := NEW.assigned_to_user_id IS DISTINCT FROM OLD.assigned_to_user_id;
    v_deleted_identity := v_identity_changed
      AND NEW.assigned_to_user_id IS NULL
      AND OLD.assigned_to_user_id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM auth.users AS au
        WHERE au.id = OLD.assigned_to_user_id
      );
  END IF;

  IF v_deleted_identity THEN
    -- Allow the FK's ON DELETE SET NULL action; do not reopen email access.
    NEW.assigned_to_legacy_email_access := false;
  ELSIF v_email_changed OR v_identity_changed THEN
    SELECT
      count(DISTINCT m.user_id)::integer,
      (array_agg(DISTINCT m.user_id ORDER BY m.user_id))[1],
      (array_agg(DISTINCT p.full_name ORDER BY p.full_name))[1]
    INTO v_match_count, v_resolved_user_id, v_assignee_name
    FROM public.memberships AS m
    INNER JOIN public.profiles AS p
      ON p.id = m.user_id
    WHERE m.institution_id = NEW.institution_id
      AND m.status = 'active'
      AND lower(btrim(p.email)) = lower(btrim(NEW.assigned_to_email))
      AND m.role IN ('owner', 'admin', 'teacher', 'accountant', 'exam_officer');

    IF v_match_count <> 1 OR v_resolved_user_id IS NULL THEN
      RAISE EXCEPTION 'The assigned email must belong to exactly one active staff account in this institution.';
    END IF;

    IF TG_OP = 'INSERT'
      AND NEW.assigned_to_user_id IS NOT NULL
      AND NEW.assigned_to_user_id IS DISTINCT FROM v_resolved_user_id THEN
      RAISE EXCEPTION 'The assigned staff identity does not match the institution staff email.';
    END IF;

    IF TG_OP = 'UPDATE'
      AND v_identity_changed
      AND NOT v_email_changed
      AND NEW.assigned_to_user_id IS DISTINCT FROM v_resolved_user_id THEN
      RAISE EXCEPTION 'The assigned staff identity cannot be changed independently of the staff email.';
    END IF;

    NEW.assigned_to_user_id := v_resolved_user_id;
    NEW.assigned_to_legacy_email_access := false;
    NEW.assigned_to_name := coalesce(v_assignee_name, NEW.assigned_to_name);
  END IF;

  IF NEW.status = 'completed' THEN
    NEW.progress_percent := 100;
  ELSIF NEW.progress_percent = 100 THEN
    NEW.status := 'completed';
  END IF;

  IF TG_OP = 'UPDATE'
    AND NOT v_deleted_identity
    AND NOT public.has_institution_role(NEW.institution_id, ARRAY['owner', 'admin']) THEN
    IF NEW.assigned_to_email IS DISTINCT FROM OLD.assigned_to_email
      OR NEW.assigned_to_name IS DISTINCT FROM OLD.assigned_to_name
      OR NEW.assigned_to_user_id IS DISTINCT FROM OLD.assigned_to_user_id
      OR NEW.assigned_to_legacy_email_access IS DISTINCT FROM OLD.assigned_to_legacy_email_access
      OR NEW.title IS DISTINCT FROM OLD.title
      OR NEW.task_type IS DISTINCT FROM OLD.task_type
      OR NEW.description IS DISTINCT FROM OLD.description
      OR NEW.priority IS DISTINCT FROM OLD.priority
      OR NEW.due_date IS DISTINCT FROM OLD.due_date
      OR NEW.institution_id IS DISTINCT FROM OLD.institution_id
      OR NEW.created_by IS DISTINCT FROM OLD.created_by THEN
      RAISE EXCEPTION 'Only administrators may reassign or redefine institutional work.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- The original trigger remains bound to this replaced function.
