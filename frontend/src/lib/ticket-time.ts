import type { Ticket } from '../api/types'
import { formatChatDate, formatChatDays } from '../i18n/chat'
import type { Language } from '../i18n/locales'

const dayMs = 86_400_000

export function getTicketStatus(ticket: Ticket, now: number): Ticket['status'] {
  if (ticket.status === 'answered') return 'answered'
  const due = Date.parse(ticket.due_at)
  if (Number.isFinite(due)) {
    if (due < now) return 'overdue'
    if (ticket.status === 'overdue') return 'in_progress'
  }
  return ticket.status
}

export function getDeadlineDays(dueAt: string, now: number): number {
  const remaining = (Date.parse(dueAt) - now) / dayMs
  return remaining < 0 ? Math.floor(remaining) : Math.ceil(remaining)
}

export function formatTicketDate(dueAt: string, language: Language): string {
  return formatChatDate(new Date(dueAt), language) ?? '—'
}

export function formatDayDuration(days: number, language: Language): string {
  return formatChatDays(Math.abs(days), language)
}
