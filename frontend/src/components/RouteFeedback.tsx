import { CircleAlert } from 'lucide-react'
import { Component } from 'react'
import type { ReactNode } from 'react'
import { useT } from '../i18n/useT'
import { Button, GlassPanel, Skeleton } from './ui'

export function RouteLoading() {
  const t = useT()
  return (
    <div className="route-loading" role="status" aria-label={t('common.loading')}>
      <Skeleton className="route-heading-skeleton" />
      <Skeleton className="route-body-skeleton" />
    </div>
  )
}

function RouteFailure() {
  const t = useT()
  return (
    <GlassPanel variant="subtle" blur={false} className="route-failure" role="alert">
      <CircleAlert size={22} aria-hidden="true" />
      <p>{t('common.loadError')}</p>
      <Button type="button" variant="secondary" onClick={() => window.location.reload()}>
        {t('common.retry')}
      </Button>
    </GlassPanel>
  )
}

export class RouteBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  render() {
    return this.state.failed ? <RouteFailure /> : this.props.children
  }
}
