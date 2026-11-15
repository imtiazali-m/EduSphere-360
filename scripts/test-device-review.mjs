import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const migration = readFileSync(new URL('../supabase/migrations/20261115060000_attendance_device_event_review_approval.sql', import.meta.url), 'utf8')
const workspace = readFileSync(new URL('../src/components/AttendanceWorkspace.tsx', import.meta.url), 'utf8')

test('review function is authenticated and restricts student vs employee reviewers', () => {
  assert.match(migration, /security definer/i)
  assert.match(migration, /has_institution_role\(v_event\.institution_id, array\['owner','admin','teacher'\]\)/i)
  assert.match(migration, /has_institution_role\(v_event\.institution_id, array\['owner','admin'\]\)/i)
  assert.match(migration, /grant execute on function public\.review_attendance_device_event[\s\S]*to authenticated/i)
  assert.match(migration, /revoke all on function public\.review_attendance_device_event[\s\S]*from public, anon/i)
})

test('original signed device evidence is immutable and direct browser updates are revoked', () => {
  for (const field of ['institution_id','source_id','external_event_id','student_id','teacher_id','occurred_at','event_kind','raw_payload','created_at']) {
    assert.ok(migration.includes('new.' + field + ' is distinct from old.' + field), 'Missing immutable evidence field: ' + field)
  }
  assert.match(migration, /revoke update on public\.attendance_device_events from anon, authenticated/i)
  assert.match(migration, /before update on public\.attendance_device_events/i)
})

test('approval reconciles into existing student and employee attendance tables', () => {
  assert.match(migration, /insert into public\.attendance\(/i)
  assert.match(migration, /update public\.attendance\s+set departure_time/i)
  assert.match(migration, /insert into public\.employee_attendance\(/i)
  assert.match(migration, /update public\.employee_attendance\s+set check_out_time/i)
  assert.match(migration, /attendance_registers/i)
  assert.match(migration, /attendance_record_type = 'attendance'/i)
  assert.match(migration, /attendance_record_type = 'employee_attendance'/i)
})

test('locked registers are protected and published/manual changes require correction reasons', () => {
  assert.match(migration, /v_register_status = 'locked'[\s\S]*?raise exception/i)
  assert.match(migration, /v_register_status = 'published' and v_correction_reason is null/i)
  assert.match(migration, /coalesce\(v_record_source,'manual'\) = 'manual'[\s\S]*?v_correction_reason is null/i)
  assert.match(migration, /correction_reason = case when v_correction_reason is not null/i)
  assert.match(migration, /corrected_by = case when v_correction_reason is not null/i)
  assert.match(migration, /corrected_at = case when v_correction_reason is not null/i)
})

test('attendance device workspace exposes approve/reject review with an audit note and explicit local time', () => {
  assert.match(workspace, /review_attendance_device_event/)
  assert.match(workspace, /submitDeviceEventReview\('approve'\)/)
  assert.match(workspace, /submitDeviceEventReview\('reject'\)/)
  assert.match(workspace, /p_review_note:reviewNote\.trim\(\)/)
  assert.match(workspace, /p_attendance_date:action==='approve'\?reviewDate:null/)
  assert.match(workspace, /p_event_time:action==='approve'\?reviewTime:null/)
  assert.match(workspace, /Review event/)
  assert.match(workspace, /processing_status/)
})
