import { lazy, Suspense, useState } from 'react'
import { useLocation, useSearchParams } from 'react-router'
import { LeadershipView } from '../components/analytics/LeadershipView'
import { Button, GlassPanel, Skeleton, Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui'
import { useAnalytics } from '../hooks/useAnalytics'
import { useTicketClock } from '../hooks/useTicketClock'
import { analyticsMessages } from '../i18n/analytics'
import { panelSimpleMessages } from '../i18n/panel-simple'
import { useT } from '../i18n/useT'
import { faqReportId } from '../lib/panel-sections'
import './analytics-page.css'

const Faq = lazy(async () => ({ default: (await import('../components/analytics/FaqReportSection')).FaqReportSection }))
const periods = [7, 14, 30] as const

function ReportOverview() {
  const [days, setDays] = useState<(typeof periods)[number]>(7)
  const t = useT(analyticsMessages)
  const simple = useT(panelSimpleMessages)
  const now = useTicketClock()
  const { current } = useAnalytics(days, now)
  const summary = current.data

  return (
    <div className="simple-report-overview">
      <div className="simple-report-period" role="group" aria-label={t('analytics.period')}>
        {periods.map((period) => (
          <Button key={period} variant={days === period ? 'secondary' : 'ghost'} aria-pressed={days === period}
            onClick={() => setDays(period)}>{t('analytics.periodDays').replace('{days}', String(period))}</Button>
        ))}
      </div>
      {current.isError && (
        <GlassPanel blur={false} className="simple-panel-state" role="alert">
          <p>{t('analytics.loadError')}</p>
          <Button variant="secondary" loading={current.isFetching} onClick={() => void current.refetch()}>{t('analytics.retry')}</Button>
        </GlassPanel>
      )}
      {current.isPending ? (
        <div className="simple-panel-state" role="status" aria-label={t('common.loading')}><Skeleton /><Skeleton /></div>
      ) : summary && (
        <>
          {summary.total === 0 && <p className="simple-report-note">{simple('simple.emptySummary')}</p>}
          <LeadershipView summary={summary} days={days} now={now} />
        </>
      )}
    </div>
  )
}

export default function AnalyticsPage() {
  const t = useT(panelSimpleMessages)
  const tAnalytics = useT(analyticsMessages)
  const [params, setParams] = useSearchParams()
  const { hash } = useLocation()
  const active = params.get('tab') === 'faq' || (!params.has('tab') && hash === '#' + faqReportId) ? 'faq' : 'overview'

  return (
    <section className="simple-panel-page" aria-labelledby="analytics-title">
      <header className="simple-panel-heading">
        <h1 id="analytics-title">{t('panel.analytics')}</h1>
        <p>{tAnalytics('analytics.subtitle')}</p>
      </header>
      <Tabs value={active} onValueChange={(value) => setParams({ tab: value }, { replace: true })}>
        <TabsList className="simple-panel-tabs" aria-label={t('panel.analytics')}>
          <TabsTrigger value="overview">{t('simple.overview')}</TabsTrigger>
          <TabsTrigger value="faq">{t('simple.faq')}</TabsTrigger>
        </TabsList>
        <TabsContent value="overview"><ReportOverview /></TabsContent>
        <TabsContent value="faq">
          <Suspense fallback={<div className="simple-panel-state" role="status" aria-label={t('common.loading')}><Skeleton /></div>}>
            <Faq />
          </Suspense>
        </TabsContent>
      </Tabs>
    </section>
  )
}
