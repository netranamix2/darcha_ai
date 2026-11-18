import { analyticsDateBoundary, analyticsSummary, faqReport } from './analytics-response'
import {
  analyticsAlerts, chatMessages, chatReply, credentials, department, documents, identifier, inboxItems,
  record, rows, session, staffList, ticket, ticketPatch,
} from './backend-response'
import { ApiError } from './errors'
import { caseStorageKey, subscribeToMockCaseChanges } from './mocks/case-events'
import type {
  AnalyticsAlert, AnalyticsSummary, CaseChangeKind, ChatMessage, ChatReply, ChatSession, Citation,
  FaqReport, InboxItem, Level, LoginReply, StaffMember, Ticket, TicketDepartment, TicketPatch,
} from './types'

export { ApiError } from './errors'

const apiUrl = (import.meta.env.VITE_API_URL ?? '').trim()
const apiBase = apiUrl.replace(/\/+$/, '')
const fallbackWarnings = new Set<string>()
const apiModeListeners = new Set<() => void>()
const chatReplies = new Map<string, ChatReply>()
const liveChatHistory = new Map<string, ChatMessage[]>()
const ticketByMessage = new Map<string, Pick<Ticket, 'id' | 'number'>>()
const ticketByResponse = new Map<string, Pick<Ticket, 'id' | 'number'>>()
let staffToken: string | undefined
let staffId = ''
let mockStaffSession = false
let mixedMode = false
let shadowCasesInMemory = false
let departmentRequest: Promise<ReadonlyMap<string, TicketDepartment>> | undefined

function loadMocks() {
  return import('./mocks/index')
}

export function getApiMode(): 'mock' | 'live' | 'mixed' {
  return !apiUrl ? 'mock' : mixedMode ? 'mixed' : 'live'
}

export function subscribeToApiMode(listener: () => void): () => void {
  apiModeListeners.add(listener)
  return () => { apiModeListeners.delete(listener) }
}

function enterMixedMode() {
  if (mixedMode) return
  mixedMode = true
  apiModeListeners.forEach((listener) => listener())
}

export function subscribeToCaseChanges(listener: (kind: CaseChangeKind) => void): () => void {
  return subscribeToMockCaseChanges(listener)
}

export function canResetDemoData() {
  return !apiUrl
}

export async function resetDemoData(): Promise<void> {
  if (!canResetDemoData()) throw new ApiError(405, 'Demo reset is unavailable')
  return (await loadMocks()).resetDemoData()
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH'
  body?: object
  staff?: boolean
}

class NetworkError extends ApiError {
  constructor() {
    super(0, 'Network request failed')
  }
}

