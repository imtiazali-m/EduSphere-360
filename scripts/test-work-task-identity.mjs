import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { isWorkTaskVisibleToAssignee } from '../src/lib/workTaskAccess.js'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const user = {
  id: 'auth-user-1',
  email: 'new.address@example.test',
  role: 'teacher',
  institutionId: 'institution-a',
  institutionName: 'Test Institution',
  fullName: 'Sample Teacher',
}
const task = {
  id: 'task-1',
  institution_id: 'institution-a',
  assigned_to_user_id: 'auth-user-1',
  assigned_to_email: 'old.address@example.test',
  assigned_to_legacy_email_access: false,
}

test('stable identity continues to match after the employee email changes', () => {
  assert.equal(isWorkTaskVisibleToAssignee(task, user), true)
})

test('a different linked Auth user cannot inherit task access through a matching email', () => {
  assert.equal(isWorkTaskVisibleToAssignee({
    ...task,
    assigned_to_user_id: 'auth-user-2',
    assigned_to_email: user.email,
    assigned_to_legacy_email_access: true,
  }, user), false)
})

test('explicitly flagged unlinked legacy tasks retain normalized email access', () => {
  assert.equal(isWorkTaskVisibleToAssignee({
    ...task,
    assigned_to_user_id: null,
    assigned_to_legacy_email_access: true,
    assigned_to_email: '  NEW.ADDRESS@example.test ',
  }, user), true)
})

test('an unlinked task without the legacy access flag fails closed', () => {
  assert.equal(isWorkTaskVisibleToAssignee({
    ...task,
    assigned_to_user_id: null,
    assigned_to_legacy_email_access: false,
    assigned_to_email: user.email,
  }, user), false)
})

test('task access is tenant-scoped even if the Auth user ID matches', () => {
  assert.equal(isWorkTaskVisibleToAssignee({
    ...task,
    institution_id: 'institution-b',
  }, user), false)
})

test('student and parent roles never inherit staff task access', () => {
  assert.equal(isWorkTaskVisibleToAssignee(task, { ...user, role: 'student' }), false)
  assert.equal(isWorkTaskVisibleToAssignee(task, { ...user, role: 'parent' }), false)
})

test('legacy email comparison is case-insensitive and whitespace-normalized', () => {
  assert.equal(isWorkTaskVisibleToAssignee({
    ...task,
    assigned_to_user_id: null,
    assigned_to_legacy_email_access: true,
    assigned_to_email: ' New.Address@Example.Test ',
  }, user), true)
})

test('work-task form permits progress updates through stable identity, not mutable email', () => {
  const component = fs.readFileSync(path.join(root, 'src/components/RecordModule.tsx'), 'utf8')
  assert.ok(component.includes("import { isWorkTaskVisibleToAssignee } from '../lib/workTaskAccess.js'"))
  assert.ok(component.includes('!isWorkTaskVisibleToAssignee(targetEditing, user!)'))
  assert.ok(!component.includes("String(payload.assigned_to_email ?? '').toLowerCase() !== user!.email.toLowerCase()"))
})

test('SQL migration keeps identity and explicit legacy rules aligned with client filtering', () => {
  const sql = fs.readFileSync(path.join(root, 'supabase/migrations/20261111140500_work_task_stable_assignee_identity.sql'), 'utf8')
  assert.match(sql, /assigned_to_user_id uuid/i)
  assert.match(sql, /REFERENCES auth\.users\(id\)\s+ON DELETE SET NULL/i)
  assert.match(sql, /assigned_to_legacy_email_access boolean NOT NULL DEFAULT false/i)
  assert.match(sql, /GROUP BY m\.institution_id, lower\(btrim\(p\.email\)\)\s+HAVING count\(DISTINCT m\.user_id\) = 1/i)
  assert.match(sql, /assigned_to_user_id = \(SELECT auth\.uid\(\)\)/i)
  assert.match(sql, /assigned_to_legacy_email_access IS TRUE/i)
  assert.match(sql, /assigned_to_user_id IS NULL/i)
  assert.match(sql, /SET search_path = ''/i)
  assert.match(sql, /m\.institution_id = NEW\.institution_id/i)
  assert.match(sql, /m\.status = 'active'/i)
  assert.match(sql, /NEW\.assigned_to_user_id IS DISTINCT FROM OLD\.assigned_to_user_id/i)
  assert.match(sql, /NOT EXISTS \(\s*SELECT 1 FROM auth\.users/i)
  assert.match(sql, /Only administrators may reassign or redefine institutional work/i)
})
