export type DashboardViewMode = 'modern' | 'classic'
export type DashboardTheme = 'light' | 'dark'
export type DashboardFontSize = 'standard' | 'large' | 'largest'
export type DashboardSidebarMode = 'expanded' | 'compact'

export interface DashboardDisplayPreferences {
  viewMode: DashboardViewMode
  theme: DashboardTheme
  fontSize: DashboardFontSize
  sidebar: DashboardSidebarMode
  reducedMotion: boolean
}

export const DASHBOARD_DISPLAY_PREFERENCES_KEY: string
export const DEFAULT_DASHBOARD_DISPLAY_PREFERENCES: Readonly<DashboardDisplayPreferences>
export function normalizeDisplayPreferences(value: unknown): DashboardDisplayPreferences
export function readDisplayPreferences(storage: Pick<Storage, 'getItem' | 'setItem'> | null | undefined): DashboardDisplayPreferences
export function writeDisplayPreferences(storage: Pick<Storage, 'getItem' | 'setItem'> | null | undefined, preferences: DashboardDisplayPreferences): boolean
