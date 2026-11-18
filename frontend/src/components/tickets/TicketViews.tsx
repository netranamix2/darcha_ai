import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  pointerWithin,
  rectIntersection,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import type { CollisionDetection, DragEndEvent, KeyboardCoordinateGetter } from '@dnd-kit/core'
import {
  ArrowDown,
  ArrowDownUp,
  ArrowUp,
  CheckCircle2,
  GripVertical,
  Inbox as InboxIcon,
  Instagram,
  MapPin,
  Monitor,
  Send,
  SignalHigh,
  SignalLow,
  SignalMedium,
  UserRound,
} from 'lucide-react'
import { useReducedMotion } from 'motion/react'
import { useId, useMemo, useState } from 'react'
import type { CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import type { StaffMember, Ticket } from '../../api/types'
import { localeCodes } from '../../i18n/locales'
import { ticketViewMessages } from '../../i18n/ticket-views'
import { useLanguage } from '../../i18n/useLanguage'
import { useT } from '../../i18n/useT'
import { formatDayDuration, formatTicketDate, getDeadlineDays, getTicketStatus } from '../../lib/ticket-time'
import { Avatar, GlassPanel } from '../ui'
import './ticket-views.css'

type Status = Ticket['status']
type MovableStatus = Exclude<Status, 'overdue'>
type ViewTranslation = ReturnType<typeof useTicketViewT>

interface TicketViewProps {
  tickets: Ticket[]
  staff: StaffMember[]
  now: number
  onOpen: (ticket: Ticket) => void
}

const laneOrder = ['new', 'in_progress', 'answered', 'overdue'] as const
const movableLanes: readonly MovableStatus[] = ['new', 'in_progress', 'answered']
const dayMs = 86_400_000

const statusLabels = {
  new: 'ticketView.new',
  in_progress: 'ticketView.inProgress',
  answered: 'ticketView.answered',
  overdue: 'ticketView.overdue',
} as const satisfies Record<Status, string>

const channels = {
  web: { label: 'ticketView.channelWeb', icon: Monitor },
  telegram: { label: 'ticketView.channelTelegram', icon: Send },
  instagram: { label: 'ticketView.channelInstagram', icon: Instagram },
} as const

const priorities = {
  low: { label: 'ticketView.priorityLow', icon: SignalLow, rank: 0 },
  normal: { label: 'ticketView.priorityNormal', icon: SignalMedium, rank: 1 },
  high: { label: 'ticketView.priorityHigh', icon: SignalHigh, rank: 2 },
} as const

function useTicketViewT() {
  return useT(ticketViewMessages)
}

function openTicketLabel(t: ViewTranslation, ticket: Ticket) {
  return t('ticketView.open').replace('{number}', ticket.number)
}

function isMovableStatus(status: unknown): status is MovableStatus {
  return movableLanes.some((lane) => lane === status)
}

function ChannelMarker({ channel, label = false }: { channel: Ticket['channel']; label?: boolean }) {
  const t = useTicketViewT()
  const { icon: Icon, label: key } = channels[channel]
  return (
    <span className="ticket-marker" title={label ? undefined : t(key)} aria-label={label ? undefined : t(key)} role={label ? undefined : 'img'}>
      <Icon aria-hidden="true" size={15} />
      {label && <span>{t(key)}</span>}
    </span>
  )
}

function PriorityMarker({ priority, label = false }: { priority: Ticket['priority']; label?: boolean }) {
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

function AssigneeMarker({ member, label = false }: { member?: StaffMember; label?: boolean }) {
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

function TicketDeadline({ ticket, now, showDate = false }: { ticket: Ticket; now: number; showDate?: boolean }) {
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

function TicketCardBody({ ticket, member, now }: { ticket: Ticket; member?: StaffMember; now: number }) {
  const t = useTicketViewT()
  const region = ticket.region ?? t('ticketView.noRegion')
  return (
    <>
      <span className="ticket-card-kicker">
        <span className="ticket-card-number">{ticket.number}</span>
        <PriorityMarker priority={ticket.priority} />
      </span>
      <span className="ticket-card-topic" title={ticket.topic}>{ticket.topic}</span>
      <span className="ticket-card-summary" title={ticket.summary}>{ticket.summary}</span>
      <span className="ticket-card-meta">
        <span className="ticket-card-context">
          <ChannelMarker channel={ticket.channel} />
          <span className="ticket-card-region" title={region}><MapPin size={13} aria-hidden="true" /><span>{region}</span></span>
        </span>
        <AssigneeMarker member={member} />
      </span>
      <TicketDeadline ticket={ticket} now={now} />
    </>
  )
}

function BoardCard({ ticket, member, now, status, onOpen }: {
  ticket: Ticket
  member?: StaffMember
  now: number
  status: Status
  onOpen: TicketViewProps['onOpen']
}) {
  const t = useTicketViewT()
  const movable = isMovableStatus(status)
  const { setNodeRef, setActivatorNodeRef, attributes, listeners, isDragging } = useDraggable({
    id: ticket.id,
    disabled: !movable,
    data: { status },
  })

  return (
    <li className="ticket-card-item" ref={setNodeRef} data-dragging={isDragging || undefined}>
      <article className="ticket-card" data-movable={movable || undefined}>
        <button
          type="button"
          className="ticket-card-open"
          aria-label={openTicketLabel(t, ticket)}
          onPointerDown={(event) => listeners?.onPointerDown?.(event)}
          onClick={() => onOpen(ticket)}
        >
          <TicketCardBody ticket={ticket} member={member} now={now} />
        </button>
        {movable && (
          <button
            type="button"
            className="ticket-card-grip"
            ref={setActivatorNodeRef}
            {...attributes}
            {...listeners}
            aria-label={t('ticketView.move').replace('{number}', ticket.number)}
          >
            <GripVertical size={17} aria-hidden="true" />
          </button>
        )}
      </article>
    </li>
  )
}

function BoardLane({ status, tickets, members, now, onOpen }: {
  status: Status
  tickets: Ticket[]
  members: ReadonlyMap<string, StaffMember>
  now: number
  onOpen: TicketViewProps['onOpen']
}) {
  const id = useId()
  const t = useTicketViewT()
  const { setNodeRef, isOver } = useDroppable({ id: status, disabled: !isMovableStatus(status) })

  return (
    <section className="ticket-board-lane" data-status={status} data-over={isOver || undefined} ref={setNodeRef} aria-labelledby={id}>
      <header className="ticket-board-lane-header">
        <span className="ticket-column-dot" aria-hidden="true" />
        <h2 id={id}>{t(statusLabels[status])}</h2>
        <span className="ticket-board-count">{tickets.length}</span>
      </header>
      {tickets.length ? (
        <ul className="ticket-board-stack glass-stagger">
          {tickets.map((ticket) => (
            <BoardCard
              key={ticket.id}
              ticket={ticket}
              member={ticket.assignee_id ? members.get(ticket.assignee_id) : undefined}
              status={status}
              now={now}
              onOpen={onOpen}
            />
          ))}
        </ul>
      ) : (
        <div className="ticket-lane-empty"><InboxIcon size={19} aria-hidden="true" /><span>{t('ticketView.emptyColumn')}</span></div>
      )}
    </section>
  )
}

const detectColumn: CollisionDetection = (args) => args.pointerCoordinates ? pointerWithin(args) : rectIntersection(args)

const keyboardColumnCoordinates: KeyboardCoordinateGetter = (event, { currentCoordinates, context }) => {
  if (event.code !== 'ArrowLeft' && event.code !== 'ArrowRight') return undefined
  const current = context.over?.id ?? context.active?.data.current?.status
  if (!isMovableStatus(current)) return undefined
  const direction = event.code === 'ArrowRight' ? 1 : -1
  const next = movableLanes[movableLanes.indexOf(current) + direction]
  const source = context.collisionRect
  const target = next ? context.droppableRects.get(next) : undefined
  if (!source || !target) return undefined
  event.preventDefault()
  return {
    x: currentCoordinates.x + target.left + target.width / 2 - source.left - source.width / 2,
    y: currentCoordinates.y,
  }
}

export function TicketKanban({ tickets, staff, now, onOpen, onMove }: TicketViewProps & {
  onMove: (id: string, status: MovableStatus) => void
}) {
  const t = useTicketViewT()
  const reducedMotion = useReducedMotion()
  const [activeId, setActiveId] = useState<string | null>(null)
  const members = useMemo(() => new Map(staff.map((member) => [member.id, member])), [staff])
  const byId = useMemo(() => new Map(tickets.map((ticket) => [ticket.id, ticket])), [tickets])
  const lanes = useMemo(() => {
    const groups: Record<Status, Ticket[]> = { new: [], in_progress: [], answered: [], overdue: [] }
    const ordered = [...tickets].sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))
    ordered.forEach((ticket) => groups[getTicketStatus(ticket, now)].push(ticket))
    return groups
  }, [tickets, now])
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: keyboardColumnCoordinates, scrollBehavior: reducedMotion ? 'auto' : 'smooth' }),
  )
  const activeTicket = activeId ? byId.get(activeId) : undefined

  function dragEnd({ active, over }: DragEndEvent) {
    setActiveId(null)
    const ticket = byId.get(String(active.id))
    if (!ticket || !isMovableStatus(over?.id) || getTicketStatus(ticket, now) === over.id) return
    onMove(ticket.id, over.id)
  }

  function announceDrag(key: 'ticketView.dragStart' | 'ticketView.dragOver' | 'ticketView.dragEnd' | 'ticketView.dragCancel', id: string | number, lane?: string | number) {
    const number = byId.get(String(id))?.number ?? String(id)
    const column = isMovableStatus(lane) ? t(statusLabels[lane]) : ''
    return t(key).replace('{number}', number).replace('{column}', column)
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={detectColumn}
      onDragStart={({ active }) => setActiveId(String(active.id))}
      onDragCancel={() => setActiveId(null)}
      onDragEnd={dragEnd}
      accessibility={{
        screenReaderInstructions: { draggable: t('ticketView.dragInstructions') },
        announcements: {
          onDragStart: ({ active }) => announceDrag('ticketView.dragStart', active.id),
          onDragOver: ({ active, over }) => over ? announceDrag('ticketView.dragOver', active.id, over.id) : undefined,
          onDragEnd: ({ active, over }) => over
            ? announceDrag('ticketView.dragEnd', active.id, over.id)
            : announceDrag('ticketView.dragCancel', active.id),
          onDragCancel: ({ active }) => announceDrag('ticketView.dragCancel', active.id),
        },
      }}
    >
      <div className="ticket-board-scroller" role="region" aria-label={t('ticketView.board')} tabIndex={0}>
        <div className="ticket-board">
          {laneOrder.map((status) => <BoardLane key={status} status={status} tickets={lanes[status]} members={members} now={now} onOpen={onOpen} />)}
        </div>
      </div>
      {createPortal(
        <DragOverlay dropAnimation={reducedMotion ? null : { duration: 270, easing: 'cubic-bezier(0.18, 0.78, 0.28, 1)' }} transition={reducedMotion ? () => undefined : undefined}>
          {activeTicket && (
            <div className="ticket-card ticket-card--overlay" aria-hidden="true" data-movable="true">
              <div className="ticket-card-open">
                <TicketCardBody ticket={activeTicket} member={activeTicket.assignee_id ? members.get(activeTicket.assignee_id) : undefined} now={now} />
              </div>
              <span className="ticket-card-grip"><GripVertical size={17} /></span>
            </div>
          )}
        </DragOverlay>,
        document.body,
      )}
    </DndContext>
  )
}

