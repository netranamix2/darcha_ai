import { ApiError } from '../errors'
import type { AnalyticsAlert, AnalyticsSummary, Channel, FaqReport, InboxItem, Level, Ticket } from '../types'
import { topics } from './chat'
import { dateBoundary, dateKey, dayMs } from './dates'
import { inbox, responseSeconds, tickets } from './fixtures'

const channels: Channel[] = ['telegram', 'web', 'instagram']
const levels: Level[] = ['green', 'yellow', 'red']

function countBy<Key>(items: InboxItem[], getKey: (item: InboxItem) => Key) {
  const counts = new Map<Key, number>()
  for (const item of items) {
    const key = getKey(item)
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  return counts
}

function changedPercent(current: number, previous: number) {
  return previous ? Math.round((current - previous) / previous * 100) : 0
}

function wasOpen(ticket: Ticket, at: number) {
  if (ticket.status !== 'answered' && !ticket.final_answer) return true
  const answered = ticket.events?.find(({ type }) => type === 'answered')
  return answered !== undefined && Date.parse(answered.created_at) > at
}

function meanResponse(total: number, count: number) {
  return count ? Math.round(total / count) : 0
}

function findSpikes(items: InboxItem[], dayCounts: ReadonlyMap<string, number>): AnalyticsAlert[] {
  const recent = new Map<string, { count: number; last: string }>()

  for (const item of items) {
    const day = dateKey(Date.parse(item.created_at))
    const value = recent.get(day) ?? { count: 0, last: item.created_at }
    value.count += 1
    if (item.created_at > value.last) value.last = item.created_at
    recent.set(day, value)
  }

  return [...recent].flatMap(([day, { count, last }]) => {
    if (count < 10) return []
    let baseline = 0
    for (let offset = 1; offset <= 7; offset++) {
      baseline += dayCounts.get(dateKey(dateBoundary(day) - offset * dayMs)) ?? 0
    }
    baseline /= 7
    const growth = changedPercent(count, baseline)
    if (growth < 55) return []
    return [{
      id: `AL-spike-${day}`,
      kind: 'spike',
      text: `Bir kunda ${count} ta murojaat kelib tushdi (+${growth}%).`,
      created_at: last,
      appeal_count: count,
      growth_pct: growth,
    }]
  })
}

export function summarizeAnalytics(from: string, to: string): AnalyticsSummary {
  const start = dateBoundary(from)
  const end = dateBoundary(to, true)
  if (!(start <= end)) throw new ApiError(400, 'Invalid analytics date range')
  const previousStart = start - (end - start + 1)
  const all = [...inbox.values()]
  const items = all.filter(({ created_at }) => {
    const time = Date.parse(created_at)
    return time >= start && time <= end
  })
  const previous = all.filter(({ created_at }) => {
    const time = Date.parse(created_at)
    return time >= previousStart && time < start
  })
  const channelCounts = countBy(items, (item) => item.channel)
  const levelCounts = countBy(items, (item) => item.level)
  const topicCounts = countBy(items, (item) => item.classification.topic)
  const previousTopics = countBy(previous, (item) => item.classification.topic)
  const regionCounts = countBy(items, (item) => item.classification.region)
  const dayCounts = countBy(all, (item) => dateKey(Date.parse(item.created_at)))
  const alerts = findSpikes(items, dayCounts)

  const activeUntil = Math.min(end, Date.now())
  const overdueTickets = [...tickets.values()].filter((ticket) => {
    const due = Date.parse(ticket.due_at)
    return due >= start && due < activeUntil && wasOpen(ticket, activeUntil)
  })
  const overdueByDay = new Map<string, number>()
  for (const { due_at } of overdueTickets) {
    const day = dateKey(Date.parse(due_at))
    overdueByDay.set(day, (overdueByDay.get(day) ?? 0) + 1)
  }

  const daily = new Map<string, {
    sentiment: Record<'positive' | 'neutral' | 'negative', number>
    total: number
    green: number
    responseTotal: number
    responseCount: number
  }>()

  let totalResponseSeconds = 0
  let responseCount = 0
  for (const item of items) {
    const day = dateKey(Date.parse(item.created_at))
    const value = daily.get(day) ?? {
      sentiment: { positive: 0, neutral: 0, negative: 0 },
      total: 0, green: 0, responseTotal: 0, responseCount: 0,
    }
    value.sentiment[item.classification.sentiment] += 1
    value.total += 1
    if (item.level === 'green') value.green += 1

    const elapsed = responseSeconds.get(item.id)
    if (elapsed !== undefined) {
      value.responseTotal += elapsed
      value.responseCount += 1
      totalResponseSeconds += elapsed
      responseCount += 1
    }
    daily.set(day, value)

    if (item.classification.flags.includes('fraud')) {
      alerts.push({ id: `AL-${item.id}`, kind: 'fraud', text: item.text, created_at: item.created_at, inbox_id: item.id })
    }
  }

  const days: string[] = []
  for (let time = dateBoundary(dateKey(start)); time <= end; time += dayMs) days.push(dateKey(time))
  return {
    total: items.length,
    ai_resolved_pct: items.length ? Math.round((levelCounts.get('green') ?? 0) / items.length * 100) : 0,
    avg_response_sec: meanResponse(totalResponseSeconds, responseCount),
    overdue: overdueTickets.length,
    by_channel: channels.map((channel) => ({ channel, count: channelCounts.get(channel) ?? 0 })),
    by_level: levels.map((level) => ({ level, count: levelCounts.get(level) ?? 0 })),
    sentiment_daily: days.map((date) => ({
      date, ...(daily.get(date)?.sentiment ?? { positive: 0, neutral: 0, negative: 0 }),
    })),
    daily: days.map((date) => {
      const value = daily.get(date)
      return {
        date,
        total: value?.total ?? 0,
        ai_resolved_pct: value ? Math.round(value.green / value.total * 100) : 0,
        avg_response_sec: value ? meanResponse(value.responseTotal, value.responseCount) : 0,
        overdue: overdueByDay.get(date) ?? 0,
      }
    }),
    top_topics: Array.from(topicCounts, ([topic, count]) => ({
      topic, count, growth_pct: changedPercent(count, previousTopics.get(topic) ?? 0),
    })).sort((a, b) => b.count - a.count),
    by_region: Array.from(regionCounts, ([region, count]) => ({ region, count })).sort((a, b) => b.count - a.count),
    alerts: alerts.sort((a, b) => b.created_at.localeCompare(a.created_at)),
  }
}

export function startOfWeek(now: number) {
  const date = dateKey(now)
  const weekday = new Date(date).getUTCDay()
  return dateBoundary(date) - ((weekday + 6) % 7) * dayMs
}

function reportRange(period: string, now: number) {
  if (period === 'week') return { start: startOfWeek(now), end: now + 1 }
  if (/^\d{4}-(0[1-9]|1[0-2])$/.test(period)) {
    const start = dateBoundary(`${period}-01`)
    const nextMonth = new Date(Date.parse(`${period}-01`))
    nextMonth.setUTCMonth(nextMonth.getUTCMonth() + 1)
    return { start, end: dateBoundary(nextMonth.toISOString().slice(0, 10)) }
  }

  const days = /^([1-9]\d*)d$/i.exec(period)
  const length = days ? Number(days[1]) : 30
  const end = dateBoundary(dateKey(now)) + dayMs
  return { start: end - length * dayMs, end }
}

const localizedTopics = {
  transfer: {
    'uz-cyrl': { label: 'Ўқишни кўчириш', confusion: 'Талабалар ариза қаерга топширилиши ва транскрипт талаб қилинишини сўрамоқда.' },
    ru: { label: 'Перевод между вузами', confusion: 'Студенты уточняют, куда подавать заявление и нужно ли приложить транскрипт.' },
  },
  restoration: {
    'uz-cyrl': { label: 'Ўқишни қайта тиклаш', confusion: 'Ўқишни қайта тиклаш ва бошқа олийгоҳга кўчириб тиклаш тартиби чалкашмоқда.' },
    ru: { label: 'Восстановление на учёбе', confusion: 'Студенты путают обычное восстановление и восстановление с переводом в другой вуз.' },
  },
  contract: {
    'uz-cyrl': { label: 'Контракт тўлови', confusion: 'Талабалар контрактнинг қанча қисмини қайси муддатгача тўлаш кераклигини билмоқчи.' },
    ru: { label: 'Оплата контракта', confusion: 'Студенты хотят понять, какую часть контракта нужно оплатить к следующему сроку.' },
  },
  certification: {
    'uz-cyrl': { label: 'Педагоглар аттестацияси', confusion: 'Педагоглар навбатдаги ва навбатдан ташқари аттестация шартларини фарқлашга қийналмоқда.' },
    ru: { label: 'Аттестация педагогов', confusion: 'Педагогам сложно отличить условия плановой аттестации от внеочередной.' },
  },
  uniform: {
    'uz-cyrl': { label: 'Мактаб формаси', confusion: 'Ота-оналар кийимга қўйилган умумий талабларни амалий мисолларда кўрмоқчи.' },
    ru: { label: 'Школьная форма', confusion: 'Родители ищут конкретные примеры одежды, которая соответствует требованиям.' },
  },
} satisfies Record<keyof typeof topics, Record<'uz-cyrl' | 'ru', { label: string; confusion: string }>>

const publishedEffects: Partial<Record<keyof typeof topics, number>> = { transfer: -38, uniform: -24 }

function examplesFor(items: InboxItem[]) {
  const recent = [...items].sort((a, b) => b.created_at.localeCompare(a.created_at))
  const first = recent[0]
  if (!first) return []
  const second = recent.find(({ text, classification }) => (
    text !== first.text && (classification.lang !== first.classification.lang || classification.script !== first.classification.script)
  )) ?? recent.find(({ text }) => text !== first.text)
  return second ? [first.text, second.text] : [first.text]
}

export function buildFaqReport(period: string, answeredTopics: ReadonlySet<string>): FaqReport {
  const now = Date.now()
  const { start, end } = reportRange(period, now)
  const previousStart = start - (end - start)
  const current: InboxItem[] = []
  const previous: InboxItem[] = []
  for (const item of inbox.values()) {
    const time = Date.parse(item.created_at)
    if (time >= start && time < end) current.push(item)
    else if (time >= previousStart && time < start) previous.push(item)
  }

  const previousCounts = countBy(previous, (item) => item.classification.topic)
  const clusters: FaqReport['clusters'] = []
  for (const id of Object.keys(topics) as (keyof typeof topics)[]) {
    const topic = topics[id]
    const members = current.filter((item) => item.classification.topic === topic.label)
    if (!members.length) continue
    const localized = localizedTopics[id]
    const effect = publishedEffects[id]

    clusters.push({
      id,
      label: topic.label,
      count: members.length,
      growth_pct: changedPercent(members.length, previousCounts.get(topic.label) ?? 0),
      confusion: topic.confusion,
      examples: examplesFor(members),
      no_answer_in_kb: topic.level === 'yellow' && !answeredTopics.has(topic.label),
      explainer_draft: topic.overview['uz-latn'],
      translations: {
        'uz-cyrl': { ...localized['uz-cyrl'], explainer_draft: topic.overview['uz-cyrl'] },
        ru: { ...localized.ru, explainer_draft: topic.overview.ru },
      },
      ...(effect === undefined ? {} : { effect_pct: effect }),
    })
  }

  return {
    period,
    generated_at: new Date(now).toISOString(),
    from: new Date(start).toISOString(),
    to: new Date(end).toISOString(),
    clusters: clusters.sort((a, b) => b.count - a.count),
  }
}
