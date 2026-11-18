import { CircleDot, Clock3, Hourglass, Timer, TriangleAlert } from 'lucide-react'
import type { Ticket } from '../../api/types'
import { localeCodes } from '../../i18n/locales'
import { ticketPageMessages } from '../../i18n/ticket-page'
import { useLanguage } from '../../i18n/useLanguage'
import { useT } from '../../i18n/useT'
import { getDeadlineDays, getTicketStatus } from '../../lib/ticket-time'
import { GlassPanel, Skeleton, ViewportCounter } from '../ui'

const metrics = [
  { key: 'new', label: 'tickets.new', tone: 'blue', icon: CircleDot },
  { key: 'in_progress', label: 'tickets.inProgress', tone: 'blue', icon: Timer },
  { key: 'due', label: 'tickets.dueSoon', tone: 'amber', icon: Hourglass },
  { key: 'overdue', label: 'tickets.overdue', tone: 'red', icon: TriangleAlert },
  { key: 'average', label: 'tickets.average', tone: 'blue', icon: Clock3 },
] as const

function measure(tickets: Ticket[], now: number) {
  let newCount = 0
  let inProgress = 0
  let due = 0
  let overdue = 0
  let solved = 0
  let elapsed = 0

  for (const ticket of tickets) {
    const status = getTicketStatus(ticket, now)
    if (status === 'new') newCount++
    if (status === 'in_progress') inProgress++
    if (status === 'overdue') overdue++
    if (status === 'new' || status === 'in_progress') {
      if (getDeadlineDays(ticket.due_at, now) <= 3) due++
    }
    if (status === 'answered') {
      const answer = ticket.events?.filter((event) => event.type === 'answered').at(-1)
      const hours = answer ? (Date.parse(answer.created_at) - Date.parse(ticket.created_at)) / 3_600_000 : -1
      if (hours >= 0 && Number.isFinite(hours)) {
        elapsed += hours
        solved++
      }
    }
  }
  return { new: newCount, in_progress: inProgress, due, overdue, average: solved ? Math.round(elapsed / solved) : null }
}

export function TicketStats({ tickets, now }: { tickets: Ticket[] | undefined; now: number }) {
  const t = useT(ticketPageMessages)
  const { language } = useLanguage()
  const stats = tickets ? measure(tickets, now) : undefined

  return (
    <dl className="tickets-stats glass-stagger" aria-busy={!stats}>
      {metrics.map(({ key, label, tone, icon: Icon }) => {
        const count = stats?.[key]
        return (
          <GlassPanel blur={false} variant="subtle" className="ticket-metric" data-tone={tone} key={key}>
            <dt className="ticket-metric-label"><Icon aria-hidden="true" size={16} /> {t(label)}</dt>
            <dd className="ticket-metric-value">
              {count === undefined ? <Skeleton className="ticket-metric-skeleton" /> : count === null ? '—' : (
                <>
                  <ViewportCounter value={count} locale={localeCodes[language]} />
                  {key === 'average' && <span>{t('tickets.hours')}</span>}
                </>
              )}
            </dd>
            {key === 'due' && <dd className="ticket-metric-hint">{t('tickets.dueSoonHint')}</dd>}
          </GlassPanel>
        )
      })}
    </dl>
  )
}
