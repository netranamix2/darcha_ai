import { ArrowDown, ArrowDownUp, ArrowUp, Inbox as InboxIcon } from 'lucide-react'
import { useMemo, useState } from 'react'
import { localeCodes } from '../../i18n/locales'
import { ticketViewMessages } from '../../i18n/ticket-views'
import { useLanguage } from '../../i18n/useLanguage'
import { localizeCaseRegion, localizeCaseTopic } from '../../lib/case-labels'
import { getTicketStatus } from '../../lib/ticket-time'
import { GlassPanel } from '../ui'
import { AssigneeMarker, ChannelMarker, PriorityMarker, TicketDeadline } from './TicketViewParts'
import { channels, laneOrder, openTicketLabel, priorities, statusLabels, useTicketViewT } from './ticket-view-config'
import type { TicketViewProps } from './ticket-view-config'
import './ticket-views.css'

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
  const sorted = useMemo(() => tickets.map((ticket) => {
    const member = ticket.assignee_id ? members.get(ticket.assignee_id) : undefined
    const status = getTicketStatus(ticket, now)
    const topic = localizeCaseTopic(ticket.topic, language)
    const region = ticket.region ? localizeCaseRegion(ticket.region, language) : ''
    const value = {
      number: ticket.number,
      topic,
      channel: ticketViewMessages[language][channels[ticket.channel].label],
      region,
      priority: priorities[ticket.priority].rank,
      assignee: member?.name ?? '',
      status: laneOrder.indexOf(status),
      deadline: Date.parse(ticket.due_at) || Number.MAX_SAFE_INTEGER,
    }[sort.key]
    return { ticket, member, status, topic, region, value }
  }).sort((a, b) => {
    const result = typeof a.value === 'number' && typeof b.value === 'number'
      ? a.value - b.value
      : compare(String(a.value), String(b.value))
    return (sort.direction === 'ascending' ? result : -result) || compare(a.ticket.number, b.ticket.number)
  }), [compare, language, members, now, sort, tickets])

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
      <div className="ticket-table-scroll" role="region" aria-label={t('ticketView.table')} tabIndex={0}>
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
            {sorted.map(({ ticket, member, status, topic, region }) => (
              <tr className="ticket-table-row" key={ticket.id} onClick={() => onOpen(ticket)}>
                <td data-column="number">
                  <button className="ticket-table-number" type="button" aria-label={openTicketLabel(t, ticket)} onClick={(event) => {
                    event.stopPropagation()
                    onOpen(ticket)
                  }}>{ticket.number}</button>
                </td>
                <td data-column="topic" title={topic}><span className="ticket-table-topic">{topic}</span></td>
                <td data-column="channel"><ChannelMarker channel={ticket.channel} label /></td>
                <td data-column="region"><span className="ticket-table-region" title={region || undefined}>{region || t('ticketView.noRegion')}</span></td>
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
