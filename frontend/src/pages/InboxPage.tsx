import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ChevronLeft, ChevronRight, Globe2, Instagram, Send } from 'lucide-react'
import { useId, useState } from 'react'
import { Link, useOutletContext, useSearchParams } from 'react-router'
import { approveResponse, convertInboxToTicket, editResponse } from '../api/client'
import type { InboxItem, Ticket } from '../api/types'
import { PanelCitations } from '../components/PanelCitations'
import type { PanelContext } from '../components/PanelLayout'
import { Button, GlassPanel, IconButton, Skeleton, StatusPill, Tabs, TabsContent, TabsList, TabsTrigger, Textarea } from '../components/ui'
import { inboxKey, ticketsKey, useInboxRecords } from '../hooks/usePanelCases'
import { inboxMessages } from '../i18n/inbox'
import { localeCodes } from '../i18n/locales'
import { panelSimpleMessages } from '../i18n/panel-simple'
import { ticketDrawerMessages } from '../i18n/ticket-drawer'
import { staffMessages } from '../i18n/staff'
import { useLanguage } from '../i18n/useLanguage'
import { useT } from '../i18n/useT'
import { canEditCases } from '../lib/panel-sections'
import { formatTicketDate } from '../lib/ticket-time'

const channels = { web: Globe2, instagram: Instagram, telegram: Send } as const
const channelNames = { web: 'inbox.channelWeb', instagram: 'inbox.channelInstagram', telegram: 'inbox.channelTelegram' } as const
const pageSize = 24
type InboxTab = 'queue' | 'all' | 'tickets'
const flagLabels = {
  fraud: 'drawer.flag.fraud',
  personal_data: 'drawer.flag.personal_data',
  corruption: 'drawer.flag.corruption',
  urgent: 'drawer.flag.urgent',
} as const

function hasTicket(item: InboxItem) {
  return Boolean(item.ticket_id || item.ticket_number)
}

function needsReview(item: InboxItem) {
  return item.level === 'yellow' && item.status === 'draft' && !hasTicket(item)
}

function getRowStatus(item: InboxItem) {
  if (hasTicket(item)) return { label: 'simple.ticketed', level: 'red' } as const
  if (item.status === 'rejected') return { label: 'simple.rejected', level: 'red' } as const
  if (item.status === 'draft') return { label: 'simple.review', level: 'yellow' } as const
  return { label: 'simple.sent', level: 'green' } as const
}

