import Dexie, { type Table } from 'dexie'
import type { AppRole, RecordRow } from './types'

export interface LocalInstitution {
  id: string
  name: string
  type: string
  createdAt: string
}

export interface LocalUser {
  id: string
  email: string
  fullName: string
  role: AppRole
  institutionId: string
  institutionName: string
  passwordHash: string
  salt: string
  linkedStudentId?: string | null
  createdAt: string
}

export interface LocalFile {
  id: string
  institutionId: string
  name: string
  type: string
  size: number
  blob: Blob
  createdAt: string
}

export interface LocalRecord {
  id: string
  institutionId: string
  tableName: string
  data: Record<string, unknown>
  createdAt: string
  updatedAt: string
}

class EduLocalDatabase extends Dexie {
  institutions!: Table<LocalInstitution, string>
  users!: Table<LocalUser, string>
  records!: Table<LocalRecord, string>
  files!: Table<LocalFile, string>

  constructor() {
    super('EduSphere360Local')
    this.version(1).stores({
      institutions: 'id, name',
      users: 'id, &email, role, institutionId',
      records: 'id, [institutionId+tableName], institutionId, tableName, createdAt',
    })
    this.version(2).stores({
      institutions: 'id, name',
      users: 'id, &email, role, institutionId',
      records: 'id, [institutionId+tableName], institutionId, tableName, createdAt',
      files: 'id, institutionId, name, createdAt',
    })
  }
}

export const localDb = new EduLocalDatabase()

export async function hashPassword(password: string, salt: string): Promise<string> {
  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: encoder.encode(salt), iterations: 160_000, hash: 'SHA-256' },
    key,
    256,
  )
  return [...new Uint8Array(bits)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

export function newId(): string {
  return crypto.randomUUID()
}

export async function createLocalAdmin(input: {
  institutionName: string; institutionType: string; fullName: string; email: string; password: string
}) {
  const email = input.email.trim().toLowerCase()
  if (!input.institutionName.trim() || !input.fullName.trim() || !email || input.password.length < 10) {
    throw new Error('Complete all fields. Use a password of at least 10 characters.')
  }
  const institutionId = newId()
  const userId = newId()
  const salt = newId()
  const passwordHash = await hashPassword(input.password, salt)
  const now = new Date().toISOString()
  return localDb.transaction('rw', localDb.institutions, localDb.users, async () => {
    if (await localDb.users.count()) throw new Error('An administrator already exists in this browser. Ask the existing administrator to create accounts.')
    await localDb.institutions.add({ id: institutionId, name: input.institutionName.trim(), type: input.institutionType, createdAt: now })
    await localDb.users.add({
      id: userId, email, fullName: input.fullName.trim(), role: 'owner', institutionId,
      institutionName: input.institutionName.trim(), passwordHash, salt, createdAt: now,
    })
    return { id: userId, email, fullName: input.fullName.trim(), role: 'owner' as const, institutionId, institutionName: input.institutionName.trim() }
  })
}

export async function signInLocal(emailValue: string, password: string) {
  const email = emailValue.trim().toLowerCase()
  const user = await localDb.users.where('email').equals(email).first()
  if (!user) throw new Error('No local account found for that email.')
  const attempted = await hashPassword(password, user.salt)
  if (attempted !== user.passwordHash) throw new Error('Email or password is incorrect.')
  return {
    id: user.id, email: user.email, fullName: user.fullName, role: user.role,
    institutionId: user.institutionId, institutionName: user.institutionName,
    linkedStudentId: user.linkedStudentId ?? null,
  }
}

export async function createLocalAccount(input: {
  fullName: string; email: string; password: string; role: AppRole; institutionId: string; institutionName: string; linkedStudentId?: string
}) {
  if (input.password.length < 10) throw new Error('Use a password of at least 10 characters.')
  const email = input.email.trim().toLowerCase()
  if (await localDb.users.where('email').equals(email).first()) throw new Error('An account with this email already exists.')
  const salt = newId()
  const passwordHash = await hashPassword(input.password, salt)
  const id = newId()
  await localDb.users.add({
    id, email, fullName: input.fullName.trim(), role: input.role, institutionId: input.institutionId,
    institutionName: input.institutionName, passwordHash, salt, linkedStudentId: input.linkedStudentId || null,
    createdAt: new Date().toISOString(),
  })
  return { id, email, fullName: input.fullName.trim(), role: input.role, institutionId: input.institutionId, institutionName: input.institutionName, linkedStudentId: input.linkedStudentId || null }
}

export async function listLocalAccounts(institutionId: string) {
  const users = await localDb.users.where('institutionId').equals(institutionId).toArray()
  return users.map(({ passwordHash: _hash, salt: _salt, ...safe }) => ({ ...safe, status: 'active' as const }))
}

function withComputedFields(tableName: string, data: Record<string, unknown>) {
  if (tableName === 'fee_invoices') return { ...data, balance: Number(data.amount ?? 0) - Number(data.paid_amount ?? 0) }
  return data
}

export async function listRecordsLocal(tableName: string, institutionId: string): Promise<RecordRow[]> {
  const rows = await localDb.records.where('[institutionId+tableName]').equals([institutionId, tableName]).toArray()
  return rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map((row) => ({
    ...withComputedFields(tableName, row.data), id: row.id, institution_id: row.institutionId, created_at: row.createdAt, updated_at: row.updatedAt,
  }))
}

export async function createRecordLocal(tableName: string, institutionId: string, payload: Record<string, unknown>) {
  const now = new Date().toISOString()
  const row: LocalRecord = { id: newId(), institutionId, tableName, data: payload, createdAt: now, updatedAt: now }
  await localDb.records.add(row)
  return { ...withComputedFields(tableName, payload), id: row.id, institution_id: institutionId, created_at: now, updated_at: now } as RecordRow
}

export async function updateRecordLocal(id: string, institutionId: string, tableName: string, payload: Record<string, unknown>) {
  const row = await localDb.records.get(id)
  if (!row || row.institutionId !== institutionId || row.tableName !== tableName) throw new Error('Record not found.')
  const updatedAt = new Date().toISOString()
  const data = { ...row.data, ...payload }
  await localDb.records.update(id, { data, updatedAt })
  return { ...withComputedFields(tableName, data), id, institution_id: institutionId, created_at: row.createdAt, updated_at: updatedAt } as RecordRow
}

export async function deleteRecordLocal(id: string, institutionId: string, tableName: string) {
  const row = await localDb.records.get(id)
  if (!row || row.institutionId !== institutionId || row.tableName !== tableName) throw new Error('Record not found.')
  await localDb.records.delete(id)
}

export async function saveLocalFile(institutionId: string, file: File) {
  const id = newId()
  await localDb.files.add({ id, institutionId, name: file.name, type: file.type, size: file.size, blob: file, createdAt: new Date().toISOString() })
}

export async function listLocalFiles(institutionId: string) {
  const files = await localDb.files.where('institutionId').equals(institutionId).toArray()
  return files.sort((a,b)=>b.createdAt.localeCompare(a.createdAt)).map(({id,name,size,type,createdAt})=>({id,name,size,type,createdAt,local:true}))
}

export async function getLocalFile(id: string) {
  return localDb.files.get(id)
}

export async function deleteLocalFile(id: string) {
  await localDb.files.delete(id)
}
