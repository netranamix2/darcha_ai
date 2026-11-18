import { animate, motion, useReducedMotion } from 'motion/react'
import { ArrowDownRight, ArrowUpRight, Download, Lightbulb } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router'
import { Cell, Pie, PieChart, Tooltip } from 'recharts'
import type { AnalyticsSummary, Level, Ticket, TicketDepartment } from '../../api/types'
import { useInboxRecords, useTicketRecords } from '../../hooks/usePanelCases'
import { leadershipMessages } from '../../i18n/leadership'
import { localeCodes } from '../../i18n/locales'
import { useLanguage } from '../../i18n/useLanguage'
import { useT } from '../../i18n/useT'
import { localizeCaseRegion, localizeCaseTopic } from '../../lib/case-labels'
import { Dropdown, DropdownContent, DropdownItem, DropdownTrigger, GlassPanel, Button } from '../ui'
import { AlertFeed } from './AnalyticsOperations'
import { ChannelChart, ChartCard } from './AnalyticsCharts'
import { AnsweredByCard, DailyDynamicsChart, TopQuestionsCard } from './LeadershipCharts'
import { outcomeTotals } from '../../lib/leadership-data'
import './leadership.css'

const minutesPerAnswer = 15
const levelColors: Record<Level, string> = { green: 'var(--color-green)', yellow: 'var(--color-amber)', red: 'var(--color-red)' }
const departments: Array<TicketDepartment | 'none'> = ['higher', 'schools', 'attestation', 'regional', 'none']

type Keys = keyof (typeof leadershipMessages)['uz-latn']

function fill(template: string, values: Record<string, string | number>) {
  return Object.entries(values).reduce((text, [key, value]) => text.replace(`{${key}}`, String(value)), template)
}

function answeredAt(ticket: Ticket) {
  const event = [...(ticket.events ?? [])].reverse().find(({ type }) => type === 'answered')
  return event ? Date.parse(event.created_at) : null
}

function isLate(ticket: Ticket, now: number) {
  if (ticket.status === 'overdue') return true
  if (ticket.status === 'answered') {
    const at = answeredAt(ticket)
    return at !== null && at > Date.parse(ticket.due_at)
  }
  return Date.parse(ticket.due_at) < now
}

function CountUp({ value, format }: { value: number; format: (value: number) => string }) {
  const reduce = useReducedMotion()
  const [shown, setShown] = useState(reduce ? value : 0)
  const previous = useRef(0)
  useEffect(() => {
    if (reduce) { setShown(value); return }
    const controls = animate(previous.current, value, {
      duration: 0.7, ease: [0.16, 1, 0.3, 1], onUpdate: (latest) => setShown(latest),
    })
    previous.current = value
    return () => controls.stop()
  }, [reduce, value])
  return <>{format(shown)}</>
}

// Ticket metrics describe the current workload (same basis as the overdue counter), not only the period.
function useTicketStats(tickets: Ticket[], now: number) {
  return useMemo(() => {
    const inPeriod = tickets
    const answered = inPeriod.filter((ticket) => ticket.status === 'answered')
    const late = inPeriod.filter((ticket) => isLate(ticket, now))
    const answeredOnTime = answered.filter((ticket) => !isLate(ticket, now)).length
    const decided = answered.length + late.filter((ticket) => ticket.status !== 'answered').length
    const durations = answered.map((ticket) => {
      const at = answeredAt(ticket)
      return at === null ? null : at - Date.parse(ticket.created_at)
    }).filter((value): value is number => value !== null && value > 0)
    const avgStaffMs = durations.length ? durations.reduce((sum, value) => sum + value, 0) / durations.length : null

    const byDepartment = departments.map((department) => {
      const rows = inPeriod.filter((ticket) => (ticket.department ?? 'none') === department)
      const times = rows.filter((ticket) => ticket.status === 'answered').map((ticket) => {
        const at = answeredAt(ticket)
        return at === null ? null : at - Date.parse(ticket.created_at)
      }).filter((value): value is number => value !== null && value > 0)
      return {
        department,
        open: rows.filter((ticket) => ticket.status !== 'answered').length,
        late: rows.filter((ticket) => ticket.status !== 'answered' && isLate(ticket, now)).length,
        avgMs: times.length ? times.reduce((sum, value) => sum + value, 0) / times.length : null,
        total: rows.length,
      }
    }).filter(({ total }) => total > 0)

    const lateByRegion = new Map<string, number>()
    for (const ticket of late) {
      if (ticket.status === 'answered' || !ticket.region) continue
      lateByRegion.set(ticket.region, (lateByRegion.get(ticket.region) ?? 0) + 1)
    }
    return {
      onTimePct: decided ? (answeredOnTime / decided) * 100 : null,
      avgStaffMs,
      byDepartment,
      lateByRegion,
    }
  }, [now, tickets])
}

