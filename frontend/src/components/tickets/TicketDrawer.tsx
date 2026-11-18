import { useMutation } from '@tanstack/react-query'
import {
  ArrowDownUp, BookOpenCheck, CalendarClock, Check, CircleAlert, CircleHelp,
  ClipboardList, Eye, Files, FileText, Flag, History, Instagram, MessageCircle, Send, Sparkles,
  Star, UserRound, X,
} from 'lucide-react'
import { Dialog } from 'radix-ui'
import { useEffect, useId, useRef, useState } from 'react'
import { answerTicket, markTicketViewed, updateTicket } from '../../api/client'
import type { Citation, StaffMember, Ticket, TicketEvent, TicketPatch } from '../../api/types'
import { panelSimpleMessages } from '../../i18n/panel-simple'
import { ticketDrawerMessages } from '../../i18n/ticket-drawer'
import { useLanguage } from '../../i18n/useLanguage'
import { useT } from '../../i18n/useT'
import { localizeCaseTopic } from '../../lib/case-labels'
import { formatTicketDate, getTicketStatus } from '../../lib/ticket-time'
import { Button, IconButton, Skeleton, Textarea, Tooltip, TooltipProvider } from '../ui'
import { TicketCitationPicker, TicketDeadline, TicketFieldPicker } from './TicketDrawerControls'
import './ticket-drawer.css'

const channels = { web: MessageCircle, telegram: Send, instagram: Instagram } as const
const eventIcons = {
  created: ClipboardList,
  assigned: UserRound,
  viewed: Eye,
  answered: Check,
  rated: Star,
  extended: CalendarClock,
  status_changed: ArrowDownUp,
} as const
const eventTime = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Tashkent',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
})
const statuses = ['new', 'in_progress', 'answered'] as const
const priorities = ['low', 'normal', 'high'] as const
const sensitiveFlags = {
  fraud: 'drawer.flag.fraud',
  personal_data: 'drawer.flag.personal_data',
  corruption: 'drawer.flag.corruption',
  urgent: 'drawer.flag.urgent',
} as const

function formatNumber(value: string) {
  return `№${value.replace(/^№\s*/, '')}`
}

function TicketTimeline({ ticket, staff }: { ticket: Ticket; staff: StaffMember[] }) {
  const t = useT(ticketDrawerMessages)
  const { language } = useLanguage()
  const events: TicketEvent[] = ticket.events?.length
    ? [...ticket.events].sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at))
    : [{ type: 'created', actor: '', created_at: ticket.created_at }]

  return (
    <section className="ticket-drawer-section">
      <h3><History size={16} aria-hidden="true" /> {t('drawer.timeline')}</h3>
      <ol className="ticket-drawer-timeline glass-stagger">
        {events.map((event, index) => {
          const EventIcon = eventIcons[event.type]
          if (!EventIcon) return null
          const created = event.type === 'created'
          const rating = event.type === 'rated' ? Number(event.note) : 0
          const actor = staff.find((member) => member.id === event.actor)?.name ??
            (/^(ai|assistant|system|citizen)$/i.test(event.actor) ? '' : event.actor)
          const title = t(created && /^(ai|assistant)$/i.test(event.actor) ? 'drawer.event.aiCreated' : `drawer.event.${event.type}`)
          const stamp = new Date(event.created_at)
          const time = Number.isNaN(stamp.getTime()) ? '' : eventTime.format(stamp)
          const state = event.type === 'status_changed' ? statuses.find((status) => status === event.note) : undefined
          const note = state ? t(`drawer.state.${state}`) :
            event.type === 'extended' || event.type === 'assigned' ? event.note : undefined
          return (
            <li key={`${event.type}:${event.created_at}:${index}`} data-event={event.type}>
              <span className="ticket-drawer-event-icon" aria-hidden="true"><EventIcon size={14} /></span>
              <div className="ticket-drawer-event-copy">
                <p>
                  {title}{created && ` (${t(`drawer.channel.${ticket.channel}`)})`}
                  {rating > 0 && rating <= 5 && (
                    <span className="ticket-drawer-rating"><Star size={13} fill="currentColor" aria-hidden="true" /> {rating}</span>
                  )}
                </p>
                {(actor || note) && <small>{[actor, note].filter(Boolean).join(' · ')}</small>}
              </div>
              {time && (
                <time dateTime={event.created_at}>{formatTicketDate(event.created_at, language)} · {time}</time>
              )}
            </li>
          )
        })}
      </ol>
    </section>
  )
}