const tableColumns = [
  { key: 'number', label: 'ticketView.number' },
  { key: 'topic', label: 'ticketView.topic' },
  { key: 'channel', label: 'ticketView.channel' },
  { key: 'region', label: 'ticketView.region' },
  { key: 'priority', label: 'ticketView.priority' },
  { key: 'assignee', label: 'ticketView.assignee' },
  { key: 'status', label: 'ticketView.status' },
  { key: 'deadline', label: 'ticketView.deadline' },
] as const

type SortKey = (typeof tableColumns)[number]['key']

export function TicketTable({ tickets, staff, now, onOpen }: TicketViewProps) {
  const t = useTicketViewT()
  const { language } = useLanguage()
  const [sort, setSort] = useState<{ key: SortKey; direction: 'ascending' | 'descending' }>({ key: 'deadline', direction: 'ascending' })
  const members = useMemo(() => new Map(staff.map((member) => [member.id, member])), [staff])
  const compare = useMemo(() => new Intl.Collator(localeCodes[language], { sensitivity: 'base', numeric: true }).compare, [language])
  const rows = tickets.map((ticket) => ({
    ticket,
    member: ticket.assignee_id ? members.get(ticket.assignee_id) : undefined,
    status: getTicketStatus(ticket, now),
  }))

  const sorted = rows.map((row) => ({
    ...row,
    value: {
      number: row.ticket.number,
      topic: row.ticket.topic,
      channel: t(channels[row.ticket.channel].label),
      region: row.ticket.region ?? '',
      priority: priorities[row.ticket.priority].rank,
      assignee: row.member?.name ?? '',
      status: laneOrder.indexOf(row.status),
      deadline: Date.parse(row.ticket.due_at) || Number.MAX_SAFE_INTEGER,
    }[sort.key],
  })).sort((a, b) => {
    const result = typeof a.value === 'number' && typeof b.value === 'number'
      ? a.value - b.value
      : compare(String(a.value), String(b.value))
    return (sort.direction === 'ascending' ? result : -result) || compare(a.ticket.number, b.ticket.number)
  })

  function changeSort(key: SortKey) {
    setSort((previous) => ({ key, direction: previous.key === key && previous.direction === 'ascending' ? 'descending' : 'ascending' }))
  }

  const DirectionIcon = sort.direction === 'ascending' ? ArrowUp : ArrowDown
  return (
    <GlassPanel variant="subtle" className="ticket-table-panel">
      <div className="ticket-mobile-sort">
        <label>
          <span>{t('ticketView.sort')}</span>
          <select value={sort.key} onChange={(event) => {
            const column = tableColumns.find(({ key }) => key === event.currentTarget.value)
            if (column) setSort({ key: column.key, direction: 'ascending' })
          }}>
            {tableColumns.map(({ key, label }) => <option key={key} value={key}>{t(label)}</option>)}
          </select>
        </label>
        <button type="button" onClick={() => changeSort(sort.key)} aria-label={t(sort.direction === 'ascending' ? 'ticketView.sortDescending' : 'ticketView.sortAscending')}>
          <DirectionIcon size={16} aria-hidden="true" />
        </button>
      </div>
      <div className="ticket-table-scroll">
        <table className="ticket-data-table" aria-label={t('ticketView.table')}>
          <thead>
            <tr>
              {tableColumns.map(({ key, label }) => {
                const active = sort.key === key
                const SortIcon = active ? DirectionIcon : ArrowDownUp
                return (
                  <th key={key} scope="col" aria-sort={active ? sort.direction : undefined}>
                    <button type="button" data-active={active || undefined} onClick={() => changeSort(key)}>
                      {t(label)} <SortIcon aria-hidden="true" size={13} />
                    </button>
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody className="glass-stagger">
            {sorted.map(({ ticket, member, status }) => (
              <tr className="ticket-table-row" key={ticket.id} onClick={() => onOpen(ticket)}>
                <td data-column="number">
                  <button className="ticket-table-number" type="button" aria-label={openTicketLabel(t, ticket)} onClick={(event) => {
                    event.stopPropagation()
                    onOpen(ticket)
                  }}>{ticket.number}</button>
                </td>
                <td data-column="topic" title={ticket.topic}><span className="ticket-table-topic">{ticket.topic}</span></td>
                <td data-column="channel"><ChannelMarker channel={ticket.channel} label /></td>
                <td data-column="region"><span className="ticket-table-region" title={ticket.region ?? undefined}>{ticket.region ?? t('ticketView.noRegion')}</span></td>
                <td data-column="priority"><PriorityMarker priority={ticket.priority} label /></td>
                <td data-column="assignee"><AssigneeMarker member={member} label /></td>
                <td data-column="status"><span className="ticket-table-status" data-status={status}><span aria-hidden="true" />{t(statusLabels[status])}</span></td>
                <td data-column="deadline"><TicketDeadline ticket={ticket} now={now} showDate /></td>
              </tr>
            ))}
          </tbody>
        </table>
        {!sorted.length && <div className="ticket-table-empty"><InboxIcon size={25} aria-hidden="true" /><p>{t('ticketView.emptyTable')}</p></div>}
      </div>
    </GlassPanel>
  )
}
