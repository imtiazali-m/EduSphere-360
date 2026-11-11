/**
 * Pure identity guards shared by the create-user Edge Function and Node tests.
 * These functions deliberately do not perform database writes.
 */

export function normalizeIdentityEmail(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : ''
}

/** Escape Postgres LIKE metacharacters before placing an email in an ILIKE pattern. */
export function escapeIlikeLiteral(value) {
  return String(value ?? '').replace(/[\\%_]/g, '\\$&')
}

/** Resolve exactly one unlinked employee identity for a teacher login. */
export function resolveTeacherEmployee(candidates, requestedEmail) {
  const normalizedEmail = normalizeIdentityEmail(requestedEmail)
  if (!normalizedEmail) return { ok: false, reason: 'invalid_email' }
  const matches = (Array.isArray(candidates) ? candidates : []).filter(
    (candidate) => normalizeIdentityEmail(candidate?.email) === normalizedEmail,
  )
  if (matches.length === 0) return { ok: false, reason: 'employee_not_found' }
  if (matches.length > 1) return { ok: false, reason: 'employee_ambiguous' }
  const employee = matches[0]
  if (typeof employee.id !== 'string' || !employee.id) return { ok: false, reason: 'employee_invalid' }
  if (typeof employee.user_id === 'string' && employee.user_id.trim()) {
    return { ok: false, reason: 'employee_already_linked' }
  }
  return { ok: true, teacherId: employee.id }
}

/** Verify the exact employee row and Auth user returned by the conditional UPDATE. */
export function isVerifiedTeacherLink(rows, expectedTeacherId, expectedUserId) {
  return Array.isArray(rows)
    && rows.length === 1
    && rows[0]?.id === expectedTeacherId
    && rows[0]?.user_id === expectedUserId
}