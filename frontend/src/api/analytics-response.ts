import { analyticsAlerts, channel, dateValue, finiteNumber, identifier, level, optionalString, record, rows, stringValue } from './backend-response'
import type { AnalyticsOutcome, AnalyticsSummary, Channel, FaqReport } from './types'

const dayMs = 86_400_000

export function analyticsDateBoundary(date: string, nextDay = false) {
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(date)) return date
  const timestamp = Date.parse(`${date}T00:00:00+05:00`)
  return Number.isFinite(timestamp) ? new Date(timestamp + (nextDay ? dayMs : 0)).toISOString() : date
}

function channelCounts(value: unknown): AnalyticsSummary['by_channel'] {
  const counts: Record<Channel, number> = { telegram: 0, web: 0, instagram: 0 }
  const entries = Array.isArray(value)
    ? rows(value).map(({ channel, count }) => [stringValue(channel), count] as const)
    : Object.entries(record(value))
  for (const [name, count] of entries) counts[channel(name)] += finiteNumber(count)
  return [
    { channel: 'telegram', count: counts.telegram },
    { channel: 'web', count: counts.web },
    { channel: 'instagram', count: counts.instagram },
  ]
}

export function analyticsSummary(value: unknown): AnalyticsSummary {
  const response = record(value)
  const levels = record(response.by_level)
  const regions = Array.isArray(response.by_region)
    ? rows(response.by_region).map(({ region, count }) => [region, count] as const)
    : Object.entries(record(response.by_region))
  return {
    total: finiteNumber(response.total),
    ai_resolved_pct: finiteNumber(response.ai_resolved_pct, Math.round(finiteNumber(response.auto_answer_rate) * 100)),
    avg_response_sec: finiteNumber(response.avg_response_sec, finiteNumber(record(response.response_time_s).p50)),
    response_time_kind: response.response_time_kind === 'median' || response.response_time_s ? 'median' : undefined,
    overdue: finiteNumber(response.overdue, finiteNumber(record(response.tickets).overdue)),
    by_channel: channelCounts(response.by_channel),
    by_level: Array.isArray(response.by_level)
      ? rows(response.by_level).map((row) => ({ level: level(row.level), count: finiteNumber(row.count) }))
      : [
        { level: 'green', count: finiteNumber(levels.green) },
        { level: 'yellow', count: finiteNumber(levels.yellow) + finiteNumber(levels.pending) },
        { level: 'red', count: finiteNumber(levels.red) },
      ],
    // TODO(backend): Supply a daily sentiment breakdown alongside the aggregate counts.
    sentiment_daily: rows(response.sentiment_daily).map((row) => ({
      date: dateValue(row.date), positive: finiteNumber(row.positive), neutral: finiteNumber(row.neutral), negative: finiteNumber(row.negative),
    })),
    alerts: analyticsAlerts(response.alerts),
    top_topics: rows(response.top_topics).flatMap(({ topic, count, growth_pct }) => typeof topic === 'string'
      ? [{ topic, count: finiteNumber(count), growth_pct: typeof growth_pct === 'number' ? finiteNumber(growth_pct) : undefined }]
      : []),
    by_region: regions.map(([region, count]) => ({ region: region === 'unknown' ? null : optionalString(region), count: finiteNumber(count) })),
    daily: rows(response.daily ?? response.per_day).map((row) => ({
      date: dateValue(row.date),
      total: finiteNumber(row.total ?? row.count),
      ai_resolved_pct: typeof row.ai_resolved_pct === 'number' ? finiteNumber(row.ai_resolved_pct) : undefined,
      avg_response_sec: typeof row.avg_response_sec === 'number' ? finiteNumber(row.avg_response_sec) : undefined,
      overdue: typeof row.overdue === 'number' ? finiteNumber(row.overdue) : undefined,
      ...(typeof row.ai === 'number' && typeof row.specialist === 'number' && typeof row.waiting === 'number'
        ? { ai: finiteNumber(row.ai), specialist: finiteNumber(row.specialist), waiting: finiteNumber(row.waiting) }
        : {}),
    })),
    by_outcome: outcome(response.by_outcome),
  }
}

function outcome(value: unknown): AnalyticsOutcome | undefined {
  const data = record(value)
  if (typeof data.ai !== 'number' || typeof data.specialist !== 'number' || typeof data.waiting !== 'number') return undefined
  return { ai: finiteNumber(data.ai), specialist: finiteNumber(data.specialist), waiting: finiteNumber(data.waiting) }
}

function translation(value: unknown) {
  const data = record(value)
  return {
    label: optionalString(data.label) ?? undefined,
    confusion: optionalString(data.confusion) ?? undefined,
    explainer_draft: optionalString(data.explainer_draft) ?? undefined,
  }
}

export function faqReport(value: unknown, period: string): FaqReport {
  const response = record(value)
  return {
    period: stringValue(response.period, period),
    generated_at: dateValue(response.generated_at ?? response.created_at, ''),
    from: optionalString(response.from) ?? undefined,
    to: optionalString(response.to) ?? undefined,
    clusters: rows(response.clusters).flatMap((cluster) => {
      const id = identifier(cluster.id)
      if (!id) return []
      const translations = record(cluster.translations)
      const examples: unknown[] = Array.isArray(cluster.examples) ? cluster.examples : []
      return [{
        id,
        label: stringValue(cluster.label),
        label_ru: optionalString(cluster.label_ru) ?? undefined,
        count: finiteNumber(cluster.count ?? cluster.size),
        growth_pct: finiteNumber(cluster.growth_pct, Math.round(finiteNumber(record(cluster.trend).change) * 100)),
        confusion: stringValue(cluster.confusion ?? cluster.what_is_unclear),
        examples: examples.filter((example): example is string => typeof example === 'string').slice(0, 2),
        no_answer_in_kb: (cluster.no_answer_in_kb ?? cluster.unanswered_in_kb) === true,
        explainer_draft: stringValue(cluster.explainer_draft ?? '', stringValue(record(cluster.explainer_draft).post)),
        effect_pct: typeof cluster.effect_pct === 'number' ? finiteNumber(cluster.effect_pct) : undefined,
        translations: {
          'uz-cyrl': translation(translations['uz-cyrl']),
          ru: translation(translations.ru),
        },
      }]
    }),
  }
}
