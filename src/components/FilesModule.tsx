import { useEffect, useMemo, useState } from 'react'
import { Download, File as FileIcon, FileImage, FileText, FileUp, Files, HardDrive, RefreshCw, Search, Trash2, X } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { userFacingError } from '../lib/userErrors'
import { canDeleteInstitutionFiles, canUploadInstitutionFiles } from '../lib/fileAccess'
import '../styles/module-workspaces.css'

interface Props { onToast: (message: string, error?: boolean) => void }
interface StoredFile { name: string; id?: string; size?: number; created_at?: string; metadata?: { size?: number; mimetype?: string; lastModified?: string } }
const MAX_FILE_BYTES = 10 * 1024 * 1024
const PAGE_SIZE = 10
const ALLOWED_FILE_TYPES = new Set([
  'application/pdf', 'image/png', 'image/jpeg', 'image/webp', 'text/plain',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
])

function fileCategory(file: StoredFile) {
  const mime = String(file.metadata?.mimetype ?? '').toLowerCase()
  const name = file.name.toLowerCase()
  if (mime.startsWith('image/') || /\.(png|jpe?g|webp|gif|svg)$/.test(name)) return 'Images'
  if (mime.includes('pdf') || mime.startsWith('text/') || /\.(docx?|xlsx?|txt|pdf)$/.test(name)) return 'Documents'
  return 'Other files'
}
function fileSize(file: StoredFile) {
  return Number(file.size ?? file.metadata?.size ?? 0)
}
function formatBytes(value: number) {
  if (!value) return '0 KB'
  if (value >= 1024 * 1024) return (value / (1024 * 1024)).toFixed(1) + ' MB'
  return Math.max(1, Math.round(value / 1024)) + ' KB'
}

