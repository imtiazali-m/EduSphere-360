const STAFF_ROLES = new Set(['teacher', 'accountant', 'exam_officer'])

function normalizeEmail(value) {
  return String(value ?? '').trim().toLowerCase()
}

/**
 * Client-side defence-in-depth filter for rows already returned under RLS.
 * Stable Auth IDs take precedence. Email matching is allowed only for an
 * explicitly flagged legacy row that has not yet been identity-linked.
 */
export function isWorkTaskVisibleToAssignee(task, user) {
  if (!task || !user || !STAFF_ROLES.has(user.role)) return false

  const institutionId = String(task.institution_id ?? '').trim()
  const userInstitutionId = String(user.institutionId ?? '').trim()
  if (!institutionId || !userInstitutionId || institutionId !== userInstitutionId) return false

  const assigneeUserId = String(task.assigned_to_user_id ?? '').trim()
  if (assigneeUserId) {
    return assigneeUserId === String(user.id ?? '').trim()
  }

  if (task.assigned_to_legacy_email_access !== true) return false
  const assigneeEmail = normalizeEmail(task.assigned_to_email)
  const userEmail = normalizeEmail(user.email)
  return Boolean(assigneeEmail && userEmail && assigneeEmail === userEmail)
}
