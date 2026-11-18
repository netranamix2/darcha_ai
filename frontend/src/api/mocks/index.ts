import { ApiError } from '../errors'
import type { ChatMessage, ChatReply, ChatSession, FaqReport, InboxItem, Level, LoginReply, StaffRole, Ticket, TicketPatch } from '../types'
import { determineReply, publicRegulations } from './chat'
import type { MockLocale } from './chat'
import {
  answeredTopics, cases, nonBlank, persistChatState, reports, requireRecord, resetChatState,
  sessions, ticketFallbackDelay, withChatState,
} from './chat-state'
import type { ChatCase } from './chat-state'
import { inbox, responseSeconds, tickets } from './fixtures'
import { buildFaqReport, startOfWeek, summarizeAnalytics } from './reports'
import { currentStaff, staff } from './ticket-examples'
import {
  answerCitations, convertInboxItem, createTicketForInbox, getMockKnowledgeBase, markDelivered, patchTicket,
  processTicketActivity, resolveTicket, viewTicket,
} from './ticket-operations'

function pause() {
  const milliseconds = 400 + Math.floor(Math.random() * 801)
  return new Promise<void>((resolve) => setTimeout(resolve, milliseconds))
}

export async function getPublicRegulations(locale: MockLocale) {
  await pause()
  return publicRegulations(locale)
}

export async function resetDemoData(): Promise<void> {
  await pause()
  return withChatState(resetChatState)
}

function newestFirst<T extends { created_at: string }>(items: T[]) {
  return items.sort((a, b) => b.created_at.localeCompare(a.created_at))
}

export async function createChatSession(apiFallback = false): Promise<ChatSession> {
  await pause()
  return withChatState(() => {
    const sessionId = `${apiFallback ? 'demo-' : ''}${crypto.randomUUID()}`
    sessions.set(sessionId, [])
    persistChatState()
    return { session_id: sessionId }
  })
}

export async function getChatMessages(sessionId: string, allowMissing = false): Promise<ChatMessage[]> {
  await pause()
  return readChatMessages(sessionId, allowMissing)
}

export function readChatMessages(sessionId: string, allowMissing: boolean): Promise<ChatMessage[]> {
  return withChatState(() => {
    const messages = allowMissing ? sessions.get(sessionId) ?? [] : requireRecord(sessions, sessionId)
    deliverReadyReplies(sessionId)
    return structuredClone(messages)
  })
}

export async function sendChatMessage(
  sessionId: string, text: string, { shadow = false, allowMissing = false } = {},
): Promise<ChatReply> {
  const started = Date.now()
  await pause()
  return withChatState(() => {
    if (allowMissing && !sessions.has(sessionId)) sessions.set(sessionId, [])
    return recordMessage(sessionId, text, started, shadow)
  })
}

