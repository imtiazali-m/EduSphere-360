import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8')
const migration = read('supabase/migrations/20261115070000_native_online_sessions_calling.sql')
const edge = read('supabase/functions/online-session-control/index.ts')
const config = read('supabase/config.toml')
const dashboard = read('src/components/Dashboard.tsx')
const routes = read('src/lib/navigationRoutes.ts')
const calling = read('src/components/NativeCallingWorkspace.tsx')
const integrations = read('src/components/IntegrationManagementWorkspace.tsx')

const check = (label, fn) => {
  try { fn(); console.log('PASS  ' + label) }
  catch (error) { console.error('FAIL  ' + label + ': ' + error.message); process.exitCode = 1 }
}

check('Native online sessions persist class, call and participant history', () => {
  for (const table of ['online_sessions','online_session_participants','online_session_events']) {
    assert.match(migration, new RegExp('create table if not exists public\\.' + table + '\\b'))
  }
  for (const status of ['scheduled','ringing','live','ended','cancelled']) assert.ok(migration.includes("'" + status + "'"))
  for (const event of ['created','invited','joined','left','ended','cancelled','declined']) assert.ok(migration.includes("'" + event + "'"))
  assert.match(migration, /attendance_minutes integer not null default 0/)
  assert.match(migration, /recording_enabled boolean not null default false/)
})

check('Direct calls and classrooms enforce institution and class membership', () => {
  for (const routine of ['list_online_session_contacts','create_online_session','join_online_session','leave_online_session','end_online_session']) {
    assert.match(migration, new RegExp('function public\\.' + routine + '\\b'))
  }
  assert.ok(migration.includes('public.has_institution_role'))
  assert.ok(migration.includes('public.can_teach_class'))
  assert.ok(migration.includes('public.student_placements'))
  assert.ok(migration.includes('only students in your assigned classes'))
  assert.ok(migration.includes('You are not invited to this call'))
  assert.ok(migration.includes('Only the session host or an institution administrator'))
})

check('Browser cannot write call records directly or read other institutions', () => {
  for (const table of ['online_sessions','online_session_participants','online_session_events']) {
    assert.ok(migration.includes('alter table public.' + table + ' enable row level security'))
  }
  assert.match(migration, /revoke insert, update, delete on public\.online_sessions from anon, authenticated/)
  assert.match(migration, /revoke insert, update, delete on public\.online_session_participants from anon, authenticated/)
  assert.match(migration, /revoke insert, update, delete on public\.online_session_events from anon, authenticated/)
  assert.ok(migration.includes('private.is_online_session_participant'))
  assert.ok(migration.includes('private.can_manage_online_session'))
  const grants = read('supabase/migrations/20261115100000_native_online_session_public_grants_lockdown.sql')
  assert.match(grants, /revoke all on table[\s\S]*from public, anon/)
  const attendanceFix = read('supabase/migrations/20261115110000_online_session_attendance_reconnect_fix.sql')
  assert.ok(attendanceFix.includes('joined_at=case'))
  assert.ok(attendanceFix.includes('attendance_minutes=attendance_minutes + case'))
  const grants = read('supabase/migrations/20261115100000_native_online_session_public_grants_lockdown.sql')
  assert.ok(grants.includes('from public, anon'))
  const attendanceFix = read('supabase/migrations/20261115110000_online_session_attendance_reconnect_fix.sql')
  assert.ok(attendanceFix.includes("joined_at=case"))
  assert.ok(attendanceFix.includes('attendance_minutes=attendance_minutes + case'))
})

check('WebRTC room tokens are issued server-side and expire quickly', () => {
  assert.match(config, /\[functions\.online-session-control\][\s\S]*?verify_jwt = true/)
  assert.ok(edge.includes('auth.getUser(token)'))
  assert.ok(edge.includes('Deno.env.get("LIVEKIT_API_SECRET")'))
  assert.ok(edge.includes('new AccessToken(apiKey, apiSecret'))
  assert.ok(edge.includes('ttl: "10m"'))
  assert.ok(edge.includes('accessToken.addGrant'))
  assert.ok(edge.includes('roomJoin: true'))
  assert.ok(edge.includes("canPublish: session.participant_role !== 'parent'"))
  const guardian = read('supabase/migrations/20261115120000_guardian_online_class_observer_access.sql')
  assert.ok(guardian.includes('public.student_guardians'))
  assert.ok(guardian.includes('sg.parent_user_id=auth.uid()'))
  assert.ok(guardian.includes('v_actor_role=\'parent\''))
  assert.ok(!calling.includes('LIVEKIT_API_SECRET'))
  assert.ok(!calling.includes('LIVEKIT_API_KEY'))
  assert.ok(!dashboard.includes('LIVEKIT_API_SECRET'))
})

check('Calling and online classes use the native EduSphere workspace', () => {
  assert.ok(dashboard.includes('<NativeCallingWorkspace'))
  assert.ok(dashboard.includes('initialView="classes"'))
  assert.ok(routes.includes("return 'voice:native'"))
  assert.ok(routes.includes("'live-online-classes':'live-online-classes'"))
  assert.ok(calling.includes("action: 'join'") || calling.includes("'join'"))
  assert.ok(calling.includes('setMicrophoneEnabled'))
  assert.ok(calling.includes('setCameraEnabled'))
  assert.ok(calling.includes('setScreenShareEnabled'))
  assert.ok(calling.includes('online_session_participants'))
  assert.ok(calling.includes("user?.role === 'parent' ? 'classes' : initialView"))
})

check('Zoom, Google Meet and YouTube are not dependencies for online classrooms', () => {
  for (const integration of ['zoom:', 'google:', 'youtube:']) assert.ok(!integrations.includes(integration))
  assert.ok(integrations.includes('AI Provider Connections'))
  assert.ok(integrations.includes('Biometric Attendance Devices'))
})

if (process.exitCode) process.exit(process.exitCode)
