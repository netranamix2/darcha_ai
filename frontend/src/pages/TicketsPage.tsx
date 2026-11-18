import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Globe2, Instagram, Send } from 'lucide-react'
import { useEffect } from 'react'
import { useOutletContext, useSearchParams } from 'react-router'
import { getTicket } from '../api/client'
import type { Ticket } from '../api/types'
import type { PanelContext } from '../components/PanelLayout'
import { TicketDrawer } from '../components/tickets/TicketDrawer'
import { Button, GlassPanel, Skeleton, Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui'
import { inboxKey, ticketsKey, useStaffRecords, useTicketRecords } from '../hooks/usePanelCases'
import { useTicketClock } from '../hooks/useTicketClock'
import { panelSimpleMessages } from '../i18n/panel-simple'
import { staffMessages } from '../i18n/staff'
import { ticketDrawerMessages } from '../i18n/ticket-drawer'
import { ticketPageMessages } from '../i18n/ticket-page'
import { useLanguage } from '../i18n/useLanguage'
import { useT } from '../i18n/useT'
import { localizeCaseTopic } from '../lib/case-labels'
import { canEditCases } from '../lib/panel-sections'
import { formatDayDuration, formatTicketDate, getDeadlineDays, getTicketStatus } from '../lib/ticket-time'

const statuses = ['new', 'in_progress', 'answered', 'overdue'] as const
const channels = {
  web: { Icon: Globe2, label: 'tickets.channelWeb' },
  telegram: { Icon: Send, label: 'tickets.channelTelegram' },
  instagram: { Icon: Instagram, label: 'tickets.channelInstagram' },
} as const

function Deadline({ ticket, now }: { ticket: Ticket; now: number }) {
  const t = useT(panelSimpleMessages)
  const { language } = useLanguage()
  if (ticket.status === 'answered') return <time dateTime={ticket.due_at}>{formatTicketDate(ticket.due_at, language)}</time>
  const days = getDeadlineDays(ticket.due_at, now)
  if (!Number.isFinite(days)) return <span>—</span>
  const total = getDeadlineDays(ticket.due_at, Date.parse(ticket.created_at))
  const progress = Math.max(0.04, Math.min(1, days / (total > 0 ? total : 15)))
  return (
    <div className="simple-ticket-deadline" data-urgent={days <= 3}>
      <span>{t(days < 0 ? 'simple.late' : 'simple.remaining').replace('{days}', formatDayDuration(days, language))}</span>
      <span className="simple-ticket-meter" aria-hidden="true"><span style={{ transform: 'scaleX(' + progress + ')' }} /></span>
    </div>
  )
}

export default function TicketsPage() {
  const t = useT(panelSimpleMessages)
  const tTicket = useT(ticketPageMessages)
  const tDrawer = useT(ticketDrawerMessages)
  const tStaff = useT(staffMessages)
  const { language } = useLanguage()
  const [params, setParams] = useSearchParams()
  const { notify, role } = useOutletContext<PanelContext>()
  const readOnly = !canEditCases(role, 'tickets')
  const client = useQueryClient()
  const records = useTicketRecords()
  const staff = useStaffRecords()
  const now = Math.max(useTicketClock(), records.dataUpdatedAt)
  const groups: Record<Ticket['status'], Ticket[]> = { new: [], in_progress: [], answered: [], overdue: [] }
  for (const ticket of [...(records.data ?? [])].sort((a, b) => b.created_at.localeCompare(a.created_at))) {
    groups[getTicketStatus(ticket, now)].push(ticket)
  }

  const requested = params.get('ticket')
  const explicitStatus = statuses.find((status) => status === params.get('status'))
  const demoTarget = !requested && params.has('answer') ? groups.new[0]?.id : undefined
  useEffect(() => {
    if (!demoTarget) return
    setParams({ status: 'new', ticket: demoTarget }, { replace: true })
  }, [demoTarget, setParams])
  const selectedId = requested
  const selectedSummary = records.data?.find(({ id }) => id === selectedId)
  const detail = useQuery({
    queryKey: [...ticketsKey, 'detail', selectedId],
    queryFn: () => getTicket(selectedId ?? ''),
    enabled: !!selectedId,
    retry: false,
  })
  const selected = detail.data ?? selectedSummary
  const active = explicitStatus ?? (selected ? getTicketStatus(selected, now) : 'new')
  const people = staff.data ?? []

  function selectTab(status: Ticket['status']) {
    setParams({ status }, { replace: true })
  }

  function invalidateCases() {
    void client.invalidateQueries({ queryKey: ticketsKey })
    void client.invalidateQueries({ queryKey: inboxKey })
  }

  return (
    <section className="simple-panel-page" aria-labelledby="tickets-title">
      <header className="simple-panel-heading">
        <h1 id="tickets-title">{t('panel.tickets')}</h1>
        <p>{t('simple.ticketsHelp')}{readOnly && ' ' + tStaff('staff.readOnlyNote')}</p>
      </header>
      <Tabs value={active} onValueChange={(value) => {
        const next = statuses.find((status) => status === value)
        if (next) selectTab(next)
      }}>
        <TabsList className="simple-panel-tabs simple-ticket-tabs" aria-label={t('panel.tickets')}>
          {statuses.map((status) => (
            <TabsTrigger value={status} key={status}>
              {t(`simple.${status}`)} <span data-urgent={status === 'overdue'}>{groups[status].length}</span>
            </TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value={active}>
          {records.isError && !records.data ? (
            <GlassPanel blur={false} className="simple-panel-state" role="alert">
              <p>{tTicket('tickets.loadError')}</p>
              <Button variant="secondary" onClick={() => void records.refetch()}>{t('simple.retry')}</Button>
            </GlassPanel>
          ) : records.isPending ? (
            <div className="simple-panel-state" role="status" aria-label={t('common.loading')}><Skeleton /><Skeleton /></div>
          ) : (
            <GlassPanel blur={false} variant="subtle" className="simple-ticket-surface">
              {groups[active].length === 0 ? (
                <div className="simple-panel-state"><p>{t('simple.noTickets')}</p><small>{t('simple.ticketHint')}</small></div>
              ) : (
                <table className="simple-ticket-table" aria-label={t('panel.tickets')}>
                  <thead>
                    <tr>
                      <th scope="col">{t('simple.number')}</th><th scope="col">{t('simple.topic')}</th>
                      <th scope="col">{t('simple.channel')}</th><th scope="col">{t('simple.deadline')}</th>
                      <th scope="col">{tTicket('tickets.assignee')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {groups[active].map((ticket) => {
                      const { Icon, label } = channels[ticket.channel]
                      const number = ticket.number.startsWith('№') ? ticket.number : '№' + ticket.number
                      const assignee = people.find(({ id }) => ticket.assignee_id === id)
                      const open = () => setParams({ status: active, ticket: ticket.id }, { replace: true })
                      return (
                        <tr key={ticket.id} onClick={open}>
                          <td className="simple-ticket-number">{number}</td>
                          <td><button type="button" onClick={(event) => { event.stopPropagation(); open() }}>
                            {localizeCaseTopic(ticket.topic, language)}<span className="sr-only"> {number}</span>
                          </button></td>
                          <td><span className="simple-ticket-channel" title={tTicket(label)}>
                            <Icon size={17} aria-hidden="true" /> <span>{tTicket(label)}</span>
                          </span></td>
                          <td><Deadline ticket={ticket} now={now} /></td>
                          <td>{assignee?.name ?? t('simple.unassigned')}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              )}
            </GlassPanel>
          )}
        </TabsContent>
      </Tabs>
      {selectedId && !selected && (
        <div className="simple-panel-state" role={detail.isError ? 'alert' : 'status'}>
          {detail.isError ? <><p>{t('simple.missingTicket')}</p>
            <Button variant="secondary" onClick={() => void detail.refetch()}>{t('simple.retry')}</Button></>
            : <Skeleton aria-label={t('common.loading')} />}
        </div>
      )}
      {selected && (
        <TicketDrawer
          key={selected.id}
          ticket={selected}
          staff={people}
          now={now}
          readOnly={readOnly}
          detailLoading={detail.isPending}
          detailError={detail.isError ? () => void detail.refetch() : undefined}
          staffUnavailable={staff.isPending || staff.isError}
          staffError={staff.isError ? () => void staff.refetch() : undefined}
          onClose={() => selectTab(active)}
          onUpdated={invalidateCases}
          onSendError={() => notify({ title: tDrawer('drawer.sendError'), variant: 'error' })}
          onChangeNotice={(ok) => notify({ title: t(ok ? 'simple.saved' : 'simple.saveError'), variant: ok ? 'success' : 'error' })}
          onSent={(answer) => {
            client.setQueryData<Ticket[]>(ticketsKey, (items) =>
              items?.map((item) => item.id === selected.id ? { ...item, status: 'answered', final_answer: answer } : item),
            )
            setParams({ status: 'answered', ticket: selected.id }, { replace: true })
            notify({ title: tTicket('tickets.sentNotice'), variant: 'success' })
          }}
        />
      )}
    </section>
  )
}
