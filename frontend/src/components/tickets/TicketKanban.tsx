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
import { GripVertical, Inbox as InboxIcon, MapPin } from 'lucide-react'
import { useReducedMotion } from 'motion/react'
import { useId, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import type { StaffMember, Ticket } from '../../api/types'
import { useLanguage } from '../../i18n/useLanguage'
import { localizeCaseRegion, localizeCaseTopic } from '../../lib/case-labels'
import { getTicketStatus } from '../../lib/ticket-time'
import { AssigneeMarker, ChannelMarker, PriorityMarker, TicketDeadline } from './TicketViewParts'
import { isMovableStatus, laneOrder, movableLanes, openTicketLabel, statusLabels, useTicketViewT } from './ticket-view-config'
import type { MovableStatus, Status, TicketViewProps } from './ticket-view-config'

function TicketCardBody({ ticket, member, now }: { ticket: Ticket; member?: StaffMember; now: number }) {
  const t = useTicketViewT()
  const { language } = useLanguage()
  const topic = localizeCaseTopic(ticket.topic, language)
  const region = ticket.region ? localizeCaseRegion(ticket.region, language) : t('ticketView.noRegion')
  return (
    <>
      <span className="ticket-card-kicker">
        <span className="ticket-card-number">{ticket.number}</span>
        <PriorityMarker priority={ticket.priority} />
      </span>
      <span className="ticket-card-topic" title={topic}>{topic}</span>
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
        <DragOverlay dropAnimation={reducedMotion ? null : { duration: 200, easing: 'ease-out' }} transition={reducedMotion ? () => undefined : undefined}>
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
