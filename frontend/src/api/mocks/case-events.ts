import type { CaseChangeKind } from '../types'

// Keep the Stage 2 key so existing conversations carry over to the shared store.
export const caseStorageKey = 'darcha.mock-chat.v1'
type Listener = (kind: CaseChangeKind) => void
const listeners = new Set<Listener>()
const pending = new Set<CaseChangeKind>()

function eventKind(snapshot: string | null): CaseChangeKind {
  if (!snapshot) return 'reset'
  // Only inspect the snapshot header so a large Inbox does not need to be parsed in each listener.
  const kind = /^\{"version":2,"change":"(reset|report)"/u.exec(snapshot)?.[1]
  return kind === 'reset' || kind === 'report' ? kind : 'update'
}

export function subscribeToMockCaseChanges(listener: Listener) {
  if (typeof window === 'undefined') return () => {}

  const onStorage = (event: StorageEvent) => {
    if (event.key === caseStorageKey || event.key === null) listener(eventKind(event.newValue))
  }
  listeners.add(listener)
  window.addEventListener('storage', onStorage)

  return () => {
    listeners.delete(listener)
    window.removeEventListener('storage', onStorage)
  }
}

export function publishMockCaseChanges(kind: CaseChangeKind) {
  const scheduled = pending.size > 0
  pending.add(kind)
  if (scheduled) return
  queueMicrotask(() => {
    const batch = [...pending]
    pending.clear()
    batch.forEach((change) => listeners.forEach((listener) => listener(change)))
  })
}
