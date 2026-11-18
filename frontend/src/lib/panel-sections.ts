import { ChartNoAxesCombined, Inbox, Ticket } from 'lucide-react'

export const panelSections = [
  { id: 'inbox', label: 'panel.inbox', icon: Inbox },
  { id: 'tickets', label: 'panel.tickets', icon: Ticket },
  { id: 'analytics', label: 'panel.analytics', icon: ChartNoAxesCombined },
] as const
