import { ShieldAlert, SlidersHorizontal, TrendingUp } from 'lucide-react'
import { useId, useMemo, useState } from 'react'
import type { CSSProperties } from 'react'
import { Link } from 'react-router'
import type { AnalyticsSummary } from '../../api/types'
import { analyticsMessages } from '../../i18n/analytics'
import { localeCodes } from '../../i18n/locales'
import { useLanguage } from '../../i18n/useLanguage'
import { useT } from '../../i18n/useT'
import { analyticsTimestamp } from '../../lib/analytics-date'
import { GlassPanel } from '../ui'

const maxMinutes = 60
const minMinutes = 1
const hoursPerStaffWeek = 40

interface SavingsOptions {
  summary: AnalyticsSummary
  days: number
  minutes: number
  onMinutesChange: (minutes: number) => void
}

function TimeSavings({ summary, days, minutes, onMinutesChange }: SavingsOptions) {
  const t = useT(analyticsMessages)
  const { language } = useLanguage()
  const sliderId = useId()
  const headingId = useId()
  const format = useMemo(() => new Intl.NumberFormat(localeCodes[language], { maximumFractionDigits: 1 }), [language])
  const share = Math.min(100, Math.max(0, summary.ai_resolved_pct)) / 100
  const hours = summary.total * share * minutes / 60
  const staff = hours / (hoursPerStaffWeek * days / 7)
  const fill = (minutes - minMinutes) / (maxMinutes - minMinutes) * 100
  const minutesLabel = t('analytics.minutes').replace('{count}', String(minutes))

  return (
    <GlassPanel variant="elevated" blur={false} className="analytics-savings" role="region" aria-labelledby={headingId}>
      <div className="analytics-operations-heading">
        <h2 id={headingId}>{t('analytics.saved')}</h2>
      </div>
      <output className="analytics-savings-value" htmlFor={sliderId} aria-live="off">
        <strong>{format.format(hours)}</strong> <span>{t('analytics.savedHours')}</span>
      </output>
      <p className="analytics-savings-fte" title={t('analytics.staffWeek')}>{t('analytics.fte').replace('{count}', format.format(staff))}</p>
      <div className="analytics-savings-control">
        <label htmlFor={sliderId}><SlidersHorizontal size={15} aria-hidden="true" />{t('analytics.minutesPerAnswer')}</label>
        <span>{minutesLabel}</span>
        <input
          id={sliderId}
          type="range"
          min={minMinutes}
          max={maxMinutes}
          value={minutes}
          aria-valuetext={minutesLabel}
          onChange={(event) => onMinutesChange(event.currentTarget.valueAsNumber)}
          style={{ '--analytics-slider-fill': `${fill}%` } as CSSProperties}
        />
      </div>
      <p className="analytics-savings-note">{t('analytics.savedNote')}</p>
    </GlassPanel>
  )
}

function AlertFeed({ alerts }: { alerts: AnalyticsSummary['alerts'] }) {
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

export function AnalyticsOperations({ summary, days }: { summary?: AnalyticsSummary; days: number }) {
  const [minutes, setMinutes] = useState(15)
  if (!summary || (!summary.total && !summary.alerts.length)) return null

  return (
    <div className="analytics-operations">
      {summary.total > 0 && <TimeSavings summary={summary} days={days} minutes={minutes} onMinutesChange={setMinutes} />}
      {summary.alerts.length > 0 && <AlertFeed alerts={summary.alerts} />}
    </div>
  )
}
