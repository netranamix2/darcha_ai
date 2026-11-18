import { useMutation, useQueryClient } from '@tanstack/react-query'
import { AlertCircle, Columns3, ListFilter, Table2 } from 'lucide-react'
import { LayoutGroup, motion, useReducedMotion } from 'motion/react'
import { useDeferredValue, useMemo, useState, useSyncExternalStore } from 'react'
import { useOutletContext, useSearchParams } from 'react-router'
import { updateTicket } from '../api/client'
import type { Channel, StaffMember, Ticket } from '../api/types'
import type { PanelNotify } from '../components/PanelLayout'
import { TicketDrawer } from '../components/tickets/TicketDrawer'
import { TicketFilters } from '../components/tickets/TicketFilters'
import type { TicketFilterValues } from '../components/tickets/TicketFilters'
import { TicketStats } from '../components/tickets/TicketStats'
import { TicketKanban, TicketTable } from '../components/tickets/TicketViews'
import { Button, GlassPanel, Skeleton } from '../components/ui'
import { inboxKey, ticketsKey, useStaffRecords, useTicketRecords } from '../hooks/usePanelCases'
import { useTicketClock } from '../hooks/useTicketClock'
import { ticketPageMessages } from '../i18n/ticket-page'
import { useT } from '../i18n/useT'
import './tickets-page.css'

const mobileQuery = '(max-width: 800px)'
const isNarrow = () => window.matchMedia(mobileQuery).matches
const noTickets: Ticket[] = []
const noStaff: StaffMember[] = []
const initialFilters: TicketFilterValues = {
  search: '', department: '', priority: '', assignee: '', region: '', mine: false,
}
const views = [
  { id: 'kanban', label: 'tickets.kanban', icon: Columns3 },
  { id: 'table', label: 'tickets.table', icon: Table2 },
] as const
const channelNames = {
  web: 'tickets.channelWeb',
  telegram: 'tickets.channelTelegram',
  instagram: 'tickets.channelInstagram',
} as const satisfies Record<Channel, string>

type View = (typeof views)[number]['id']
type MovableStatus = Exclude<Ticket['status'], 'overdue'>

function subscribeToWidth(callback: () => void) {
  const query = window.matchMedia(mobileQuery)
  query.addEventListener('change', callback)
  return () => query.removeEventListener('change', callback)
}

