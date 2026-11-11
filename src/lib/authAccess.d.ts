export type LoginCategory = 'owner_admin' | 'employee' | 'student' | 'parent'
export function loginCategoryForRole(role: string | null | undefined): LoginCategory
export function matchesLoginRole(actualRole: string, expectedRole?: string): boolean
export function authLinkModeFromLocation(hash: string, search: string): 'recovery' | 'invite' | null
export function normalizeContactPhone(value: string): string
export function isValidContactPhone(value: string): boolean
