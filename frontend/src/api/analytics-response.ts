import type { AnalyticsSummary, BackendAnalyticsSummary, BackendFaqReport, Channel, FaqReport } from './types'

const channels: Channel[] = ['telegram', 'web', 'instagram']
const dayMs = 86_400_000

export function analyticsDateBoundary(date: string, nextDay = false) {
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(date)) return date
  const timestamp = Date.parse(`${date}T00:00:00+05:00`)
  return Number.isFinite(timestamp) ? new Date(timestamp + (nextDay ? dayMs : 0)).toISOString() : date
}

export function analyticsSummary(response: AnalyticsSummary | BackendAnalyticsSummary): AnalyticsSummary {
  if (!('auto_answer_rate' in response)) return response
  const levels = response.by_level
  return {
    total: response.total,
    ai_resolved_pct: Math.round((response.auto_answer_rate ?? 0) * 100),
    avg_response_sec: response.response_time_s.p50 ?? 0,
    response_time_kind: 'median',
    overdue: response.tickets.overdue,
    by_channel: channels.map((channel) => ({ channel, count: response.by_channel[channel] ?? 0 })),
    by_level: [
      { level: 'green', count: levels.green ?? 0 },
      { level: 'yellow', count: (levels.yellow ?? 0) + (levels.pending ?? 0) },
      { level: 'red', count: levels.red ?? 0 },
    ],
    // TODO(backend): the current summary exposes sentiment and alert counts only for the whole period.
    sentiment_daily: [],
    alerts: [],
    top_topics: response.top_topics,
    by_region: Object.entries(response.by_region).map(([region, count]) => ({ region: region === 'unknown' ? null : region, count })),
    daily: response.per_day.map(({ date, count }) => ({ date, total: count })),
  }
}

export function faqReport(response: FaqReport | BackendFaqReport): FaqReport {
  if (!('created_at' in response)) return response
  return {
    period: response.period,
    generated_at: response.created_at,
    from: response.from,
    to: response.to,
    clusters: response.clusters.map((cluster) => ({
      id: String(cluster.id),
      label: cluster.label,
      label_ru: cluster.label_ru ?? undefined,
      count: cluster.size,
      growth_pct: Math.round((cluster.trend.change ?? 0) * 100),
      confusion: cluster.what_is_unclear,
      examples: cluster.examples.slice(0, 2),
      no_answer_in_kb: cluster.unanswered_in_kb,
      explainer_draft: cluster.explainer_draft.post ?? '',
    })),
  }
}
