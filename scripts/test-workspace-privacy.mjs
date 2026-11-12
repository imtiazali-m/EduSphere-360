import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'

const migration = fs.readFileSync(new URL('../supabase/migrations/20261112000100_institutional_record_review_isolation.sql', import.meta.url), 'utf8')

let privacy
try {
  privacy = await import('../src/lib/workspacePrivacy.js')
} catch {
  privacy = null
}

const columns = [
  { key: 'title', label: 'Record' },
  { key: 'status', label: 'Status' },
  { key: 'approval_status', label: 'Approval' },
  { key: 'reviewed_by', label: 'Reviewed by' },
  { key: 'reviewed_at', label: 'Reviewed at' },
  { key: 'review_notes', label: 'Review notes' },
]
const rows = [
  {
    id: 'one',
    title: 'Learning record',
    status: 'published',
    approval_status: 'pending',
    reviewed_by: 'internal-user',
    reviewed_at: '2026-11-11T10:00:00Z',
    review_notes: 'Internal reviewer comment',
    payload: {
      chapter: 'Unit 1',
      approval_status: 'draft',
      nested: { reviewed_by: 'internal-user' },
      history: [{ reviewed_at: '2026-11-11T09:00:00Z', value: 'safe' }],
    },
  },
  { id: 'two', title: 'Second record', status: 'pending', approval_status: 'approved', payload: {} },
  { id: 'three', title: 'Completed record', status: 'completed', approval_status: 'draft', payload: {} },
]

test('workspace privacy policy is implemented', () => {
  assert.ok(privacy, 'workspacePrivacy.js must exist and export the role-aware privacy policy')
})

test('only owner and admin may view internal approval metadata', () => {
  assert.ok(privacy, 'workspace privacy policy is not implemented')
  for (const role of ['owner', 'admin']) assert.equal(privacy.canViewInternalApproval(role), true)
  for (const role of ['teacher', 'student', 'parent', 'accountant', 'exam_officer', null, undefined]) {
    assert.equal(privacy.canViewInternalApproval(role), false)
  }
})

test('non-admin export columns omit approval and reviewer fields', () => {
  assert.ok(privacy, 'workspace privacy policy is not implemented')
  for (const role of ['teacher', 'student', 'parent', 'accountant', 'exam_officer']) {
    assert.deepEqual(
      privacy.getWorkspaceExportColumns(role, columns).map(column => column.key),
      ['title', 'status'],
    )
  }
  assert.deepEqual(privacy.getWorkspaceExportColumns('owner', columns), columns)
  assert.deepEqual(privacy.getWorkspaceExportColumns('admin', columns), columns)
})

test('non-admin export rows deeply remove internal review fields', () => {
  assert.ok(privacy, 'workspace privacy policy is not implemented')
  for (const role of ['teacher', 'student', 'parent', 'accountant', 'exam_officer']) {
    const safeRows = privacy.getWorkspaceExportRows(role, rows)
    for (const row of safeRows) {
      for (const field of ['approval_status', 'reviewed_by', 'reviewed_at', 'review_notes']) {
        assert.equal(Object.hasOwn(row, field), false, `Unexpected export field ${field}`)
      }
    }
    assert.deepEqual(safeRows[0].payload, {
      chapter: 'Unit 1',
      nested: {},
      history: [{ value: 'safe' }],
    })
  }
  const adminRows = privacy.getWorkspaceExportRows('admin', rows)
  assert.equal(adminRows[0].approval_status, 'pending')
  assert.equal(adminRows[0].review_notes, 'Internal reviewer comment')
  assert.equal(adminRows[0].payload.nested.reviewed_by, 'internal-user')
})

test('non-admin dashboard metrics use public status only', () => {
  assert.ok(privacy, 'workspace privacy policy is not implemented')
  const expected = [
    { status: 'pending', count: 1 },
    { status: 'published', count: 1 },
    { status: 'completed', count: 1 },
  ]
  for (const role of ['teacher', 'student', 'parent', 'accountant', 'exam_officer']) {
    const metrics = privacy.getWorkspaceReviewMetrics(rows, role)
    assert.equal(metrics.pendingCount, null)
    assert.deepEqual(metrics.statusCounts, expected)
  }
})

