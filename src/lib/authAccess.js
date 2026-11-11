export function loginCategoryForRole(role) {
  if (role === 'owner' || role === 'admin') return 'owner_admin'
  if (role === 'student') return 'student'
  if (role === 'parent') return 'parent'
  if (role === 'teacher' || role === 'accountant' || role === 'exam_officer') return 'employee'
  return 'owner_admin'
}
export function matchesLoginRole(actualRole, expectedRole) {
  if (!expectedRole) return true
  if (expectedRole === 'owner_admin') return actualRole === 'owner' || actualRole === 'admin'
  if (expectedRole === 'employee') return ['teacher', 'accountant', 'exam_officer'].includes(actualRole)
  if (expectedRole === 'admin') return actualRole === 'admin' || actualRole === 'owner'
  return actualRole === expectedRole
}
function extractAuthType(value) {
  const raw = String(value ?? '')
  const query = raw.includes('?') ? raw.slice(raw.indexOf('?') + 1) : raw.replace(/^#/, '')
  const type = new URLSearchParams(query).get('type')
  return type === 'invite' || type === 'recovery' ? type : null
}
export function authLinkModeFromLocation(hash, search) {
  return extractAuthType(hash) ?? extractAuthType(search)
}
export function normalizeContactPhone(value) {
  return String(value ?? '').trim().replace(/[\s().-]/g, '')
}
export function isValidContactPhone(value) {
  return /^\+?[0-9]{7,15}$/.test(normalizeContactPhone(value))
}
