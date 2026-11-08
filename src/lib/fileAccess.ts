import type { AppRole } from './types'

/** Mirrors the live institution-files Storage policies. */
export function canUploadInstitutionFiles(role?: AppRole | null): boolean {
  return role === 'owner' || role === 'admin' || role === 'teacher'
}

/** The live Storage DELETE policy is intentionally restricted to owner/admin. */
export function canDeleteInstitutionFiles(role?: AppRole | null): boolean {
  return role === 'owner' || role === 'admin'
}
