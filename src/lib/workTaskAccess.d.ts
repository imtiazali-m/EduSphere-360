import type { AppUser, RecordRow } from './types'

export function isWorkTaskVisibleToAssignee(task: RecordRow, user: AppUser): boolean
