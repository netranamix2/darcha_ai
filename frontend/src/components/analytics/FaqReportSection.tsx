import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  BookOpen, CalendarDays, Check, ChevronDown,
  Clock3, Copy, FileText, Inbox, Layers3, PenLine, Printer, RefreshCw, Send,
  TriangleAlert,
} from 'lucide-react'
import { useEffect, useId, useState } from 'react'
import type { CSSProperties } from 'react'
import { ApiError, getFaqReport, runFaqReport, subscribeToCaseChanges } from '../../api/client'
import type { FaqReport } from '../../api/types'
import { faqReportMessages } from '../../i18n/faq-report'
import { localeCodes } from '../../i18n/locales'
import { useLanguage } from '../../i18n/useLanguage'
import { useT } from '../../i18n/useT'
import { analyticsTimestamp } from '../../lib/analytics-date'
import { Button, GlassPanel, Skeleton } from '../ui'
import './faq-report.css'

const reportKey = ['faq', 'week'] as const
const timeZone = 'Asia/Tashkent'
const calendarDate = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: 'numeric', day: 'numeric' })
const reportPhases = [
  { label: 'faq.collecting', Icon: Inbox },
  { label: 'faq.clustering', Icon: Layers3 },
  { label: 'faq.writing', Icon: PenLine },
] as const

type Cluster = FaqReport['clusters'][number]
type CopyStatus = 'idle' | 'copied' | 'error'

function getIsoWeek(value: string) {
  const timestamp = new Date(value)
  if (!Number.isFinite(timestamp.getTime())) return null

  const parts = calendarDate.formatToParts(timestamp)
  const year = Number(parts.find(({ type }) => type === 'year')?.value)
  const month = Number(parts.find(({ type }) => type === 'month')?.value)
  const day = Number(parts.find(({ type }) => type === 'day')?.value)
  const thursday = new Date(Date.UTC(year, month - 1, day))
  thursday.setUTCDate(thursday.getUTCDate() + 4 - (thursday.getUTCDay() || 7))
  const weekYear = thursday.getUTCFullYear()
  const week = Math.ceil((thursday.getTime() - Date.UTC(weekYear, 0, 1) + 86_400_000) / 604_800_000)
  return { year: weekYear, week }
}

function ReportProgress() {
  const t = useT(faqReportMessages)
  const [step, setStep] = useState(0)

  useEffect(() => {
    const clusterTimer = window.setTimeout(() => setStep(1), 280)
    const writeTimer = window.setTimeout(() => setStep(2), 560)
    return () => {
      window.clearTimeout(clusterTimer)
      window.clearTimeout(writeTimer)
    }
  }, [])

  return (
    <div className="faq-progress">
      <p className="sr-only" role="status">{t(reportPhases[step].label)}</p>
      <ol aria-hidden="true">
        {reportPhases.map(({ label, Icon }, index) => (
          <li key={label} data-phase={index === step ? 'current' : index < step ? 'complete' : 'upcoming'}>
            <span>{index < step ? <Check /> : <Icon />}</span>
            {t(label)}
          </li>
        ))}
      </ol>
    </div>
  )
}