function TicketOriginal({ ticket }: { ticket: Ticket }) {
  const t = useT(ticketDrawerMessages)
  const ChannelIcon = channels[ticket.channel]

  return (
    <section className="ticket-drawer-section">
      <div className="ticket-drawer-section-row">
        <h3><FileText size={16} aria-hidden="true" /> {t('drawer.original')}</h3>
        <span className="ticket-drawer-channel"><ChannelIcon size={13} aria-hidden="true" /> {t(`drawer.channel.${ticket.channel}`)}</span>
      </div>
      <blockquote className="ticket-drawer-original">{ticket.original_text}</blockquote>
    </section>
  )
}

function TicketFacts({ ticket }: { ticket: Ticket }) {
  const t = useT(ticketDrawerMessages)
  return (
    <>
      {ticket.summary.trim() && ticket.summary.trim() !== ticket.original_text.trim() && (
        <div className="ticket-drawer-summary">
          <span>{t('drawer.summary')}</span>
          <p>{ticket.summary}</p>
        </div>
      )}
      {!!ticket.flags?.length && (
        <ul className="ticket-drawer-flags">
          {Array.from(new Set(ticket.flags)).map((flag) => (
            <li key={flag}><Flag size={12} aria-hidden="true" /> {
              t(Object.hasOwn(sensitiveFlags, flag) ? sensitiveFlags[flag as keyof typeof sensitiveFlags] : 'drawer.flagSensitive')
            }</li>
          ))}
        </ul>
      )}
    </>
  )
}

function SimilarTickets({ ticket, disabled, onReuse }: {
  ticket: Ticket
  disabled: boolean
  onReuse?: (answer: string) => void
}) {
  const t = useT(ticketDrawerMessages)

  if (!ticket.similar_cases.length) return null

  return (
    <section className="ticket-drawer-section">
      <h3><Files size={16} aria-hidden="true" /> {t('drawer.similar')}</h3>
      <ul className="ticket-drawer-similar-list">
        {ticket.similar_cases.slice(0, 3).map((item) => (
          <li key={item.number}>
            <div><strong>{formatNumber(item.number)}</strong><p>{item.summary}</p></div>
            {onReuse && (
              <Button variant="secondary" size="sm" disabled={disabled || !item.answer}
                onClick={() => item.answer && onReuse(item.answer)}>
                {t('drawer.reuse')}
              </Button>
            )}
          </li>
        ))}
      </ul>
    </section>
  )
}

interface TicketDrawerProps {
  ticket: Ticket
  staff: StaffMember[]
  now: number
  detailLoading: boolean
  readOnly: boolean
  detailError?: () => void
  staffUnavailable: boolean
  staffError?: () => void
  onClose: () => void
  onUpdated: () => void
  onSent: (answer: string) => void
  onChangeNotice: (ok: boolean) => void
  onSendError: () => void
}