export function LeadershipView({ summary, days, now }: { summary: AnalyticsSummary; days: number; now: number }) {
  const t = useT(leadershipMessages)
  const { language } = useLanguage()
  const locale = localeCodes[language]
  const tickets = useTicketRecords()
  const inbox = useInboxRecords()
  const outcome = outcomeTotals(summary)
  const stats = useTicketStats(tickets.data ?? [], now)
  const number = useMemo(() => new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }), [locale])
  const decimal = useMemo(() => new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }), [locale])
  const percent = useMemo(() => new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 0 }), [locale])

  const levels = (['green', 'yellow', 'red'] as const).map((level) => ({
    level, name: t(`lead.${level}` as Keys), value: summary.by_level.find((row) => row.level === level)?.count ?? 0,
  }))
  const fixedReplies = summary.fixed_replies ?? 0
  const aiCount = levels[0].value
  const savedHours = (aiCount * minutesPerAnswer) / 60
  const regions = summary.by_region
    .map(({ region, count }) => ({
      key: region ?? '',
      label: region ? localizeCaseRegion(region, language) : t('lead.unknown'),
      count,
      late: region ? stats.lateByRegion.get(region) ?? 0 : 0,
    }))
    .sort((a, b) => Number(!a.key) - Number(!b.key) || b.count - a.count)
  const worstLate = [...regions].filter(({ late }) => late > 0).sort((a, b) => b.late - a.late).slice(0, 3).map(({ key }) => key)
  const maxRegion = Math.max(1, ...regions.map(({ count }) => count))
  const topics = [...summary.top_topics].sort((a, b) => b.count - a.count).slice(0, 8)
  const maxTopic = Math.max(1, ...topics.map(({ count }) => count))

  const duration = (ms: number) => {
    const minutes = ms / 60_000
    return minutes < 90 ? `${number.format(minutes)} ${t('lead.minutes')}` : `${decimal.format(minutes / 60)} ${t('lead.hours')}`
  }
  // No invented fallback: hide the AI response time when the API has no measurement.
  const aiSeconds = summary.avg_response_sec > 0 ? summary.avg_response_sec : null

  const insights: Array<{ text: string; to: string; link: string }> = []
  const rising = topics.filter(({ growth_pct }) => (growth_pct ?? 0) >= 20).sort((a, b) => (b.growth_pct ?? 0) - (a.growth_pct ?? 0))[0]
  if (rising) {
    insights.push({
      text: fill(t('lead.insightTopic'), { topic: localizeCaseTopic(rising.topic, language), growth: percent.format((rising.growth_pct ?? 0) / 100) }),
      to: '/panel/analytics?tab=faq', link: t('lead.insightFaq'),
    })
  }
  const lateRegion = regions.find(({ key }) => key === worstLate[0])
  if (lateRegion) {
    insights.push({
      text: fill(t('lead.insightRegion'), { region: lateRegion.label, n: lateRegion.late }),
      to: '/panel/tickets?status=overdue', link: t('lead.insightTickets'),
    })
  }

  function exportCsv() {
    const lines: Array<Array<string | number>> = [
      [t('lead.reportTitle')], [fill(t('lead.period'), { days })], [],
      [t('lead.total'), summary.total],
      [t('lead.ai'), `${decimal.format(summary.ai_resolved_pct)}%`],
      [t('lead.onTime'), stats.onTimePct === null ? '—' : `${decimal.format(stats.onTimePct)}%`],
      [t('lead.overdue'), summary.overdue], [],
      [t('lead.levels')], ...levels.map(({ name, value }) => [name, value]), [],
      [t('lead.regions'), '', t('lead.late')], ...regions.map(({ label, count, late }) => [label, count, late]), [],
      [t('lead.departments'), t('lead.open'), t('lead.late')],
      ...stats.byDepartment.map(({ department, open, late }) => [t(`lead.dep.${department}` as Keys), open, late]), [],
      ...topics.map(({ topic, count, growth_pct }) => [localizeCaseTopic(topic, language), count, growth_pct ?? '']),
    ]
    const csv = lines.map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(';')).join('\r\n')
    const url = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }))
    const link = document.createElement('a')
    link.href = url
    link.download = `darcha-hisobot-${new Date(now).toISOString().slice(0, 10)}.csv`
    link.click()
    window.setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  const kpis = [
    {
      key: 'total', label: t('lead.total'), value: summary.total, format: (v: number) => number.format(v),
    },
    {
      key: 'onTime', label: t('lead.onTime'), primary: true, value: stats.onTimePct,
      format: (v: number) => percent.format(v / 100), sub: t('lead.onTimeHint'),
    },
    {
      key: 'ai', label: t('lead.ai'), value: summary.ai_resolved_pct, format: (v: number) => percent.format(v / 100),
      sub: fill(t('lead.saved'), { hours: number.format(savedHours) }), note: t('lead.savedNote'),
    },
  ] as const

  return (
    <div className="leader-report">
      <div className="leader-print-head">
        <h1>{t('lead.reportTitle')}</h1>
        <p>{fill(t('lead.period'), { days })} · {new Date(now).toLocaleString(locale)}</p>
      </div>

      <div className="leader-toolbar">
        {insights.length ? (
          <div className="leader-insights">
            {insights.map((insight) => (
              <motion.p key={insight.text} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}>
                <Lightbulb size={16} aria-hidden="true" />
                <span>{insight.text}</span>
                <Link to={insight.to}>{insight.link}</Link>
              </motion.p>
            ))}
          </div>
        ) : <span />}
        <Dropdown>
          <DropdownTrigger asChild>
            <Button variant="secondary" size="sm"><Download size={15} aria-hidden="true" />{t('lead.export')}</Button>
          </DropdownTrigger>
          <DropdownContent align="end">
            <DropdownItem onSelect={() => window.setTimeout(() => window.print(), 50)}>{t('lead.exportPdf')}</DropdownItem>
            <DropdownItem onSelect={exportCsv}>{t('lead.exportCsv')}</DropdownItem>
          </DropdownContent>
        </Dropdown>
      </div>

      <dl className="leader-kpis">
        {kpis.map((kpi) => kpi.value === null ? null : (
          <GlassPanel key={kpi.key} variant="subtle" blur={false} className="leader-kpi" data-primary={'primary' in kpi ? true : undefined}>
            <dt>{kpi.label}</dt>
            <dd><CountUp value={kpi.value} format={kpi.format} /></dd>
            {'sub' in kpi ? <p>{kpi.sub}</p> : null}
            {'note' in kpi ? <small>{kpi.note}</small> : null}
          </GlassPanel>
        ))}
        <GlassPanel variant="subtle" blur={false} className="leader-kpi">
          <dt>{t('lead.response')}</dt>
          <dd className="leader-kpi-split">
            {aiSeconds !== null ? <span>{fill(t('lead.responseAi'), { value: `${number.format(aiSeconds)} ${t('lead.seconds')}` })}</span> : null}
            {stats.avgStaffMs !== null ? <span>{fill(t('lead.responseStaff'), { value: duration(stats.avgStaffMs) })}</span> : null}
          </dd>
        </GlassPanel>
        <GlassPanel variant="subtle" blur={false} className="leader-kpi" data-urgent={summary.overdue > 0 || undefined}>
          <dt>{t('lead.overdue')}</dt>
          <dd><CountUp value={summary.overdue} format={(v) => number.format(v)} /></dd>
          {summary.overdue > 0 ? <Link className="leader-kpi-link" to="/panel/tickets?status=overdue">{t('lead.overdueOpen')}</Link> : null}
        </GlassPanel>
      </dl>

      <div className="leader-grid">
        <div className={outcome ? 'leader-span-8' : 'leader-span-12'}><DailyDynamicsChart summary={summary} locale={locale} /></div>
        {outcome ? <div className="leader-span-4"><AnsweredByCard totals={outcome} locale={locale} /></div> : null}
        <div className="leader-span-12"><TopQuestionsCard items={inbox.data ?? []} days={days} now={now} locale={locale} /></div>
      </div>

      <div className="leader-row leader-row--two">
        <ChannelChart byChannel={summary.by_channel} locale={locale} />
        <ChartCard title={t('lead.levels')}>
          <div className="leader-donut">
            <PieChart width={190} height={190}>
              <Pie data={fixedReplies > 0 ? [...levels, { level: 'fixed' as const, name: t('lead.fixed'), value: fixedReplies }] : levels} dataKey="value" nameKey="name" innerRadius={62} outerRadius={88} paddingAngle={3}
                stroke="none" cornerRadius={6} animationDuration={700}>
                {levels.map(({ level }) => <Cell key={level} fill={levelColors[level]} />)}
                {fixedReplies > 0 ? <Cell key="fixed" fill="var(--color-muted)" /> : null}
              </Pie>
              <Tooltip wrapperClassName="analytics-chart-tooltip" />
            </PieChart>
            <div className="leader-donut-center"><strong>{percent.format(summary.ai_resolved_pct / 100)}</strong><span>AI</span></div>
            <ul>
              {levels.map(({ level, name, value }) => (
                <li key={level}><i style={{ background: levelColors[level] }} /><span>{name}</span><b>{number.format(value)}</b></li>
              ))}
              {fixedReplies > 0 ? (
                <li><i style={{ background: 'var(--color-muted)' }} /><span>{t('lead.fixed')}</span><b>{number.format(fixedReplies)}</b></li>
              ) : null}
            </ul>
          </div>
        </ChartCard>
      </div>

      <div className="leader-row leader-row--wide">
        <ChartCard title={t('lead.regions')} detail={t('lead.regionsHint')}>
          <ol className="leader-bars">
            {regions.map(({ key, label, count, late }, index) => (
              <li key={key || 'unknown'} data-warn={worstLate.includes(key) || undefined}>
                <span className="leader-bar-label">{label}</span>
                <span className="leader-bar-track">
                  <motion.span className="leader-bar-fill" initial={{ width: 0 }} animate={{ width: `${(count / maxRegion) * 100}%` }}
                    transition={{ duration: 0.6, delay: index * 0.03, ease: [0.16, 1, 0.3, 1] }} />
                </span>
                <b>{number.format(count)}</b>
                <small>{late ? fill(t('lead.regionOverdue'), { n: late }) : ''}</small>
              </li>
            ))}
          </ol>
        </ChartCard>
        <AlertFeed alerts={summary.alerts} />
      </div>

      <div className="leader-row leader-row--two">
        <ChartCard title={t('lead.topics')} className="leader-topics">
          <ol className="leader-bars">
            {topics.map(({ topic, count, growth_pct }, index) => (
              <li key={topic}>
                <Link className="leader-bar-label" to={`/panel/inbox?${new URLSearchParams({ topic })}`}>{localizeCaseTopic(topic, language)}</Link>
                <span className="leader-bar-track">
                  <motion.span className="leader-bar-fill" initial={{ width: 0 }} animate={{ width: `${(count / maxTopic) * 100}%` }}
                    transition={{ duration: 0.6, delay: index * 0.04, ease: [0.16, 1, 0.3, 1] }} />
                </span>
                <b>{number.format(count)}</b>
                <small className="leader-growth" data-up={(growth_pct ?? 0) > 0 || undefined}>
                  {growth_pct ? <>{growth_pct > 0 ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}{percent.format(Math.abs(growth_pct) / 100)}</> : ''}
                </small>
              </li>
            ))}
          </ol>
        </ChartCard>
        <ChartCard title={t('lead.departments')}>
          <table className="leader-table">
            <thead>
              <tr><th>{t('lead.department')}</th><th>{t('lead.open')}</th><th>{t('lead.late')}</th><th>{t('lead.avgTime')}</th></tr>
            </thead>
            <tbody>
              {stats.byDepartment.map(({ department, open, late, avgMs }) => (
                <tr key={department}>
                  <td>{t(`lead.dep.${department}` as Keys)}</td>
                  <td>{number.format(open)}</td>
                  <td data-late={late > 0 || undefined}>{number.format(late)}</td>
                  <td>{avgMs === null ? '—' : duration(avgMs)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </ChartCard>
      </div>

      <p className="leader-api">{t('lead.api')}</p>
    </div>
  )
}