function Explainer({ draft }: { draft: string }) {
  const t = useT(faqReportMessages)
  const [expanded, setExpanded] = useState(false)
  const [status, setStatus] = useState<CopyStatus>('idle')
  const draftId = useId()

  async function copyDraft() {
    try {
      await navigator.clipboard.writeText(draft)
      setStatus('copied')
    } catch {
      setStatus('error')
    }
  }

  return (
    <div className="faq-draft" data-expanded={expanded}>
      <button
        type="button"
        className="faq-draft-toggle"
        aria-controls={draftId}
        aria-expanded={expanded}
        onClick={() => setExpanded((open) => !open)}
      >
        <FileText aria-hidden="true" />
        {t('faq.draft')}
        <ChevronDown className="faq-draft-chevron" aria-hidden="true" />
      </button>
      <div className="faq-draft-preview" id={draftId}>
        <div className="faq-preview-header">
          <h4><Send aria-hidden="true" /> {t('faq.preview')}</h4>
          <Button size="sm" variant="ghost" className="faq-copy" onClick={() => void copyDraft()}>
            {status === 'copied' ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
            {t(status === 'copied' ? 'faq.copied' : 'faq.copy')}
          </Button>
        </div>
        <p className="faq-preview-text">{draft}</p>
        {status === 'error' && <p className="faq-copy-feedback" role="status">{t('faq.copyError')}</p>}
        {status === 'copied' && <span role="status" className="sr-only">{t('faq.copied')}</span>}
      </div>
    </div>
  )
}

function ClusterCard({ cluster, index }: { cluster: Cluster; index: number }) {
  const { language } = useLanguage()
  const t = useT(faqReportMessages)
  const titleId = useId()
  const locale = localeCodes[language]
  const localized = language === 'uz-latn' ? undefined : cluster.translations?.[language]
  const title = localized?.label ?? (language === 'ru' ? cluster.label_ru : undefined) ?? cluster.label
  const confusion = localized?.confusion ?? cluster.confusion
  const draft = localized?.explainer_draft ?? cluster.explainer_draft
  const percent = new Intl.NumberFormat(locale, { style: 'percent', signDisplay: 'exceptZero', maximumFractionDigits: 1 })
  const count = new Intl.NumberFormat(locale).format(cluster.count)
  const growth = percent.format(cluster.growth_pct / 100)
  const examples = cluster.examples.slice(0, 2)
  const effect = cluster.effect_pct

  return (
    <article
      className="faq-cluster"
      aria-labelledby={titleId}
      style={{ '--faq-stagger': `${Math.min(index, 6) * 42}ms` } as CSSProperties}
    >
      <GlassPanel blur={false} className="faq-cluster-panel">
        <div className="faq-cluster-header">
          <h3 id={titleId}>{title}</h3>
          <span className="faq-growth" role="img" aria-label={t('faq.growth').replace('{value}', growth)}>
            {growth}
          </span>
        </div>
        <div className="faq-cluster-metric">
          <strong>{count}</strong>
          <span>{t('faq.count')}</span>
        </div>
        {cluster.no_answer_in_kb && (
          <span className="faq-knowledge-gap">
            <TriangleAlert aria-hidden="true" /> {t('faq.noKnowledge')}
          </span>
        )}
        {(confusion || examples.length > 0) && (
          <div className="faq-cluster-evidence">
            {confusion && (
              <div>
                <h4>{t('faq.unclear')}</h4>
                <p>{confusion}</p>
              </div>
            )}
            {examples.length > 0 && (
              <div>
                <h4>{t('faq.examples')}</h4>
                <ul className="faq-examples">
                  {examples.map((example, exampleIndex) => (
                    <li key={exampleIndex}>
                      <q dir="auto">{example}</q>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
        {effect != null && (
          <p className="faq-effect">
            {t('faq.effect').replace('{value}', percent.format(effect / 100))}
          </p>
        )}
        {draft && <Explainer draft={draft} />}
      </GlassPanel>
    </article>
  )
}

export function FaqReportSection() {
  const { language } = useLanguage()
  const t = useT(faqReportMessages)
  const client = useQueryClient()
  const titleId = useId()
  const reportQuery = useQuery({ queryKey: reportKey, queryFn: () => getFaqReport('week'), staleTime: 60_000, retry: false })
  const rebuild = useMutation({
    mutationFn: async () => {
      await runFaqReport()
      return getFaqReport('week')
    },
    onSuccess: async (report) => {
      await client.cancelQueries({ queryKey: reportKey })
      client.setQueryData(reportKey, report)
    },
  })

  useEffect(() => subscribeToCaseChanges((kind) => {
    if (kind === 'report' || kind === 'reset') void client.invalidateQueries({ queryKey: reportKey })
  }), [client])

  const report = reportQuery.data
  const clusters = report?.clusters.slice().sort((first, second) => second.count - first.count) ?? []
  const week = report ? getIsoWeek(report.from ?? report.generated_at) : null
  const period = week ? t('faq.week').replace('{year}', String(week.year)).replace('{week}', String(week.week)) : ''
  const generated = report ? new Date(report.generated_at) : null
  const generatedLabel = generated && Number.isFinite(generated.getTime())
    ? analyticsTimestamp(generated.getTime(), language)
    : ''
  const missing = reportQuery.error instanceof ApiError && reportQuery.error.status === 404

  return (
    <section className="faq-report" aria-labelledby={titleId} data-printable={report ? 'true' : undefined}>
      <header className="faq-report-header">
        <div>
          <h2 id={titleId}><BookOpen aria-hidden="true" /> {t('faq.title')}</h2>
          {(period || generatedLabel) && (
            <div className="faq-report-meta">
              {period && <span><CalendarDays aria-hidden="true" /> {period}</span>}
              {generatedLabel && (
                <span><Clock3 aria-hidden="true" /> {t('faq.generated')} <time dateTime={report?.generated_at}>{generatedLabel}</time></span>
              )}
            </div>
          )}
        </div>
        <div className="faq-report-actions">
          <Button variant="secondary" size="sm" disabled={!report || rebuild.isPending} onClick={() => window.print()}>
            <Printer aria-hidden="true" /> {t('faq.print')}
          </Button>
          <Button size="sm" loading={rebuild.isPending} disabled={reportQuery.isLoading} onClick={() => rebuild.mutate()}>
            {!rebuild.isPending && <RefreshCw aria-hidden="true" />}
            {t('faq.rebuild')}
          </Button>
        </div>
      </header>

      {rebuild.isPending && <ReportProgress />}
      {rebuild.isError && (
        <div className="faq-report-feedback faq-report-error" role="alert">
          <p>{t('faq.rebuildError')}</p>
          <Button variant="secondary" size="sm" onClick={() => rebuild.mutate()}>{t('faq.retry')}</Button>
        </div>
      )}

      {reportQuery.isPending && (
        <div className="faq-report-grid faq-report-loading" role="status">
          <span className="sr-only">{t('faq.loading')}</span>
          <Skeleton /><Skeleton />
        </div>
      )}
      {reportQuery.isError && !rebuild.isPending && (!missing || !report) && (
        <GlassPanel blur={false} className="faq-report-feedback" role={missing ? 'status' : 'alert'}>
          <span>{t(missing ? 'faq.noReport' : 'faq.loadError')}</span>
          {!missing && <Button variant="secondary" size="sm" onClick={() => void reportQuery.refetch()}>{t('faq.retry')}</Button>}
        </GlassPanel>
      )}
      {report && (clusters.length ? (
        <div key={report.generated_at} className="faq-report-grid" aria-busy={rebuild.isPending}>
          {clusters.map((cluster, index) => <ClusterCard key={cluster.id} cluster={cluster} index={index} />)}
        </div>
      ) : <GlassPanel blur={false} className="faq-report-feedback">{t('faq.noClusters')}</GlassPanel>)}
    </section>
  )
}
