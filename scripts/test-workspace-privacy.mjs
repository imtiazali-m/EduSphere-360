import assert from 'node:assert/strict'
import test from 'node:test'
import {
  canViewInternalApproval,
  getWorkspaceExportColumns,
  getWorkspaceExportRows,
  getWorkspaceReviewMetrics,
} from '../src/lib/workspacePrivacy.js'

const columns = [
  { key: 'title', label: 'Record' },
  { key: 'status', label: 'Status' },
  { key: 'approval_status', label: 'Approval' },
  { key: 'reviewed_by', label: 'Reviewed by' },
  { key: 'reviewed_at', label: 'Reviewed at' },
]
const rows = [
  {
    id: 'one',
    title: 'Learning record',
    status: 'published',
    approval_status: 'pending',
    reviewed_by: 'internal-user',
    reviewed_at: '2026-11-11T10:00:00Z',
    payload: { chapter: 'Unit 1', approval_status: 'draft', reviewed_by: 'internal-user' },
  },
  {
    id: 'two',
    title: 'Second record',
    status: 'pending',
    approval_status: 'approved',
    reviewed_by: 'another-internal-user',
    reviewed_at: '2026-11-11T11:00:00Z',
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

test('family exports omit approval and review audit fields', () => {
  for (const role of ['student', 'parent']) {
    const safeColumns = getWorkspaceExportColumns(role, columns)
    assert.deepEqual(safeColumns.map(column => column.key), ['title', 'status'])
    const safeRows = getWorkspaceExportRows(role, rows)
    for (const row of safeRows) {
      for (const field of ['approval_status', 'reviewed_by', 'reviewed_at']) {
        assert.equal(Object.hasOwn(row, field), false, `Unexpected export field ${field}`)
      }
    }
    assert.equal(Object.hasOwn(safeRows[0].payload, 'approval_status'), false)
    assert.equal(Object.hasOwn(safeRows[0].payload, 'reviewed_by'), false)
  }
})

test('owner and admin retain approval metadata in exports', () => {
  for (const role of ['owner', 'admin']) {
    assert.deepEqual(getWorkspaceExportColumns(role, columns), columns)
    const exported = getWorkspaceExportRows(role, rows)
    assert.equal(exported[0].approval_status, 'pending')
    assert.equal(exported[0].reviewed_by, 'internal-user')
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
    { status: 'draft', count: 2 },
    { status: 'pending', count: 2 },
    { status: 'approved', count: 1 },
    { status: 'published', count: 1 },
    { status: 'completed', count: 1 },
  ])
})
