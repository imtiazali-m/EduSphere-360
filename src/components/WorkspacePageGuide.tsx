import { CheckCircle2, ClipboardList, Compass, ShieldCheck } from 'lucide-react'
import { getWorkspaceGroup, getWorkspaceItem } from '../lib/institutionalCatalog'
import { getWorkspaceExperience } from '../lib/workspaceExperience'

interface Props { groupKey:string; itemKey:string }

export function WorkspacePageGuide({groupKey,itemKey}:Props) {
  const group=getWorkspaceGroup(groupKey)
  const item=getWorkspaceItem(groupKey,itemKey)
  if(!group||!item||groupKey==='dashboard')return null
  const experience=getWorkspaceExperience(groupKey,item.label)
  return <section className="ed360-page-guide" aria-label={item.label+' workspace guide'}>
    <div className="ed360-page-guide-heading">
      <span className="ed360-page-guide-icon"><Compass size={18}/></span>
      <div><span className="ed360-page-guide-kicker">{group.label.toUpperCase()} / PAGE GUIDE</span><h2>Working in {item.label}</h2><p>{experience.purpose}</p></div>
    </div>
    <div className="ed360-page-guide-steps" aria-label="Recommended workflow">
      {experience.workflow.map((step,index)=><div className="ed360-page-guide-step" key={step}>
        <span className="ed360-page-guide-step-number">{index+1}</span><p>{step}</p>
      </div>)}
    </div>
    <div className="ed360-page-guide-outcome"><ShieldCheck size={16}/><span><b>Expected outcome</b>{experience.outcome}</span><CheckCircle2 size={17}/></div>
  </section>
}
