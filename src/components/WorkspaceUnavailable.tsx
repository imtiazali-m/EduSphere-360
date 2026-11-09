import { ArrowLeft, Construction, Database, ShieldCheck } from 'lucide-react'
import { getWorkspaceGroup, getWorkspaceItem } from '../lib/institutionalCatalog'

interface Props {
  groupKey: string
  itemKey: string
  onNavigate: (route: string) => void
}

export function WorkspaceUnavailable({ groupKey, itemKey, onNavigate }: Props) {
  const group = getWorkspaceGroup(groupKey)
  const item = getWorkspaceItem(groupKey, itemKey)
  const title = item?.label ?? itemKey.replaceAll('-', ' ').replace(/\b\w/g, value => value.toUpperCase())
  const description = item?.description ?? group?.description ?? 'This destination belongs to the institution workspace.'

  return <main className="page-content ed360-module-page" style={{ maxWidth: 1100, margin: '0 auto', padding: 32 }}>
    <header style={{ display: 'flex', alignItems: 'center', gap: 18, marginBottom: 28 }}>
      <span style={{ width: 52, height: 52, borderRadius: 16, display: 'grid', placeItems: 'center', background: '#edf2fb', color: '#315b9b' }}><Construction size={24}/></span>
      <div>
        <div className="eyebrow">{group?.label ?? groupKey} / WORKSPACE STATUS</div>
        <h1 style={{ margin: '5px 0', fontSize: 30 }}>{title}</h1>
        <p style={{ margin: 0, color: 'var(--muted, #64748b)' }}>{description}</p>
      </div>
    </header>
    <section className="table-card" style={{ padding: 28, borderRadius: 18 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#9a6515', fontWeight: 700, marginBottom: 12 }}>
        <Database size={18}/> Dedicated workflow connection required
      </div>
      <p style={{ maxWidth: 760, lineHeight: 1.65, color: 'var(--text-secondary, #536173)' }}>
        This menu destination is identified, but its dedicated production workflow is not connected yet.
        It will not display invented sample records or save unrelated entries in the generic institutional
        record store. The underlying domain tables, permissions and actions must be connected before this
        workspace can be treated as operational.
      </p>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: 16, borderRadius: 12, background: '#f3f7fb', color: '#40536b', margin: '20px 0' }}>
        <ShieldCheck size={18} style={{ flexShrink: 0, marginTop: 2 }}/>
        <span style={{ lineHeight: 1.55 }}>Your institution data is not changed by opening this screen. Existing supported workspaces remain available from the main navigation.</span>
      </div>
      <button type="button" className="button button-outline" onClick={() => onNavigate('overview')}><ArrowLeft size={15}/> Return to dashboard</button>
    </section>
  </main>
}
