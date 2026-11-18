import type { AnalyticsSummary } from '../../api/types'
import { analyticsChartMessages } from '../../i18n/analytics-charts'
import { localeCodes } from '../../i18n/locales'
import { useLanguage } from '../../i18n/useLanguage'
import { useT } from '../../i18n/useT'
import { GlassPanel } from '../ui'
import './analytics-charts.css'

const metrics = [
  { key: 'total', label: 'charts.total' },
  { key: 'ai_resolved_pct', label: 'charts.resolved' },
  { key: 'avg_response_sec', label: 'charts.response' },
  { key: 'overdue', label: 'charts.overdue' },
] as const

export function AnalyticsKpis({ summary }: { summary: AnalyticsSummary }) {
  const t = useT(analyticsChartMessages)
  const { language } = useLanguage()
  const numbers = new Intl.NumberFormat(localeCodes[language], { maximumFractionDigits: 1 })
  const percent = new Intl.NumberFormat(localeCodes[language], { style: 'percent', maximumFractionDigits: 1 })

  return (
    <dl className="simple-kpi-grid" aria-label={t('charts.kpiLabel')}>
      {metrics.map(({ key, label }) => (
        <GlassPanel key={key} className="simple-kpi" variant="subtle" blur={false}>
          <dt>{t(key === 'avg_response_sec' && summary.response_time_kind === 'median' ? 'charts.responseMedian' : label)}</dt>
          <dd data-urgent={key === 'overdue' && summary.overdue > 0}>
            {key === 'ai_resolved_pct' ? percent.format(summary[key] / 100) : numbers.format(summary[key])}
            {key === 'avg_response_sec' && <span> {t('charts.seconds')}</span>}
          </dd>
        </GlassPanel>
      ))}
    </dl>
  )
}
