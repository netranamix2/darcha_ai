import { useId } from 'react'
import type { AnalyticsSummary } from '../../api/types'
import { analyticsChartMessages } from '../../i18n/analytics-charts'
import { localeCodes } from '../../i18n/locales'
import { useLanguage } from '../../i18n/useLanguage'
import { useT } from '../../i18n/useT'
import { GlassPanel, Skeleton, ViewportCounter } from '../ui'
import './analytics-charts.css'

const metrics = [
  { key: 'total', label: 'charts.total' },
  { key: 'ai_resolved_pct', label: 'charts.resolved' },
  { key: 'avg_response_sec', label: 'charts.response' },
  { key: 'overdue', label: 'charts.overdue' },
] as const

type MetricKey = (typeof metrics)[number]['key']

function Sparkline({ values }: { values: number[] }) {
  const id = useId()
  const min = Math.min(...values)
  const max = Math.max(...values)
  const points = values.map((value, index) => {
    const x = 2 + index / (values.length - 1) * 96
    const y = max === min ? 18 : 28 - (value - min) / (max - min) * 23
    return `${x.toFixed(1)},${y.toFixed(1)}`
  }).join(' ')

  return (
    <svg className="analytics-kpi-spark" viewBox="0 0 100 32" preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <linearGradient id={id} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="currentColor" stopOpacity={0.21} />
          <stop offset="100%" stopColor="currentColor" stopOpacity={0} />
        </linearGradient>
      </defs>
      <polygon points={`2,32 ${points} 98,32`} fill={`url(#${id})`} />
      <polyline points={points} fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
    </svg>
  )
}

function metricTrend(metric: MetricKey, summary: AnalyticsSummary, previous: AnalyticsSummary | undefined) {
  const values = summary.daily?.map((day) => day[metric]).filter((value): value is number => typeof value === 'number' && Number.isFinite(value))
  if (values && values.length > 1) return values
  if (metric === 'total' && summary.sentiment_daily.length > 1) {
    return summary.sentiment_daily.map(({ positive, neutral, negative }) => positive + neutral + negative)
  }
  return [previous?.[metric] ?? summary[metric], summary[metric]]
}

function MetricChange({ metric, value, previous, locale }: {
  metric: MetricKey
  value: number
  previous: number | undefined
  locale: string
}) {
  const t = useT(analyticsChartMessages)
  if (previous === undefined) return <span className="analytics-kpi-baseline">{t('charts.noPrevious')}</span>

  const diff = value - previous
  const ai = metric === 'ai_resolved_pct'
  const comparative = !ai && previous !== 0
  const change = comparative ? diff / previous * 100 : diff
  const tone = diff === 0 || metric === 'total'
    ? 'neutral'
    : (ai && diff > 0) || (!ai && diff < 0)
      ? 'good'
      : metric === 'overdue' ? 'bad' : 'attention'
  const unit = ai ? ` ${t('charts.points')}` : comparative ? '%' : metric === 'avg_response_sec' ? ` ${t('charts.seconds')}` : ''
  const amount = new Intl.NumberFormat(locale, { maximumFractionDigits: 1, signDisplay: 'exceptZero' }).format(change)

  return (
    <>
      <span className="analytics-kpi-change" data-tone={tone}>
        <span>{amount}{unit}</span>
      </span>
      <span className="analytics-kpi-baseline">{t('charts.previous')}</span>
    </>
  )
}

export function AnalyticsKpis({ summary, previous, comparisonLoading }: {
  summary: AnalyticsSummary
  previous?: AnalyticsSummary
  comparisonLoading: boolean
}) {
  const t = useT(analyticsChartMessages)
  const { language } = useLanguage()
  const locale = localeCodes[language]

  return (
    <dl className="analytics-kpi-grid" aria-label={t('charts.kpiLabel')}>
      {metrics.map(({ key, label }) => (
        <GlassPanel
          key={key}
          className="analytics-kpi-card"
          variant="subtle"
          blur={false}
        >
          <dt className="analytics-kpi-label">
            {t(key === 'avg_response_sec' && summary.response_time_kind === 'median' ? 'charts.responseMedian' : label)}
          </dt>
          <dd className="analytics-kpi-main">
            <span className="analytics-kpi-number">
              <ViewportCounter value={summary[key]} locale={locale} />
              {key === 'ai_resolved_pct' && <span className="analytics-kpi-unit analytics-kpi-percent">%</span>}
              {key === 'avg_response_sec' && <span className="analytics-kpi-unit">{t('charts.seconds')}</span>}
            </span>
            <Sparkline values={metricTrend(key, summary, previous)} />
          </dd>
          <dd className="analytics-kpi-foot">
            {comparisonLoading ? (
              <div role="status" aria-label={t('common.loading')}><Skeleton className="analytics-kpi-comparison-loading" /></div>
            ) : <MetricChange metric={key} value={summary[key]} previous={previous?.[key]} locale={locale} />}
          </dd>
        </GlassPanel>
      ))}
    </dl>
  )
}
