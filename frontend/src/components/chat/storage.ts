export function readChatPreference(key: string): unknown {
  try {
    return JSON.parse(localStorage.getItem(key) ?? 'null') as unknown
  } catch {
    return null
  }
}

export function saveChatPreference(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Preferences still work in this tab when local storage is unavailable.
  }
}
