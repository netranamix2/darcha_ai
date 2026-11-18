// Keep the Stage 2 key so existing conversations carry over to the shared store.
export const caseStorageKey = 'darcha.mock-chat.v1'
const listeners = new Set<() => void>()
let queued = false

export function subscribeToMockCaseChanges(listener: () => void) {
  if (typeof window === 'undefined') return () => {}

  const onStorage = (event: StorageEvent) => {
    if (event.key === caseStorageKey || event.key === null) listener()
  }
  listeners.add(listener)
  window.addEventListener('storage', onStorage)

  return () => {
    listeners.delete(listener)
    window.removeEventListener('storage', onStorage)
  }
}

export function publishMockCaseChanges() {
  if (queued) return
  queued = true
  queueMicrotask(() => {
    queued = false
    listeners.forEach((listener) => listener())
  })
}
