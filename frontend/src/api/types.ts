export interface ChatSession {
  session_id: string
}

export interface Citation {
  title: string
  ref: string
  url: string
}

export interface KnowledgeDocument {
  title: string
  number: string
  date: string
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
  ticket_id?: string | null
  ticket_number?: string | null
}

export type TicketDepartment = 'higher' | 'schools' | 'attestation' | 'regional'

export interface StaffMember {
  id: string
  name: string
  department: TicketDepartment
  is_current?: boolean
}

export interface TicketEvent {
  type: 'created' | 'assigned' | 'viewed' | 'answered' | 'rated' | 'extended' | 'status_changed'
  actor: string
  created_at: string
  note?: string
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
  similar_cases: { number: string; summary: string; answer?: string }[]
  department?: TicketDepartment
  assignee_id?: string | null
  flags?: string[]
  // TODO(backend): ticket_events
  events?: TicketEvent[]
  extension_reason?: string | null
  original_due_at?: string
}

export type TicketPatch = Partial<Omit<Ticket, 'id'>>

export interface AnalyticsAlert {
  id: string
  kind: 'spike' | 'fraud'
  text: string
  created_at: string
  appeal_count?: number
  growth_pct?: number
  // TODO(backend): include the linked Inbox item on individual alerts.
  inbox_id?: string | null
}

export interface AnalyticsDay {
  date: string
  total: number
  ai_resolved_pct?: number
  avg_response_sec?: number
  overdue?: number
}

export interface AnalyticsSummary {
  total: number
  ai_resolved_pct: number
  avg_response_sec: number
  response_time_kind?: 'median'
  overdue: number
  by_channel: { channel: Channel; count: number }[]
  by_level: { level: Level; count: number }[]
  sentiment_daily: { date: string; positive: number; neutral: number; negative: number }[]
  top_topics: { topic: string; count: number; growth_pct?: number }[]
  by_region: { region: string | null; count: number }[]
  alerts: AnalyticsAlert[]
  // TODO(backend): add daily AI share, average response time and overdue count.
  daily?: AnalyticsDay[]
}

export interface BackendAnalyticsSummary {
  total: number
  by_channel: Partial<Record<Channel, number>>
  by_level: Partial<Record<Level | 'pending', number>>
  by_region: Record<string, number>
  top_topics: AnalyticsSummary['top_topics']
  per_day: { date: string; count: number }[]
  auto_answer_rate: number | null
  response_time_s: { p50: number | null }
  tickets: { overdue: number }
}

export interface FaqReport {
  period: string
  generated_at: string
  from?: string
  to?: string
  clusters: {
    id: string
    label: string
    count: number
    growth_pct: number
    confusion: string
    examples: string[]
    no_answer_in_kb: boolean
    explainer_draft: string
    // TODO(backend): track change in questions after an explainer is published.
    effect_pct?: number
    label_ru?: string
    translations?: Partial<Record<'uz-cyrl' | 'ru', { label?: string; confusion?: string; explainer_draft?: string }>>
  }[]
}

export interface BackendFaqReport {
  period: string
  from: string
  to: string
  created_at: string
  clusters: {
    id: number | string
    label: string
    label_ru: string | null
    what_is_unclear: string
    size: number
    trend: { change?: number }
    examples: string[]
    unanswered_in_kb: boolean
    explainer_draft: { post?: string }
  }[]
}

export type CaseChangeKind = 'update' | 'reset' | 'report'

export type StaffRole = 'operator' | 'specialist' | 'manager'

export interface LoginReply {
  token: string
  role: StaffRole
}

export interface InstagramComment {
  id: string
  author: string
  text: string
  created_at: string
  is_bot: boolean
  hidden?: boolean
  pending?: boolean
  replies: InstagramComment[]
}

export interface InstagramTrace {
  comment_id: string
  received_at: string
  level: Level | 'hidden'
  lang?: 'uz-latn' | 'uz-cyrl' | 'ru'
  topic?: string
  documents?: number
  replied_at?: string | null
  ticket_number?: string | null
  reason?: 'abuse' | 'off_topic'
}

export interface InstagramFeed {
  post_id: string
  comments: InstagramComment[]
  traces: InstagramTrace[]
}
