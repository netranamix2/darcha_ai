export interface ChatSession {
  session_id: string
}

export interface Citation {
  title: string
  ref: string
  url: string
}

export type Level = 'green' | 'yellow' | 'red'

export interface ChatReply {
  message_id: string
  answer: string
  citations: Citation[]
  level: Level
  ticket_number: string | null
  due_at: string | null
  // TODO(backend): add `warning` field for fraud detection
  warning?: 'fraud'
}

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant' | 'specialist'
  text: string
  created_at: string
  reply?: ChatReply
}

export type Channel = 'telegram' | 'web' | 'instagram'
export type Sentiment = 'positive' | 'neutral' | 'negative'

export interface InboxItem {
  id: string
  channel: Channel
  text: string
  created_at: string
  level: Level
  classification: {
    type: string
    topic: string
    region: string | null
    sentiment: Sentiment
    flags: string[]
    lang: 'uz' | 'ru'
    script: 'latin' | 'cyrillic'
  }
  draft: {
    answer: string
    citations: Citation[]
    confidence: number
  } | null
  status: 'draft' | 'approved' | 'sent' | 'rejected'
}

export interface Ticket {
  id: string
  number: string
  topic: string
  region: string | null
  priority: 'low' | 'normal' | 'high'
  status: 'new' | 'in_progress' | 'answered' | 'overdue'
  created_at: string
  due_at: string
  summary: string
  original_text: string
  channel: Channel
  draft_answer: string | null
  final_answer: string | null
  similar_cases: { number: string; summary: string }[]
}

export type TicketPatch = Partial<Omit<Ticket, 'id'>>

export interface AnalyticsAlert {
  id: string
  kind: 'spike' | 'fraud'
  text: string
  created_at: string
}

export interface AnalyticsSummary {
  total: number
  ai_resolved_pct: number
  avg_response_sec: number
  overdue: number
  by_channel: { channel: Channel; count: number }[]
  by_level: { level: Level; count: number }[]
  sentiment_daily: { date: string; positive: number; neutral: number; negative: number }[]
  top_topics: { topic: string; count: number }[]
  by_region: { region: string | null; count: number }[]
  alerts: AnalyticsAlert[]
}

export interface FaqReport {
  period: string
  generated_at: string
  clusters: {
    id: string
    label: string
    count: number
    growth_pct: number
    confusion: string
    examples: string[]
    no_answer_in_kb: boolean
    explainer_draft: string
  }[]
}

export type StaffRole = 'operator' | 'specialist' | 'manager'

export interface LoginReply {
  token: string
  role: StaffRole
}
