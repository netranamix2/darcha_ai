import type { AnalyticsOutcome, AnalyticsSummary, InboxItem } from '../api/types'

export function outcomeTotals(summary: AnalyticsSummary): AnalyticsOutcome | null {
  if (summary.by_outcome) return summary.by_outcome
  const days = summary.daily ?? []
  if (!days.length || !days.every((day) => day.ai !== undefined)) return null
  return days.reduce<AnalyticsOutcome>((sum, day) => ({
    ai: sum.ai + (day.ai ?? 0), specialist: sum.specialist + (day.specialist ?? 0), waiting: sum.waiting + (day.waiting ?? 0),
  }), { ai: 0, specialist: 0, waiting: 0 })
}

const sentenceSplit = /(?<=[.!?])\s+/u

function questionOf(text: string) {
  const sentences = text.trim().split(sentenceSplit)
  return sentences.find((sentence) => sentence.trim().endsWith('?'))?.trim() ?? null
}

function normalize(text: string) {
  return text.toLocaleLowerCase().replace(/[ʻʼ'`‘’]/gu, '').replace(/[^\p{L}\p{N}]+/gu, ' ').trim()
}

type Question = { key: string; text: string; count: number }

export function topQuestions(items: InboxItem[], from: number): Question[] {
  const recent = items.filter((item) => Date.parse(item.created_at) >= from)
  const byText = new Map<string, Question>()
  for (const item of recent) {
    const question = questionOf(item.text)
    if (!question) continue
    const key = normalize(question)
    const row = byText.get(key) ?? { key, text: question, count: 0 }
    row.count += 1
    byText.set(key, row)
  }
  const exact = [...byText.values()].sort((a, b) => b.count - a.count || a.text.length - b.text.length)
  if (exact[0] && exact[0].count > 1) return exact.slice(0, 10)

  // Texts are all unique (typical for live data): group by topic, show its most typical (shortest) question.
  const byTopic = new Map<string, { count: number; text: string | null }>()
  for (const item of recent) {
    const topic = item.classification.topic || '—'
    const row = byTopic.get(topic) ?? { count: 0, text: null }
    row.count += 1
    const question = questionOf(item.text)
    if (question && (!row.text || question.length < row.text.length)) row.text = question
    byTopic.set(topic, row)
  }
  return [...byTopic].flatMap(([topic, { count, text }]) => text ? [{ key: topic, text, count }] : [])
    .sort((a, b) => b.count - a.count).slice(0, 10)
}

