import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'

const migration = fs.readFileSync(new URL('../supabase/migrations/20261112000400_revoke_anon_execute_on_internal_definer_functions.sql', import.meta.url), 'utf8')

test('internal SECURITY DEFINER functions are not anonymously executable', () => {
  assert.match(migration, /REVOKE ALL ON FUNCTION public\.can_teach_class\(uuid,\s*uuid\) FROM PUBLIC, anon/i)
  assert.match(migration, /GRANT EXECUTE ON FUNCTION public\.can_teach_class\(uuid,\s*uuid\) TO authenticated/i)
  assert.match(migration, /REVOKE ALL ON FUNCTION public\.prevent_academic_timetable_conflicts\(\) FROM PUBLIC, anon, authenticated/i)
  assert.doesNotMatch(migration, /GRANT EXECUTE ON FUNCTION public\.prevent_academic_timetable_conflicts/i)
})

test('the migration preserves authenticated RLS use of can_teach_class and limits the other function to trigger execution', () => {
  assert.match(migration, /can_teach_class[\s\S]*?TO authenticated/i)
  assert.match(migration, /prevent_academic_timetable_conflicts[\s\S]*?FROM PUBLIC, anon, authenticated/i)
  assert.ok(migration.includes('BEGIN;') && migration.includes('COMMIT;'), 'Grant changes must be atomic')
})
