import { ApiError } from '../errors'
import type { ChatMessage, ChatReply, ChatSession, FaqReport, InboxItem, Level, LoginReply, StaffRole, Ticket, TicketPatch } from '../types'
import { determineReply } from './chat'
import { dayMs } from './dates'
import { inbox, responseSeconds, tickets } from './fixtures'
import { buildFaqReport, summarizeAnalytics } from './reports'

const sessions = new Map<string, ChatMessage[]>()
const reports = new Map<string, FaqReport>()
const answeredTopics = new Set<string>()
const chatTickets = new Map<string, { sessionId: string; inboxId: string }>()
let nextTicketNumber = 1045

function pause() {
  const milliseconds = 400 + Math.floor(Math.random() * 801)
  return new Promise<void>((resolve) => setTimeout(resolve, milliseconds))
}

function nonBlank(text: string) {
  const value = text.trim()
  if (!value) throw new ApiError(422, 'Text is required')
  return value
}

function requireRecord<Value>(records: Map<string, Value>, id: string): Value {
  const record = records.get(id)
  if (!record) throw new ApiError(404, 'Record not found')
  return record
}

function newestFirst<T extends { created_at: string }>(items: T[]) {
  return items.sort((a, b) => b.created_at.localeCompare(a.created_at))
}

export async function createChatSession(): Promise<ChatSession> {
  await pause()
  const sessionId = crypto.randomUUID()
  sessions.set(sessionId, [])
  return { session_id: sessionId }
}

export async function getChatMessages(sessionId: string): Promise<ChatMessage[]> {
  await pause()
  return structuredClone(requireRecord(sessions, sessionId))
}

export async function sendChatMessage(sessionId: string, text: string): Promise<ChatReply> {
  const started = Date.now()
  await pause()
  const history = requireRecord(sessions, sessionId)
  const message = nonBlank(text)
  const result = determineReply(message)
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

  if (result.level === 'red') {
    const sequence = nextTicketNumber++
    const ticket: Ticket = {
      id: `T-${sequence}`,
      number: `DCH-${sequence}`,
      topic,
      region: null,
      priority: result.fraud ? 'high' : 'normal',
      status: 'new',
      created_at: createdAt,
      due_at: new Date(now + 15 * dayMs).toISOString(),
      summary: message.length > 140 ? `${message.slice(0, 139)}…` : message,
      original_text: message,
      channel: 'web',
      draft_answer: null,
      final_answer: null,
      similar_cases: Array.from(tickets.values())
        .filter((existing) => existing.topic === topic && existing.status === 'answered')
        .slice(0, 2)
        .map(({ number, summary }) => ({ number, summary })),
    }

    tickets.set(ticket.id, ticket)
    chatTickets.set(ticket.id, { sessionId, inboxId })
    reply.ticket_number = ticket.number
    reply.due_at = ticket.due_at
    if (result.fraud) reply.warning = 'fraud'
  }

  inbox.set(inboxId, {
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
    draft: null,
    status: result.level === 'green' ? 'sent' : 'draft',
  })

  if (result.level === 'green') responseSeconds.set(inboxId, (now - started) / 1000)

  history.push(
    { id: crypto.randomUUID(), role: 'user', text: message, created_at: createdAt },
    { id: reply.message_id, role: 'assistant', text: reply.answer, created_at: createdAt, reply },
  )

  return structuredClone(reply)
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
  const items = Array.from(inbox.values()).filter((item) => !level || item.level === level)
  return structuredClone(newestFirst(items))
}

export async function approveResponse(id: string): Promise<void> {
  await pause()
  const item = requireRecord(inbox, id)
  if (!item.draft || item.status === 'sent') throw new ApiError(409, 'No pending response to approve')
  if (item.status === 'approved') return

  item.status = 'approved'
  responseSeconds.set(id, (Date.now() - Date.parse(item.created_at)) / 1000)
}

export async function rejectResponse(id: string): Promise<void> {
  await pause()
  const item = requireRecord(inbox, id)
  if (item.status === 'sent') throw new ApiError(409, 'Response has already been sent')

  item.status = 'rejected'
  responseSeconds.delete(id)
}

export async function editResponse(id: string, text: string): Promise<void> {
  await pause()
  const item = requireRecord(inbox, id)
  if (item.status === 'sent') throw new ApiError(409, 'Response has already been sent')

  item.draft = {
    answer: nonBlank(text),
    citations: item.draft?.citations ?? [],
    confidence: item.draft?.confidence ?? 0,
  }
  item.status = 'draft'
  responseSeconds.delete(id)
}

export async function getTickets(): Promise<Ticket[]> {
  await pause()
  return structuredClone(newestFirst(Array.from(tickets.values())))
}

export async function updateTicket(id: string, patch: TicketPatch): Promise<void> {
  await pause()
  const ticket = requireRecord(tickets, id)
  tickets.set(id, { ...ticket, ...structuredClone(patch), id })
}

export async function answerTicket(id: string, text: string, addToKb: boolean): Promise<void> {
  await pause()
  const ticket = requireRecord(tickets, id)
  const answer = nonBlank(text)
  const alreadyAnswered = ticket.status === 'answered' && ticket.final_answer === answer
  ticket.status = 'answered'
  ticket.final_answer = answer

  const chat = chatTickets.get(id)
  if (chat && !alreadyAnswered) {
    const now = Date.now()
    const messages = requireRecord(sessions, chat.sessionId)
    messages.push({ id: crypto.randomUUID(), role: 'specialist', text: answer, created_at: new Date(now).toISOString() })
    const item = requireRecord(inbox, chat.inboxId)
    item.status = 'sent'
    responseSeconds.set(item.id, (now - Date.parse(item.created_at)) / 1000)
  }

  if (addToKb) answeredTopics.add(ticket.topic)
}

export async function getAnalyticsSummary(from: string, to: string) {
  await pause()
  return structuredClone(summarizeAnalytics(from, to))
}

export async function getFaqReport(period: string): Promise<FaqReport> {
  await pause()
  let report = reports.get(period)
  if (!report) {
    report = buildFaqReport(period, answeredTopics)
    reports.set(period, report)
  }
  return structuredClone(report)
}

export async function runFaqReport(): Promise<void> {
  await pause()
  const periods = reports.size ? Array.from(reports.keys()) : ['7d']
  for (const period of periods) reports.set(period, buildFaqReport(period, answeredTopics))
}