function MessageDetail({ item, readOnly, onConvert }: {
  item: InboxItem
  readOnly: boolean
  onConvert: () => void
}) {
  const t = useT(panelSimpleMessages)
  const tInbox = useT(inboxMessages)
  const tFlags = useT(ticketDrawerMessages)
  const { notify } = useOutletContext<PanelContext>()
  const queryClient = useQueryClient()
  const [draft, setDraft] = useState<string | null>(null)
  const editorId = useId()
  const classification = item.classification
  const ready = needsReview(item) && Boolean(item.draft?.answer.trim())

  function updateItem(patch: Partial<InboxItem>) {
    queryClient.setQueryData<InboxItem[]>(inboxKey, (current) =>
      current?.map((entry) => entry.id === item.id ? { ...entry, ...patch } : entry),
    )
  }

  const operation = useMutation({
    mutationFn: (action: { type: 'approve' | 'convert' } | { type: 'edit'; text: string }): Promise<Ticket | void> => {
      if (action.type === 'edit') return editResponse(item.id, action.text)
      if (action.type === 'convert') return convertInboxToTicket(item.id)
      return approveResponse(item.id)
    },
    onSuccess: (ticket, action) => {
      if (action.type === 'approve') {
        updateItem({ status: 'approved' })
        notify({ title: t('simple.sent'), variant: 'success' })
      } else if (action.type === 'edit' && item.draft) {
        updateItem({ draft: { ...item.draft, answer: action.text } })
        setDraft(null)
        notify({ title: t('simple.saved'), variant: 'success' })
      } else if (ticket) {
        updateItem({ level: 'red', ticket_id: ticket.id, ticket_number: ticket.number })
        queryClient.setQueryData<Ticket[]>(ticketsKey, (current) =>
          current && !current.some(({ id }) => id === ticket.id) ? [ticket, ...current] : current,
        )
        void queryClient.invalidateQueries({ queryKey: ticketsKey })
        onConvert()
        notify({ title: tInbox('inbox.converted'), description: ticket.number, variant: 'success' })
      }
    },
    onError: (_, { type }) => notify({
      title: type === 'edit' ? t('simple.saveError') : tInbox(type === 'approve' ? 'inbox.approveError' : 'inbox.conversionError'),
      variant: 'error',
    }),
    onSettled: () => void queryClient.invalidateQueries({ queryKey: inboxKey }),
  })

  return (
    <div className="simple-message-detail">
      <section>
        <h2>{t('simple.message')}</h2>
        <p className="simple-message-text">{item.text}</p>
      </section>
      <section>
        <h2>{t('simple.draft')}</h2>
        {draft !== null && !readOnly ? (
          <form className="simple-inbox-edit" onSubmit={(event) => {
            event.preventDefault()
            if (draft.trim() && !operation.isPending) operation.mutate({ type: 'edit', text: draft.trim() })
          }}>
            <label className="sr-only" htmlFor={editorId}>{t('simple.draft')}</label>
            <Textarea id={editorId} rows={6} autoFocus value={draft} onChange={(event) => setDraft(event.target.value)} />
            <div className="simple-message-actions">
              <Button type="submit" disabled={!draft.trim()} loading={operation.isPending}>{t('simple.save')}</Button>
              <Button variant="secondary" disabled={operation.isPending} onClick={() => setDraft(null)}>{t('simple.cancel')}</Button>
            </div>
          </form>
        ) : <p className="simple-message-text">{item.draft?.answer || t('simple.noDraft')}</p>}
        {!!item.draft?.citations.length && (
          <div className="simple-message-sources">
            <h3>{t('simple.sources')}</h3>
            <PanelCitations citations={item.draft.citations} />
          </div>
        )}
      </section>
      {hasTicket(item) ? (
        <Button asChild variant="secondary">
          <Link to={item.ticket_id ? '/panel/tickets?' + new URLSearchParams({ ticket: item.ticket_id }) : '/panel/tickets'}>
            {tInbox('inbox.open')}{item.ticket_number ? ' · ' + item.ticket_number : ''}
          </Link>
        </Button>
      ) : !readOnly && draft === null && (
        <div className="simple-message-actions">
          {ready && (
            <>
              <Button disabled={operation.isPending} loading={operation.isPending && operation.variables.type === 'approve'}
                onClick={() => operation.mutate({ type: 'approve' })}>{t('simple.send')}</Button>
              <Button variant="secondary" disabled={operation.isPending} onClick={() => setDraft(item.draft?.answer ?? '')}>
                {t('simple.edit')}
              </Button>
            </>
          )}
          <Button variant="secondary" disabled={operation.isPending} loading={operation.isPending && operation.variables.type === 'convert'}
            onClick={() => operation.mutate({ type: 'convert' })}>{t('simple.assign')}</Button>
        </div>
      )}
      <details className="simple-panel-details">
        <summary>{t('simple.details')}</summary>
        <dl>
          <dt>{t('simple.sentiment')}</dt><dd>{t(`simple.${classification.sentiment}`)}</dd>
          <dt>{t('simple.language')}</dt><dd>{t(`simple.${classification.lang}`)}</dd>
          <dt>{t('simple.script')}</dt><dd>{t(`simple.${classification.script}`)}</dd>
          {!!classification.flags.length && <><dt>{t('simple.flags')}</dt><dd>{classification.flags.map((flag) =>
            tFlags(Object.hasOwn(flagLabels, flag) ? flagLabels[flag as keyof typeof flagLabels] : 'drawer.flagSensitive'),
          ).join(' · ')}</dd></>}
          {item.draft && <><dt>{t('simple.confidence')}</dt><dd>{Math.round(item.draft.confidence * 100)}%</dd></>}
        </dl>
      </details>
    </div>
  )
}

