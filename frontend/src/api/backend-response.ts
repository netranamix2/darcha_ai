import { ApiError } from './errors'
import type {
  AnalyticsAlert, Channel, ChatMessage, ChatReply, ChatSession, Citation, InboxItem, Level,
  LoginReply, StaffMember, Ticket, TicketDepartment, TicketEvent, TicketPatch,
} from './types'

export function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

export function rows(value: unknown) {
  return Array.isArray(value) ? (value as unknown[]).map(record) : []
}

export function stringValue(value: unknown, fallback = '') {
  return typeof value === 'string' ? value : fallback
}

export function finiteNumber(value: unknown, fallback = 0) {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function strings(value: unknown) {
  return Array.isArray(value) ? value.filter((entry: unknown): entry is string => typeof entry === 'string') : []
}

export function identifier(value: unknown) {
  return typeof value === 'number' && Number.isSafeInteger(value) ? String(value) : stringValue(value)
}

export function optionalString(value: unknown) {
  return stringValue(value) || null
}

export function dateValue(value: unknown, fallback = new Date(0).toISOString()) {
  const input = stringValue(value)
  return Number.isFinite(Date.parse(input)) ? input : fallback
}

export function channel(value: unknown): Channel {
  const name = stringValue(value)
  if (name === 'telegram' || name.startsWith('telegram_')) return 'telegram'
  return name === 'instagram' || name.startsWith('instagram_') ? 'instagram' : 'web'
}

export function level(value: unknown): Level {
  if (value === 'yellow' || value === 'pending') return 'yellow'
  return value === 'red' ? 'red' : 'green'
}

function webUrl(value: unknown) {
  const url = stringValue(value)
  try {
    const parsed = new URL(url)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? url : ''
  } catch {
    return ''
  }
}

function citations(value: unknown): Citation[] {
  return rows(value).flatMap((entry) => {
    const title = stringValue(entry.title)
    return title ? [{ title, ref: stringValue(entry.ref), url: webUrl(entry.url) }] : []
  })
}

export function session(value: unknown): ChatSession {
  const session_id = identifier(record(value).session_id)
  if (!session_id) throw new ApiError(502, 'Chat session ID is missing')
  return { session_id }
}

export function credentials(value: unknown): LoginReply & { staffId: string } {
  const data = record(value)
  const user = record(data.user)
  const token = stringValue(data.token ?? data.access_token)
  if (!token) throw new ApiError(502, 'Authentication response is incomplete')
  const role = data.role ?? user.role
  if (role === 'kb_admin') throw new ApiError(403, 'This account does not have a panel role')
  return {
    token,
    staffId: identifier(user.id),
    role: role === 'admin' ? 'manager' : role === 'manager' || role === 'specialist' ? role : 'operator',
  }
}

function replyId(rawId: unknown) {
  const id = identifier(rawId)
  return /^\d+$/u.test(id) ? `m${id}:reply` : id
}

export function chatReply(value: unknown, fallbackId = ''): ChatReply {
  const data = record(value)
  const message_id = replyId(data.message_id) || fallbackId
  if (!message_id) throw new ApiError(502, 'Chat reply ID is missing')
  return {
    message_id,
    answer: stringValue(data.answer ?? data.text),
    citations: citations(data.citations),
    level: level(data.level),
    ticket_number: optionalString(data.ticket_number),
    due_at: optionalString(data.due_at),
    warning: data.warning === 'fraud' ? 'fraud' : undefined,
  }
}

export function chatMessages(value: unknown, immediateReplies: ReadonlyMap<string, ChatReply>): ChatMessage[] {
  let firstReply = false
  let userId = ''
  const messages: ChatMessage[] = []

  for (const entry of rows(value)) {
    const rawId = identifier(entry.id)
    if (!rawId) continue
    const created_at = dateValue(entry.created_at)
    const text = stringValue(entry.text)
    if (entry.role === 'user') {
      messages.push({ id: rawId, role: 'user', created_at, text })
      userId = rawId
      firstReply = /^m\d+$/u.test(rawId)
      continue
    }
    if (entry.role !== 'assistant' && entry.role !== 'bot' && entry.role !== 'specialist') continue

    const role = entry.role === 'specialist' ? 'specialist' : 'assistant'
    const id = firstReply && role === 'assistant' ? `${userId}:reply` : rawId
    firstReply = false
    const data = entry.reply ?? entry
    let reply = chatReply(data, id)
    const immediate = immediateReplies.get(id)
    if (entry.pending === true && immediate && immediate.level !== 'yellow') {
      // Pending history omits ticket numbers and whether a message was ignored.
      if (immediate.level === 'green' && !immediate.answer) continue
      reply = immediate
    } else if (role === 'specialist' || (reply.level === 'yellow' && entry.pending !== true && reply.answer)) {
      reply = { ...reply, level: 'green' }
    }
    if (immediate?.warning) reply.warning = immediate.warning
    if (record(data).level === 'none' && !reply.answer) continue
    messages.push({ id: reply.message_id, role, created_at, reply, text: reply.answer })
  }
  return messages
}

export function inboxItems(value: unknown, links: ReadonlyMap<string, Pick<Ticket, 'id' | 'number'>>): InboxItem[] {
  return rows(value).flatMap((entry) => {
    const id = identifier(entry.id)
    if (!id || entry.level === 'none' || entry.status === 'skipped') return []
    const message = record(entry.message)
    const classification = record(entry.classification ?? message.classification)
    const draft = record(entry.draft ?? entry)
    const status = entry.status === 'approved' || entry.status === 'sent' || entry.status === 'rejected'
      ? entry.status : 'draft'
    const sentiment = classification.sentiment === 'positive' || classification.sentiment === 'negative'
      ? classification.sentiment : 'neutral'
    const script = classification.script ?? message.script
    const linksForMessage = links.get(identifier(message.id))
    const answer = stringValue(draft.answer)
    return [{
      id,
      channel: channel(entry.channel ?? message.channel),
      text: stringValue(entry.text ?? message.text),
      created_at: dateValue(message.received_at ?? entry.created_at),
      level: level(entry.level),
      classification: {
        type: stringValue(classification.type),
        topic: stringValue(classification.topic_name ?? classification.topic),
        region: optionalString(classification.region),
        sentiment,
        flags: strings(classification.flags),
        lang: (classification.lang ?? message.lang) === 'ru' ? 'ru' : 'uz',
        script: script === 'cyrillic' || script === 'cyrl' ? 'cyrillic' : 'latin',
      },
      draft: entry.draft === null || (!answer && status !== 'draft') ? null : {
        answer,
        citations: citations(draft.citations),
        confidence: finiteNumber(draft.confidence),
      },
      status,
      ticket_id: identifier(entry.ticket_id) || linksForMessage?.id || null,
      ticket_number: optionalString(entry.ticket_number) ?? linksForMessage?.number ?? null,
    }]
  })
}

export function department(value: unknown): TicketDepartment | undefined {
  const name = stringValue(value).toLowerCase()
  if (/higher|admission|oliy|universit|высш/u.test(name)) return 'higher'
  if (/schools?|maktab|школ|preschool/u.test(name)) return 'schools'
  if (/attestation|attestat|teachers|pedagog|педагог|аттест/u.test(name)) return 'attestation'
  if (/regional|appeals|security|hudud|murojaat|регион/u.test(name)) return 'regional'
  return undefined
}

function ticketEvents(value: unknown): TicketEvent[] {
  return rows(value).flatMap((row) => {
    const details = record(row.payload)
    const base = { actor: stringValue(row.actor), created_at: dateValue(row.created_at) }
    const events: TicketEvent[] = []
    switch (row.type) {
      case 'created':
      case 'assigned':
      case 'viewed':
      case 'answered':
      case 'rated':
      case 'extended':
      case 'status_changed':
        events.push({ ...base, type: row.type, note: optionalString(row.note) ?? undefined })
        break
      case 'updated':
        if (details.assignee_id != null) events.push({ ...base, type: 'assigned' })
        if (details.status) events.push({ ...base, type: 'status_changed' })
        break
    }
    return events
  })
}

export function ticket(value: unknown): Ticket {
  const data = record(value)
  const message = record(data.message)
  const classification = record(message.classification)
  const id = identifier(data.id)
  if (!id) throw new ApiError(502, 'Ticket ID is missing')
  const summary = stringValue(data.summary ?? message.text)
  const created_at = dateValue(data.created_at)
  const due_at = dateValue(data.due_at, '')

  return {
    id,
    number: stringValue(data.number) || id,
    topic: stringValue(data.topic ?? classification.topic_name ?? classification.topic) || summary,
    summary,
    region: optionalString(data.region ?? classification.region),
    priority: data.priority === 'high' || data.priority === 'low' ? data.priority : 'normal',
    status: data.status === 'closed' || data.status === 'answered' ? 'answered'
      : data.status === 'in_progress' || data.status === 'overdue' ? data.status : 'new',
    created_at,
    due_at,
    channel: channel(data.channel ?? message.channel),
    original_text: stringValue(data.original_text ?? message.text, summary),
    draft_answer: optionalString(data.draft_answer),
    final_answer: optionalString(data.final_answer),
    similar_cases: rows(data.similar_cases ?? data.similar).flatMap((entry) => {
      const number = stringValue(entry.number)
      return number ? [{ number, summary: stringValue(entry.summary), answer: optionalString(entry.answer ?? entry.final_answer) ?? undefined }] : []
    }),
    department: department(data.department_code ?? data.department),
    assignee_id: identifier(data.assignee_id) || null,
    flags: strings(data.flags ?? classification.flags),
    events: ticketEvents(data.events),
    extension_reason: optionalString(data.extension_reason),
    original_due_at: optionalString(data.original_due_at) ?? undefined,
  }
}

export function ticketPatch(patch: TicketPatch, departmentCodes: ReadonlyMap<string, TicketDepartment>) {
  if (patch.due_at !== undefined || patch.extension_reason !== undefined) {
    // TODO(backend): Accept deadline extensions atomically with a reason and citizen notification.
    throw new ApiError(422, 'The server does not support deadline extensions')
  }
  if (patch.assignee_id === null) {
    // TODO(backend): Distinguish omitted fields from an explicit null assignee when applying a patch.
    throw new ApiError(422, 'The server does not support clearing the assignee')
  }
  const assigneeId = patch.assignee_id === undefined ? undefined : Number(patch.assignee_id)
  if (assigneeId !== undefined && (!Number.isSafeInteger(assigneeId) || assigneeId <= 0)) {
    throw new ApiError(422, 'A live ticket requires a live assignee')
  }
  const departmentId = [...departmentCodes].find(([, name]) => name === patch.department)?.[0]
  if (patch.department && !departmentId) throw new ApiError(422, 'Unknown server department')
  return {
    status: patch.status === 'new' || patch.status === 'overdue' ? 'open' : patch.status,
    assignee_id: assigneeId,
    department_id: departmentId === undefined ? undefined : Number(departmentId),
    priority: patch.priority,
  }
}

export function staffList(value: unknown, departments: ReadonlyMap<string, TicketDepartment>, currentStaffId: string): StaffMember[] {
  return rows(value).flatMap((entry) => {
    const id = identifier(entry.id)
    const name = stringValue(entry.name ?? entry.full_name ?? entry.username)
    return id && name ? [{
      id,
      name,
      department: department(entry.department) ?? departments.get(identifier(entry.department_id)) ?? 'regional',
      is_current: id === currentStaffId || entry.is_current === true,
    }] : []
  })
}

export function documents(value: unknown): Citation[] {
  return citations(rows(value).filter((entry) => entry.status !== 'repealed').map((entry) => ({
    title: entry.title,
    ref: entry.ref ?? entry.number,
    url: entry.url ?? entry.source_url,
  })))
}

export function analyticsAlerts(value: unknown): AnalyticsAlert[] {
  return rows(value).flatMap((entry) => {
    const id = identifier(entry.id)
    if (!id || (entry.kind !== 'spike' && entry.kind !== 'fraud')) return []
    const payload = record(entry.payload)
    return [{
      id,
      kind: entry.kind,
      created_at: dateValue(entry.created_at),
      text: stringValue(entry.text),
      inbox_id: identifier(entry.inbox_id ?? payload.response_id) || null,
      appeal_count: typeof entry.appeal_count === 'number' ? finiteNumber(entry.appeal_count) : undefined,
      growth_pct: typeof entry.growth_pct === 'number' ? finiteNumber(entry.growth_pct) : undefined,
    }]
  })
}