export function FilesModule({ onToast }: Props) {
  const { user } = useAuth()
  const [files, setFiles] = useState<StoredFile[]>([])
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<'all'|'Documents'|'Images'|'Other files'>('all')
  const [page, setPage] = useState(1)
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
        name: file.name,
        id: file.id ?? undefined,
        created_at: file.created_at ?? undefined,
        size: typeof file.metadata?.size === 'number' ? file.metadata.size : undefined,
        metadata: file.metadata ? {
          size: typeof file.metadata.size === 'number' ? file.metadata.size : undefined,
          mimetype: typeof file.metadata.mimetype === 'string' ? file.metadata.mimetype : undefined,
          lastModified: typeof file.metadata.lastModified === 'string' ? file.metadata.lastModified : undefined,
        } : undefined,
      })))
    } catch (error) {
      onToast(userFacingError(error, 'Could not load institution files. Refresh and try again.'), true)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void load() }, [user?.id, user?.institutionId])

  const fileStats = useMemo(() => {
    const totalBytes = files.reduce((sum, file) => sum + fileSize(file), 0)
    const documents = files.filter(file => fileCategory(file) === 'Documents').length
    const images = files.filter(file => fileCategory(file) === 'Images').length
    const categories = ['Documents', 'Images', 'Other files'].map(label => ({
      label,
      value: files.filter(file => fileCategory(file) === label).length,
      color: label === 'Documents' ? '#2877ee' : label === 'Images' ? '#16a36b' : '#8b62e8',
    }))
    return { totalBytes, documents, images, categories }
  }, [files])

  const filteredFiles = useMemo(() => files.filter(file =>
    (categoryFilter === 'all' || fileCategory(file) === categoryFilter)
      && (file.name.toLowerCase().includes(search.trim().toLowerCase())
        || String(file.metadata?.mimetype ?? '').toLowerCase().includes(search.trim().toLowerCase()))
  ), [files, search, categoryFilter])
  const pageCount = Math.max(1, Math.ceil(filteredFiles.length / PAGE_SIZE))
  const pageFiles = filteredFiles.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  const maxCategory = Math.max(1, ...fileStats.categories.map(item => item.value))

  async function upload(file?: File) {
    if (!file || !user?.institutionId) return
    if (!canUpload) { onToast('Your role cannot upload institution files.', true); return }
    if (!supabase) { onToast('Supabase file storage is not configured.', true); return }
    if (file.size > MAX_FILE_BYTES) { onToast('Maximum file size is 10 MB.', true); return }
    if (!ALLOWED_FILE_TYPES.has(file.type)) { onToast('This file type is not supported. Upload PDF, PNG, JPG, WebP, TXT, Word or Excel documents.', true); return }
    setBusy(true)
    try {
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
      const path = user.institutionId + '/' + crypto.randomUUID() + '-' + safeName
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
        .createSignedUrl(user.institutionId + '/' + file.name, 60)
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
    if (!canDelete) { onToast('Your role cannot delete institution files.', true); return }
    if (!window.confirm('Delete ' + file.name + '?')) return
    try {
      const { error } = await supabase.storage.from('institution-files').remove([user.institutionId + '/' + file.name])
      if (error) throw error
      onToast('File deleted from institution cloud storage.')
      await load()
    } catch (error) {
      onToast(userFacingError(error, 'Could not delete the file. Refresh and try again.'), true)
    }
  }

  return <div className="page-content ed360-module-page">
    <div className="page-title-row">
      <div><div className="eyebrow">DOCUMENT CENTRE</div><h1>Files &amp; Documentation</h1><p>Private institutional documents, learning resources and uploaded files.</p></div>
      {canUpload && <label className={'button button-primary upload-button ' + (busy ? 'disabled' : '')}>
        <FileUp size={17}/>{busy ? 'Uploading…' : 'Upload file'}
        <input hidden type="file" disabled={busy} onChange={event => { void upload(event.target.files?.[0]); event.currentTarget.value = '' }}/>
      </label>}
    </div>
    <nav className="ed360-operations-window-nav" aria-label="File documentation workspace windows">
      {([{key:'all',label:'File Register',count:files.length},{key:'Documents',label:'Documents',count:fileStats.documents},{key:'Images',label:'Images',count:fileStats.images},{key:'Other files',label:'Other files',count:fileStats.categories.find(item=>item.label==='Other files')?.value??0}] as const).map(item=><button type="button" key={item.key} className={categoryFilter===item.key?'active':''} aria-current={categoryFilter===item.key?'page':undefined} onClick={()=>{setCategoryFilter(item.key);setPage(1)}}>{item.label}<b>{loading?'—':item.count}</b></button>)}
    </nav>
    <section className="ed360-operations-context-window"><div><span>DOCUMENT CENTRE / PRIVATE STORAGE</span><h2>{categoryFilter==='all'?'Institution file register':categoryFilter+' workspace'}</h2><p>{categoryFilter==='all'?'Browse every institution file, or narrow the register by document type.':categoryFilter==='Documents'?'Review PDF, Word, Excel and text documents stored for this institution.':categoryFilter==='Images'?'Review image assets stored in the institution’s private file space.':'Review other file types returned by the private storage bucket.'}</p></div><div><strong>{filteredFiles.length}</strong><small>files in this window</small></div></section>

    <section className="ed360-module-insights" hidden={categoryFilter!=='all'}>
      <header className="ed360-module-insights-heading"><div><span>INSTITUTION DOCUMENTS</span><h2>Storage overview</h2><p>Files currently visible in this private institution folder.</p></div><small>{loading ? 'Updating…' : 'Latest 100 files'}</small></header>
      <div className="ed360-workspace-metrics">
        <div className="ed360-workspace-metric blue"><span><Files size={19}/></span><small>Files available</small><strong>{loading ? '—' : files.length}</strong><em>Most recent files listed</em></div>
        <div className="ed360-workspace-metric green"><span><HardDrive size={19}/></span><small>Storage used</small><strong>{loading ? '—' : formatBytes(fileStats.totalBytes)}</strong><em>Based on listed metadata</em></div>
        <div className="ed360-workspace-metric violet"><span><FileText size={19}/></span><small>Documents</small><strong>{loading ? '—' : fileStats.documents}</strong><em>PDF, Word, Excel and text</em></div>
        <div className="ed360-workspace-metric amber"><span><FileImage size={19}/></span><small>Images</small><strong>{loading ? '—' : fileStats.images}</strong><em>JPG, PNG and WebP</em></div>
      </div>
      <div className="ed360-workspace-chart-card">
        <div><h3>Files by type</h3><p>Distribution of the files returned by private storage.</p></div>
        <div className="ed360-workspace-bar-list">{fileStats.categories.map(item => <div className="ed360-workspace-bar-row" key={item.label}><div><span>{item.label}</span><b>{loading ? '—' : item.value}</b></div><span className="ed360-workspace-bar-track"><i style={{ width: (item.value / maxCategory * 100) + '%', background: item.color }}/></span></div>)}</div>
      </div>
    </section>

    <section className="table-card files-card">
      <div className="table-toolbar">
        <div className="table-count"><strong>{filteredFiles.length}</strong> matching files</div>
        <label className="student-search"><Search size={16}/><input aria-label="Search files" value={search} onChange={event => { setSearch(event.target.value); setPage(1) }} placeholder="Search filename or file type…"/>{search && <button type="button" aria-label="Clear search" onClick={() => { setSearch(''); setPage(1) }}><X size={14}/></button>}</label>
        <button type="button" className="student-refresh-button" onClick={() => void load()} disabled={loading}><RefreshCw className={loading ? 'spin' : ''} size={15}/> Refresh</button>
      </div>
      {loading ? <div className="table-empty"><RefreshCw className="spin"/> Loading files…</div>
        : filteredFiles.length === 0 ? <div className="table-empty"><div className="empty-icon"><FileUp size={22}/></div><strong>{search ? 'No matching files' : 'No files uploaded'}</strong><span>{search ? 'Try another filename or file type.' : 'Upload a document, assignment brief or institution learning resource.'}</span></div>
          : <div className="file-list">{pageFiles.map(file => <div className="file-row" key={file.id ?? file.name}>
            <div className="file-icon"><FileIcon size={19}/></div>
            <div className="file-meta"><strong>{file.name}</strong><small>{formatBytes(fileSize(file))} · {file.metadata?.mimetype ?? fileCategory(file)} · Private cloud storage</small></div>
            <button className="icon-button" onClick={() => void download(file)} title="Download"><Download size={16}/></button>
            {canDelete && <button className="icon-button danger-icon" onClick={() => void remove(file)} title="Delete"><Trash2 size={16}/></button>}
          </div>)}</div>}
      {filteredFiles.length > PAGE_SIZE && <div className="ed360-table-pagination"><span>Showing <b>{(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filteredFiles.length)}</b> of <b>{filteredFiles.length}</b> files</span><div className="ed360-pagination-controls"><button type="button" disabled={page <= 1} onClick={() => setPage(value => value - 1)}>‹</button>{Array.from({ length: pageCount }, (_, index) => index + 1).filter(number => number === 1 || number === pageCount || Math.abs(number - page) <= 1).map(number => <button type="button" key={number} className={number === page ? 'active' : ''} onClick={() => setPage(number)}>{number}</button>)}<button type="button" disabled={page >= pageCount} onClick={() => setPage(value => value + 1)}>›</button></div></div>}
    </section>
    <p className="field-help file-storage-footnote">Files are stored in the institution's private cloud bucket and are available to authorised users with internet access.</p>
  </div>
}
