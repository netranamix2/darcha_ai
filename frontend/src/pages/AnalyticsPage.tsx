import { CircleAlert, Clock3 } from 'lucide-react'
import { LayoutGroup, motion, useReducedMotion } from 'motion/react'
import { lazy, Suspense, useState } from 'react'
import { AnalyticsKpis } from '../components/analytics/AnalyticsKpis'
import { AnalyticsOperations } from '../components/analytics/AnalyticsOperations'
import { Button, GlassPanel, Skeleton } from '../components/ui'
import { useAnalytics } from '../hooks/useAnalytics'
import { useTicketClock } from '../hooks/useTicketClock'
import { analyticsMessages } from '../i18n/analytics'
import { useLanguage } from '../i18n/useLanguage'
import { useT } from '../i18n/useT'
import { analyticsTimestamp } from '../lib/analytics-date'
import './analytics-page.css'

const AnalyticsCharts = lazy(async () => ({ default: (await import('../components/analytics/AnalyticsCharts')).AnalyticsCharts }))
const FaqReportSection = lazy(async () => ({ default: (await import('../components/analytics/FaqReportSection')).FaqReportSection }))
const periods = [7, 14, 30] as const
const loadingMetrics = Array.from({ length: 4 }, (_, index) => index)
type Period = (typeof periods)[number]

export default function AnalyticsPage() {
  const [days, setDays] = useState<Period>(7)
  const t = useT(analyticsMessages)
  const { language } = useLanguage()
  const reducedMotion = useReducedMotion()
  const now = useTicketClock()
  const { current, previous, lastFourteen } = useAnalytics(days, now)
  const summary = current.data

  return (
    <section className="analytics-page" aria-labelledby="analytics-title">
      <div className="analytics-screen-only">
        <header className="analytics-heading">
          <div>
            <h1 id="analytics-title">{t('panel.analytics')}</h1>
            <p>{t('analytics.subtitle')}</p>
          </div>
          <div className="analytics-heading-controls">
            <LayoutGroup id="analytics-period">
              <div role="group" aria-label={t('analytics.period')} className="analytics-period">
                {periods.map((value) => (
                  <button key={value} type="button" aria-pressed={value === days} onClick={() => setDays(value)}>
                    {value === days && (
                      <motion.span
                        className="analytics-period-marker"
                        aria-hidden="true"
                        layoutId={reducedMotion ? undefined : 'selected'}
                        transition={{ duration: 0.2, ease: 'easeOut' }}
                      />
                    )}
                    {t('analytics.periodDays').replace('{days}', String(value))}
                  </button>
                ))}
              </div>
            </LayoutGroup>
            {summary && (
              <p className="analytics-last-updated">
                <Clock3 aria-hidden="true" size={14} />
                {t('analytics.updated')}
                <time dateTime={new Date(current.dataUpdatedAt).toISOString()}>{analyticsTimestamp(current.dataUpdatedAt, language)}</time>
              </p>
            )}
          </div>
        </header>
        {current.isError && (
          <GlassPanel blur={false} className="analytics-load-error" role="alert">
            <CircleAlert aria-hidden="true" size={21} />
            <p>{t('analytics.loadError')}</p>
            <Button variant="secondary" size="sm" onClick={() => void current.refetch()}>{t('analytics.retry')}</Button>
          </GlassPanel>
        )}
        {summary ? (
          <>
            {previous.isError && (
              <GlassPanel blur={false} className="analytics-load-error" role="alert">
                <CircleAlert aria-hidden="true" size={21} />
                <p>{t('analytics.comparisonError')}</p>
                <Button variant="secondary" size="sm" onClick={() => void previous.refetch()}>{t('analytics.retry')}</Button>
              </GlassPanel>
            )}
            <AnalyticsKpis summary={summary} previous={previous.data} comparisonLoading={previous.isPending} />
            <Suspense fallback={<div role="status" aria-label={t('common.loading')}><Skeleton className="analytics-loading-chart" /></div>}>
              <AnalyticsCharts
                summary={summary}
                previous={previous.data}
                sentiment={lastFourteen.data?.sentiment_daily}
                sentimentLoading={lastFourteen.isPending}
                onSentimentRetry={lastFourteen.isError ? () => void lastFourteen.refetch() : undefined}
              />
            </Suspense>
          </>
        ) : current.isPending && (
          <div className="analytics-loading" role="status" aria-label={t('common.loading')}>
            <div>
              {loadingMetrics.map((metric) => <Skeleton key={metric} className="analytics-loading-metric" />)}
            </div>
            <Skeleton className="analytics-loading-chart" />
          </div>
        )}
        <AnalyticsOperations summary={summary} days={days} />
      </div>
      <Suspense fallback={<div role="status" aria-label={t('common.loading')}><Skeleton className="analytics-loading-chart" /></div>}>
        <FaqReportSection />
      </Suspense>
    </section>
  )
}
