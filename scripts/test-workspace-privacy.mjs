import assert from 'node:assert/strict'
import test from 'node:test'

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
]
const rows = [
  {
    id: 'one',
    title: 'Learning record',
    status: 'published',
    approval_status: 'pending',
    reviewed_by: 'internal-user',
    reviewed_at: '2026-11-11T10:00:00Z',
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
      for (const field of ['approval_status', 'reviewed_by', 'reviewed_at']) {
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
