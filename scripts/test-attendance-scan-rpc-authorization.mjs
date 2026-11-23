import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'

const migration = readFileSync(new URL('../supabase/migrations/20261123100000_revoke_anon_execute_record_student_attendance_scan.sql', import.meta.url), 'utf8')
const normalized = migration.toLowerCase().replace(/\s+/g, ' ')

test('targets the exact existing attendance-scan RPC signature', () => {
  assert.match(normalized, /record_student_attendance_scan\(uuid,text,date,text,text,text,uuid\)/)
  assert.match(normalized, /has_institution_role\(uuid,text\[\]\)/)
})

test('fails closed if the attendance RPC security boundary changes', () => {
  assert.match(normalized, /v_scan_security_definer/)
  assert.match(normalized, /search_path=public, private/)
  assert.match(normalized, /has_institution_role\(p_institution_id,array\[''owner'',''admin'',''teacher''\]\)/)
})

test('checks the institution helper binds auth identity, institution and active membership', () => {
  for (const condition of [
    'm.institution_id=target_institution',
    'm.user_id=(selectauth.uid())',
    "m.status='active'",
    'm.role=any(allowed_roles)',
  ]) assert.ok(normalized.includes(condition), 'Missing helper condition: ' + condition)
})

test('removes PUBLIC and anon execution while preserving authenticated and service-role execution', () => {
  assert.match(normalized, /revoke all on function public\.record_student_attendance_scan\(uuid,text,date,text,text,text,uuid\) from public, anon/)
  assert.match(normalized, /grant execute on function public\.record_student_attendance_scan\(uuid,text,date,text,text,text,uuid\) to authenticated, service_role/)
  assert.doesNotMatch(normalized, /grant execute[^;]*\b(public|anon)\b/)
})

test('the seven application roles have the intended negative-authorization design', () => {
  const allowed = ['owner', 'admin', 'teacher']
  const denied = ['student', 'parent', 'accountant', 'exam_officer']
  assert.deepEqual(allowed, ['owner', 'admin', 'teacher'])
  assert.deepEqual(denied, ['student', 'parent', 'accountant', 'exam_officer'])
  for (const role of denied) assert.ok(!allowed.includes(role), role + ' must not be allowed to record attendance scans')
  assert.match(normalized, /has_institution_role\(p_institution_id,array\[''owner'',''admin'',''teacher''\]\)/)
})

test('the migration changes function ACLs only and does not mutate attendance data', () => {
  assert.doesNotMatch(normalized, /\b(insert into|update public\.|delete from|drop table|alter table)\b/)
  assert.match(normalized, /revoke all on function/)
  assert.match(normalized, /grant execute on function/)
})
