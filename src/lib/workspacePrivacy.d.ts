export interface WorkspacePrivacyColumn {
  key: string
  label: string
}

export interface WorkspaceReviewRow {
  status?: unknown
  approval_status?: unknown
}

export interface WorkspaceReviewMetrics {
  pendingCount: number | null
  statusCounts: Array<{ status: string; count: number }>
}

export function canViewInternalApproval(role: string | null | undefined): boolean
export function getWorkspaceExportColumns<T extends WorkspacePrivacyColumn>(role: string | null | undefined, columns: T[]): T[]
export function getWorkspaceExportRows<T extends Record<string, unknown>>(role: string | null | undefined, rows: T[]): Array<Record<string, unknown>>
export function getWorkspaceReviewMetrics(rows: WorkspaceReviewRow[], role: string | null | undefined): WorkspaceReviewMetrics
