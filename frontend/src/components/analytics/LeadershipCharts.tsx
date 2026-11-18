import { motion, useReducedMotion } from 'motion/react'
import { useId, useMemo } from 'react'
import { Link } from 'react-router'
import { Area, AreaChart, CartesianGrid, Tooltip, XAxis, YAxis } from 'recharts'
import type { AnalyticsOutcome, AnalyticsSummary, InboxItem } from '../../api/types'
import { outcomeTotals, topQuestions } from '../../lib/leadership-data'
import { leadershipChartMessages } from '../../i18n/leadership-charts'
import { useT } from '../../i18n/useT'
import { ChartCard, ChartTooltip } from './AnalyticsCharts'

type Series = keyof AnalyticsOutcome
const series: Array<{ key: Series; color: string }> = [
  { key: 'ai', color: 'var(--color-green)' },
  { key: 'specialist', color: 'var(--color-primary)' },
  { key: 'waiting', color: 'var(--color-amber)' },
]
const dayMs = 86_400_000
const axisTick = { fill: 'var(--color-secondary)', fontSize: 12, fontFamily: 'var(--font-ui)' }
const ease = [0.16, 1, 0.3, 1] as const

function fill(template: string, values: Record<string, string | number>) {
  return Object.entries(values).reduce((text, [key, value]) => text.replace(`{${key}}`, String(value)), template)
}

/** Largest-remainder rounding so the shown percentages always sum to 100. */
function shares(values: number[]) {
  const total = values.reduce((sum, value) => sum + value, 0)
  if (!total) return values.map(() => 0)
  const raw = values.map((value) => (value / total) * 100)
  const floors = raw.map(Math.floor)
  let rest = 100 - floors.reduce((sum, value) => sum + value, 0)
  const order = raw.map((value, index) => [value - floors[index], index] as const).sort((a, b) => b[0] - a[0])
  for (const [, index] of order) {
    if (rest <= 0) break
    floors[index] += 1
    rest -= 1
  }
  return floors
}

export function DailyDynamicsChart({ summary, locale }: { summary: AnalyticsSummary; locale: string }) {
  const t = useT(leadershipChartMessages)
  const reduce = useReducedMotion()
  const id = useId().replaceAll(':', '')
  const days = summary.daily ?? []
  const split = days.length > 0 && days.every((day) => day.ai !== undefined && day.specialist !== undefined && day.waiting !== undefined)
  const number = new Intl.NumberFormat(locale)
  const dayLabel = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', timeZone: 'UTC' })
  const label = (value: string) => {
    const time = Date.parse(`${value}T00:00:00Z`)
    return Number.isFinite(time) ? dayLabel.format(time) : value
  }
  const data = days.map((day) => ({ date: day.date, total: day.total, ai: day.ai ?? 0, specialist: day.specialist ?? 0, waiting: day.waiting ?? 0 }))
  const totals = outcomeTotals(summary)
  const legend = split && totals
    ? series.map(({ key, color }) => ({ key, color, name: t(`lc.${key}`), value: totals[key] }))
    : [{ key: 'total', color: 'var(--color-primary)', name: t('lc.total'), value: days.reduce((sum, day) => sum + day.total, 0) }]
  const hasData = days.some((day) => day.total > 0)

  return (
    <ChartCard title={t('lc.daily')} detail={t('lc.dailyHint')} className="leader-daily">
      <ul className="leader-legend">
        {legend.map(({ key, color, name, value }) => (
          <li key={key}><i style={{ background: color }} />{name}<b>{number.format(value)}</b></li>
        ))}
      </ul>
      {hasData ? (
        <AreaChart className="leader-daily-plot" responsive accessibilityLayer aria-label={t('lc.daily')} data={data}
          margin={{ top: 8, right: 6, bottom: 0, left: 0 }}>
          <defs>
            {(split ? series : [{ key: 'total', color: 'var(--color-primary)' }]).map(({ key, color }) => (
              <linearGradient key={key} id={`${id}-${key}`} x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity={0.38} />
                <stop offset="100%" stopColor={color} stopOpacity={0.02} />
              </linearGradient>
            ))}
          </defs>
          <CartesianGrid vertical={false} stroke="var(--color-border)" strokeDasharray="3 5" />
          <XAxis dataKey="date" tick={axisTick} tickLine={false} axisLine={false} tickMargin={8} minTickGap={18} tickFormatter={label} />
          <YAxis tick={axisTick} tickLine={false} axisLine={false} width={32} allowDecimals={false} tickCount={4} />
          <Tooltip content={(props) => <ChartTooltip {...props} locale={locale} dateLabel={label} />}
            cursor={{ stroke: 'rgb(143 183 255 / 35%)', strokeDasharray: '3 4' }} wrapperStyle={{ zIndex: 4 }} isAnimationActive={false} />
          {split ? series.map(({ key, color }) => (
            <Area key={key} type="monotone" dataKey={key} name={t(`lc.${key}`)} stackId="who" stroke={color} strokeWidth={2}
              fill={`url(#${id}-${key})`} activeDot={{ r: 4, strokeWidth: 0 }} isAnimationActive={!reduce} animationDuration={800} />
          )) : (
            <Area type="monotone" dataKey="total" name={t('lc.total')} stroke="var(--color-primary)" strokeWidth={2}
              fill={`url(#${id}-total)`} activeDot={{ r: 4, strokeWidth: 0 }} isAnimationActive={!reduce} animationDuration={800} />
          )}
        </AreaChart>
      ) : <p className="analytics-chart-empty">{t('lc.empty')}</p>}
    </ChartCard>
  )
}

