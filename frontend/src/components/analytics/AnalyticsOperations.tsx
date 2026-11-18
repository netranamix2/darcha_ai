import { ShieldAlert, TrendingUp } from 'lucide-react'
import { useId, useMemo } from 'react'
import { Link } from 'react-router'
import type { AnalyticsSummary } from '../../api/types'
import { analyticsMessages } from '../../i18n/analytics'
import { localeCodes } from '../../i18n/locales'
import { useLanguage } from '../../i18n/useLanguage'
import { useT } from '../../i18n/useT'
import { analyticsTimestamp } from '../../lib/analytics-date'
import { GlassPanel } from '../ui'

export function AlertFeed({ alerts }: { alerts: AnalyticsSummary['alerts'] }) {
  const t = useT(analyticsMessages)
  const { language } = useLanguage()
  const headingId = useId()
  const recent = useMemo(() => [...alerts].sort((first, second) => second.created_at.localeCompare(first.created_at)), [alerts])
  const number = useMemo(() => new Intl.NumberFormat(localeCodes[language]), [language])
  const growth = useMemo(() => new Intl.NumberFormat(localeCodes[language], { style: 'percent', signDisplay: 'exceptZero' }), [language])

  return (
    <GlassPanel blur={false} className="analytics-alerts" role="region" aria-labelledby={headingId}>
      <div className="analytics-operations-heading">
        <h2 id={headingId}>{t('analytics.alerts')}</h2>
      </div>
      {recent.length === 0 && <p className="simple-report-note">{t('analytics.noAlerts')}</p>}
      <ul className="analytics-alert-list glass-stagger" aria-live="polite" aria-relevant="additions">
        {recent.map((alert) => {
          const fraud = alert.kind === 'fraud'
          const AlertIcon = fraud ? ShieldAlert : TrendingUp
          const canOpen = fraud && alert.inbox_id
          const text = !fraud && alert.appeal_count != null && alert.growth_pct != null
            ? t('analytics.spikeDetail').replace('{count}', number.format(alert.appeal_count)).replace('{growth}', growth.format(alert.growth_pct / 100))
            : alert.text
          const body = (
            <>
              <span className="analytics-alert-mark"><AlertIcon aria-hidden="true" size={17} /></span>
              <span className="analytics-alert-body">
                <span className="analytics-alert-meta">
                  <strong>{t(fraud ? 'analytics.fraud' : 'analytics.spike')}</strong>
                  <time dateTime={alert.created_at}>{analyticsTimestamp(alert.created_at, language)}</time>
                </span>
                <span className="analytics-alert-text">{text}</span>
              </span>
            </>
          )
          return (
            <li key={alert.id} data-kind={alert.kind} className="analytics-alert-entry">
              {canOpen ? (
                <Link className="analytics-alert-row" to={`/panel/inbox?${new URLSearchParams({ item: canOpen })}`}>
                  {body}
                  <span className="sr-only">{t('analytics.alertOpen')}</span>
                </Link>
              ) : <div className="analytics-alert-row">{body}</div>}
            </li>
          )
        })}
      </ul>
    </GlassPanel>
  )
}
