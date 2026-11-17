import { ChartNoAxesCombined, Inbox, Ticket } from 'lucide-react'

export const panelSections = [
  { id: 'inbox', label: 'panel.inbox', description: 'panel.inboxDescription', icon: Inbox },
  { id: 'tickets', label: 'panel.tickets', description: 'panel.ticketsDescription', icon: Ticket },
  { id: 'analytics', label: 'panel.analytics', description: 'panel.analyticsDescription', icon: ChartNoAxesCombined },
] as const

export type PanelSectionId = (typeof panelSections)[number]['id']
