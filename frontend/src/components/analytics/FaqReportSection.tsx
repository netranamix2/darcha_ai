import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { getFaqReport, subscribeToCaseChanges } from '../../api/client'
import { faqReportMessages } from '../../i18n/faq-report'
import { localeCodes } from '../../i18n/locales'
import { panelSimpleMessages } from '../../i18n/panel-simple'
import { useLanguage } from '../../i18n/useLanguage'
import { useT } from '../../i18n/useT'
import { faqReportId } from '../../lib/panel-sections'
import { Button, GlassPanel, Skeleton } from '../ui'

const reportKey = ['faq', 'week'] as const

export function FaqReportSection() {
  const t = useT(faqReportMessages)
  const simple = useT(panelSimpleMessages)
  const { language } = useLanguage()
  const client = useQueryClient()
  const report = useQuery({ queryKey: reportKey, queryFn: () => getFaqReport('week'), staleTime: 60_000, retry: false })
  useEffect(() => subscribeToCaseChanges((kind) => {
    if (kind === 'report' || kind === 'reset') void client.invalidateQueries({ queryKey: reportKey })
  }), [client])

  const format = new Intl.NumberFormat(localeCodes[language])
  const percent = new Intl.NumberFormat(localeCodes[language], { style: 'percent', signDisplay: 'exceptZero' })
  const clusters = [...(report.data?.clusters ?? [])].sort((first, second) => second.count - first.count)

  return (
    <section id={faqReportId} aria-label={simple('simple.faq')}>
      {report.isPending ? (
        <div className="simple-panel-state" role="status" aria-label={t('faq.loading')}><Skeleton /><Skeleton /></div>
      ) : report.isError ? (
        <GlassPanel className="simple-panel-state" blur={false} role="alert">
          <p>{t('faq.loadError')}</p>
          <Button variant="secondary" loading={report.isFetching} onClick={() => void report.refetch()}>{t('faq.retry')}</Button>
        </GlassPanel>
      ) : clusters.length === 0 ? (
        <GlassPanel className="simple-panel-state" blur={false}><p>{t('faq.noClusters')}</p></GlassPanel>
      ) : (
        <ul className="simple-faq-grid">
          {clusters.map((cluster) => {
            const localized = language === 'uz-latn' ? undefined : cluster.translations?.[language]
            const title = localized?.label ?? (language === 'ru' ? cluster.label_ru : undefined) ?? cluster.label
            const growth = percent.format(cluster.growth_pct / 100)
            return (
              <li key={cluster.id}>
                <GlassPanel className="simple-faq-cluster" variant="subtle" blur={false}>
                  <h2>{title}</h2>
                  <div className="simple-faq-metrics">
                    <span><strong>{format.format(cluster.count)}</strong> {t('faq.count')}</span>
                    <span aria-label={t('faq.growth').replace('{value}', growth)}>{growth}</span>
                  </div>
                  {cluster.no_answer_in_kb && <span className="simple-faq-gap">{simple('simple.noAnswer')}</span>}
                </GlassPanel>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