test('owner and admin retain review KPIs and review-state distribution', () => {
  assert.ok(privacy, 'workspace privacy policy is not implemented')
  for (const role of ['owner', 'admin']) {
    const metrics = privacy.getWorkspaceReviewMetrics(rows, role)
    assert.equal(metrics.pendingCount, 2)
    assert.deepEqual(metrics.statusCounts, [
      { status: 'draft', count: 1 },
      { status: 'pending', count: 2 },
      { status: 'approved', count: 1 },
      { status: 'published', count: 1 },
      { status: 'completed', count: 1 },
    ])
  }
})

test('database review relation is tenant-scoped, admin-only, audited and preserves existing metadata', () => {
  for (const required of [
    'create table public.institutional_record_reviews',
    'foreign key (record_id, institution_id)',
    'alter table public.institutional_record_reviews enable row level security',
    'revoke all on public.institutional_record_reviews from public, anon',
    'grant select, insert, update, delete on public.institutional_record_reviews to authenticated',
    'institutional_record_reviews_owner_admin_select',
    'institutional_record_reviews_owner_admin_insert',
    'institutional_record_reviews_owner_admin_update',
    'institutional_record_reviews_owner_admin_delete',
    "public.has_institution_role(institution_id, array['owner','admin']::text[])",
    'review_notes',
    'private.audit_institutional_record_review',
    'module_key text not null',
    'record_type text not null',
    'after insert or update or delete on public.institutional_record_reviews',
    'v_module_key := old.module_key',
    'save_institutional_record_with_review',
    "set search_path = ''",
    'revoke all on function public.save_institutional_record_with_review',
    'grant execute on function public.save_institutional_record_with_review',
  ]) assert.ok(migration.toLowerCase().includes(required.toLowerCase()), `Migration is missing safeguard: ${required}`)

  const saveRpcAt = migration.indexOf('create or replace function public.save_institutional_record_with_review')
  const saveRpcEnd = migration.indexOf('$function$;', saveRpcAt)
  const saveRpc = migration.slice(saveRpcAt, saveRpcEnd)
  assert.ok(saveRpc.includes('security invoker'), 'Admin save RPC must retain caller RLS')
  assert.ok(!saveRpc.includes('security definer'), 'Admin save RPC must not bypass caller RLS')
  const auditAt = migration.indexOf('create or replace function private.audit_institutional_record_review')
  const auditEnd = migration.indexOf('$function$;', auditAt)
  assert.ok(migration.slice(auditAt, auditEnd).includes('security definer'), 'Private audit trigger must write through its protected owner context')

  const backfillAt = migration.indexOf('insert into public.institutional_record_reviews (')
  const removeAt = migration.indexOf('drop column approval_status')
  assert.ok(backfillAt >= 0 && removeAt > backfillAt, 'Existing review fields must be backfilled before legacy columns are dropped')
  for (const column of ['drop column approval_status', 'drop column reviewed_by', 'drop column reviewed_at', 'drop column review_notes']) {
    assert.ok(migration.includes(column), `Legacy review column is still exposed: ${column}`)
  }

  const workspace = fs.readFileSync(new URL('../src/components/InstitutionalWorkspace.tsx', import.meta.url), 'utf8')
  const adminWorkspace = fs.readFileSync(new URL('../src/components/AdministrationStage5Workspace.tsx', import.meta.url), 'utf8')
  assert.ok(workspace.includes(".from('institutional_records').select('id,institution_id,campus_id"), 'Operational records must use an explicit safe column projection')
  assert.ok(!workspace.includes(".from('institutional_records').select('*')"), 'No broad institutional_records select may remain')
  assert.ok(workspace.includes("supabase.from('institutional_record_reviews')"), 'Admin review metadata must use the isolated relation')
  assert.ok(workspace.includes("supabase.rpc('save_institutional_record_with_review'"), 'Admin record and review saves must use the scoped RPC')
  assert.ok(adminWorkspace.includes(".from('institutional_records').select('id,institution_id,module_key,record_type,title,reference_code,description,status,effective_date,payload,updated_at,created_at')"), 'Administration policy records must use an explicit safe projection')
  assert.ok(!adminWorkspace.includes("approval_status:'not_required'"), 'Administration policy writes must not use the removed approval column')
})
