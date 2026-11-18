import { Instagram, Monitor, Send, SignalHigh, SignalLow, SignalMedium } from 'lucide-react'
import type { StaffMember, Ticket } from '../../api/types'
import { ticketViewMessages } from '../../i18n/ticket-views'
import { useT } from '../../i18n/useT'

export type Status = Ticket['status']
export type MovableStatus = Exclude<Status, 'overdue'>
export type ViewTranslation = ReturnType<typeof useTicketViewT>

export interface TicketViewProps {
  tickets: Ticket[]
  staff: StaffMember[]
  now: number
  onOpen: (ticket: Ticket) => void
}

export const laneOrder = ['new', 'in_progress', 'answered', 'overdue'] as const
export const movableLanes: readonly MovableStatus[] = ['new', 'in_progress', 'answered']
export const dayMs = 86_400_000

export const statusLabels = {
  new: 'ticketView.new',
  in_progress: 'ticketView.inProgress',
  answered: 'ticketView.answered',
  overdue: 'ticketView.overdue',
} as const satisfies Record<Status, string>

export const channels = {
  web: { label: 'ticketView.channelWeb', icon: Monitor },
  telegram: { label: 'ticketView.channelTelegram', icon: Send },
  instagram: { label: 'ticketView.channelInstagram', icon: Instagram },
} as const

export const priorities = {
  low: { label: 'ticketView.priorityLow', icon: SignalLow, rank: 0 },
  normal: { label: 'ticketView.priorityNormal', icon: SignalMedium, rank: 1 },
  high: { label: 'ticketView.priorityHigh', icon: SignalHigh, rank: 2 },
} as const

export function useTicketViewT() {
  return useT(ticketViewMessages)
}

export function openTicketLabel(t: ViewTranslation, ticket: Ticket) {
  return t('ticketView.open').replace('{number}', ticket.number)
}

export function isMovableStatus(status: unknown): status is MovableStatus {
  return movableLanes.some((lane) => lane === status)
}
