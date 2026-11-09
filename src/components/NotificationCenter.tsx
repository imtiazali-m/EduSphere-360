import { useCallback, useEffect, useMemo, useState } from 'react'
import { Bell, Check, CheckCheck, Clock3, Megaphone, RefreshCw, Search } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { listRecords } from '../lib/data'
import { supabase } from '../lib/supabase'
import type { RecordRow } from '../lib/types'
import '../styles/notification-center.css'

type AnnouncementRow = RecordRow & { title: string; body: string; audience: string; created_at: string }
type NoticeRow = AnnouncementRow & { read_at: string | null }
type Props = { onToast: (message: string, error?: boolean) => void; onUnreadCountChange: (count: number) => void }

const dateLabel = (value: string) => {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? 'Date unavailable' : date.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
}

export function NotificationCenter({ onToast, onUnreadCountChange }: Props) {
  const { user, mode } = useAuth()
  const [rows, setRows] = useState<NoticeRow[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [filter, setFilter] = useState<'all' | 'unread'>('all')
  const [search, setSearch] = useState('')
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    if (!supabase || !user) { setRows([]); setLoading(false); return }
    setLoading(true); setLoadError('')
    try {
      const announcements = await listRecords(mode, user, 'announcements') as AnnouncementRow[]
      const ids = announcements.map(row => row.id)
      let receiptMap = new Map<string, string>()
      if (ids.length) {
        const { data, error } = await supabase.from('announcement_reads')
          .select('announcement_id,read_at')
          .eq('institution_id', user.institutionId).eq('user_id', user.id)
          .in('announcement_id', ids)
        if (error) throw error
        receiptMap = new Map((data ?? []).map(receipt => [String(receipt.announcement_id), String(receipt.read_at)]))
      }
      const next = announcements.map(row => ({ ...row, read_at: receiptMap.get(row.id) ?? null }))
        .sort((a, b) => new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime())
      setRows(next)
      onUnreadCountChange(next.filter(row => !row.read_at).length)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Notifications could not be loaded.'
      setLoadError(message); setRows([]); onUnreadCountChange(0)
    } finally { setLoading(false) }
  }, [mode, user?.id, user?.institutionId, onUnreadCountChange])

  useEffect(() => { void load() }, [load])

  const unreadCount = rows.filter(row => !row.read_at).length
  const recentCount = rows.filter(row => Date.now() - new Date(row.created_at).getTime() <= 7 * 86400000).length
  const visible = useMemo(() => rows.filter(row => {
    if (filter === 'unread' && row.read_at) return false
    const query = search.trim().toLowerCase()
    return !query || `${row.title} ${row.body} ${row.audience}`.toLowerCase().includes(query)
  }), [rows, filter, search])

  async function markRead(row: NoticeRow) {
    if (row.read_at || !supabase || !user || saving) return
    setSaving(true)
    try {
      const readAt = new Date().toISOString()
      const { error } = await supabase.from('announcement_reads').upsert({
        institution_id: user.institutionId, announcement_id: row.id, user_id: user.id, read_at: readAt,
      }, { onConflict: 'announcement_id,user_id' })
      if (error) throw error
      const next = rows.map(item => item.id === row.id ? { ...item, read_at: readAt } : item)
      setRows(next); onUnreadCountChange(next.filter(item => !item.read_at).length)
    } catch (error) {
      onToast(error instanceof Error ? error.message : 'This notification could not be marked as read.', true)
    } finally { setSaving(false) }
  }

  async function markAllRead() {
    if (!supabase || !user || unreadCount === 0 || saving) return
    setSaving(true)
    try {
      const readAt = new Date().toISOString()
      const receipts = rows.filter(row => !row.read_at).map(row => ({
        institution_id: user.institutionId, announcement_id: row.id, user_id: user.id, read_at: readAt,
      }))
      const { error } = await supabase.from('announcement_reads').upsert(receipts, { onConflict: 'announcement_id,user_id' })
      if (error) throw error
      setRows(rows.map(row => row.read_at ? row : { ...row, read_at: readAt }))
      onUnreadCountChange(0)
      onToast('All notifications marked as read.')
    } catch (error) {
      onToast(error instanceof Error ? error.message : 'Notifications could not be updated.', true)
    } finally { setSaving(false) }
  }

  return <main className="ed360-notification-page">
    <section className="ed360-notification-hero">
      <span className="ed360-notification-hero-icon"><Bell size={22}/></span>
      <div className="ed360-notification-hero-copy">
        <span>INSTITUTION COMMUNICATION</span>
        <h1>Notification centre</h1>
        <p>Published notices and updates visible to your account and institution role.</p>
      </div>
      <div className="ed360-notification-hero-actions">
        <button type="button" onClick={() => void load()} disabled={loading}><RefreshCw size={14}/> Refresh</button>
        <button type="button" onClick={() => void markAllRead()} disabled={saving || unreadCount === 0}><CheckCheck size={14}/> Mark all read</button>
      </div>
    </section>
    <section className="ed360-notification-kpis">
      <article><span>Total notices</span><strong>{rows.length}</strong><small>Visible to your account</small></article>
      <article><span>Unread</span><strong>{unreadCount}</strong><small>Awaiting your review</small></article>
      <article><span>Last 7 days</span><strong>{recentCount}</strong><small>Recently published</small></article>
    </section>
    <section className="ed360-notification-toolbar" aria-label="Notification filters">
      <div className="ed360-notification-filter">
        <button type="button" className={filter === 'all' ? 'active' : ''} onClick={() => setFilter('all')}>All notices</button>
        <button type="button" className={filter === 'unread' ? 'active' : ''} onClick={() => setFilter('unread')}>Unread ({unreadCount})</button>
      </div>
      <label className="ed360-notification-search"><Search size={15}/><input aria-label="Search notifications" placeholder="Search notices…" value={search} onChange={event => setSearch(event.target.value)}/></label>
    </section>
    {loadError && <div className="ed360-notification-error" role="alert">{loadError}</div>}
    {loading ? <div className="ed360-notification-empty"><RefreshCw size={19}/><strong>Loading notifications</strong><span>Checking the notices available to your account.</span></div>
      : visible.length ? <section className="ed360-notification-list" aria-label="Notifications">
        {visible.map(row => <article className={`ed360-notification-card ${row.read_at ? '' : 'is-unread'}`} key={row.id}>
          <span className="ed360-notification-card-icon"><Megaphone size={18}/></span>
          <div className="ed360-notification-card-copy">
            <div className="ed360-notification-card-meta">{!row.read_at && <i className="ed360-notification-dot"/>}<span className="ed360-notification-audience">{row.audience}</span><span><Clock3 size={12} style={{ verticalAlign: 'middle' }}/> {dateLabel(row.created_at)}</span></div>
            <h3>{row.title}</h3>
            <p>{row.body}</p>
          </div>
          <div className="ed360-notification-card-actions">
            {row.read_at ? <span><Check size={13}/> Read</span> : <button type="button" onClick={() => void markRead(row)} disabled={saving}><Check size={13}/> Mark read</button>}
          </div>
        </article>)}
      </section> : <section className="ed360-notification-empty"><Bell size={21}/><strong>{filter === 'unread' ? 'You are all caught up' : 'No notices yet'}</strong><span>{filter === 'unread' ? 'There are no unread notices for this account.' : 'Published institution announcements will appear here when they are available to your role.'}</span></section>}
  </main>
}
