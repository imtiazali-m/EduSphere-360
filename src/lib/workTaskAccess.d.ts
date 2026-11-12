import type { AppUser, RecordRow } from './types'

export function isWorkTaskVisibleToAssignee(task: RecordRow | null, user: AppUser): boolean
