import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'
import {
  canViewInternalApproval,
  getWorkspaceExportColumns,
  getWorkspaceExportRows,
  getWorkspaceReviewMetrics,
} from '../src/lib/workspacePrivacy.js'

const migration = fs.readFileSync(new URL('../supabase/migrations/20261111160000_institutional_record_review_isolation.sql', import.meta.url), 'utf8')
const columns = [
  { key: 'title', label: 'Record' },
  { key: 'status', label: 'Status' },
  { key: 'approval_status', label: 'Approval' },
  { key: 'reviewed_by', label: 'Reviewed by' },
  { key: 'reviewed_at', label: 'Reviewed at' },
  { key: 'review_notes', label: 'Review note' },
]
const rows = [
  {
    id: 'one',
    title: 'Learning record',
    status: 'published',
    approval_status: 'pending',
    reviewed_by: 'internal-user',
    reviewed_at: '2026-11-11T10:00:00Z',
    review_notes: 'Internal approval note',
    payload: { chapter: 'Unit 1', approval_status: 'draft', reviewed_by: 'internal-user', review_notes: 'Nested internal note' },
  },
  {
    id: 'two',
    title: 'Second record',
    status: 'pending',
    approval_status: 'approved',
    reviewed_by: 'another-internal-user',
    reviewed_at: '2026-11-11T11:00:00Z',
    review_notes: null,
    payload: { chapter: 'Unit 2' },
  },
  {
    id: 'three',
    title: 'Completed record',
    status: 'completed',
    approval_status: 'draft',
    payload: {},
  },
]

test('only owner and admin may view internal approval metadata', () => {
  for (const role of ['owner', 'admin']) assert.equal(canViewInternalApproval(role), true)
  for (const role of ['teacher', 'student', 'parent', 'accountant', 'exam_officer', null, undefined]) {
    assert.equal(canViewInternalApproval(role), false)
  }
})

test('family exports omit every internal review field, including nested payload values', () => {
  for (const role of ['student', 'parent']) {
    const safeColumns = getWorkspaceExportColumns(role, columns)
    assert.deepEqual(safeColumns.map(column => column.key), ['title', 'status'])
    const safeRows = getWorkspaceExportRows(role, rows)
    for (const row of safeRows) {
      for (const field of ['approval_status', 'reviewed_by', 'reviewed_at', 'review_notes']) {
        assert.equal(Object.hasOwn(row, field), false, `Unexpected export field ${field}`)
      }
    }
    for (const field of ['approval_status', 'reviewed_by', 'review_notes']) {
      assert.equal(Object.hasOwn(safeRows[0].payload, field), false, `Unexpected nested export field ${field}`)
    }
  }
})

test('owner and admin retain approval metadata in exports', () => {
  for (const role of ['owner', 'admin']) {
    assert.deepEqual(getWorkspaceExportColumns(role, columns), columns)
    const exported = getWorkspaceExportRows(role, rows)
    assert.equal(exported[0].approval_status, 'pending')
    assert.equal(exported[0].reviewed_by, 'internal-user')
    assert.equal(exported[0].review_notes, 'Internal approval note')
  }
})

test('family dashboard metrics use public status only', () => {
  const expected = [
    { status: 'pending', count: 1 },
    { status: 'published', count: 1 },
    { status: 'completed', count: 1 },
  ]
  for (const role of ['student', 'parent']) {
    const metrics = getWorkspaceReviewMetrics(rows, role)
    assert.equal(metrics.pendingCount, null)
    assert.deepEqual(metrics.statusCounts, expected)
  }
})

test('non-admin staff dashboards do not infer internal approval states', () => {
  for (const role of ['teacher', 'accountant', 'exam_officer']) {
    const metrics = getWorkspaceReviewMetrics(rows, role)
    assert.equal(metrics.pendingCount, null)
    assert.deepEqual(metrics.statusCounts, [
      { status: 'pending', count: 1 },
      { status: 'published', count: 1 },
      { status: 'completed', count: 1 },
    ])
    assert.deepEqual(getWorkspaceExportColumns(role, columns).map(column => column.key), ['title', 'status'])
  }
})

test('administrative dashboard retains review KPIs and review-state distribution', () => {
  const metrics = getWorkspaceReviewMetrics(rows, 'admin')
  assert.equal(metrics.pendingCount, 2)
  assert.deepEqual(metrics.statusCounts, [
    { status: 'draft', count: 1 },
    { status: 'pending', count: 2 },
    { status: 'approved', count: 1 },
    { status: 'published', count: 1 },
    { status: 'completed', count: 1 },
  ])
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
    'public.has_institution_role(institution_id, array[\'owner\',\'admin\']::text[])',
    'review_notes',
    'private.audit_institutional_record_review',
    'save_institutional_record_with_review',
    'set search_path = \'\'',
    'revoke all on function public.save_institutional_record_with_review',
    'grant execute on function public.save_institutional_record_with_review',
  ]) assert.ok(migration.toLowerCase().includes(required.toLowerCase()), `Migration is missing safeguard: ${required}`)

  const backfillAt = migration.indexOf('insert into public.institutional_record_reviews (')
  const removeAt = migration.indexOf('drop column approval_status')
  assert.ok(backfillAt >= 0 && removeAt > backfillAt, 'Existing review fields must be backfilled before legacy columns are dropped')
  for (const column of ['drop column approval_status', 'drop column reviewed_by', 'drop column reviewed_at', 'drop column review_notes']) {
    assert.ok(migration.includes(column), `Legacy review column is still exposed: ${column}`)
  }
})
