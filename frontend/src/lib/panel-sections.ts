import { BookOpen, ChartNoAxesCombined, Inbox, Ticket } from 'lucide-react'
import type { StaffRole } from '../api/types'

export const faqReportId = 'faq-report'

const sections = {
  inbox: { id: 'inbox', to: '/panel/inbox', label: 'panel.inbox', icon: Inbox },
  tickets: { id: 'tickets', to: '/panel/tickets', label: 'panel.tickets', icon: Ticket },
  analytics: { id: 'analytics', to: '/panel/analytics', label: 'panel.analytics', icon: ChartNoAxesCombined },
  faq: { id: 'faq', to: '/panel/analytics#' + faqReportId, label: 'staff.faq', icon: BookOpen },
} as const

const sectionsByRole = {
  operator: [sections.inbox],
  specialist: [sections.tickets],
  manager: [sections.analytics, sections.faq, sections.inbox, sections.tickets],
} as const
const demoSections = [sections.inbox, sections.tickets, sections.analytics] as const

export type PanelSection = (typeof sections)[keyof typeof sections]

export function staffSections(role: StaffRole | null): readonly PanelSection[] {
  return role ? sectionsByRole[role] : demoSections
}

export function canEditCases(role: StaffRole | null, section: 'inbox' | 'tickets') {
  return role === null || role === (section === 'inbox' ? 'operator' : 'specialist')
}
