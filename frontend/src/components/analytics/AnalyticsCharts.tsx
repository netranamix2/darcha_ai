import { CircleAlert } from 'lucide-react'
import { useId, useMemo } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { Area, AreaChart, Bar, BarChart, CartesianGrid, LabelList, Pie, PieChart, Rectangle, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { BarShapeProps, TooltipContentProps } from 'recharts'
import type { AnalyticsSummary, Channel, Level, Sentiment } from '../../api/types'
import { analyticsChartMessages } from '../../i18n/analytics-charts'
import { formatChatDate } from '../../i18n/chat'
import { localeCodes } from '../../i18n/locales'
import type { Language } from '../../i18n/locales'
import { useLanguage } from '../../i18n/useLanguage'
import { useT } from '../../i18n/useT'
import { localizeCaseRegion, localizeCaseTopic } from '../../lib/case-labels'
import { Button, Skeleton } from '../ui'
import './analytics-charts.css'

const levels = [
  { level: 'green', label: 'charts.green', color: 'var(--color-green)' },
  { level: 'yellow', label: 'charts.yellow', color: 'var(--color-amber)' },
  { level: 'red', label: 'charts.red', color: 'var(--color-red)' },
] as const satisfies ReadonlyArray<{ level: Level; label: keyof typeof analyticsChartMessages['uz-latn']; color: string }>

const sentimentSeries = [
  { key: 'positive', label: 'charts.positive', color: 'var(--color-primary)' },
  { key: 'neutral', label: 'charts.neutral', color: 'var(--color-secondary)' },
  { key: 'negative', label: 'charts.negative', color: 'var(--color-saffron)' },
] as const satisfies ReadonlyArray<{ key: Sentiment; label: keyof typeof analyticsChartMessages['uz-latn']; color: string }>

const channelNames = {
  telegram: 'charts.telegram',
  web: 'charts.web',
  instagram: 'charts.instagram',
} as const satisfies Record<Channel, keyof typeof analyticsChartMessages['uz-latn']>

type Rank = { key: string; label: string; count: number; growth?: number }
const chartGrid = 'var(--color-border)'
const axisTick = { fill: 'var(--color-secondary)', fontSize: 11, fontFamily: 'var(--font-mono)' }
const chartMargin = { top: 20, right: 8, bottom: 0, left: 0 }
const channelHeight = 228
const donutSize = 160
const sentimentHeight = 216
const rankHeight = 51
const rankMargin = { top: 0, right: 0, bottom: 0, left: 0 }
const tooltipStyle = { zIndex: 4 }

function ChartSection({ title, detail, className = '', children }: {
  title: string
  detail?: string
  className?: string
  children: ReactNode
}) {
  const titleId = useId()
  return (
    <section className={`analytics-chart-section ${className}`} aria-labelledby={titleId}>
      <header className="analytics-chart-heading">
        <h2 id={titleId}>{title}</h2>
        {detail && <span className="analytics-chart-detail">{detail}</span>}
      </header>
      {children}
    </section>
  )
}

function ChartTooltip({ active, payload, label, locale, dateLabel }: Pick<TooltipContentProps, 'active' | 'payload' | 'label'> & {
  locale: string
  dateLabel?: (value: string) => string
}) {
  if (!active || !payload?.length) return null
  const formatter = new Intl.NumberFormat(locale)
  const caption = label !== undefined ? dateLabel?.(String(label)) ?? String(label) : null

  return (
    <div className="analytics-chart-tooltip" role="status">
      {caption && <strong>{caption}</strong>}
      <ul>
        {payload.map((item, index) => (
          <li key={`${String(item.name)}-${index}`}>
            <span>{item.name}</span>
            <b>{typeof item.value === 'number' ? formatter.format(item.value) : item.value}</b>
          </li>
        ))}
      </ul>
    </div>
  )
}

function EmptyChart() {
  const t = useT(analyticsChartMessages)
  return <p className="analytics-chart-empty">{t('charts.empty')}</p>
}

function ChannelChart({ byChannel, locale }: { byChannel: AnalyticsSummary['by_channel']; locale: string }) {
  const t = useT(analyticsChartMessages)
  const names = Object.keys(channelNames) as Channel[]
  const data = names.map((channel) => ({ name: t(channelNames[channel]), count: byChannel.find((row) => row.channel === channel)?.count ?? 0 }))
  const formatter = new Intl.NumberFormat(locale, { notation: 'compact' })
  const title = t('charts.channels')

  return (
    <ChartSection title={title}>
      {data.some(({ count }) => count > 0) ? (
        <div className="analytics-channel-plot">
          <ResponsiveContainer width="100%" height={channelHeight} minWidth={0}>
            <BarChart accessibilityLayer aria-label={title} data={data} margin={chartMargin} barCategoryGap="25%">
              <CartesianGrid vertical={false} stroke={chartGrid} />
              <XAxis dataKey="name" tick={axisTick} tickLine={false} axisLine={false} tickMargin={9} interval={0} />
              <YAxis tick={axisTick} tickLine={false} axisLine={false} width={35} tickCount={4} allowDecimals={false}
                tickFormatter={(value: number) => formatter.format(value)} />
              <Tooltip content={(props) => <ChartTooltip {...props} locale={locale} />} cursor={{ fill: 'var(--color-row)' }} wrapperStyle={tooltipStyle} isAnimationActive={false} />
              <Bar className="analytics-chart-columns" name={t('charts.total')} dataKey="count" fill="var(--color-primary)" radius={[1, 1, 0, 0]} maxBarSize={62} isAnimationActive={false}>
                <LabelList dataKey="count" position="top" fill="var(--color-text)" fontFamily="var(--font-mono)" fontSize={12}
                  formatter={(value) => formatter.format(Number(value))} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      ) : <EmptyChart />}
    </ChartSection>
  )
}

function LevelChart({ summary, locale }: { summary: AnalyticsSummary; locale: string }) {
  const t = useT(analyticsChartMessages)
  const title = t('charts.levels')
  const formatter = new Intl.NumberFormat(locale)
  const data = levels.map(({ level, label, color }) => ({
    level,
    name: t(label),
    count: summary.by_level.find((row) => row.level === level)?.count ?? 0,
    fill: color,
  }))
  return (
    <ChartSection title={title}>
      {data.some(({ count }) => count > 0) ? (
        <div className="analytics-donut-layout">
          <div className="analytics-donut-plot">
            <PieChart width={donutSize} height={donutSize} accessibilityLayer aria-label={title}>
              <Pie className="analytics-chart-ring" data={data} dataKey="count" nameKey="name" startAngle={90} endAngle={-270}
                innerRadius={59} outerRadius={76} paddingAngle={2} cornerRadius={0} stroke="none" isAnimationActive={false} />
              <Tooltip content={(props) => <ChartTooltip {...props} locale={locale} />} wrapperStyle={tooltipStyle} isAnimationActive={false} />
            </PieChart>
            <div className="analytics-donut-center">
              <strong>{formatter.format(summary.ai_resolved_pct)}%</strong>
              <span>{t('charts.shortAi')}</span>
            </div>
          </div>
          <ul className="analytics-chart-levels">
            {data.map(({ level, name, count, fill }) => (
              <li key={level}>
                <span className="analytics-chart-dot" style={{ '--analytics-series-color': fill } as CSSProperties} aria-hidden="true" />
                <span>{name}</span>
                <strong>{formatter.format(count)}</strong>
              </li>
            ))}
          </ul>
        </div>
      ) : <EmptyChart />}
    </ChartSection>
  )
}

function SentimentChart({ data, language, loading, onRetry }: {
  data: AnalyticsSummary['sentiment_daily']
  language: Language
  loading: boolean
  onRetry?: () => void
}) {
  const t = useT(analyticsChartMessages)
  const id = useId()
  const title = t('charts.sentiment')
  const locale = localeCodes[language]
  const formatDate = useMemo(() => new Intl.DateTimeFormat(locale, { month: 'numeric', day: 'numeric', timeZone: 'Asia/Tashkent' }), [locale])
  const numeric = new Intl.NumberFormat(locale, { notation: 'compact' })
  const chronological = useMemo(() => [...data].sort((a, b) => a.date.localeCompare(b.date)).slice(-14), [data])

  function tickDate(value: string) {
    const date = new Date(value)
    return Number.isNaN(date.valueOf()) ? value : formatDate.format(date)
  }

  return (
    <ChartSection title={title} detail={t('charts.last14')} className="analytics-sentiment-section">
      {onRetry && (
        <div className="analytics-load-error" role="alert">
          <CircleAlert size={18} aria-hidden="true" />
          <p>{t('charts.sentimentError')}</p>
          <Button variant="secondary" size="sm" onClick={onRetry}>{t('charts.retry')}</Button>
        </div>
      )}
      {loading ? (
        <div role="status" aria-label={t('common.loading')}><Skeleton className="analytics-loading-chart" /></div>
      ) : chronological.some(({ positive, neutral, negative }) => positive + neutral + negative > 0) ? (
        <>
          <div className="analytics-sentiment-plot">
            <ResponsiveContainer width="100%" height={sentimentHeight} minWidth={0}>
              <AreaChart accessibilityLayer aria-label={title} data={chronological} margin={chartMargin}>
                <defs>
                  {sentimentSeries.map(({ key, color }) => (
                    <linearGradient key={key} id={`${id}-${key}`} x1="0" x2="0" y1="0" y2="1">
                      <stop offset="0%" stopColor={color} stopOpacity={0.16} />
                      <stop offset="100%" stopColor={color} stopOpacity={0.02} />
                    </linearGradient>
                  ))}
                </defs>
                <CartesianGrid vertical={false} stroke={chartGrid} />
                <XAxis dataKey="date" tickFormatter={tickDate} minTickGap={26} tick={axisTick} tickMargin={10} tickLine={false} axisLine={false} />
                <YAxis tick={axisTick} tickMargin={4} tickLine={false} axisLine={false} width={31} tickCount={4} allowDecimals={false}
                  tickFormatter={(value: number) => numeric.format(value)} />
                <Tooltip content={(props) => <ChartTooltip {...props} dateLabel={(value) => formatChatDate(new Date(value), language) ?? value} locale={locale} />}
                  cursor={{ stroke: 'var(--color-secondary)', strokeDasharray: '3 4', opacity: 0.7 }} wrapperStyle={tooltipStyle} isAnimationActive={false} />
                {sentimentSeries.map(({ key, label, color }) => (
                  <Area key={key} className="analytics-chart-area" type="monotone" dataKey={key} name={t(label)} stackId="sentiment"
                    stroke={color} strokeWidth={1.5} fill={`url(#${id}-${key})`} isAnimationActive={false}
                    activeDot={{ r: 4, fill: color, stroke: 'var(--color-deep)', strokeWidth: 2 }} />
                ))}
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <ul className="analytics-sentiment-legend">
            {sentimentSeries.map(({ key, label, color }) => (
              <li key={key}>
                <span className="analytics-chart-dot" style={{ '--analytics-series-color': color } as CSSProperties} aria-hidden="true" />{t(label)}
              </li>
            ))}
          </ul>
        </>
      ) : !onRetry && <EmptyChart />}
    </ChartSection>
  )
}

function RankBar({ x, y, width, height, fill }: BarShapeProps) {
  return <Rectangle className="analytics-rank-mark" x={x} y={y + 11} width={width} height={height} fill={fill} radius={4} />
}

function RankedBars({ rows, title, locale, unspecified, region = false }: {
  rows: Rank[]
  title: string
  locale: string
  unspecified?: number
  region?: boolean
}) {
  const t = useT(analyticsChartMessages)
  const format = new Intl.NumberFormat(locale)
  const growthFormat = new Intl.NumberFormat(locale, { maximumFractionDigits: 1, signDisplay: 'exceptZero' })
  return (
    <ChartSection title={title} className={region ? 'analytics-ranking-regions' : undefined}>
      {rows.length > 0 ? (
        <div className="analytics-ranking" tabIndex={region && rows.length > 5 ? 0 : undefined} style={{ '--analytics-rank-height': `${rankHeight}px` } as CSSProperties}>
          <div className="analytics-ranking-plot">
            <ResponsiveContainer width="100%" height={rows.length * rankHeight} minWidth={0}>
              <BarChart accessibilityLayer aria-label={title} layout="vertical" data={rows} margin={rankMargin}>
                <XAxis hide type="number" domain={[0, (max: number) => Math.max(1, max)]} />
                <YAxis hide type="category" dataKey="label" />
                <Tooltip content={(props) => <ChartTooltip {...props} locale={locale} />} cursor={{ fill: 'var(--color-row)' }} wrapperStyle={tooltipStyle} isAnimationActive={false} />
                <Bar dataKey="count" name={t('charts.total')} shape={RankBar} fill="var(--color-primary)" barSize={3} isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <ol className="analytics-ranking-labels">
            {rows.map(({ key, label, count, growth }) => (
              <li key={key}>
                <span className="analytics-ranking-name" title={label}>{label}</span>
                {growth !== undefined && (
                  <span className="analytics-ranking-growth" title={t('charts.previous')}>
                    {growthFormat.format(growth)}%
                  </span>
                )}
                <strong>{format.format(count)}</strong>
              </li>
            ))}
          </ol>
        </div>
      ) : !unspecified && <EmptyChart />}
      {unspecified !== undefined && (
        <div className="analytics-ranking-unspecified">
          <span>{t('charts.unspecified')}</span>
          <strong>{format.format(unspecified)}</strong>
        </div>
      )}
    </ChartSection>
  )
}

export function AnalyticsCharts({ summary, previous, sentiment, sentimentLoading, onSentimentRetry }: {
  summary: AnalyticsSummary
  previous?: AnalyticsSummary
  sentiment?: AnalyticsSummary['sentiment_daily']
  sentimentLoading: boolean
  onSentimentRetry?: () => void
}) {
  const t = useT(analyticsChartMessages)
  const { language } = useLanguage()
  const locale = localeCodes[language]
  const previousTopics = new Map(previous?.top_topics.map(({ topic, count }) => [topic, count]))
  const topics = [...summary.top_topics].sort((a, b) => b.count - a.count).slice(0, 5).map((row) => {
    const before = previousTopics.get(row.topic)
    const growth = row.growth_pct ?? (before ? ((row.count - before) / before) * 100 : undefined)
    return { key: row.topic, label: localizeCaseTopic(row.topic, language), count: row.count, growth }
  })
  const regions = summary.by_region.flatMap(({ region, count }) => region?.trim()
    ? [{ key: region, label: localizeCaseRegion(region, language), count }]
    : []).sort((a, b) => b.count - a.count)
  const unspecified = summary.by_region.filter(({ region }) => !region?.trim()).reduce((total, { count }) => total + count, 0)

  return (
    <div className="analytics-charts-grid">
      <ChannelChart byChannel={summary.by_channel} locale={locale} />
      <LevelChart summary={summary} locale={locale} />
      <SentimentChart data={sentiment ?? []} language={language} loading={sentimentLoading} onRetry={onSentimentRetry} />
      <RankedBars rows={topics} title={t('charts.topics')} locale={locale} />
      <RankedBars rows={regions} title={t('charts.regions')} locale={locale} unspecified={unspecified} region />
    </div>
  )
}
