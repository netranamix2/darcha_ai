import { ArrowDownRight, ArrowRight, ArrowUpRight, BarChart3, ChartNoAxesCombined, ChartPie, MapPin, MessagesSquare } from 'lucide-react'
import { useId, useMemo } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { Area, AreaChart, Bar, BarChart, CartesianGrid, LabelList, Pie, PieChart, Rectangle, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { BarShapeProps, TooltipContentProps } from 'recharts'
import type { AnalyticsSummary, Channel, Level, Sentiment } from '../../api/types'
import { analyticsChartMessages, analyticsTopicNames } from '../../i18n/analytics-charts'
import { chatMessages } from '../../i18n/chat'
import { localeCodes } from '../../i18n/locales'
import type { Language } from '../../i18n/locales'
import { useLanguage } from '../../i18n/useLanguage'
import { useT } from '../../i18n/useT'
import { GlassPanel } from '../ui'
import './analytics-charts.css'

const levels = [
  { level: 'green', label: 'charts.green', color: 'var(--color-green)' },
  { level: 'yellow', label: 'charts.yellow', color: 'var(--color-amber)' },
  { level: 'red', label: 'charts.red', color: 'var(--color-red)' },
] as const satisfies ReadonlyArray<{ level: Level; label: keyof typeof analyticsChartMessages['uz-latn']; color: string }>

const sentimentSeries = [
  { key: 'positive', label: 'charts.positive', color: 'var(--color-green)' },
  { key: 'neutral', label: 'charts.neutral', color: 'var(--color-focus)' },
  { key: 'negative', label: 'charts.negative', color: 'var(--color-red)' },
] as const satisfies ReadonlyArray<{ key: Sentiment; label: keyof typeof analyticsChartMessages['uz-latn']; color: string }>

const channelNames = {
  telegram: 'charts.telegram',
  web: 'charts.web',
  instagram: 'charts.instagram',
} as const satisfies Record<Channel, keyof typeof analyticsChartMessages['uz-latn']>

const regionKeys = [
  'conversation.regionAndijan', 'conversation.regionBukhara', 'conversation.regionFergana', 'conversation.regionJizzakh',
  'conversation.regionKarakalpakstan', 'conversation.regionKashkadarya', 'conversation.regionKhorezm', 'conversation.regionNamangan',
  'conversation.regionNavoi', 'conversation.regionSamarkand', 'conversation.regionSirdarya', 'conversation.regionSurkhandarya',
  'conversation.regionTashkent', 'conversation.regionTashkentCity',
] as const

type Rank = { key: string; label: string; count: number; growth?: number }
const chartGrid = 'var(--color-border)'
const axisTick = { fill: 'var(--color-secondary)', fontSize: 12, fontFamily: 'var(--font-ui)' }
const chartMargin = { top: 18, right: 10, bottom: 0, left: 0 }
const rankHeight = 47
const rankMargin = { top: 0, right: 0, bottom: 0, left: 0 }
const tooltipStyle = { zIndex: 4 }

function ChartCard({ title, icon, detail, className = '', children }: {
  title: string
  icon: ReactNode
  detail?: string
  className?: string
  children: ReactNode
}) {
  const titleId = useId()
  return (
    <GlassPanel className={`analytics-chart-card ${className}`} blur={false} role="region" aria-labelledby={titleId}>
      <header className="analytics-chart-heading">
        <span className="analytics-chart-icon" aria-hidden="true">{icon}</span>
        <h2 id={titleId}>{title}</h2>
        {detail && <span className="analytics-chart-detail">{detail}</span>}
      </header>
      {children}
    </GlassPanel>
  )
}

function ChartTooltip({ active, payload, label, locale, dateLabel }: Pick<TooltipContentProps, 'active' | 'payload' | 'label'> & {
  locale: string
  dateLabel?: (value: string) => string
}) {
  if (!active || !payload.length) return null
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
  const gradient = useId()
  const names = Object.keys(channelNames) as Channel[]
  const data = names.map((channel) => ({ name: t(channelNames[channel]), count: byChannel.find((row) => row.channel === channel)?.count ?? 0 }))
  const formatter = new Intl.NumberFormat(locale, { notation: 'compact' })
  const title = t('charts.channels')

  return (
    <ChartCard title={title} icon={<BarChart3 size={17} />}>
      {data.some(({ count }) => count > 0) ? (
        <div className="analytics-channel-plot">
          <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
            <BarChart accessibilityLayer aria-label={title} data={data} margin={chartMargin} barCategoryGap="25%">
              <defs>
                <linearGradient id={gradient} x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor="var(--color-focus)" stopOpacity={0.98} />
                  <stop offset="100%" stopColor="var(--color-primary)" stopOpacity={0.36} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} stroke={chartGrid} strokeDasharray="3 5" />
              <XAxis dataKey="name" tick={axisTick} tickLine={false} axisLine={false} tickMargin={9} interval={0} />
              <YAxis tick={axisTick} tickLine={false} axisLine={false} width={35} tickCount={4} allowDecimals={false}
                tickFormatter={(value: number) => formatter.format(value)} />
              <Tooltip content={(props) => <ChartTooltip {...props} locale={locale} />} cursor={{ fill: 'var(--control-fill)' }} wrapperStyle={tooltipStyle} isAnimationActive={false} />
              <Bar className="analytics-chart-columns" name={t('charts.total')} dataKey="count" fill={`url(#${gradient})`} radius={[7, 7, 2, 2]} maxBarSize={76} isAnimationActive={false}>
                <LabelList dataKey="count" position="top" fill="var(--color-text)" fontSize={13} fontWeight={650} formatter={(value) => formatter.format(Number(value))} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      ) : <EmptyChart />}
    </ChartCard>
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
  const hasData = data.some(({ count }) => count > 0)

  return (
    <ChartCard title={title} icon={<ChartPie size={17} />}>
      <div className="analytics-donut-layout">
        <div className="analytics-donut-plot">
          {hasData ? (
            <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
              <PieChart accessibilityLayer aria-label={title}>
                <Pie className="analytics-chart-ring" data={data} dataKey="count" nameKey="name" startAngle={90} endAngle={-270}
                  innerRadius="73%" outerRadius="96%" paddingAngle={3} cornerRadius={4} stroke="none" isAnimationActive={false} />
                <Tooltip content={(props) => <ChartTooltip {...props} locale={locale} />} wrapperStyle={tooltipStyle} isAnimationActive={false} />
              </PieChart>
            </ResponsiveContainer>
          ) : <div className="analytics-donut-placeholder" aria-hidden="true" />}
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
    </ChartCard>
  )
}

function SentimentChart({ data, locale }: { data: AnalyticsSummary['sentiment_daily']; locale: string }) {
  const t = useT(analyticsChartMessages)
  const id = useId()
  const title = t('charts.sentiment')
  const formatDate = useMemo(() => new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric', timeZone: 'Asia/Tashkent' }), [locale])
  const numeric = new Intl.NumberFormat(locale, { notation: 'compact' })
  const chronological = useMemo(() => [...data].sort((a, b) => a.date.localeCompare(b.date)).slice(-14), [data])

  function tickDate(value: string) {
    const date = new Date(value)
    return Number.isNaN(date.valueOf()) ? value : formatDate.format(date)
  }

  return (
    <ChartCard title={title} detail={t('charts.last14')} icon={<ChartNoAxesCombined size={17} />} className="analytics-sentiment-card">
      {chronological.some(({ positive, neutral, negative }) => positive + neutral + negative > 0) ? (
        <>
          <div className="analytics-sentiment-plot">
            <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
              <AreaChart accessibilityLayer aria-label={title} data={chronological} margin={chartMargin}>
                <defs>
                  {sentimentSeries.map(({ key, color }, index) => (
                    <linearGradient key={key} id={`${id}-${key}`} x1="0" x2="0" y1="0" y2="1">
                      <stop offset="0%" stopColor={color} stopOpacity={0.48 - index * 0.05} />
                      <stop offset="100%" stopColor={color} stopOpacity={0.1} />
                    </linearGradient>
                  ))}
                </defs>
                <CartesianGrid vertical={false} stroke={chartGrid} strokeDasharray="3 5" />
                <XAxis dataKey="date" tickFormatter={tickDate} minTickGap={26} tick={axisTick} tickMargin={10} tickLine={false} axisLine={false} />
                <YAxis tick={axisTick} tickMargin={4} tickLine={false} axisLine={false} width={31} tickCount={4} allowDecimals={false}
                  tickFormatter={(value: number) => numeric.format(value)} />
                <Tooltip content={(props) => <ChartTooltip {...props} dateLabel={tickDate} locale={locale} />}
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
      ) : <EmptyChart />}
    </ChartCard>
  )
}

function RankBar({ x, y, width, height, fill }: BarShapeProps) {
  return <Rectangle className="analytics-rank-mark" x={x} y={y + 11} width={width} height={height} fill={fill} radius={4} />
}

function RankedBars({ rows, title, icon, locale, unspecified, region = false }: {
  rows: Rank[]
  title: string
  icon: ReactNode
  locale: string
  unspecified?: number
  region?: boolean
}) {
  const t = useT(analyticsChartMessages)
  const gradient = useId()
  const format = new Intl.NumberFormat(locale)
  const growthFormat = new Intl.NumberFormat(locale, { maximumFractionDigits: 1, signDisplay: 'exceptZero' })
  return (
    <ChartCard title={title} icon={icon} className={region ? 'analytics-ranking-card analytics-ranking-regions' : 'analytics-ranking-card'}>
      {rows.length > 0 ? (
        <div className="analytics-ranking" tabIndex={region && rows.length > 5 ? 0 : undefined} style={{ '--analytics-rank-height': `${rankHeight}px` } as CSSProperties}>
          <div className="analytics-ranking-plot" style={{ height: rows.length * rankHeight }}>
            <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
              <BarChart accessibilityLayer aria-label={title} layout="vertical" data={rows} margin={rankMargin}>
                <defs>
                  <linearGradient id={gradient} x1="0" x2="1" y1="0" y2="0">
                    <stop offset="0%" stopColor="var(--color-primary)" stopOpacity={region ? 0.4 : 0.52} />
                    <stop offset="100%" stopColor={region ? 'var(--color-cyan)' : 'var(--color-focus)'} stopOpacity={region ? 0.72 : 0.92} />
                  </linearGradient>
                </defs>
                <XAxis hide type="number" domain={[0, (max: number) => Math.max(1, max)]} />
                <YAxis hide type="category" dataKey="label" />
                <Tooltip content={(props) => <ChartTooltip {...props} locale={locale} />} cursor={{ fill: 'var(--control-fill)' }} wrapperStyle={tooltipStyle} isAnimationActive={false} />
                <Bar dataKey="count" name={t('charts.total')} shape={RankBar} fill={`url(#${gradient})`} barSize={6} isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <ol className="analytics-ranking-labels">
            {rows.map(({ key, label, count, growth }) => (
              <li key={key}>
                <span className="analytics-ranking-name" title={label}>{label}</span>
                {growth !== undefined && (
                  <span className="analytics-ranking-growth" title={t('charts.previous')}>
                    {growth > 0 ? <ArrowUpRight size={12} aria-hidden="true" /> : growth < 0 ? <ArrowDownRight size={12} aria-hidden="true" /> : <ArrowRight size={12} aria-hidden="true" />}
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
    </ChartCard>
  )
}

function localizedTopic(name: string, language: Language) {
  if (language === 'uz-latn') return name
  return analyticsTopicNames[name]?.[language === 'uz-cyrl' ? 0 : 1] ?? name
}

function localizedRegion(name: string, language: Language) {
  const translationKey = regionKeys.find((key) => chatMessages['uz-latn'][key] === name)
  return translationKey ? chatMessages[language][translationKey] : name
}

export function AnalyticsCharts({ summary, previous, sentiment }: {
  summary: AnalyticsSummary
  previous?: AnalyticsSummary
  sentiment: AnalyticsSummary['sentiment_daily']
}) {
  const t = useT(analyticsChartMessages)
  const { language } = useLanguage()
  const locale = localeCodes[language]
  const previousTopics = new Map(previous?.top_topics.map(({ topic, count }) => [topic, count]))
  const topics = [...summary.top_topics].sort((a, b) => b.count - a.count).slice(0, 5).map((row) => {
    const before = previousTopics.get(row.topic)
    const growth = row.growth_pct ?? (before ? ((row.count - before) / before) * 100 : undefined)
    return { key: row.topic, label: localizedTopic(row.topic, language), count: row.count, growth }
  })
  const regions = summary.by_region.flatMap(({ region, count }) => region?.trim()
    ? [{ key: region, label: localizedRegion(region, language), count }]
    : []).sort((a, b) => b.count - a.count)
  const unspecified = summary.by_region.filter(({ region }) => !region?.trim()).reduce((total, { count }) => total + count, 0)

  return (
    <div className="analytics-charts-grid">
      <ChannelChart byChannel={summary.by_channel} locale={locale} />
      <LevelChart summary={summary} locale={locale} />
      <SentimentChart data={sentiment} locale={locale} />
      <RankedBars rows={topics} title={t('charts.topics')} icon={<MessagesSquare size={17} />} locale={locale} />
      <RankedBars rows={regions} title={t('charts.regions')} icon={<MapPin size={17} />} locale={locale} unspecified={unspecified} region />
    </div>
  )
}
