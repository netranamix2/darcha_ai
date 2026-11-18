import { useSyncExternalStore } from 'react'
import { getApiMode, subscribeToApiMode } from '../api/client'
import { useT } from '../i18n/useT'

const labels = {
  mock: 'panel.apiMock',
  live: 'panel.apiLive',
  mixed: 'panel.apiMixed',
} as const

export function PanelApiFooter() {
  const mode = useSyncExternalStore(subscribeToApiMode, getApiMode)
  const t = useT()

  return (
    <footer className="panel-api-footer" data-api-mode={mode}>
      <span role="status">{t(labels[mode])}</span>
    </footer>
  )
}
