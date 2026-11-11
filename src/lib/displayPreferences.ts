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

export const DASHBOARD_DISPLAY_PREFERENCES_KEY = 'edusphere360:dashboard-display-preferences:v1'

export const DEFAULT_DASHBOARD_DISPLAY_PREFERENCES: Readonly<DashboardDisplayPreferences> = Object.freeze({
  viewMode: 'modern',
  theme: 'light',
  fontSize: 'standard',
  sidebar: 'expanded',
  reducedMotion: false,
})

type PreferenceStorage = Pick<Storage, 'getItem' | 'setItem'>

export function normalizeDisplayPreferences(value: unknown): DashboardDisplayPreferences {
  const source = value && typeof value === 'object' ? value as Record<string, unknown> : {}
  return {
    viewMode: source.viewMode === 'classic' ? 'classic' : 'modern',
    theme: source.theme === 'dark' ? 'dark' : 'light',
    fontSize: source.fontSize === 'largest' || source.fontSize === 'large'
      ? source.fontSize
      : 'standard',
    sidebar: source.sidebar === 'compact' ? 'compact' : 'expanded',
    reducedMotion: source.reducedMotion === true,
  }
}

export function readDisplayPreferences(storage: PreferenceStorage | null | undefined): DashboardDisplayPreferences {
  try {
    const stored = storage?.getItem(DASHBOARD_DISPLAY_PREFERENCES_KEY)
    return stored ? normalizeDisplayPreferences(JSON.parse(stored) as unknown) : { ...DEFAULT_DASHBOARD_DISPLAY_PREFERENCES }
  } catch {
    return { ...DEFAULT_DASHBOARD_DISPLAY_PREFERENCES }
  }
}

export function writeDisplayPreferences(
  storage: PreferenceStorage | null | undefined,
  preferences: DashboardDisplayPreferences,
): boolean {
  try {
    storage?.setItem(DASHBOARD_DISPLAY_PREFERENCES_KEY, JSON.stringify(normalizeDisplayPreferences(preferences)))
    return Boolean(storage)
  } catch {
    return false
  }
}