export function AnsweredByCard({ totals, locale }: { totals: AnalyticsOutcome; locale: string }) {
  const t = useT(leadershipChartMessages)
  const reduce = useReducedMotion()
  const number = new Intl.NumberFormat(locale)
  const values = series.map(({ key }) => totals[key])
  const total = values.reduce((sum, value) => sum + value, 0)
  const pct = shares(values)

  return (
    <ChartCard title={t('lc.who')} detail={fill(t('lc.whoHint'), { n: number.format(total) })} className="leader-who">
      {total ? (
        <>
          <motion.div className="leader-stack" aria-hidden="true" initial={reduce ? false : { scaleX: 0, opacity: 0 }}
            animate={{ scaleX: 1, opacity: 1 }} transition={{ duration: 0.45, ease }}>
            {series.map(({ key, color }, index) => values[index] > 0 && (
              <span key={key} style={{ flexGrow: values[index], background: color }} />
            ))}
          </motion.div>
          <ul className="leader-who-list">
            {series.map(({ key, color }, index) => (
              <li key={key}>
                <i style={{ background: color }} />
                <span><strong>{t(`lc.${key}`)}</strong><small>{t(`lc.${key}Note`)}</small></span>
                <b>{pct[index]}%</b>
                <em>{number.format(values[index])}</em>
              </li>
            ))}
          </ul>
        </>
      ) : <p className="analytics-chart-empty">{t('lc.empty')}</p>}
    </ChartCard>
  )
}

export function TopQuestionsCard({ items, days, now, locale }: { items: InboxItem[]; days: number; now: number; locale: string }) {
  const t = useT(leadershipChartMessages)
  const reduce = useReducedMotion()
  const number = new Intl.NumberFormat(locale)
  const rows = useMemo(() => topQuestions(items, now - days * dayMs), [days, items, now])
  const max = Math.max(1, ...rows.map(({ count }) => count))

  return (
    <ChartCard title={t('lc.questions')} className="leader-questions">
      {rows.length ? (
        <ol className="leader-question-list">
          {rows.map(({ key, text, count }, index) => (
            <motion.li key={key} initial={reduce ? false : { opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: index * 0.04, ease }}>
              <Link to="/panel/analytics?tab=faq">
                <span className="leader-question-rank">{index + 1}</span>
                <span className="leader-question-text" title={text}>{text}</span>
                <span className="leader-question-count">{fill(t('lc.times'), { n: number.format(count) })}</span>
                <span className="leader-question-track" aria-hidden="true">
                  <motion.span initial={reduce ? false : { scaleX: 0 }} animate={{ scaleX: count / max }}
                    transition={{ duration: 0.6, delay: index * 0.04, ease }} />
                </span>
              </Link>
            </motion.li>
          ))}
        </ol>
      ) : <p className="analytics-chart-empty">{t('lc.empty')}</p>}
      <Link className="leader-questions-more" to="/panel/analytics?tab=faq">{t('lc.questionsLink')}</Link>
    </ChartCard>
  )
}