function recordMessage(sessionId: string, text: string, started: number, shadow: boolean): ChatReply {
  const history = requireRecord(sessions, sessionId)
  const message = nonBlank(text)
  deliverReadyReplies(sessionId)
  const classified = determineReply(message)
  const result = classified.level === 'yellow' && classified.topic !== 'Boshqa murojaatlar' && answeredTopics.has(classified.topic)
    ? { ...classified, level: 'green' as const, answer: classified.followUp }
    : classified
  const now = Date.now()
  const createdAt = new Date(now).toISOString()
  const inboxId = `IN-${crypto.randomUUID()}`
  const topic = result.topic

  const reply: ChatReply = {
    message_id: crypto.randomUUID(),
    answer: result.answer,
    citations: result.citations,
    level: result.level,
    ticket_number: null,
    due_at: null,
  }
  const messages: ChatMessage[] = [
    { id: crypto.randomUUID(), role: 'user', text: message, created_at: createdAt },
    { id: reply.message_id, role: 'assistant', text: reply.answer, created_at: createdAt, reply },
  ]
  if (classified.refused) {
    history.push(...messages)
    persistChatState()
    return structuredClone(reply)
  }
  const record: ChatCase = {
    sessionId,
    shadow,
    messageId: reply.message_id,
    ticketId: null,
    followUp: result.level === 'green' ? null : {
      availableAt: now + (result.level === 'yellow' ? 15_000 : ticketFallbackDelay),
      answer: result.followUp,
      citations: result.citations,
    },
  }

  const item: InboxItem = {
    id: inboxId,
    channel: 'web',
    text: message,
    created_at: createdAt,
    level: result.level,
    classification: {
      type: result.level === 'red' ? 'Shikoyat' : 'Savol',
      topic,
      region: null,
      sentiment: result.level === 'red' ? 'negative' : 'neutral',
      flags: result.fraud ? ['fraud'] : [],
      lang: result.locale === 'ru' ? 'ru' : 'uz',
      script: result.locale === 'uz-latn' ? 'latin' : 'cyrillic',
    },
    draft: result.level === 'yellow'
      ? { answer: result.followUp, citations: result.citations, confidence: 0.62 }
      : null,
    status: result.level === 'green' ? 'sent' : 'draft',
  }
  inbox.set(inboxId, item)

  if (result.level === 'red') {
    const ticket = createTicketForInbox(item, now, result.followUp)
    record.ticketId = ticket.id
    reply.ticket_number = ticket.number
    reply.due_at = ticket.due_at
    if (result.fraud) reply.warning = 'fraud'
  }

  if (result.level === 'green') responseSeconds.set(inboxId, (now - started) / 1000)

  history.push(...messages)
  cases.set(inboxId, record)
  persistChatState()
  return structuredClone(reply)
}

function deliverReadyReplies(sessionId?: string) {
  const now = Date.now()
  let changed = false

  for (const [inboxId, record] of cases) {
    const { followUp } = record
    if (!followUp || (sessionId && record.sessionId !== sessionId)) continue

    const item = requireRecord(inbox, inboxId)
    if (item.status === 'rejected') continue

    if (record.ticketId) {
      if (now < followUp.availableAt) continue
      const ticket = requireRecord(tickets, record.ticketId)
      if (!resolveTicket(ticket, followUp.answer, 'ai', followUp.citations)) {
        markDelivered(record, item, now)
      }
    } else {
      if (item.status !== 'approved' && now < followUp.availableAt) continue
      const messages = requireRecord(sessions, record.sessionId)
      const message = messages.find(({ id }) => id === record.messageId)
      if (!message?.reply) continue
      const draft = item.draft
      const answer = draft?.answer ?? followUp.answer
      const citations = draft?.citations.length ? draft.citations : followUp.citations
      message.text = answer
      message.reply = { ...message.reply, level: 'green', answer, citations }
      markDelivered(record, item, now)
    }
    changed = true
  }

  if (changed) persistChatState()
}

export async function login(email: string, password: string): Promise<LoginReply> {
  await pause()
  if (!email.trim() || !password.trim()) throw new ApiError(401, 'Email and password are required')

  const username = email.trim().toLowerCase().split('@')[0]
  const role: StaffRole = username === 'specialist' || username === 'manager' ? username : 'operator'
  return { token: `demo-${crypto.randomUUID()}`, role }
}

export async function getInbox(level?: Level): Promise<InboxItem[]> {
  await pause()
  return withChatState(() => {
    deliverReadyReplies()
    const items = Array.from(inbox.values()).filter((item) => !level || item.level === level)
    return structuredClone(newestFirst(items))
  })
}

export async function approveResponse(id: string): Promise<void> {
  await pause()
  await withChatState(() => {
    const item = requireRecord(inbox, id)
    if (!item.draft || item.ticket_id || item.status === 'rejected') throw new ApiError(409, 'No pending response to approve')
    if (item.status === 'approved' || item.status === 'sent') return

    item.status = 'approved'
    responseSeconds.set(id, (Date.now() - Date.parse(item.created_at)) / 1000)
    persistChatState()
  })
}

