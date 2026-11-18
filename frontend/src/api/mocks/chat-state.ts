import type { CaseChangeKind, ChatMessage, Citation, FaqReport, InboxItem, Ticket } from '../types'
import { ApiError } from '../errors'
import { createAnalyticsFixtures } from './analytics-fixtures'
import { caseStorageKey, publishMockCaseChanges } from './case-events'
import { freshCaseFixtures, inbox, responseSeconds, tickets } from './fixtures'
import { departmentFor } from './ticket-examples'

const firstTicketNumber = 1045
export const ticketFallbackDelay = 180_000

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

interface SharedSnapshot {
  version: 2
  change?: CaseChangeKind
  sessions: Snapshot['sessions']
  cases: Array<[string, ChatCase]>
  inbox: InboxItem[]
  tickets: Ticket[]
  responseSeconds: Array<[string, number]>
  ratings: Array<[string, number]>
  answeredTopics: string[]
  nextTicketNumber: number
  nextArrivalAt: number | null
  analyticsSeedAt?: number
  reports?: Array<[string, FaqReport]>
}

export const sessions = new Map<string, ChatMessage[]>()
export const cases = new Map<string, ChatCase>()
export const ratings = new Map<string, number>()
export const answeredTopics = new Set<string>()
export const reports = new Map<string, FaqReport>()
export const liveSchedule = { nextArrivalAt: null as number | null }
const initialTime = Date.now()
let nextTicketNumber = firstTicketNumber
let lastStored: string | null | undefined
let analyticsSeedAt = initialTime

function seedAnalytics(now: number) {
  analyticsSeedAt = now
  for (const { item, seconds } of createAnalyticsFixtures(now)) {
    if (inbox.has(item.id)) continue
    inbox.set(item.id, item)
    if (seconds !== undefined) responseSeconds.set(item.id, seconds)
  }
}

seedAnalytics(initialTime)

export function takeTicketNumber() {
  return nextTicketNumber++
}

export function nonBlank(text: string) {
  const value = text.trim()
  if (!value) throw new ApiError(422, 'Text is required')
  return value
}

