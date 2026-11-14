export const COLLEGE_NAME = 'Government Islamia Degree College Badin'
export const COLLEGE_SHORT_NAME = 'GIDC Badin'
export const COLLEGE_LOCATION = 'Badin, Sindh, Pakistan'

/** Normalise existing legacy institution-name variants for this single-college deployment. */
export function displayInstitutionName(name: string | null | undefined): string {
  const value = (name ?? '').trim()
  const normalised = value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
  if (
    normalised === 'government islamia degree college' ||
    normalised === 'government islamia degree college badin' ||
    normalised === 'islamia degree college' ||
    normalised === 'islamia degree college badin'
  ) return COLLEGE_NAME
  return value || COLLEGE_NAME
}
