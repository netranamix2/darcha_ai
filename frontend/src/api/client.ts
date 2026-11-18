import { analyticsDateBoundary, analyticsSummary, faqReport } from './analytics-response'
import { ApiError } from './errors'
import { subscribeToMockCaseChanges } from './mocks/case-events'
import type {
  AnalyticsSummary,
  BackendAnalyticsSummary,
  BackendFaqReport,
  CaseChangeKind,
  ChatMessage,
  ChatReply,
  ChatSession,
  Citation,
  FaqReport,
  InboxItem,
  Level,
  LoginReply,
  StaffMember,
  Ticket,
  TicketPatch,
} from './types'

export { ApiError } from './errors'

const apiUrl = (import.meta.env.VITE_API_URL ?? '').trim()
const apiBase = apiUrl.replace(/\/+$/, '')
let staffToken: string | undefined

function loadMocks() {
  return import('./mocks/index')
}

export function subscribeToCaseChanges(listener: (kind: CaseChangeKind) => void): () => void {
  if (apiUrl) return () => {}
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

async function fetchApi(path: string, { method = 'GET', body, staff }: RequestOptions = {}) {
  const headers = new Headers({ Accept: 'application/json' })

  if (body) headers.set('Content-Type', 'application/json')
  if (staff && staffToken) headers.set('Authorization', `Bearer ${staffToken}`)

  const response = await fetch(`${apiBase}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  })

  if (!response.ok) {
    const problem: unknown = await response.json().catch(() => null)
    const detail = problem && typeof problem === 'object' && 'detail' in problem
      ? problem.detail
      : undefined

    throw new ApiError(response.status, typeof detail === 'string' ? detail : `HTTP ${response.status}`)
  }

  return response
}

async function read<Result>(path: string, options?: RequestOptions): Promise<Result> {
  const response = await fetchApi(path, options)
  const payload: unknown = await response.json()
  return payload as Result
}

export async function createChatSession(): Promise<ChatSession> {
  if (!apiUrl) return (await loadMocks()).createChatSession()
  return read('/api/chat/sessions', { method: 'POST' })
}

export async function sendChatMessage(sessionId: string, text: string): Promise<ChatReply> {
  if (!apiUrl) return (await loadMocks()).sendChatMessage(sessionId, text)
  return read('/api/chat/messages', { method: 'POST', body: { session_id: sessionId, text } })
}

export async function getChatMessages(sessionId: string): Promise<ChatMessage[]> {
  if (!apiUrl) return (await loadMocks()).getChatMessages(sessionId)
  return read(`/api/chat/sessions/${encodeURIComponent(sessionId)}/messages`)
}

export async function login(email: string, password: string): Promise<LoginReply> {
  const credentials = apiUrl
    ? await read<LoginReply>('/api/auth/login', { method: 'POST', body: { email, password } })
    : await (await loadMocks()).login(email, password)

  staffToken = credentials.token
  return credentials
}

export async function getInbox(level?: Level): Promise<InboxItem[]> {
  if (!apiUrl) return (await loadMocks()).getInbox(level)

  const query = level ? `?${new URLSearchParams({ level })}` : ''
  return read(`/api/inbox${query}`, { staff: true })
}

export async function approveResponse(id: string): Promise<void> {
  if (!apiUrl) return (await loadMocks()).approveResponse(id)
  await fetchApi(`/api/responses/${encodeURIComponent(id)}/approve`, { method: 'POST', staff: true })
}

export async function rejectResponse(id: string): Promise<void> {
  if (!apiUrl) return (await loadMocks()).rejectResponse(id)
  await fetchApi(`/api/responses/${encodeURIComponent(id)}/reject`, { method: 'POST', staff: true })
}

export async function editResponse(id: string, text: string): Promise<void> {
  if (!apiUrl) return (await loadMocks()).editResponse(id, text)
  await fetchApi(`/api/responses/${encodeURIComponent(id)}/edit`, {
    method: 'POST',
    body: { text },
    staff: true,
  })
}

export async function getTickets(): Promise<Ticket[]> {
  if (!apiUrl) return (await loadMocks()).getTickets()
  return read('/api/tickets', { staff: true })
}

export async function convertInboxToTicket(id: string): Promise<Ticket> {
  if (!apiUrl) return (await loadMocks()).convertInboxToTicket(id)
  // TODO(backend): POST /api/inbox/{id}/ticket
  return read(`/api/inbox/${encodeURIComponent(id)}/ticket`, { method: 'POST', staff: true })
}

export async function getStaff(): Promise<StaffMember[]> {
  if (!apiUrl) return (await loadMocks()).getStaff()
  // TODO(backend): GET /api/staff
  return read('/api/staff', { staff: true })
}

export async function getKnowledgeBase(): Promise<Citation[]> {
  if (!apiUrl) return (await loadMocks()).getKnowledgeBase()
  // TODO(backend): GET /api/knowledge-base
  return read('/api/knowledge-base', { staff: true })
}

export async function markTicketViewed(id: string): Promise<void> {
  if (!apiUrl) return (await loadMocks()).markTicketViewed(id)
  // TODO(backend): POST /api/tickets/{id}/view
  await fetchApi(`/api/tickets/${encodeURIComponent(id)}/view`, { method: 'POST', staff: true })
}

export async function updateTicket(id: string, patch: TicketPatch): Promise<void> {
  if (!apiUrl) return (await loadMocks()).updateTicket(id, patch)
  await fetchApi(`/api/tickets/${encodeURIComponent(id)}`, { method: 'PATCH', body: patch, staff: true })
}

export async function answerTicket(id: string, text: string, addToKb: boolean): Promise<void> {
  if (!apiUrl) return (await loadMocks()).answerTicket(id, text, addToKb)
  await fetchApi(`/api/tickets/${encodeURIComponent(id)}/answer`, {
    method: 'POST',
    body: { text, add_to_kb: addToKb },
    staff: true,
  })
}

export async function getAnalyticsSummary(from: string, to: string): Promise<AnalyticsSummary> {
  if (!apiUrl) return (await loadMocks()).getAnalyticsSummary(from, to)
  const query = new URLSearchParams({ from: analyticsDateBoundary(from), to: analyticsDateBoundary(to, true) })
  const response = await read<AnalyticsSummary | BackendAnalyticsSummary>(`/api/analytics/summary?${query}`, { staff: true })
  return analyticsSummary(response)
}

export async function getFaqReport(period: string): Promise<FaqReport> {
  if (!apiUrl) return (await loadMocks()).getFaqReport(period)
  const query = new URLSearchParams({ period })
  const response = await read<FaqReport | BackendFaqReport>(`/api/reports/faq?${query}`, { staff: true })
  return faqReport(response)
}

export async function runFaqReport(): Promise<void> {
  if (!apiUrl) return (await loadMocks()).runFaqReport()
  await fetchApi('/api/reports/faq/run', { method: 'POST', staff: true })
}