export default function InboxPage() {
  const [tab, setTab] = useState<InboxTab>('queue')
  const [page, setPage] = useState(0)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [params, setParams] = useSearchParams()
  const deepLink = params.get('item')
  const activeTab = deepLink ? 'all' : tab
  const t = useT(panelSimpleMessages)
  const tInbox = useT(inboxMessages)
  const tStaff = useT(staffMessages)
  const { language } = useLanguage()
  const { role } = useOutletContext<PanelContext>()
  const readOnly = !canEditCases(role, 'inbox')
  const query = useInboxRecords()
  const appeals = query.data ?? []
  const queue = appeals.filter(needsReview)
  const ticketed = appeals.filter(hasTicket)
  const filtered = activeTab === 'queue' ? queue : activeTab === 'tickets' ? ticketed : appeals
  const index = deepLink ? filtered.findIndex(({ id }) => id === deepLink) : -1
  const lastPage = Math.max(0, Math.ceil(filtered.length / pageSize) - 1)
  const currentPage = index >= 0 ? Math.floor(index / pageSize) : Math.min(page, lastPage)
  const visible = filtered.slice(currentPage * pageSize, (currentPage + 1) * pageSize)
  const selected = visible.find(({ id }) => id === (deepLink ?? selectedId))
  const shown = selected ?? (deepLink ? undefined : visible[0])
  const time = new Intl.DateTimeFormat(localeCodes[language], {
    timeZone: 'Asia/Tashkent', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  })

  function chooseView(next: InboxTab, nextPage = 0, item: string | null = null) {
    setTab(next)
    setPage(nextPage)
    setSelectedId(item)
    if (deepLink) setParams((current) => {
      const copy = new URLSearchParams(current)
      copy.delete('item')
      return copy
    }, { replace: true })
  }

  return (
    <section className="simple-panel-page" aria-labelledby="inbox-title">
      <header className="simple-panel-heading">
        <h1 id="inbox-title">{t('panel.inbox')}</h1>
        <p>{t('simple.inboxHelp')}{readOnly && ' ' + tStaff('staff.readOnlyNote')}</p>
      </header>
      <Tabs value={activeTab} onValueChange={(value) => chooseView(value === 'queue' || value === 'tickets' ? value : 'all')}>
        <TabsList className="simple-panel-tabs" aria-label={t('panel.inbox')}>
          <TabsTrigger value="queue">{t('simple.review')} <span>{queue.length}</span></TabsTrigger>
          <TabsTrigger value="all">{t('simple.all')} <span>{appeals.length}</span></TabsTrigger>
          <TabsTrigger value="tickets">{t('simple.ticketed')} <span>{ticketed.length}</span></TabsTrigger>
        </TabsList>
        <TabsContent value={activeTab}>
          {query.isError && !query.data ? (
            <GlassPanel className="simple-panel-state" blur={false} role="alert">
              <p>{tInbox('inbox.error')}</p>
              <Button variant="secondary" loading={query.isFetching} onClick={() => void query.refetch()}>{tInbox('inbox.retry')}</Button>
            </GlassPanel>
          ) : query.isPending ? (
            <div className="simple-panel-state" role="status" aria-label={t('common.loading')}><Skeleton /><Skeleton /></div>
          ) : (
            <GlassPanel className="simple-inbox" variant="subtle" blur={false} data-show-message={Boolean(selected || deepLink)}>
              <div className="simple-inbox-list">
                {visible.length > 0 ? (
                  <ul>
                    {visible.map((item) => {
                      const Icon = channels[item.channel]
                      const status = getRowStatus(item)
                      const date = new Date(item.created_at)
                      return (
                        <li key={item.id}>
                          <button type="button" className="simple-inbox-row" aria-current={shown?.id === item.id ? 'true' : undefined}
                            onClick={() => chooseView(activeTab, currentPage, item.id)}>
                            <span className="simple-inbox-channel" title={tInbox(channelNames[item.channel])}>
                              <Icon size={18} aria-hidden="true" /><span className="sr-only">{tInbox(channelNames[item.channel])}</span>
                            </span>
                            <strong>{t('simple.citizen')}</strong>
                            <time dateTime={item.created_at}>{Number.isFinite(date.getTime()) ? formatTicketDate(item.created_at, language) + ' · ' + time.format(date) : '—'}</time>
                            <span className="simple-inbox-snippet">{item.text}</span>
                            <StatusPill level={status.level}>{t(status.label)}</StatusPill>
                          </button>
                        </li>
                      )
                    })}
                  </ul>
                ) : (
                  <div className="simple-panel-state">
                    <p>{tInbox(activeTab === 'queue' ? 'inbox.emptyQueue' : activeTab === 'tickets' ? 'inbox.emptyTicketed' : 'inbox.empty')}</p>
                    {activeTab !== 'all' && <small>{t('simple.queueHint')}</small>}
                  </div>
                )}
                {lastPage > 0 && (
                  <nav className="simple-inbox-pagination" aria-label={tInbox('inbox.pages')}>
                    <IconButton variant="secondary" aria-label={tInbox('inbox.previousPage')} disabled={currentPage === 0}
                      onClick={() => chooseView(activeTab, currentPage - 1)}><ChevronLeft size={18} aria-hidden="true" /></IconButton>
                    <span>{currentPage + 1} / {lastPage + 1}</span>
                    <IconButton variant="secondary" aria-label={tInbox('inbox.nextPage')} disabled={currentPage === lastPage}
                      onClick={() => chooseView(activeTab, currentPage + 1)}><ChevronRight size={18} aria-hidden="true" /></IconButton>
                  </nav>
                )}
              </div>
              <div className="simple-inbox-detail">
                {(selected || deepLink) && (
                  <Button className="simple-inbox-back" variant="ghost" onClick={() => chooseView(activeTab, currentPage)}>
                    <ChevronLeft size={18} aria-hidden="true" /> {t('simple.back')}
                  </Button>
                )}
                {shown ? (
                  <MessageDetail key={shown.id} item={shown} readOnly={readOnly} onConvert={() => chooseView('tickets', 0, shown.id)} />
                ) : (
                  <div className="simple-panel-state"><p>{t(deepLink ? 'simple.missingMessage' : 'simple.select')}</p></div>
                )}
              </div>
            </GlassPanel>
          )}
        </TabsContent>
      </Tabs>
    </section>
  )
}
