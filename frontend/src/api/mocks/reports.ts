import { ApiError } from '../errors'
import type { AnalyticsAlert, AnalyticsSummary, Channel, FaqReport, InboxItem, Level } from '../types'
import { topics } from './chat'
import { dateBoundary, dateKey, dayMs } from './dates'
import { inbox, responseSeconds, spikeAlert, tickets } from './fixtures'

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

export function summarizeAnalytics(from: string, to: string): AnalyticsSummary {
  const start = dateBoundary(from)
  const end = dateBoundary(to, true)
  if (!(start <= end)) throw new ApiError(400, 'Invalid analytics date range')

  function inRange(timestamp: string) {
    const time = Date.parse(timestamp)
    return time >= start && time <= end
  }

  const items = Array.from(inbox.values()).filter((item) => inRange(item.created_at))
  const channelCounts = countBy(items, (item) => item.channel)
  const levelCounts = countBy(items, (item) => item.level)
  const topicCounts = countBy(items, (item) => item.classification.topic)
  const regionCounts = countBy(items, (item) => item.classification.region)
  const dailySentiment = new Map<string, AnalyticsSummary['sentiment_daily'][number]>()
  const alerts: AnalyticsAlert[] = inRange(spikeAlert.created_at) ? [spikeAlert] : []

  let totalResponseSeconds = 0
  let responseCount = 0
  for (const item of items) {
    const day = dateKey(Date.parse(item.created_at))
    const daily = dailySentiment.get(day) ?? { date: day, positive: 0, neutral: 0, negative: 0 }
    daily[item.classification.sentiment] += 1
    dailySentiment.set(day, daily)

    const elapsed = responseSeconds.get(item.id)
    if (elapsed !== undefined) {
      totalResponseSeconds += elapsed
      responseCount += 1
    }

    if (item.classification.flags.includes('fraud')) {
      alerts.push({ id: `AL-${item.id}`, kind: 'fraud', text: item.text, created_at: item.created_at })
    }
  }

  const now = Date.now()
  const currentTickets = Array.from(tickets.values()).filter((ticket) => inRange(ticket.created_at))
  const overdue = currentTickets.filter((ticket) => (
    ticket.status !== 'answered' && Date.parse(ticket.due_at) < now
  )).length

  return {
    total: items.length,
    ai_resolved_pct: items.length ? Math.round((levelCounts.get('green') ?? 0) / items.length * 100) : 0,
    avg_response_sec: responseCount ? Math.round(totalResponseSeconds / responseCount) : 0,
    overdue,
    by_channel: channels.map((channel) => ({ channel, count: channelCounts.get(channel) ?? 0 })),
    by_level: levels.map((level) => ({ level, count: levelCounts.get(level) ?? 0 })),
    sentiment_daily: Array.from(dailySentiment.values()).sort((a, b) => a.date.localeCompare(b.date)),
    top_topics: Array.from(topicCounts, ([topic, count]) => ({ topic, count })).sort((a, b) => b.count - a.count),
    by_region: Array.from(regionCounts, ([region, count]) => ({ region, count })).sort((a, b) => b.count - a.count),
    alerts: alerts.sort((a, b) => b.created_at.localeCompare(a.created_at)),
  }
}

function reportRange(period: string, now: number) {
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
  for (const [id, topic] of Object.entries(topics)) {
    const examples = current
      .filter((item) => item.classification.topic === topic.label)
      .map((item) => item.text)
    const count = examples.length
    if (count === 0) continue

    const previousCount = previousCounts.get(topic.label) ?? 0
    clusters.push({
      id,
      label: topic.label,
      count,
      growth_pct: previousCount ? Math.round((count - previousCount) / previousCount * 100) : 0,
      confusion: topic.confusion,
      examples: examples.slice(0, 3),
      no_answer_in_kb: topic.level === 'yellow' && !answeredTopics.has(topic.label),
      explainer_draft: topic.overview['uz-latn'],
    })
  }

  return { period, generated_at: new Date(now).toISOString(), clusters: clusters.sort((a, b) => b.count - a.count) }
}
