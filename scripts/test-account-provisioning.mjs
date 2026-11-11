import assert from 'node:assert/strict'
import {
  escapeIlikeLiteral,
  isVerifiedTeacherLink,
  normalizeIdentityEmail,
  resolveTeacherEmployee,
} from '../supabase/functions/create-user/provisioning-guards.mjs'

const cases = [
  ['normalizes case and surrounding whitespace', () => {
    assert.equal(normalizeIdentityEmail('  Teacher.Example@School.EDU  '), 'teacher.example@school.edu')
  }],
  ['escapes LIKE wildcard characters in an email literal', () => {
    assert.equal(escapeIlikeLiteral('a_b%c\\d@example.edu'), 'a\\_b\\%c\\\\d@example.edu')
  }],
  ['requires an exact employee email match', () => {
    const result = resolveTeacherEmployee([
      { id: 'teacher-1', email: 'teacher@example.edu', user_id: null },
      { id: 'teacher-2', email: 'teacher-extra@example.edu', user_id: null },
    ], ' TEACHER@example.edu ')
    assert.deepEqual(result, { ok: true, teacherId: 'teacher-1' })
  }],
  ['rejects provisioning when no employee record exists', () => {
    assert.deepEqual(resolveTeacherEmployee([], 'new@example.edu'), { ok: false, reason: 'employee_not_found' })
  }],
  ['rejects ambiguous employee matches', () => {
    assert.deepEqual(resolveTeacherEmployee([
      { id: 'teacher-1', email: 'same@example.edu', user_id: null },
      { id: 'teacher-2', email: ' SAME@example.edu ', user_id: null },
    ], 'same@example.edu'), { ok: false, reason: 'employee_ambiguous' })
  }],
  ['rejects an employee already linked to a login', () => {
    assert.deepEqual(resolveTeacherEmployee([
      { id: 'teacher-1', email: 'teacher@example.edu', user_id: 'existing-user' },
    ], 'teacher@example.edu'), { ok: false, reason: 'employee_already_linked' })
  }],
  ['rejects malformed employee candidates', () => {
    assert.deepEqual(resolveTeacherEmployee([
      { id: '', email: 'teacher@example.edu', user_id: null },
    ], 'teacher@example.edu'), { ok: false, reason: 'employee_invalid' })
  }],
  ['confirms only the exact employee and new user pair', () => {
    assert.equal(isVerifiedTeacherLink([{ id: 'teacher-1', user_id: 'user-1' }], 'teacher-1', 'user-1'), true)
    assert.equal(isVerifiedTeacherLink([], 'teacher-1', 'user-1'), false)
    assert.equal(isVerifiedTeacherLink([{ id: 'teacher-2', user_id: 'user-1' }], 'teacher-1', 'user-1'), false)
    assert.equal(isVerifiedTeacherLink([{ id: 'teacher-1', user_id: 'user-2' }], 'teacher-1', 'user-1'), false)
    assert.equal(isVerifiedTeacherLink([
      { id: 'teacher-1', user_id: 'user-1' },
      { id: 'teacher-1', user_id: 'user-1' },
    ], 'teacher-1', 'user-1'), false)
  }],
]

let failed = 0
for (const [name, run] of cases) {
  try {
    run()
    console.log('PASS  ' + name)
  } catch (error) {
    failed += 1
    console.error('FAIL  ' + name + ': ' + (error instanceof Error ? error.message : String(error)))
  }
}
console.log('\nTeacher account provisioning guards: ' + (cases.length - failed) + '/' + cases.length + ' passed')
if (failed > 0) process.exitCode = 1