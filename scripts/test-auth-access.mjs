import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { authLinkModeFromLocation, isValidContactPhone, loginCategoryForRole, matchesLoginRole, normalizeContactPhone } from '../src/lib/authAccess.js'

test('all seven institution roles map to their intended access window', () => {
  assert.equal(loginCategoryForRole('owner'), 'owner_admin')
  assert.equal(loginCategoryForRole('admin'), 'owner_admin')
  for (const role of ['teacher', 'accountant', 'exam_officer']) assert.equal(loginCategoryForRole(role), 'employee')
  assert.equal(loginCategoryForRole('student'), 'student')
  assert.equal(loginCategoryForRole('parent'), 'parent')
})
test('owner and administration access rejects student and parent accounts', () => {
  assert.equal(matchesLoginRole('owner', 'owner_admin'), true)
  assert.equal(matchesLoginRole('admin', 'owner_admin'), true)
  assert.equal(matchesLoginRole('student', 'owner_admin'), false)
  assert.equal(matchesLoginRole('parent', 'owner_admin'), false)
})
test('employee access accepts only the configured staff role family', () => {
  for (const role of ['teacher', 'accountant', 'exam_officer']) assert.equal(matchesLoginRole(role, 'employee'), true)
  assert.equal(matchesLoginRole('student', 'employee'), false)
  assert.equal(matchesLoginRole('parent', 'employee'), false)
})
test('student and parent login categories remain distinct', () => {
  assert.equal(matchesLoginRole('student', 'student'), true)
  assert.equal(matchesLoginRole('parent', 'parent'), true)
  assert.equal(matchesLoginRole('parent', 'student'), false)
  assert.equal(matchesLoginRole('student', 'parent'), false)
})
test('invitation and password recovery callbacks are distinguished', () => {
  assert.equal(authLinkModeFromLocation('#access_token=abc&type=invite', ''), 'invite')
  assert.equal(authLinkModeFromLocation('#access_token=abc&type=recovery', ''), 'recovery')
  assert.equal(authLinkModeFromLocation('', '?type=invite'), 'invite')
  assert.equal(authLinkModeFromLocation('#/login/owner', ''), null)
  assert.equal(authLinkModeFromLocation('#access_token=abc&type=signup', ''), null)
})
test('international contact phones are normalized and validated', () => {
  assert.equal(normalizeContactPhone('+92 300 123-4567'), '+923001234567')
  assert.equal(isValidContactPhone('+92 300 123-4567'), true)
  assert.equal(isValidContactPhone('0300 1234567'), true)
  assert.equal(isValidContactPhone('abc12345'), false)
  assert.equal(isValidContactPhone('123'), false)
})
test('multi-institution access uses explicit choices instead of an implicit first membership', () => {
  const authSource = readFileSync(new URL('../src/lib/auth.ts', import.meta.url), 'utf8')
  const authContext = readFileSync(new URL('../src/context/AuthContext.tsx', import.meta.url), 'utf8')
  assert.match(authSource, /export async function listCloudInstitutionChoices/)
  assert.match(authContext, /if \(choices\.length === 1\)/)
  assert.match(authContext, /setInstitutionChoices\(choices\)/)
  assert.doesNotMatch(authSource, /\.limit\(1\)\.maybeSingle\(\)/)
})
