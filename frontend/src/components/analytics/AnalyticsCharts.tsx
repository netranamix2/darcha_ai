import { useId } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { Bar, BarChart, CartesianGrid, LabelList, Rectangle, Tooltip, XAxis, YAxis } from 'recharts'
import type { BarShapeProps, TooltipContentProps } from 'recharts'
import type { AnalyticsSummary, Channel } from '../../api/types'
import { analyticsChartMessages } from '../../i18n/analytics-charts'
import { localeCodes } from '../../i18n/locales'
import { useLanguage } from '../../i18n/useLanguage'
import { useT } from '../../i18n/useT'
import { localizeCaseRegion, localizeCaseTopic } from '../../lib/case-labels'
import { GlassPanel } from '../ui'
import './analytics-charts.css'

const channelNames = {
  telegram: 'charts.telegram',
  web: 'charts.web',
  instagram: 'charts.instagram',
} as const satisfies Record<Channel, keyof typeof analyticsChartMessages['uz-latn']>

type Rank = { key: string; label: string; count: number }
const chartGrid = 'var(--color-border)'
const axisTick = { fill: 'var(--color-secondary)', fontSize: 12, fontFamily: 'var(--font-ui)' }
const chartMargin = { top: 18, right: 10, bottom: 0, left: 0 }
const rankHeight = 47
const rankMargin = { top: 0, right: 0, bottom: 0, left: 0 }
const tooltipStyle = { zIndex: 4 }

function ChartCard({ title, detail, className = '', children }: {
  title: string
  detail?: string
  className?: string
  children: ReactNode
}) {
  const titleId = useId()
  return (
    <GlassPanel className={`analytics-chart-card ${className}`} blur={false} role="region" aria-labelledby={titleId}>
      <header className="analytics-chart-heading">
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
  const gradient = 'channel-' + useId().replaceAll(':', '')
  const names = Object.keys(channelNames) as Channel[]
  const data = names.map((channel) => ({ name: t(channelNames[channel]), count: byChannel.find((row) => row.channel === channel)?.count ?? 0 }))
  const formatter = new Intl.NumberFormat(locale, { notation: 'compact' })
  const title = t('charts.channels')

  return (
    <ChartCard title={title}>
      {data.some(({ count }) => count > 0) ? (
        <BarChart className="analytics-channel-plot" responsive accessibilityLayer aria-label={title} data={data} margin={chartMargin} barCategoryGap="25%">
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
          <Bar name={t('charts.total')} dataKey="count" fill={`url(#${gradient}) var(--color-primary)`} radius={[7, 7, 2, 2]} maxBarSize={76} isAnimationActive={false}>
            <LabelList dataKey="count" position="top" fill="var(--color-text)" fontSize={13} fontWeight={650} formatter={(value) => formatter.format(Number(value))} />
          </Bar>
        </BarChart>
      ) : <EmptyChart />}
    </ChartCard>
  )
}

function RankBar({ x, y, width, height, fill }: BarShapeProps) {
  return <Rectangle className="analytics-rank-mark" x={x} y={y + 11} width={width} height={height} fill={fill} radius={4} />
}

function RankedBars({ rows, title, locale }: { rows: Rank[]; title: string; locale: string }) {
  const t = useT(analyticsChartMessages)
  const gradient = 'topic-' + useId().replaceAll(':', '')
  const format = new Intl.NumberFormat(locale)

  return (
    <ChartCard title={title} className="analytics-ranking-card">
      {rows.length > 0 ? (
        <div className="analytics-ranking" style={{ '--analytics-rank-height': rankHeight + 'px' } as CSSProperties}>
          <div className="analytics-ranking-plot">
            <BarChart
              responsive accessibilityLayer aria-label={title} layout="vertical" data={rows} margin={rankMargin}
              style={{ width: '100%', height: rows.length * rankHeight }}
            >
              <defs>
                <linearGradient id={gradient} x1="0" x2="1" y1="0" y2="0">
                  <stop offset="0%" stopColor="var(--color-primary)" stopOpacity={0.52} />
                  <stop offset="100%" stopColor="var(--color-focus)" stopOpacity={0.92} />
                </linearGradient>
              </defs>
              <XAxis hide type="number" domain={[0, (max: number) => Math.max(1, max)]} />
              <YAxis hide type="category" dataKey="label" />
              <Tooltip content={(props) => <ChartTooltip {...props} locale={locale} />} cursor={{ fill: 'var(--control-fill)' }} wrapperStyle={tooltipStyle} isAnimationActive={false} />
              <Bar dataKey="count" name={t('charts.total')} shape={RankBar} fill={'url(#' + gradient + ') var(--color-primary)'} barSize={6} isAnimationActive={false} />
            </BarChart>
          </div>
          <ol className="analytics-ranking-labels">
            {rows.map(({ key, label, count }) => (
              <li key={key}>
                <span className="analytics-ranking-name" title={label}>{label}</span>
                <strong>{format.format(count)}</strong>
              </li>
            ))}
          </ol>
        </div>
      ) : <EmptyChart />}
    </ChartCard>
  )
}

export function AnalyticsCharts({ summary }: { summary: AnalyticsSummary }) {
  const t = useT(analyticsChartMessages)
  const { language } = useLanguage()
  const locale = localeCodes[language]
  const format = new Intl.NumberFormat(locale)
  const topics = [...summary.top_topics].sort((a, b) => b.count - a.count).slice(0, 5)
    .map(({ topic, count }) => ({ key: topic, label: localizeCaseTopic(topic, language), count }))
  const regions = summary.by_region.filter(({ region }) => Boolean(region?.trim()))
    .sort((a, b) => b.count - a.count).slice(0, 5)

  return (
    <>
      <div className="analytics-charts-grid">
        <ChannelChart byChannel={summary.by_channel} locale={locale} />
        <RankedBars rows={topics} title={t('charts.topics')} locale={locale} />
      </div>
      <ChartCard title={t('charts.regions')}>
        {regions.length === 0 ? <EmptyChart /> : (
          <ol className="simple-region-list">
            {regions.map(({ region, count }) => (
              <li key={region}>
                <span>{localizeCaseRegion(region ?? '', language)}</span><strong>{format.format(count)}</strong>
              </li>
            ))}
          </ol>
        )}
      </ChartCard>
    </>
  )
}