function normalizeSearch(value: string) {
  return value.trim().toLocaleLowerCase().replace(/[ʻʼ’`]/gu, "'")
}

function matchesTicket(ticket: Ticket, filters: TicketFilterValues, search: string, currentStaffId?: string) {
  if (filters.priority && ticket.priority !== filters.priority) return false
  if (filters.department && ticket.department !== filters.department) return false
  if (filters.mine && (!currentStaffId || ticket.assignee_id !== currentStaffId)) return false
  if (filters.assignee && (filters.assignee === 'unassigned' ? ticket.assignee_id : ticket.assignee_id !== filters.assignee)) return false
  if (filters.region && (filters.region === 'no-region' ? ticket.region : ticket.region !== filters.region)) return false
  return !search || normalizeSearch(`${ticket.number} ${ticket.topic} ${ticket.summary}`).includes(search)
}

export default function TicketsPage() {
  const t = useT(ticketPageMessages)
  const [view, setView] = useState<View>('kanban')
  const [filters, setFilters] = useState(initialFilters)
  const [params, setParams] = useSearchParams()
  const isMobile = useSyncExternalStore(subscribeToWidth, isNarrow)
  const reducedMotion = useReducedMotion()
  const notify = useOutletContext<PanelNotify>()
  const queryClient = useQueryClient()
  const ticketsQuery = useTicketRecords()
  const staffQuery = useStaffRecords()
  const now = Math.max(useTicketClock(), ticketsQuery.dataUpdatedAt)
  const deferredFilters = useDeferredValue(filters)
  const tickets = ticketsQuery.data ?? noTickets
  const staff = staffQuery.data ?? noStaff

  function updateCases() {
    void queryClient.invalidateQueries({ queryKey: ticketsKey })
    void queryClient.invalidateQueries({ queryKey: inboxKey })
  }

  const movement = useMutation({
    mutationFn: ({ id, status }: { id: string; status: MovableStatus }) => updateTicket(id, { status }),
    onSuccess: (_response, { id, status }) => {
      queryClient.setQueryData<Ticket[]>(ticketsKey, (previous) =>
        previous?.map((ticket) => ticket.id === id ? { ...ticket, status } : ticket),
      )
    },
    onError: () => notify({ title: t('tickets.moveError'), variant: 'error' }),
    onSettled: updateCases,
  })
  const move = movement.isPending ? movement.variables : undefined
  const selected = tickets.find((ticket) => ticket.id === params.get('ticket'))
  const regions = useMemo(() => [...new Set(tickets.flatMap(({ region }) => region ? [region] : []))].sort(), [tickets])
  const currentStaffId = staff.find(({ is_current }) => is_current)?.id
  const visible = useMemo(() => {
    const search = normalizeSearch(deferredFilters.search)
    return tickets
      .filter((ticket) => matchesTicket(ticket, deferredFilters, search, currentStaffId))
      .map((ticket) => move?.id === ticket.id ? { ...ticket, status: move.status } : ticket)
  }, [currentStaffId, deferredFilters, move, tickets])

  function selectTicket(ticket?: Ticket) {
    setParams((current) => {
      const next = new URLSearchParams(current)
      if (ticket) next.set('ticket', ticket.id)
      else next.delete('ticket')
      return next
    }, { replace: true })
  }

  return (
    <section className="tickets-page" aria-labelledby="tickets-title">
      <header className="tickets-heading">
        <div>
          <h1 id="tickets-title">{t('panel.tickets')}</h1>
          <p>{t('tickets.subtitle')}</p>
        </div>
        {!isMobile && (
          <LayoutGroup id="ticket-view">
            <div role="group" aria-label={t('tickets.views')} className="tickets-view-toggle">
              {views.map(({ id, label, icon: Icon }) => (
                <button key={id} type="button" aria-pressed={view === id} onClick={() => setView(id)}>
                  {view === id && <motion.span className="tickets-view-marker" aria-hidden="true" layoutId={reducedMotion ? undefined : 'selected'} transition={{ type: 'spring', duration: 0.28, bounce: 0.12 }} />}
                  <Icon aria-hidden="true" size={16} />
                  {t(label)}
                </button>
              ))}
            </div>
          </LayoutGroup>
        )}
      </header>
      <TicketStats tickets={ticketsQuery.isError ? tickets : ticketsQuery.data} now={now} />
      <TicketFilters filters={filters} staff={staff} regions={regions} onChange={setFilters} />
      {ticketsQuery.isError && !ticketsQuery.data ? (
        <GlassPanel blur={false} className="tickets-page-state" role="alert">
          <AlertCircle aria-hidden="true" size={21} />
          <p>{t('tickets.loadError')}</p>
          <Button variant="secondary" size="sm" onClick={() => void ticketsQuery.refetch()}>{t('tickets.retry')}</Button>
        </GlassPanel>
      ) : ticketsQuery.isPending ? (
        <div className="tickets-loading" role="status" aria-label={t('common.loading')}>
          {views.map(({ id }) => <Skeleton key={id} className="tickets-loading-block" />)}
        </div>
      ) : (
        <>
          {visible.length === 0 && tickets.length > 0 && (
            <div className="tickets-no-matches" role="status">
              <ListFilter aria-hidden="true" size={18} />
              <span>{t('tickets.noMatches')}</span>
              <Button variant="ghost" size="sm" onClick={() => setFilters(initialFilters)}>{t('tickets.resetFilters')}</Button>
            </div>
          )}
          {isMobile || view === 'table' ? (
            <TicketTable tickets={visible} staff={staff} now={now} onOpen={selectTicket} />
          ) : (
            <TicketKanban
              tickets={visible}
              staff={staff}
              now={now}
              onOpen={selectTicket}
              onMove={(id, status) => { if (!movement.isPending) movement.mutate({ id, status }) }}
            />
          )}
        </>
      )}
      {selected && (
        <TicketDrawer
          key={selected.id}
          ticket={selected}
          staff={staff}
          now={now}
          onClose={() => selectTicket()}
          onUpdated={updateCases}
          onSent={(channel) => notify({ title: `${t('tickets.sentNotice')} · ${t(channelNames[channel])}`, variant: 'success' })}
        />
      )}
    </section>
  )
}
