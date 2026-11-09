import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { ChevronRight, Layers3 } from 'lucide-react'
import { getWorkspaceBlueprint, type WorkspaceSubwindow } from '../lib/workspaceBlueprints'

interface WorkspaceState {
  routeKey: string
  windowKey: string
  subwindowKey: string
  setWindowKey: (key: string) => void
  setSubwindowKey: (key: string) => void
}
const emptyState: WorkspaceState = {
  routeKey:'', windowKey:'overview', subwindowKey:'all',
  setWindowKey:()=>undefined, setSubwindowKey:()=>undefined,
}
const WorkspaceContext = createContext<WorkspaceState>(emptyState)

interface Props {
  routeKey: string
  groupLabel: string
  pageLabel: string
  children: ReactNode
  mode?: 'full' | 'embedded'
}
export function WorkspaceHierarchy({routeKey,groupLabel,pageLabel,children,mode='full'}:Props) {
  const blueprint = getWorkspaceBlueprint(routeKey)
  const [windowKey,setWindowKey] = useState(blueprint.defaultWindow)
  const [subwindowKey,setSubwindowKey] = useState(blueprint.windows[0]?.subwindows[0]?.key ?? 'all')
  useEffect(()=>{
    const next = getWorkspaceBlueprint(routeKey)
    setWindowKey(next.defaultWindow)
    setSubwindowKey(next.windows[0]?.subwindows[0]?.key ?? 'all')
  },[routeKey])
  const currentWindow = blueprint.windows.find(item=>item.key===windowKey) ?? blueprint.windows[0]
  const currentOptions = currentWindow?.subwindows ?? []
  useEffect(()=>{
    if(currentOptions.length && !currentOptions.some(item=>item.key===subwindowKey)) setSubwindowKey(currentOptions[0].key)
  },[windowKey,routeKey,subwindowKey,currentOptions])
  const context = useMemo(()=>({routeKey,windowKey,subwindowKey,setWindowKey,setSubwindowKey}),[routeKey,windowKey,subwindowKey])
  return <WorkspaceContext.Provider value={context}>
    {mode==='full' ? <main className="workspace-hierarchy page-content">
      <header className="workspace-hierarchy-header">
        <div className="workspace-hierarchy-breadcrumb">
          <span>{groupLabel}</span><ChevronRight size={14}/><b>{pageLabel}</b><ChevronRight size={14}/><span>{currentWindow?.label ?? blueprint.label}</span>
        </div>
        <div className="workspace-hierarchy-heading">
          <div><span className="workspace-hierarchy-kicker"><Layers3 size={14}/> {groupLabel}</span><h2>{currentWindow?.label ?? blueprint.label}</h2><p>{currentWindow?.description ?? blueprint.description}</p></div>
          <div className="workspace-hierarchy-current"><small>SUBMENU</small><strong>{pageLabel}</strong></div>
        </div>
      </header>
      <nav className="workspace-window-tabs" aria-label={pageLabel+' workspaces'}>
        {blueprint.windows.map(item=><button type="button" key={item.key} className={windowKey===item.key?'active':''} aria-current={windowKey===item.key?'page':undefined} onClick={()=>{setWindowKey(item.key);setSubwindowKey(item.subwindows[0]?.key??'all')}}><span>{item.label}</span></button>)}
      </nav>
      <WorkspaceSubwindowNav items={currentOptions}/>
      <div className="workspace-hierarchy-content">{children}</div>
    </main> : children}
  </WorkspaceContext.Provider>
}
export function useWorkspaceHierarchy() { return useContext(WorkspaceContext) }
export function WorkspaceSubwindowNav({items}: {items:WorkspaceSubwindow[]}) {
  const {subwindowKey,setSubwindowKey} = useWorkspaceHierarchy()
  if(!items.length)return null
  return <nav className="workspace-subwindow-tabs" aria-label="Workspace task views">
    <div className="workspace-subwindow-caption">TASK VIEW</div>
    {items.map(item=><button type="button" key={item.key} className={subwindowKey===item.key?'active':''} aria-pressed={subwindowKey===item.key} title={item.description} onClick={()=>setSubwindowKey(item.key)}><span>{item.label}</span></button>)}
  </nav>
}
export function WorkspaceWindowSummary({title,description,count,action}: {title:string;description:string;count:number;action?:ReactNode}) {
  const {subwindowKey} = useWorkspaceHierarchy()
  return <div className="workspace-window-summary"><div><span>ACTIVE WORKSPACE</span><h2>{title}</h2><p>{description}</p><small>Selected task view: {subwindowKey.replaceAll('-',' ')}</small></div><div className="workspace-window-summary-right"><strong>{count.toLocaleString()}</strong><small>matching records</small>{action}</div></div>
}
