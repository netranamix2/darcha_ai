import type { AnalyticsSummary } from '../../api/types'
import { analyticsChartMessages } from '../../i18n/analytics-charts'
import { localeCodes } from '../../i18n/locales'
import { useLanguage } from '../../i18n/useLanguage'
import { useT } from '../../i18n/useT'
import { Skeleton, ViewportCounter } from '../ui'
import './analytics-charts.css'

const metrics = [
  { key: 'total', label: 'charts.total' },
  { key: 'ai_resolved_pct', label: 'charts.resolved' },
  { key: 'avg_response_sec', label: 'charts.response' },
  { key: 'overdue', label: 'charts.overdue' },
] as const

type MetricKey = (typeof metrics)[number]['key']

function MetricChange({ metric, value, previous, locale }: {
  metric: MetricKey
  value: number
  previous: number | undefined
  locale: string
}) {
  const t = useT(analyticsChartMessages)
  if (previous === undefined) return <span>{t('charts.noPrevious')}</span>

  const difference = value - previous
  const usesPoints = metric === 'ai_resolved_pct'
  const usesPercent = !usesPoints && previous !== 0
  const change = usesPercent ? difference / previous * 100 : difference
  const unit = usesPoints ? ` ${t('charts.points')}` : usesPercent ? '%' : metric === 'avg_response_sec' ? ` ${t('charts.seconds')}` : ''
  const amount = new Intl.NumberFormat(locale, { maximumFractionDigits: 1, signDisplay: 'exceptZero' }).format(change)

  return (
    <>
      <span className="analytics-kpi-change">{amount}{unit}</span>
      <span>{t('charts.previous')}</span>
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
        <div key={key} className="analytics-kpi-card">
          <dt className="analytics-kpi-label" title={key === 'overdue' ? t('charts.overdueSnapshot') : undefined}>
            {key === 'overdue' && summary.overdue > 0 && <span className="analytics-kpi-overdue-dot" aria-hidden="true" />}
            {t(key === 'avg_response_sec' && summary.response_time_kind === 'median' ? 'charts.responseMedian' : label)}
          </dt>
          <dd className="analytics-kpi-number">
            <ViewportCounter value={summary[key]} locale={locale} />
            {key === 'ai_resolved_pct' && <span className="analytics-kpi-unit analytics-kpi-percent">%</span>}
            {key === 'avg_response_sec' && <span className="analytics-kpi-unit">{t('charts.seconds')}</span>}
          </dd>
          <dd className="analytics-kpi-foot">
            {comparisonLoading ? (
              <div role="status" aria-label={t('common.loading')}><Skeleton className="analytics-kpi-comparison-loading" /></div>
            ) : <MetricChange metric={key} value={summary[key]} previous={previous?.[key]} locale={locale} />}
          </dd>
        </div>
      ))}
    </dl>
  )
}
