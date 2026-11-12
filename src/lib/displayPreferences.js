export const DASHBOARD_DISPLAY_PREFERENCES_KEY = 'edusphere360:dashboard-display-preferences:v1'

export const DEFAULT_DASHBOARD_DISPLAY_PREFERENCES = Object.freeze({
  viewMode: 'modern',
  theme: 'light',
  fontSize: 'standard',
  sidebar: 'expanded',
  reducedMotion: false,
})

export function normalizeDisplayPreferences(value) {
  const source = value && typeof value === 'object' ? value : {}
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

export function readDisplayPreferences(storage) {
  try {
    const stored = storage?.getItem(DASHBOARD_DISPLAY_PREFERENCES_KEY)
    return stored ? normalizeDisplayPreferences(JSON.parse(stored)) : { ...DEFAULT_DASHBOARD_DISPLAY_PREFERENCES }
  } catch {
    return { ...DEFAULT_DASHBOARD_DISPLAY_PREFERENCES }
  }
}

export function writeDisplayPreferences(storage, preferences) {
  try {
    if (!storage) return false
    storage.setItem(DASHBOARD_DISPLAY_PREFERENCES_KEY, JSON.stringify(normalizeDisplayPreferences(preferences)))
    return true
  } catch {
    return false
  }
}
