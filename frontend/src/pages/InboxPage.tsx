import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Check, ChevronLeft, ChevronRight, Globe2, Inbox, Instagram, Send, Ticket as TicketIcon } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useOutletContext, useSearchParams } from 'react-router'
import { approveResponse, convertInboxToTicket } from '../api/client'
import type { Channel, InboxItem, Ticket } from '../api/types'
import type { PanelNotify } from '../components/PanelLayout'
import { Button, GlassPanel, IconButton, Skeleton, Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui'
import { inboxKey, ticketsKey, useInboxRecords } from '../hooks/usePanelCases'
import { inboxMessages } from '../i18n/inbox'
import { useLanguage } from '../i18n/useLanguage'
import { useT } from '../i18n/useT'
import { localizeCaseTopic } from '../lib/case-labels'
import { formatTicketDate } from '../lib/ticket-time'
import './inbox-page.css'

const channels = {
  web: { icon: Globe2, label: 'inbox.channelWeb' },
  instagram: { icon: Instagram, label: 'inbox.channelInstagram' },
  telegram: { icon: Send, label: 'inbox.channelTelegram' },
} as const satisfies Record<Channel, { icon: typeof Globe2; label: string }>

const empty: InboxItem[] = []
const pageSize = 24
type InboxTab = 'queue' | 'all' | 'tickets'

function needsReview(appeal: InboxItem) {
  return appeal.level === 'yellow' && appeal.status === 'draft' && !appeal.ticket_id && !appeal.ticket_number
}

function AppealedRow({ appeal, selected, pendingAction, disabled, onConvert, onApprove }: {
  appeal: InboxItem
  selected: boolean
  pendingAction?: 'convert' | 'approve'
  disabled: boolean
  onConvert: () => void
  onApprove: () => void
}) {
  const t = useT(inboxMessages)
  const { language } = useLanguage()
  const row = useRef<HTMLElement>(null)
  const { icon: ChannelIcon, label } = channels[appeal.channel]
  const draft = needsReview(appeal) ? appeal.draft?.answer.trim() : undefined
  const target = appeal.ticket_id
    ? `/panel/tickets?${new URLSearchParams({ ticket: appeal.ticket_id })}`
    : '/panel/tickets'

  useEffect(() => {
    if (!selected) return
    row.current?.focus({ preventScroll: true })
    row.current?.scrollIntoView({ block: 'center' })
  }, [selected])

  return (
    <article className="inbox-record" ref={row} tabIndex={selected ? -1 : undefined} data-highlighted={selected || undefined}>
      <div className="inbox-record-icon"><ChannelIcon aria-hidden="true" size={16} /></div>
      <div className="inbox-record-body">
        <div className="inbox-record-meta">
          <span>{t(label)}</span>
          <time dateTime={appeal.created_at}>{formatTicketDate(appeal.created_at, language)}</time>
          {appeal.ticket_number && <span className="inbox-ticket-number">{appeal.ticket_number}</span>}
        </div>
        <h2>{localizeCaseTopic(appeal.classification.topic, language)}</h2>
        <p>{appeal.text}</p>
        {draft && (
          <details className="inbox-draft">
            <summary>{t('inbox.draft')}</summary>
            <p>{draft}</p>
          </details>
        )}
      </div>
      <div className="inbox-record-actions">
        {appeal.ticket_id || appeal.ticket_number ? (
          <Button asChild variant="secondary" size="sm">
            <Link to={target}>{t('inbox.open')}</Link>
          </Button>
        ) : (
          <>
            {draft && (
              <Button size="sm" onClick={onApprove} loading={pendingAction === 'approve'} disabled={disabled}>
                <Check aria-hidden="true" size={16} /> {t('inbox.approve')}
              </Button>
            )}
            <Button variant="secondary" size="sm" onClick={onConvert} loading={pendingAction === 'convert'} disabled={disabled}>
              <TicketIcon aria-hidden="true" size={16} /> {t('inbox.convert')}
            </Button>
          </>
        )}
      </div>
    </article>
  )
}

export default function InboxPage() {
  const [tab, setTab] = useState<InboxTab>('queue')
  const [page, setPage] = useState(0)
  const [params, setParams] = useSearchParams()
  const heading = useRef<HTMLHeadingElement>(null)
  const selected = params.get('item')
  const activeTab = selected ? 'all' : tab
  const t = useT(inboxMessages)
  const notify = useOutletContext<PanelNotify>()
  const queryClient = useQueryClient()
  const query = useInboxRecords()
  const appeals = query.data ?? empty
  const queue = useMemo(() => appeals.filter(needsReview), [appeals])
  const ticketed = useMemo(() => appeals.filter(({ ticket_id, ticket_number }) => ticket_id || ticket_number), [appeals])
  const filtered = activeTab === 'queue' ? queue : activeTab === 'tickets' ? ticketed : appeals
  const selectedIndex = selected ? filtered.findIndex(({ id }) => id === selected) : -1
  const lastPage = Math.max(0, Math.ceil(filtered.length / pageSize) - 1)
  const currentPage = selectedIndex >= 0 ? Math.floor(selectedIndex / pageSize) : Math.min(page, lastPage)
  const visible = filtered.slice(currentPage * pageSize, (currentPage + 1) * pageSize)

  function changeView(next: InboxTab, nextPage: number) {
    setTab(next)
    setPage(nextPage)
    if (selected) {
      setParams((current) => {
        const updated = new URLSearchParams(current)
        updated.delete('item')
        return updated
      }, { replace: true })
    }
  }

  function changePage(nextPage: number) {
    changeView(activeTab, nextPage)
    heading.current?.focus({ preventScroll: true })
    heading.current?.scrollIntoView({ block: 'start' })
  }

  const approval = useMutation({
    mutationFn: approveResponse,
    onSuccess: (_, id) => {
      queryClient.setQueryData<InboxItem[]>(inboxKey, (current) =>
        current?.map((appeal) => appeal.id === id ? { ...appeal, status: 'approved' } : appeal),
      )
      notify({ title: t('inbox.approved'), variant: 'success' })
    },
    onError: () => notify({ title: t('inbox.approveError'), variant: 'error' }),
    onSettled: () => { void queryClient.invalidateQueries({ queryKey: inboxKey }) },
  })

  const conversion = useMutation({
    mutationFn: convertInboxToTicket,
    onSuccess: (ticket, id) => {
      queryClient.setQueryData<Ticket[]>(ticketsKey, (current) =>
        current && !current.some((item) => item.id === ticket.id) ? [ticket, ...current] : current,
      )
      queryClient.setQueryData<InboxItem[]>(inboxKey, (current) =>
        current?.map((appeal) => appeal.id === id
          ? { ...appeal, level: 'red', ticket_id: ticket.id, ticket_number: ticket.number }
          : appeal),
      )
      changeView('tickets', 0)
      notify({ title: t('inbox.converted'), description: ticket.number, variant: 'success' })
    },
    onError: () => notify({ title: t('inbox.conversionError'), variant: 'error' }),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ticketsKey })
      void queryClient.invalidateQueries({ queryKey: inboxKey })
    },
  })
  const busy = approval.isPending || conversion.isPending

  return (
    <section className="inbox-page" aria-labelledby="inbox-title">
      <header className="inbox-heading">
        <h1 id="inbox-title" ref={heading} tabIndex={-1}>{t('panel.inbox')}</h1>
        <p>{t('inbox.subtitle')}</p>
      </header>
      <Tabs value={activeTab} onValueChange={(value) => changeView(value === 'queue' || value === 'tickets' ? value : 'all', 0)}>
        <TabsList aria-label={t('panel.inbox')}>
          <TabsTrigger value="queue">{t('inbox.queue')}<span className="inbox-tab-count">{queue.length}</span></TabsTrigger>
          <TabsTrigger value="all">{t('inbox.all')}<span className="inbox-tab-count">{appeals.length}</span></TabsTrigger>
          <TabsTrigger value="tickets">{t('inbox.ticketed')}<span className="inbox-tab-count">{ticketed.length}</span></TabsTrigger>
        </TabsList>
        <TabsContent value={activeTab}>
          <GlassPanel className="inbox-list" variant="subtle">
            {query.isError && !query.data ? (
              <div className="inbox-state" role="alert">
                <p>{t('inbox.error')}</p>
                <Button variant="secondary" size="sm" loading={query.isFetching} onClick={() => void query.refetch()}>{t('inbox.retry')}</Button>
              </div>
            ) : query.isPending ? (
              <div className="inbox-state" role="status" aria-label={t('common.loading')}>
                <Skeleton className="inbox-skeleton" />
                <Skeleton className="inbox-skeleton" />
              </div>
            ) : visible.length > 0 ? (
              <>
                <div className="inbox-records glass-stagger">
                  {visible.map((appeal) => (
                    <AppealedRow
                      key={appeal.id}
                      appeal={appeal}
                      selected={appeal.id === selected}
                      pendingAction={approval.isPending && approval.variables === appeal.id
                        ? 'approve'
                        : conversion.isPending && conversion.variables === appeal.id ? 'convert' : undefined}
                      disabled={busy}
                      onApprove={() => approval.mutate(appeal.id)}
                      onConvert={() => conversion.mutate(appeal.id)}
                    />
                  ))}
                </div>
                {lastPage > 0 && (
                  <nav className="inbox-pagination" aria-label={t('inbox.pages')}>
                    <span aria-live="polite">{t('inbox.visibleRange')
                      .replace('{start}', String(currentPage * pageSize + 1))
                      .replace('{end}', String(currentPage * pageSize + visible.length))
                      .replace('{total}', String(filtered.length))}</span>
                    <IconButton size="sm" variant="secondary" aria-label={t('inbox.previousPage')} disabled={currentPage === 0}
                      onClick={() => changePage(currentPage - 1)}><ChevronLeft size={17} aria-hidden="true" /></IconButton>
                    <IconButton size="sm" variant="secondary" aria-label={t('inbox.nextPage')} disabled={currentPage === lastPage}
                      onClick={() => changePage(currentPage + 1)}><ChevronRight size={17} aria-hidden="true" /></IconButton>
                  </nav>
                )}
              </>
            ) : (
              <div className="inbox-state">
                <Inbox aria-hidden="true" size={23} />
                <p>{t(activeTab === 'tickets' ? 'inbox.emptyTicketed' : activeTab === 'queue' ? 'inbox.emptyQueue' : 'inbox.empty')}</p>
              </div>
            )}
          </GlassPanel>
        </TabsContent>
      </Tabs>
    </section>
  )
}