export async function rejectResponse(id: string): Promise<void> {
  await pause()
  await withChatState(() => {
    const item = requireRecord(inbox, id)
    if (item.status === 'sent' || item.ticket_id) throw new ApiError(409, 'Response cannot be rejected')

    item.status = 'rejected'
    responseSeconds.delete(id)
    persistChatState()
  })
}

export async function editResponse(id: string, text: string): Promise<void> {
  await pause()
  await withChatState(() => {
    const item = requireRecord(inbox, id)
    if (item.status === 'sent' || item.ticket_id) throw new ApiError(409, 'Response cannot be edited')

    item.draft = {
      answer: nonBlank(text),
      citations: item.draft?.citations ?? [],
      confidence: item.draft?.confidence ?? 0,
    }
    item.status = 'draft'
    responseSeconds.delete(id)
    persistChatState()
  })
}

export async function getTickets(): Promise<Ticket[]> {
  await pause()
  return withChatState(() => {
    deliverReadyReplies()
    processTicketActivity()
    return structuredClone(newestFirst(Array.from(tickets.values())))
  })
}

export async function getTicket(id: string): Promise<Ticket> {
  await pause()
  return withChatState(() => {
    deliverReadyReplies()
    return structuredClone(requireRecord(tickets, id))
  })
}

export function getChatCases() {
  return withChatState(() => {
    deliverReadyReplies()
    const shadowCases = [...cases.entries()].filter(([, record]) => record.shadow)
    return structuredClone({
      inbox: shadowCases.map(([id]) => requireRecord(inbox, id)),
      tickets: shadowCases.flatMap(([, { ticketId }]) => ticketId ? [requireRecord(tickets, ticketId)] : []),
    })
  })
}

export async function convertInboxToTicket(id: string): Promise<Ticket> {
  await pause()
  return withChatState(() => structuredClone(convertInboxItem(id)))
}

export async function getStaff() {
  await pause()
  return structuredClone(staff)
}

export async function getKnowledgeBase() {
  await pause()
  return getMockKnowledgeBase()
}

export async function markTicketViewed(id: string): Promise<void> {
  await pause()
  await withChatState(() => viewTicket(id))
}

export async function updateTicket(id: string, patch: TicketPatch): Promise<void> {
  await pause()
  await withChatState(() => patchTicket(id, patch))
}

export async function answerTicket(id: string, text: string, addToKb: boolean): Promise<void> {
  await pause()
  await withChatState(() => {
    const ticket = requireRecord(tickets, id)
    const answer = nonBlank(text)
    const changed = resolveTicket(ticket, answer, currentStaff.name, answerCitations(answer))
    const learnedTopic = addToKb && !answeredTopics.has(ticket.topic)
    if (learnedTopic) {
      answeredTopics.add(ticket.topic)
      reports.clear()
    }
    if (changed || learnedTopic) persistChatState()
  })
}

export async function getAnalyticsSummary(from: string, to: string) {
  await pause()
  return withChatState(() => {
    deliverReadyReplies()
    return structuredClone(summarizeAnalytics(from, to))
  })
}

export async function getFaqReport(period: string): Promise<FaqReport> {
  await pause()
  return withChatState(() => {
    const report = reports.get(period)
    const current = period !== 'week' || Date.parse(report?.from ?? '') === startOfWeek(Date.now())
    if (report && current) return structuredClone(report)

    const next = buildFaqReport(period, answeredTopics)
    reports.set(period, next)
    persistChatState()
    return structuredClone(next)
  })
}

export async function runFaqReport(): Promise<void> {
  await pause()
  await withChatState(() => {
    const periods = new Set(['week', ...reports.keys()])
    for (const period of periods) reports.set(period, buildFaqReport(period, answeredTopics))
    persistChatState('report')
  })
}
