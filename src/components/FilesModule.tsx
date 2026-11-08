import { useEffect, useState } from 'react'
import { Download, File as FileIcon, FileUp, RefreshCw, Trash2 } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { userFacingError } from '../lib/userErrors'
import { canDeleteInstitutionFiles, canUploadInstitutionFiles } from '../lib/fileAccess'

interface Props { onToast: (message: string, error?: boolean) => void }
interface StoredFile { name: string; id?: string; size?: number; metadata?: { size?: number; mimetype?: string; lastModified?: string } }

const MAX_FILE_BYTES = 10 * 1024 * 1024
const ALLOWED_FILE_TYPES = new Set([
  'application/pdf', 'image/png', 'image/jpeg', 'image/webp', 'text/plain',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
])

export function FilesModule({ onToast }: Props) {
  const { user } = useAuth()
  const [files, setFiles] = useState<StoredFile[]>([])
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(true)
  const canUpload = canUploadInstitutionFiles(user?.role)
  const canDelete = canDeleteInstitutionFiles(user?.role)

  async function load() {
    if (!supabase || !user?.institutionId) {
      setFiles([])
      setLoading(false)
      onToast('Cloud file storage is not configured for this institution.', true)
      return
    }
    setLoading(true)
    try {
      const { data, error } = await supabase.storage.from('institution-files').list(user.institutionId, {
        limit: 100,
        sortBy: { column: 'created_at', order: 'desc' },
      })
      if (error) throw error
      setFiles((data ?? []).filter(file => file.name !== '.emptyFolderPlaceholder').map(file => ({
        ...file,
        id: file.id ?? undefined,
        metadata: file.metadata ?? undefined,
        size: file.metadata?.size,
      })))
    } catch (error) {
      onToast(userFacingError(error, 'Could not load institution files. Refresh and try again.'), true)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void load() }, [user?.id, user?.institutionId])

  async function upload(file?: File) {
    if (!file || !user?.institutionId) return
    if (!canUpload) { onToast('Your role cannot upload institution files.', true); return }
    if (!supabase) { onToast('Supabase file storage is not configured.', true); return }
    if (file.size > MAX_FILE_BYTES) { onToast('Maximum file size is 10 MB.', true); return }
    if (!ALLOWED_FILE_TYPES.has(file.type)) { onToast('This file type is not supported. Upload PDF, PNG, JPG, WebP, TXT, Word or Excel documents.', true); return }
    setBusy(true)
    try {
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
      const path = `${user.institutionId}/${crypto.randomUUID()}-${safeName}`
      const { error } = await supabase.storage.from('institution-files').upload(path, file, {
        cacheControl: '3600', contentType: file.type || 'application/octet-stream', upsert: false,
      })
      if (error) throw error
      onToast('File uploaded to private institution cloud storage.')
      await load()
    } catch (error) {
      onToast(userFacingError(error, 'The file could not be uploaded. Check the file and try again.'), true)
    } finally {
      setBusy(false)
    }
  }

  async function download(file: StoredFile) {
    if (!supabase || !user?.institutionId) { onToast('Cloud file storage is not available.', true); return }
    try {
      const { data, error } = await supabase.storage.from('institution-files')
        .createSignedUrl(`${user.institutionId}/${file.name}`, 60)
      if (error) throw error
      const anchor = document.createElement('a')
      anchor.href = data.signedUrl
      anchor.download = file.name
      anchor.rel = 'noopener noreferrer'
      document.body.appendChild(anchor)
      anchor.click()
      anchor.remove()
    } catch (error) {
      onToast(userFacingError(error, 'Could not create a secure download link. Refresh the file list and try again.'), true)
    }
  }

  async function remove(file: StoredFile) {
    if (!supabase || !user?.institutionId) { onToast('Cloud file storage is not available.', true); return }
    if (!window.confirm(`Delete ${file.name}?`)) return
    try {
      const { error } = await supabase.storage.from('institution-files').remove([`${user.institutionId}/${file.name}`])
      if (error) throw error
      onToast('File deleted from institution cloud storage.')
      await load()
    } catch (error) {
      onToast(userFacingError(error, 'Could not delete the file. Refresh and try again.'), true)
    }
  }

  return <div className="page-content">
    <div className="page-title-row">
      <div><div className="eyebrow">DOCUMENT CENTRE</div><h1>Institution files</h1><p>Private cloud documents for your institution. Access is controlled by Supabase Storage policies.</p></div>
      {canUpload && <label className={`button button-primary upload-button ${busy ? 'disabled' : ''}`}>
        <FileUp size={17}/>{busy ? 'Uploading…' : 'Upload file'}
        <input hidden type="file" disabled={busy} onChange={event => { void upload(event.target.files?.[0]); event.currentTarget.value = '' }}/>
      </label>}
    </div>
    <div className="table-card files-card">
      {loading ? <div className="table-empty"><RefreshCw className="spin"/> Loading files…</div>
        : files.length === 0 ? <div className="table-empty"><div className="empty-icon"><FileUp size={22}/></div><strong>No files uploaded</strong><span>Upload a document, assignment brief or institution learning resource.</span></div>
          : <div className="file-list">{files.map(file => <div className="file-row" key={file.id ?? file.name}>
            <div className="file-icon"><FileIcon size={19}/></div>
            <div className="file-meta"><strong>{file.name}</strong><small>{(file.size ?? file.metadata?.size) ? `${((file.size ?? file.metadata?.size ?? 0) / 1024).toFixed(0)} KB` : 'Institution file'} · Cloud storage</small></div>
            <button className="icon-button" onClick={() => void download(file)} title="Download"><Download size={16}/></button>
            {canDelete && <button className="icon-button danger-icon" onClick={() => void remove(file)} title="Delete"><Trash2 size={16}/></button>}
          </div>)}</div>}
    </div>
    <p className="field-help file-storage-footnote">Files are stored in the institution's private cloud bucket and are available to authorised users with internet access.</p>
  </div>
}
