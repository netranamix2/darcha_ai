import { CheckCircle2, UserRound } from 'lucide-react'
import type { CSSProperties } from 'react'
import type { StaffMember, Ticket } from '../../api/types'
import { useLanguage } from '../../i18n/useLanguage'
import { formatDayDuration, formatTicketDate, getDeadlineDays, getTicketStatus } from '../../lib/ticket-time'
import { Avatar } from '../ui'
import { channels, dayMs, priorities, useTicketViewT } from './ticket-view-config'

export function ChannelMarker({ channel, label = false }: { channel: Ticket['channel']; label?: boolean }) {
  const t = useTicketViewT()
  const { icon: Icon, label: key } = channels[channel]
  return (
    <span className="ticket-marker" title={label ? undefined : t(key)} aria-label={label ? undefined : t(key)} role={label ? undefined : 'img'}>
      <Icon aria-hidden="true" size={15} />
      {label && <span>{t(key)}</span>}
    </span>
  )
}

export function PriorityMarker({ priority, label = false }: { priority: Ticket['priority']; label?: boolean }) {
  const t = useTicketViewT()
  const { icon: Icon, label: key } = priorities[priority]
  return (
    <span
      className="ticket-marker ticket-priority"
      data-priority={priority}
      title={label ? undefined : t(key)}
      aria-label={label ? undefined : t(key)}
      role={label ? undefined : 'img'}
    >
      <Icon aria-hidden="true" size={16} />
      {label && <span>{t(key)}</span>}
    </span>
  )
}

export function AssigneeMarker({ member, label = false }: { member?: StaffMember; label?: boolean }) {
  const t = useTicketViewT()
  const name = member?.name ?? t('ticketView.unassigned')
  return (
    <span className="ticket-marker ticket-assignee" title={name} aria-label={label ? undefined : name} role={label ? undefined : 'img'}>
      {member ? (
        <Avatar
          size="sm"
          initials={member.name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('')}
        />
      ) : (
        <span className="ticket-unassigned"><UserRound size={14} aria-hidden="true" /></span>
      )}
      {label && <span>{name}</span>}
    </span>
  )
}

export function TicketDeadline({ ticket, now, showDate = false }: { ticket: Ticket; now: number; showDate?: boolean }) {
  const { language } = useLanguage()
  const t = useTicketViewT()
  const due = Date.parse(ticket.due_at)
  const status = getTicketStatus(ticket, now)
  const days = getDeadlineDays(ticket.due_at, now)
  const isAnswered = status === 'answered'
  const isLate = status === 'overdue'
  const validDeadline = Number.isFinite(due) && Number.isFinite(days)
  const remaining = (due - now) / dayMs
  const tone = isAnswered ? 'success' : !validDeadline ? 'neutral' : isLate || remaining < 3 ? 'critical' : remaining <= 7 ? 'soon' : 'success'
  let text = t('ticketView.deadlineUnknown')
  if (isAnswered) text = t('ticketView.deadlineDone')
  else if (validDeadline) {
    if (isLate) {
      const lateDays = Math.max(1, Math.ceil((now - due) / dayMs))
      text = t('ticketView.deadlineOverdue').replace('{duration}', formatDayDuration(lateDays, language))
    } else {
      text = days === 0
        ? t('ticketView.deadlineToday')
        : t('ticketView.deadlineRemaining').replace('{duration}', formatDayDuration(days, language))
    }
  }

  const initialSpan = due - Date.parse(ticket.created_at)
  const span = Number.isFinite(initialSpan) && initialSpan > 0 ? initialSpan : 15 * dayMs
  const scale = isAnswered || isLate ? 1 : validDeadline ? Math.min(1, Math.max(0.06, (due - now) / span)) : 0
  return (
    <span className="ticket-deadline" data-tone={tone} data-late={isLate || undefined} data-with-date={showDate || undefined}>
      {showDate && validDeadline && <time className="ticket-deadline-date" dateTime={ticket.due_at}>{formatTicketDate(ticket.due_at, language)}</time>}
      <span className="ticket-deadline-label">
        {isAnswered ? <CheckCircle2 size={13} aria-hidden="true" /> : <span className="ticket-deadline-dot" aria-hidden="true" />}
        {text}
      </span>
      {!showDate && (
        <span className="ticket-deadline-track" aria-hidden="true">
          <span style={{ '--ticket-deadline-scale': scale } as CSSProperties} />
        </span>
      )}
    </span>
  )
}
