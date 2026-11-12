const INTERNAL_REVIEW_FIELDS = new Set(['approval_status', 'reviewed_by', 'reviewed_at', 'review_notes'])
const REVIEW_STATES = ['draft', 'pending', 'in_progress', 'approved', 'published', 'completed', 'cancelled']
const PRIVILEGED_ROLES = new Set(['owner', 'admin'])

export function canViewInternalApproval(role) {
  return PRIVILEGED_ROLES.has(String(role ?? ''))
}

export function getWorkspaceExportColumns(role, columns) {
  if (canViewInternalApproval(role)) return [...columns]
  return columns.filter(column => !INTERNAL_REVIEW_FIELDS.has(column.key))
}

function removeInternalReviewFields(value) {
  if (Array.isArray(value)) return value.map(removeInternalReviewFields)
  if (!value || typeof value !== 'object') return value
  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => !INTERNAL_REVIEW_FIELDS.has(key))
      .map(([key, nested]) => [key, removeInternalReviewFields(nested)]),
  )
}

export function getWorkspaceExportRows(role, rows) {
  if (canViewInternalApproval(role)) return rows.map(row => ({ ...row }))
  return rows.map(removeInternalReviewFields)
}

export function getWorkspaceReviewMetrics(rows, role) {
  const canReview = canViewInternalApproval(role)
  const statusCounts = REVIEW_STATES
    .map(status => ({
      status,
      count: rows.filter(row => row.status === status || (canReview && row.approval_status === status)).length,
    }))
    .filter(entry => entry.count > 0)

  return {
    pendingCount: canReview
      ? rows.filter(row => ['pending', 'draft'].includes(String(row.approval_status ?? ''))).length
      : null,
    statusCounts,
  }
}
