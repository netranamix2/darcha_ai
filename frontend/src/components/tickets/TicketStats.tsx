import type { Ticket } from '../../api/types'
import { localeCodes } from '../../i18n/locales'
import { ticketPageMessages } from '../../i18n/ticket-page'
import { useLanguage } from '../../i18n/useLanguage'
import { useT } from '../../i18n/useT'
import { getDeadlineDays, getTicketStatus } from '../../lib/ticket-time'
import { Skeleton } from '../ui'

const metrics = [
  { key: 'new', label: 'tickets.new' },
  { key: 'in_progress', label: 'tickets.inProgress' },
  { key: 'due', label: 'tickets.dueSoon' },
  { key: 'overdue', label: 'tickets.overdue' },
  { key: 'average', label: 'tickets.average' },
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
  const formatter = new Intl.NumberFormat(localeCodes[language])

  return (
    <dl className="tickets-stats" aria-busy={!stats}>
      {metrics.map(({ key, label }) => {
        const count = stats?.[key]
        return (
          <div className="ticket-metric" data-metric={key} key={key}>
            <dt className="ticket-metric-label">{t(label)}</dt>
            <dd className="ticket-metric-value">
              {count === undefined ? <Skeleton className="ticket-metric-skeleton" /> : count === null ? '—' : (
                <>
                  <span>{formatter.format(count)}</span>
                  {key === 'average' && <span>{t('tickets.hours')}</span>}
                </>
              )}
            </dd>
          </div>
        )
      })}
    </dl>
  )
}