export function requireRecord<Value>(records: Map<string, Value>, id: string): Value {
  const record = records.get(id)
  if (!record) throw new ApiError(404, 'Record not found')
  return record
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

function isCase(value: unknown): value is ChatCase {
  if (!isRecord(value) || typeof value.sessionId !== 'string' || typeof value.messageId !== 'string' ||
    (value.ticketId !== null && typeof value.ticketId !== 'string')) return false
  const { followUp } = value
  return followUp === null || (isRecord(followUp) && typeof followUp.availableAt === 'number' &&
    typeof followUp.answer === 'string' && Array.isArray(followUp.citations) && followUp.citations.every(isCitation))
}

function isInboxItem(value: unknown): value is InboxItem {
  return isRecord(value) && typeof value.id === 'string' && typeof value.created_at === 'string' &&
    typeof value.text === 'string' && isRecord(value.classification) && Array.isArray(value.classification.flags)
}

function isTicket(value: unknown): value is Ticket {
  return isRecord(value) && typeof value.id === 'string' && typeof value.number === 'string' &&
    typeof value.topic === 'string' && typeof value.created_at === 'string' && typeof value.due_at === 'string' &&
    typeof value.summary === 'string' && typeof value.original_text === 'string' && Array.isArray(value.similar_cases) &&
    (value.events === undefined || Array.isArray(value.events))
}

function isStoredCase(value: unknown): value is StoredCase {
  return isRecord(value) && isInboxItem(value.item) &&
    (value.ticket === null || (isTicket(value.ticket) && value.ticket.id === value.ticketId)) && isCase(value)
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function isFaqReport(value: unknown): value is FaqReport {
  return isRecord(value) && typeof value.period === 'string' && typeof value.generated_at === 'string' &&
    Array.isArray(value.clusters) && value.clusters.every((cluster: unknown) => isRecord(cluster) &&
      typeof cluster.id === 'string' && typeof cluster.label === 'string' && typeof cluster.count === 'number' &&
      typeof cluster.growth_pct === 'number' && typeof cluster.confusion === 'string' &&
      typeof cluster.no_answer_in_kb === 'boolean' && typeof cluster.explainer_draft === 'string' &&
      Array.isArray(cluster.examples) && cluster.examples.every((example: unknown) => typeof example === 'string'))
}

function isEntryList<Value>(value: unknown, check: (entry: unknown) => entry is Value): value is Array<[string, Value]> {
  return Array.isArray(value) && value.every((entry: unknown) => (
    Array.isArray(entry) && typeof entry[0] === 'string' && check(entry[1])
  ))
}

function readSnapshot(raw: string): Snapshot | SharedSnapshot | null {
  try {
    const value: unknown = JSON.parse(raw)
    if (!isRecord(value) || !Array.isArray(value.sessions) || !Array.isArray(value.cases) ||
      typeof value.nextTicketNumber !== 'number' || !Number.isSafeInteger(value.nextTicketNumber)) return null
    const entries: Array<[string, ChatMessage[]]> = []
    for (const entry of value.sessions) {
      if (!Array.isArray(entry) || typeof entry[0] !== 'string' || !Array.isArray(entry[1]) || !entry[1].every(isMessage)) return null
      entries.push([entry[0], entry[1]])
    }
    const nextNumber = Math.max(firstTicketNumber, value.nextTicketNumber)
    if (value.version === 2) {
      if (!isEntryList(value.cases, isCase) || !Array.isArray(value.inbox) || !value.inbox.every(isInboxItem) ||
        !Array.isArray(value.tickets) || !value.tickets.every(isTicket) || !isEntryList(value.responseSeconds, isFiniteNumber) ||
        !isEntryList(value.ratings, isFiniteNumber) || !Array.isArray(value.answeredTopics) ||
        !value.answeredTopics.every((topic: unknown) => typeof topic === 'string') ||
        (value.nextArrivalAt !== null && !isFiniteNumber(value.nextArrivalAt))) return null
      return {
        version: 2,
        sessions: entries,
        cases: value.cases,
        inbox: value.inbox,
        tickets: value.tickets,
        responseSeconds: value.responseSeconds,
        ratings: value.ratings,
        answeredTopics: value.answeredTopics,
        nextTicketNumber: nextNumber,
        nextArrivalAt: value.nextArrivalAt,
        analyticsSeedAt: isFiniteNumber(value.analyticsSeedAt) ? value.analyticsSeedAt : undefined,
        reports: isEntryList(value.reports, isFaqReport) ? value.reports : [],
      }
    }
    if (!value.cases.every(isStoredCase)) return null
    return { sessions: entries, cases: value.cases, nextTicketNumber: nextNumber }
  } catch {
    return null
  }
}

function replaceMap<Key, Value>(map: Map<Key, Value>, records: Iterable<[Key, Value]>) {
  map.clear()
  for (const [key, value] of records) map.set(key, value)
}

function restoreFixtures(now = Date.now()) {
  const initial = freshCaseFixtures(now)
  replaceMap(inbox, initial.inbox.map((item) => [item.id, item]))
  replaceMap(tickets, initial.tickets.map((ticket) => [ticket.id, ticket]))
  replaceMap(responseSeconds, initial.responseSeconds)
  cases.clear()
  sessions.clear()
  ratings.clear()
  answeredTopics.clear()
  reports.clear()
  nextTicketNumber = firstTicketNumber
  liveSchedule.nextArrivalAt = null
  seedAnalytics(now)
}

function restore() {
  let raw: string | null
  try {
    raw = localStorage.getItem(caseStorageKey)
  } catch {
    return
  }

  if (raw === lastStored) return
  lastStored = raw
  if (!raw) {
    restoreFixtures()
    persistChatState()
    return
  }
  const saved = readSnapshot(raw)
  if (!saved) return

  if ('version' in saved) {
    replaceMap(sessions, saved.sessions)
    nextTicketNumber = saved.nextTicketNumber
    replaceMap(cases, saved.cases)
    replaceMap(inbox, saved.inbox.map((item) => [item.id, item]))
    replaceMap(tickets, saved.tickets.map((ticket) => [ticket.id, ticket]))
    replaceMap(responseSeconds, saved.responseSeconds)
    replaceMap(ratings, saved.ratings)
    answeredTopics.clear()
    for (const topic of saved.answeredTopics) answeredTopics.add(topic)
    liveSchedule.nextArrivalAt = saved.nextArrivalAt
    replaceMap(reports, saved.reports ?? [])
    if (saved.analyticsSeedAt === undefined) {
      seedAnalytics(Date.now())
      persistChatState()
    } else {
      analyticsSeedAt = saved.analyticsSeedAt
    }
    return
  }

  restoreFixtures()
  replaceMap(sessions, saved.sessions)
  nextTicketNumber = saved.nextTicketNumber
  for (const { item, ticket, seconds, ...record } of saved.cases) {
    if (!sessions.has(record.sessionId)) continue
    cases.set(item.id, record)
    inbox.set(item.id, item)
    if (ticket) {
      item.ticket_id = ticket.id
      item.ticket_number = ticket.number
      ticket.department ??= departmentFor(ticket.topic, ticket.original_text)
      ticket.flags ??= [...item.classification.flags]
      ticket.events ??= [
        { type: 'created', actor: 'ai', created_at: ticket.created_at },
      ]
      const specialist = sessions.get(record.sessionId)?.find(({ role, reply }) => (
        role === 'specialist' && reply?.ticket_number === ticket.number
      ))
      if (specialist && !ticket.events.some(({ type }) => type === 'answered')) {
        ticket.events.push({ type: 'answered', actor: 'ai', created_at: specialist.created_at })
      }
      if (record.followUp) record.followUp.availableAt = Date.parse(ticket.created_at) + ticketFallbackDelay
      tickets.set(ticket.id, ticket)
    }
    if (typeof seconds === 'number') responseSeconds.set(item.id, seconds)
  }
  persistChatState()
}

export function persistChatState(change: CaseChangeKind = 'update') {
  const raw = JSON.stringify({
    version: 2,
    change,
    sessions: [...sessions],
    cases: [...cases],
    inbox: [...inbox.values()],
    tickets: [...tickets.values()],
    responseSeconds: [...responseSeconds],
    ratings: [...ratings],
    answeredTopics: [...answeredTopics],
    nextTicketNumber,
    nextArrivalAt: liveSchedule.nextArrivalAt,
    analyticsSeedAt,
    reports: [...reports],
  } satisfies SharedSnapshot)
  if (raw === lastStored) return
  try {
    localStorage.setItem(caseStorageKey, raw)
    lastStored = raw
  } catch {
    // Keep this tab working when storage is blocked or full.
  }
  publishMockCaseChanges(change)
}

export function resetChatState() {
  restoreFixtures()
  persistChatState('reset')
}

export async function withChatState<Result>(task: () => Result): Promise<Result> {
  function transaction() {
    restore()
    return task()
  }

  if (typeof navigator !== 'undefined' && navigator.locks) {
    return navigator.locks.request(caseStorageKey, transaction)
  }
  return transaction()
}