export function TicketDrawer({ ticket, staff, now, detailLoading, readOnly, detailError, staffUnavailable, staffError, onClose, onUpdated, onSent, onChangeNotice, onSendError }: TicketDrawerProps) {
  const t = useT(ticketDrawerMessages)
  const { language } = useLanguage()
  const simple = useT(panelSimpleMessages)
  const [open, setOpen] = useState(true)
  const opener = useRef<HTMLElement | null>(null)
  const closing = useRef(false)
  const closeButton = useRef<HTMLButtonElement>(null)
  const [answer, setAnswer] = useState('')
  const [addToKnowledge, setAddToKnowledge] = useState(false)
  const [justSent, setJustSent] = useState('')
  const answerInput = useRef<HTMLTextAreaElement>(null)
  const viewedTicketId = useRef<string>()
  const formId = useId()
  const answerId = useId()
  const update = useMutation({
    mutationFn: (patch: TicketPatch) => updateTicket(ticket.id, patch),
    onSuccess: () => { onUpdated(); onChangeNotice(true) },
    onError: () => onChangeNotice(false),
  })
  const { mutate: markViewed } = useMutation({ mutationFn: markTicketViewed, onSuccess: onUpdated })
  const send = useMutation({
    mutationFn: (text: string) => answerTicket(ticket.id, text, addToKnowledge),
    onError: onSendError,
    onSuccess: (_, text) => {
      setJustSent(text)
      onSent(text)
      onUpdated()
    },
  })
  const busy = update.isPending || send.isPending || detailLoading
  const sent = ticket.final_answer || justSent
  const displayTicket = justSent && !ticket.final_answer
    ? { ...ticket, status: 'answered' as const, final_answer: justSent }
    : ticket
  const status = getTicketStatus(displayTicket, now)
  const statusItems = statuses.map((value) => ({ value, label: t(`drawer.state.${value}`) }))
  const priorityItems = priorities.map((value) => ({ value, label: t(`drawer.priority.${value}`) }))
  const assignees = [{ value: '', label: t('drawer.unassigned') }, ...staff.map((person) => ({ value: person.id, label: person.name }))]
  const assignee = assignees.find(({ value }) => value === (ticket.assignee_id ?? ''))

  useEffect(() => {
    if (readOnly || detailLoading || viewedTicketId.current === ticket.id || ticket.events?.some((event) => event.type === 'viewed')) return
    viewedTicketId.current = ticket.id
    markViewed(ticket.id)
  }, [detailLoading, markViewed, readOnly, ticket.events, ticket.id])

  function save(patch: TicketPatch) {
    if (!readOnly) update.mutate(patch)
  }

  function insert(text: string, focus = true) {
    if (!text.trim()) return
    setAnswer((previous) => previous.trim() ? `${previous.trimEnd()}\n\n${text}` : text)
    if (focus) answerInput.current?.focus()
  }

  function insertCitation(citation: Citation) {
    const title = citation.ref ? `${citation.title} (${citation.ref})` : citation.title
    insert(`${title} — ${citation.url}`, false)
  }

  return (
    <Dialog.Root open={open} onOpenChange={(next) => {
      if (!next) closing.current = true
      setOpen(next)
    }}>
      <Dialog.Portal>
        <Dialog.Overlay className="ticket-drawer-overlay" />
        <Dialog.Content
          className="ticket-drawer"
          onOpenAutoFocus={(event) => {
            event.preventDefault()
            if (document.activeElement instanceof HTMLElement && document.activeElement !== document.body) {
              opener.current = document.activeElement
            }
            closeButton.current?.focus({ preventScroll: true })
          }}
          onCloseAutoFocus={(event) => {
            event.preventDefault()
            if (!closing.current) return
            const target = opener.current?.isConnected ? opener.current : document.getElementById('main-content')
            target?.focus({ preventScroll: true })
            onClose()
          }}
        >
          <header className="ticket-drawer-header">
            <div className="ticket-drawer-heading">
              <div>
                <Dialog.Title className="ticket-drawer-title">{formatNumber(ticket.number)}</Dialog.Title>
                <Dialog.Description className="ticket-drawer-topic">{localizeCaseTopic(ticket.topic, language)}</Dialog.Description>
              </div>
              <Dialog.Close asChild>
                <IconButton ref={closeButton} size="sm" variant="secondary"
                  className="ticket-drawer-close" aria-label={t('drawer.close')}>
                  <X size={19} aria-hidden="true" />
                </IconButton>
              </Dialog.Close>
            </div>
          </header>
          <div className="ticket-drawer-body">
            {detailLoading ? (
              <div className="ticket-drawer-loading" role="status" aria-label={t('common.loading')}>
                <Skeleton /><Skeleton /><Skeleton />
              </div>
            ) : (
              <>
                {detailError && (
                  <div className="ticket-drawer-state" role="alert">
                    <p className="ticket-drawer-error">{t('drawer.detailError')}</p>
                    <Button variant="secondary" size="sm" onClick={detailError}>{t('drawer.retry')}</Button>
                  </div>
                )}
                {status === 'overdue' && (
                  <p className="ticket-drawer-overdue"><CircleAlert size={17} aria-hidden="true" /> {t('drawer.overdueBanner')}</p>
                )}
                <TicketOriginal ticket={ticket} />
                <TicketTimeline ticket={ticket} staff={staff} />
                {(!readOnly || sent) && <section className="ticket-drawer-section ticket-drawer-answer">
                  <h3><Send size={16} aria-hidden="true" /> {sent ? t('drawer.answer') : <label htmlFor={answerId}>{t('drawer.answer')}</label>}</h3>
                  {sent ? <p className="ticket-drawer-original ticket-drawer-final-answer">{sent}</p> : (
                    <form id={formId} onSubmit={(event) => {
                      event.preventDefault()
                      if (!readOnly && answer.trim() && !busy && !sent) send.mutate(answer.trim())
                    }}>
                      <Textarea id={answerId} ref={answerInput} rows={6} placeholder={t('drawer.answerPlaceholder')}
                        disabled={send.isPending} value={answer} onChange={(event) => setAnswer(event.target.value)} />
                      <div className="ticket-drawer-knowledge">
                        <label>
                          <input type="checkbox" checked={addToKnowledge} disabled={send.isPending}
                            onChange={(event) => setAddToKnowledge(event.target.checked)} />
                          <span><BookOpenCheck size={15} aria-hidden="true" /> {t('drawer.addToKnowledge')}</span>
                        </label>
                        <TooltipProvider>
                          <Tooltip content={t('drawer.knowledgeTip')} side="top">
                            <IconButton size="sm" aria-label={t('drawer.knowledgeTip')}><CircleHelp size={15} aria-hidden="true" /></IconButton>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                      <details className="simple-panel-details">
                        <summary>{simple('simple.sources')}</summary>
                        <div className="ticket-drawer-editor-tools">
                          <Button variant="secondary" size="sm" disabled={busy || !ticket.draft_answer}
                            onClick={() => ticket.draft_answer && insert(ticket.draft_answer)}>
                            <Sparkles size={15} aria-hidden="true" /> {t('drawer.draft')}
                          </Button>
                          <TicketCitationPicker disabled={busy} onPick={insertCitation}
                            onReturnToEditor={() => answerInput.current?.focus()} />
                        </div>
                        <SimilarTickets ticket={ticket} disabled={busy} onReuse={insert} />
                      </details>
                    </form>
                  )}
                </section>}
                <details className="simple-panel-details simple-ticket-controls">
                  <summary>{simple('simple.details')}</summary>
                  <div className="ticket-drawer-fields">
                    <TicketFieldPicker<Ticket['status']> label={t('drawer.status')} value={status} selectedLabel={t(`drawer.state.${status}`)}
                      options={statusItems} disabled={busy} readOnly={readOnly} tone={status} onChange={(next) => save({ status: next })} />
                    <TicketFieldPicker label={t('drawer.priority')} value={ticket.priority} selectedLabel={t(`drawer.priority.${ticket.priority}`)}
                      options={priorityItems} disabled={busy} readOnly={readOnly} tone={ticket.priority} onChange={(priority) => save({ priority })} />
                    <TicketFieldPicker label={t('drawer.assignee')} value={ticket.assignee_id ?? ''} selectedLabel={assignee?.label ?? t('drawer.unassigned')}
                      options={assignees} disabled={busy || staffUnavailable} readOnly={readOnly} onChange={(value) => save({ assignee_id: value || null })} />
                  </div>
                  {update.isError && (
                    <div className="ticket-drawer-state" role="alert">
                      <p className="ticket-drawer-error">{t('drawer.saveError')}</p>
                      <Button variant="secondary" size="sm" disabled={busy} onClick={() => update.variables && save(update.variables)}>{t('drawer.retry')}</Button>
                    </div>
                  )}
                  {staffError && (
                    <div className="ticket-drawer-state" role="alert">
                      <p className="ticket-drawer-error">{t('drawer.staffError')}</p>
                      <Button variant="secondary" size="sm" onClick={staffError}>{t('drawer.retry')}</Button>
                    </div>
                  )}
                  <TicketDeadline ticket={displayTicket} now={now} disabled={busy} readOnly={readOnly}
                    onUpdated={() => { onUpdated(); onChangeNotice(true) }} />
                  <TicketFacts ticket={ticket} />
                </details>
              </>
            )}
          </div>
          {(!readOnly || sent) && <footer className="ticket-drawer-footer">
            {sent ? (
              <p className="ticket-drawer-sent" data-recent={Boolean(justSent) || undefined} role={justSent ? 'status' : undefined}>
                <span aria-hidden="true" className="ticket-drawer-drawn-check" />
                {t('drawer.sent')} · {t(`drawer.channel.${ticket.channel}`)}
              </p>
            ) : (
              <>
                {send.isError && <p className="ticket-drawer-error" role="alert">{t('drawer.sendError')}</p>}
                <Button type="submit" form={formId} className="ticket-drawer-send" size="lg" disabled={busy || !answer.trim()}
                  loading={send.isPending}>
                  {!send.isPending && <Send size={16} aria-hidden="true" />} {t('drawer.send')}
                </Button>
              </>
            )}
          </footer>}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
