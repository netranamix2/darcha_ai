import type { ChatMessage, Citation, InboxItem, Ticket } from '../types'
import { inbox, responseSeconds, tickets } from './fixtures'

const storageKey = 'darcha.mock-chat.v1'
const firstTicketNumber = 1045

interface FollowUp {
  availableAt: number
  answer: string
  citations: Citation[]
}

export interface ChatCase {
  sessionId: string
  messageId: string
  ticketId: string | null
  followUp: FollowUp | null
}

interface StoredCase extends ChatCase {
  item: InboxItem
  ticket: Ticket | null
  seconds: number | null
}

interface Snapshot {
  sessions: Array<[string, ChatMessage[]]>
  cases: StoredCase[]
  nextTicketNumber: number
}

export const sessions = new Map<string, ChatMessage[]>()
export const cases = new Map<string, ChatCase>()
let nextTicketNumber = firstTicketNumber
let lastStored: string | null | undefined

export function takeTicketNumber() {
  return nextTicketNumber++
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isCitation(value: unknown): value is Citation {
  return isRecord(value) && typeof value.title === 'string' && typeof value.ref === 'string' && typeof value.url === 'string'
}

function isMessage(value: unknown): value is ChatMessage {
  if (!isRecord(value) || typeof value.id !== 'string' || typeof value.text !== 'string' || typeof value.created_at !== 'string') return false
  if (value.role !== 'user' && value.role !== 'assistant' && value.role !== 'specialist') return false
  if (value.reply === undefined) return true
  const { reply } = value
  return isRecord(reply) && typeof reply.message_id === 'string' && typeof reply.answer === 'string' &&
    (reply.level === 'green' || reply.level === 'yellow' || reply.level === 'red') &&
    Array.isArray(reply.citations) && reply.citations.every(isCitation)
}

function isStoredCase(value: unknown): value is StoredCase {
  if (!isRecord(value) || typeof value.sessionId !== 'string' || typeof value.messageId !== 'string') return false
  if (!isRecord(value.item) || typeof value.item.id !== 'string' || typeof value.item.created_at !== 'string') return false
  if (!isRecord(value.item.classification) || !Array.isArray(value.item.classification.flags)) return false
  if (value.ticket !== null && (!isRecord(value.ticket) || value.ticket.id !== value.ticketId)) return false
  const { followUp } = value
  return followUp === null || (isRecord(followUp) && typeof followUp.availableAt === 'number' &&
    typeof followUp.answer === 'string' && Array.isArray(followUp.citations) && followUp.citations.every(isCitation))
}

function readSnapshot(raw: string): Snapshot | null {
  try {
    const value: unknown = JSON.parse(raw)
    if (!isRecord(value) || !Array.isArray(value.sessions) || !Array.isArray(value.cases) ||
      typeof value.nextTicketNumber !== 'number' || !Number.isSafeInteger(value.nextTicketNumber)) return null
    const entries: Array<[string, ChatMessage[]]> = []
    for (const entry of value.sessions) {
      if (!Array.isArray(entry) || typeof entry[0] !== 'string' || !Array.isArray(entry[1]) || !entry[1].every(isMessage)) return null
      entries.push([entry[0], entry[1]])
    }
    if (!value.cases.every(isStoredCase)) return null
    return { sessions: entries, cases: value.cases, nextTicketNumber: Math.max(firstTicketNumber, value.nextTicketNumber) }
  } catch {
    return null
  }
}

function restore() {
  let raw: string | null
  try {
    raw = localStorage.getItem(storageKey)
  } catch {
    return
  }

  if (!raw || raw === lastStored) return
  lastStored = raw
  const saved = readSnapshot(raw)
  if (!saved) return

  for (const [inboxId, { ticketId }] of cases) {
    inbox.delete(inboxId)
    responseSeconds.delete(inboxId)
    if (ticketId) tickets.delete(ticketId)
  }
  cases.clear()
  sessions.clear()

  for (const [id, messages] of saved.sessions) sessions.set(id, messages)
  for (const { item, ticket, seconds, ...record } of saved.cases) {
    if (!sessions.has(record.sessionId)) continue
    cases.set(item.id, record)
    inbox.set(item.id, item)
    if (ticket) tickets.set(ticket.id, ticket)
    if (typeof seconds === 'number') responseSeconds.set(item.id, seconds)
  }
  nextTicketNumber = saved.nextTicketNumber
}

export function persistChatState() {
  const savedCases: StoredCase[] = []
  for (const [id, record] of cases) {
    const item = inbox.get(id)
    if (!item) continue
    savedCases.push({
      ...record,
      item,
      ticket: record.ticketId ? tickets.get(record.ticketId) ?? null : null,
      seconds: responseSeconds.get(id) ?? null,
    })
  }

  try {
    const raw = JSON.stringify({ sessions: [...sessions], cases: savedCases, nextTicketNumber } satisfies Snapshot)
    localStorage.setItem(storageKey, raw)
    lastStored = raw
  } catch {
    // Keep this tab working when storage is blocked or full.
  }
}

export async function withChatState<Result>(task: () => Result): Promise<Result> {
  function transaction() {
    restore()
    return task()
  }

  if (typeof navigator !== 'undefined' && navigator.locks) {
    return navigator.locks.request(storageKey, transaction)
  }
  return transaction()
}