async function fetchApi(path: string, { method = 'GET', body, staff }: RequestOptions = {}) {
  const headers = new Headers({ Accept: 'application/json' })
  if (body) headers.set('Content-Type', 'application/json')
  if (staff && staffToken) headers.set('Authorization', `Bearer ${staffToken}`)

  let response: Response
  try {
    response = await fetch(`${apiBase}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    })
  } catch (error) {
    if (error instanceof TypeError) throw new NetworkError()
    throw error
  }

  if (!response.ok) {
    const problem: unknown = await response.json().catch(() => null)
    const detail = record(problem).detail
    throw new ApiError(response.status, typeof detail === 'string' ? detail : `HTTP ${response.status}`)
  }

  return response
}

async function read(path: string, options?: RequestOptions): Promise<unknown> {
  const response = await fetchApi(path, options)
  try {
    return await response.json()
  } catch (error) {
    if (error instanceof TypeError) throw new NetworkError()
    throw error
  }
}

async function request<Result>(
  endpoint: string, live: () => Promise<Result>, mock: () => Promise<Result>, useMock = false,
): Promise<Result> {
  if (!apiUrl) return mock()
  if (useMock) {
    enterMixedMode()
    return mock()
  }
  try {
    return await live()
  } catch (error) {
    if (!(error instanceof NetworkError || (error instanceof ApiError && (error.status === 404 || error.status === 501)))) throw error
    if (!fallbackWarnings.has(endpoint)) {
      fallbackWarnings.add(endpoint)
      console.warn(`[api] fallback to mock: ${endpoint}`)
    }
    enterMixedMode()
    return mock()
  }
}

function hasMockCases() {
  if (shadowCasesInMemory) return true
  try {
    return localStorage.getItem(caseStorageKey) !== null
  } catch {
    return false
  }
}

function isMockSession(id: string) {
  // The backend issues a 32-character hex ID. The original demo sessions used hyphenated UUIDs.
  return /^demo-|^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/iu.test(id)
}

function mergeChatHistory(live: ChatMessage[], mock: ChatMessage[]) {
  if (!mock.length) return live
  return [...live, ...mock].sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at))
}

export async function createChatSession(): Promise<ChatSession> {
  const path = '/api/chat/sessions'
  return request(path, async () => session(await read(path, { method: 'POST' })),
    async () => (await loadMocks()).createChatSession(Boolean(apiUrl)))
}

export async function sendChatMessage(sessionId: string, text: string): Promise<ChatReply> {
  const path = '/api/chat/messages'
  const mockSession = isMockSession(sessionId)
  return request(path, async () => {
    const reply = chatReply(await read(path, { method: 'POST', body: { session_id: sessionId, text } }))
    if (chatReplies.size >= 500) chatReplies.delete(chatReplies.keys().next().value ?? '')
    chatReplies.set(reply.message_id, reply)
    return reply
  }, async () => {
    shadowCasesInMemory = Boolean(apiUrl)
    return (await loadMocks()).sendChatMessage(sessionId, text, {
      shadow: Boolean(apiUrl),
      allowMissing: Boolean(apiUrl) && !mockSession,
    })
  }, mockSession)
}

export async function getChatMessages(sessionId: string): Promise<ChatMessage[]> {
  const mockSession = isMockSession(sessionId)
  const path = '/api/chat/sessions/{id}/messages'
  return request(path, async () => {
    const payload = await read(`/api/chat/sessions/${encodeURIComponent(sessionId)}/messages`)
    const live = chatMessages(payload, chatReplies)
    if (liveChatHistory.size >= 5) liveChatHistory.delete(liveChatHistory.keys().next().value ?? '')
    liveChatHistory.set(sessionId, live)
    if (!hasMockCases()) return live
    const mock = await (await loadMocks()).readChatMessages(sessionId, true)
    if (mock.length) enterMixedMode()
    return mergeChatHistory(live, mock)
  }, async () => {
    const liveSession = Boolean(apiUrl) && !mockSession
    const mock = await (await loadMocks()).getChatMessages(sessionId, liveSession)
    return mergeChatHistory(liveChatHistory.get(sessionId) ?? [], mock)
  }, mockSession)
}

export async function login(email: string, password: string): Promise<LoginReply> {
  const path = '/api/auth/login'
  return request(path, async () => {
    const username = email.trim().replace(/@darcha\.test$/iu, '')
    const next = credentials(await read(path, { method: 'POST', body: { username, password } }))
    staffToken = next.token
    staffId = next.staffId
    mockStaffSession = false
    return { token: next.token, role: next.role }
  }, async () => {
    const next = await (await loadMocks()).login(email, password)
    staffToken = undefined
    staffId = ''
    mockStaffSession = true
    return next
  })
}

export async function getInbox(level?: Level): Promise<InboxItem[]> {
  const path = '/api/inbox'
  return request(path, async () => {
    // The backend defaults to yellow drafts when the filters are omitted.
    const query = new URLSearchParams({ level: level ?? '', status: '' })
    const items = inboxItems(await read(`${path}?${query}`, { staff: true }), ticketByMessage).map((item) => {
      const linkedTicket = ticketByResponse.get(item.id)
      return linkedTicket ? { ...item, ticket_id: linkedTicket.id, ticket_number: linkedTicket.number } : item
    })
    if (!hasMockCases()) return items
    const mock = (await (await loadMocks()).getChatCases()).inbox.filter((item) => !level || item.level === level)
    if (mock.length) enterMixedMode()
    return [...items, ...mock].sort((a, b) => b.created_at.localeCompare(a.created_at))
  }, async () => (await loadMocks()).getInbox(level), mockStaffSession)
}

export async function approveResponse(id: string): Promise<void> {
  return request('/api/responses/{id}/approve', async () => {
    await fetchApi(`/api/responses/${encodeURIComponent(id)}/approve`, { method: 'POST', staff: true })
  }, async () => (await loadMocks()).approveResponse(id), mockStaffSession || id.startsWith('IN-'))
}

export async function rejectResponse(id: string): Promise<void> {
  return request('/api/responses/{id}/reject', async () => {
    await fetchApi(`/api/responses/${encodeURIComponent(id)}/reject`, {
      method: 'POST', body: { create_ticket: false }, staff: true,
    })
  }, async () => (await loadMocks()).rejectResponse(id), mockStaffSession || id.startsWith('IN-'))
}

export async function editResponse(id: string, text: string): Promise<void> {
  return request('/api/responses/{id}/edit', async () => {
    await fetchApi(`/api/responses/${encodeURIComponent(id)}/edit`, { method: 'POST', body: { text }, staff: true })
  }, async () => (await loadMocks()).editResponse(id, text), mockStaffSession || id.startsWith('IN-'))
}

async function getDepartments(): Promise<ReadonlyMap<string, TicketDepartment>> {
  const path = '/api/departments'
  if (departmentRequest) return departmentRequest
  const next = request(path, async () => {
    const codes = new Map<string, TicketDepartment>()
    for (const row of rows(await read(path))) {
      const id = identifier(row.id)
      const name = department(row.code ?? row.name)
      if (id && name) codes.set(id, name)
    }
    return codes
  }, async () => new Map<string, TicketDepartment>())
  departmentRequest = next
  try {
    const departments = await next
    if (!departments.size) departmentRequest = undefined
    return departments
  } catch (error) {
    departmentRequest = undefined
    throw error
  }
}

export async function getTickets(): Promise<Ticket[]> {
  const path = '/api/tickets'
  return request(path, async () => {
    const payload = await read(path, { staff: true })
    // The list includes the live department label. The detail includes the actual classification.
    const items = rows(payload).filter((row) => identifier(row.id)).map(ticket)
    if (!hasMockCases()) return items
    const mock = (await (await loadMocks()).getChatCases()).tickets
    if (mock.length) enterMixedMode()
    return [...items, ...mock].sort((a, b) => b.created_at.localeCompare(a.created_at))
  }, async () => (await loadMocks()).getTickets(), mockStaffSession)
}

export async function getTicket(id: string): Promise<Ticket> {
  return request('/api/tickets/{id}', async () => {
    const payload = await read(`/api/tickets/${encodeURIComponent(id)}`, { staff: true })
    const item = ticket(payload)
    const messageId = identifier(record(record(payload).message).id)
    if (messageId) ticketByMessage.set(messageId, item)
    return item
  }, async () => (await loadMocks()).getTicket(id), mockStaffSession || id.startsWith('T-'))
}

export async function convertInboxToTicket(id: string): Promise<Ticket> {
  const result = await request<Ticket | string>('/api/responses/{id}/reject', async () => {
    const result = record(await read(`/api/responses/${encodeURIComponent(id)}/reject`, {
      method: 'POST', body: { create_ticket: true }, staff: true,
    }))
    const number = identifier(result.ticket_number)
    if (!number) throw new ApiError(502, 'The server returned no ticket number')
    return number
  }, async () => (await loadMocks()).convertInboxToTicket(id), mockStaffSession || id.startsWith('IN-'))
  if (typeof result !== 'string') return result

  const linked = (await getTickets()).find(({ number }) => number === result)
  if (!linked) throw new ApiError(502, 'The created ticket is unavailable in the ticket list')
  ticketByResponse.set(id, linked)
  return linked
}

export async function getStaff(): Promise<StaffMember[]> {
  const path = '/api/staff'
  return request(path, async () => {
    const payload = await read(path, { staff: true })
    return staffList(payload, await getDepartments(), staffId)
  }, async () => (await loadMocks()).getStaff(), mockStaffSession)
}

export async function getKnowledgeBase(): Promise<Citation[]> {
  const path = '/api/documents'
  return request(path, async () => documents(await read(path, { staff: true })),
    async () => (await loadMocks()).getKnowledgeBase(), mockStaffSession)
}

export async function markTicketViewed(id: string): Promise<void> {
  const mock = mockStaffSession || id.startsWith('T-')
  // TODO(backend): POST /api/tickets/{id}/view
  return request('/api/tickets/{id}/view', async () => {
    await fetchApi(`/api/tickets/${encodeURIComponent(id)}/view`, { method: 'POST', staff: true })
  }, async () => {
    // A demo audit event can only be attached to a demo ticket.
    if (!apiUrl || mock) await (await loadMocks()).markTicketViewed(id)
  }, mock)
}

export async function updateTicket(id: string, patch: TicketPatch): Promise<void> {
  return request('/api/tickets/{id}', async () => {
    const departments = patch.department ? await getDepartments() : new Map<string, TicketDepartment>()
    await fetchApi(`/api/tickets/${encodeURIComponent(id)}`, {
      method: 'PATCH', body: ticketPatch(patch, departments), staff: true,
    })
  }, async () => (await loadMocks()).updateTicket(id, patch), mockStaffSession || id.startsWith('T-'))
}

export async function answerTicket(id: string, text: string, addToKb: boolean): Promise<void> {
  return request('/api/tickets/{id}/answer', async () => {
    await fetchApi(`/api/tickets/${encodeURIComponent(id)}/answer`, {
      method: 'POST', body: { text, add_to_kb: addToKb }, staff: true,
    })
  }, async () => (await loadMocks()).answerTicket(id, text, addToKb), mockStaffSession || id.startsWith('T-'))
}

async function getAlerts(from: string, to: string): Promise<AnalyticsAlert[]> {
  const path = '/api/alerts'
  return request(path, async () => analyticsAlerts(await read(path, { staff: true }))
    .filter(({ created_at }) => withinPeriod(created_at, from, to)),
  async () => (await (await loadMocks()).getAnalyticsSummary(from, to)).alerts, mockStaffSession)
}

function withinPeriod(date: string, from: string, to: string) {
  const timestamp = Date.parse(date)
  return timestamp >= Date.parse(analyticsDateBoundary(from)) && timestamp < Date.parse(analyticsDateBoundary(to, true))
}

async function mergeAlerts(alerts: AnalyticsAlert[], from: string, to: string): Promise<AnalyticsAlert[]> {
  if (!hasMockCases()) return alerts
  const { inbox } = await (await loadMocks()).getChatCases()
  const current = new Map(alerts.map((alert) => [alert.id, alert]))
  for (const item of inbox) {
    if (!item.classification.flags.includes('fraud') || !withinPeriod(item.created_at, from, to)) continue
    const id = `AL-${item.id}`
    if (current.has(id)) continue
    current.set(id, { id, kind: 'fraud', text: item.text, created_at: item.created_at, inbox_id: item.id })
    enterMixedMode()
  }
  return [...current.values()].sort((a, b) => b.created_at.localeCompare(a.created_at))
}

export async function getAnalyticsSummary(from: string, to: string): Promise<AnalyticsSummary> {
  const path = '/api/analytics/summary'
  return request(path, async () => {
    const query = new URLSearchParams({ from: analyticsDateBoundary(from), to: analyticsDateBoundary(to, true) })
    const payload = await read(`${path}?${query}`, { staff: true })
    const summary = analyticsSummary(payload)
    const alerts = Array.isArray(record(payload).alerts) ? summary.alerts : await getAlerts(from, to)
    return { ...summary, alerts: await mergeAlerts(alerts, from, to) }
  }, async () => (await loadMocks()).getAnalyticsSummary(from, to), mockStaffSession)
}

export async function getFaqReport(period: string): Promise<FaqReport> {
  const path = '/api/reports/faq'
  return request(path, async () => faqReport(await read(`${path}?${new URLSearchParams({ period })}`, { staff: true }), period),
    async () => (await loadMocks()).getFaqReport(period), mockStaffSession)
}

export async function runFaqReport(): Promise<void> {
  const path = '/api/reports/faq/run'
  return request(path, async () => {
    await fetchApi(path, { method: 'POST', staff: true })
  }, async () => (await loadMocks()).runFaqReport(), mockStaffSession)
}
