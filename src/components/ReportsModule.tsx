import { ReportsAnalyticsWorkspace } from './ReportsAnalyticsWorkspace'

export function ReportsModule({ onToast, initialWindow }: { onToast: (message: string, error?: boolean) => void; initialWindow?: string }) {
  return <ReportsAnalyticsWorkspace initialWindow={initialWindow ?? 'overview'} onToast={onToast}/>
}
