import { AdministrationStage5Workspace } from './AdministrationStage5Workspace'

type Props={initialWindow?:string;onToast:(message:string,error?:boolean)=>void;onNavigate:(route:string)=>void}

/** The one Administration parent renders its 14 dedicated child windows through this workspace. */
export function GovernanceWorkspace(props:Props){
  return <AdministrationStage5Workspace {...props}/>
}
