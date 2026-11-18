import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useOutletContext, useSearchParams } from 'react-router'
import { approveResponse, convertInboxToTicket, editResponse, rejectResponse } from '../api/client'
import type { InboxItem, Ticket } from '../api/types'
import { InboxDetail, type InboxChange } from '../components/inbox/InboxDetail'
import { inboxChannel, inboxStatus, inboxTone, isDraft, isTicketed } from '../components/inbox/inbox-record'
import type { PanelNotify } from '../components/PanelLayout'
import { Button, Skeleton, Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui'
import { analyticsKey } from '../hooks/useAnalytics'
import { inboxKey, ticketsKey, useInboxRecords } from '../hooks/usePanelCases'
import { formatChatDate } from '../i18n/chat'
import { inboxMessages } from '../i18n/inbox'
import { localeCodes, type Language } from '../i18n/locales'
import { useLanguage } from '../i18n/useLanguage'
import { useT } from '../i18n/useT'
import { localizeCaseTopic } from '../lib/case-labels'
import './inbox-page.css'

const empty: InboxItem[] = []
const pageSize = 24
const inboxTabs = ['queue', 'all', 'tickets'] as const
type InboxTab = (typeof inboxTabs)[number]

const tabLabels = {
  queue: 'inbox.queue',
  all: 'inbox.all',
  tickets: 'inbox.ticketed',
} as const

const timeZone = 'Asia/Tashkent'
const clockOptions = { hour: '2-digit', minute: '2-digit', hour12: false, timeZone } as const
const dayKey = new Intl.DateTimeFormat('en-CA', { dateStyle: 'short', timeZone })

function inboxTimestamp(date: Date, today: string, language: Language) {
  if (!Number.isFinite(date.getTime())) return '—'
  const locale = localeCodes[language]
  return dayKey.format(date) === today
    ? date.toLocaleTimeString(locale, clockOptions)
    : formatChatDate(date, language) ?? '—'
}

function InboxRow({ item, selected, today, onSelect }: {
  item: InboxItem
  selected: boolean
  today: string
  onSelect: () => void
}) {
  const t = useT(inboxMessages)
  const { language } = useLanguage()
  const { icon: ChannelIcon, label } = inboxChannel[item.channel]
  const topic = localizeCaseTopic(item.classification.topic, language) || t('inbox.topicUnknown')

  return (
    <li className="inbox-record" data-highlighted={selected || undefined}>
      <button
        type="button"
        className="inbox-row"
        data-inbox-id={item.id}
        aria-current={selected ? 'true' : undefined}
        aria-controls="inbox-message-detail"
        tabIndex={selected ? 0 : -1}
        onClick={onSelect}
      >
        <span className="inbox-row-meta">
          <span className="inbox-status" data-tone={inboxTone(item)} title={t(inboxStatus(item))}>
            <i aria-hidden="true" /><span className="sr-only">{t(inboxStatus(item))}</span>
          </span>
          <ChannelIcon size={15} strokeWidth={1.5} aria-label={t(label)} />
          <span className="inbox-author" aria-label={t('inbox.maskedAuthor')}>{t('inbox.author')} <span aria-hidden="true">••••</span></span>
          <time dateTime={item.created_at}>{inboxTimestamp(new Date(item.created_at), today, language)}</time>
        </span>
        <span className="inbox-row-topic">{topic}</span>
        <span className="inbox-row-preview">{item.text}</span>
      </button>
    </li>
  )
}

function InboxPlaceholder({ label }: { label: string }) {
  return (
    <div className="inbox-placeholder" id="inbox-message-detail"><p>{label}</p></div>
  )
}

export default function InboxPage() {
  const [tab, setTab] = useState<InboxTab>('queue')
  const [page, setPage] = useState(0)
  const [selection, setSelection] = useState<string>()
  const [detailOpen, setDetailOpen] = useState(false)
  const [stagger, setStagger] = useState(true)
  const [params, setParams] = useSearchParams()
  const list = useRef<HTMLUListElement>(null)
  const split = useRef<HTMLDivElement>(null)
  const linkedSelection = params.get('item') ?? undefined
  const activeTab = linkedSelection ? 'all' : tab
  const t = useT(inboxMessages)
  const notify = useOutletContext<PanelNotify>()
  const queryClient = useQueryClient()
  const query = useInboxRecords()
  const appeals = query.data ?? empty
  const records = useMemo(() => ({
    queue: appeals.filter(isDraft),
    all: appeals,
    tickets: appeals.filter(isTicketed),
  }), [appeals])
  const filtered = records[activeTab]
  const linkIndex = linkedSelection ? filtered.findIndex(({ id }) => id === linkedSelection) : -1
  const lastPage = Math.max(0, Math.ceil(filtered.length / pageSize) - 1)
  const currentPage = linkIndex >= 0 ? Math.floor(linkIndex / pageSize) : Math.min(page, lastPage)
  const visible = filtered.slice(currentPage * pageSize, (currentPage + 1) * pageSize)
  const selected = linkedSelection
    ? visible.find(({ id }) => id === linkedSelection)
    : visible.find(({ id }) => id === selection) ?? visible[0]
  const selectedId = selected?.id
  const today = dayKey.format(new Date())

  function clearLinkedSelection() {
    if (!linkedSelection) return
    setParams((current) => {
      const updated = new URLSearchParams(current)
      updated.delete('item')
      return updated
    }, { replace: true })
  }

  function findRow(id?: string) {
    return id ? list.current?.querySelector<HTMLButtonElement>('[data-inbox-id="' + CSS.escape(id) + '"]') : undefined
  }

  function selectItem(id: string, open: boolean) {
    if (linkedSelection) {
      setTab(activeTab)
      setPage(currentPage)
      clearLinkedSelection()
    }
    setSelection(id)
    if (open) setDetailOpen(true)
    requestAnimationFrame(() => {
      const detail = split.current?.querySelector<HTMLElement>('.inbox-back')
      if (open && detail && detail.getClientRects().length > 0) detail.focus()
      else findRow(id)?.focus()
    })
  }

  function closeDetail() {
    if (linkedSelection) {
      setTab('all')
      setPage(currentPage)
      clearLinkedSelection()
    }
    setSelection(selectedId)
    setDetailOpen(false)
    requestAnimationFrame(() => findRow(selectedId)?.focus())
  }

  function changeView(next: InboxTab, nextPage: number) {
    clearLinkedSelection()
    setTab(next)
    setPage(nextPage)
    setSelection(undefined)
    setDetailOpen(false)
    setStagger(false)
    if (list.current) list.current.scrollTop = 0
  }

  useEffect(() => {
    if (!linkedSelection || selectedId !== linkedSelection) return
    split.current?.querySelector<HTMLElement>('.inbox-detail-title')?.focus({ preventScroll: true })
    const entries = list.current?.querySelectorAll<HTMLButtonElement>('[data-inbox-id]')
    const target = Array.from(entries ?? []).find((node) => node.dataset.inboxId === linkedSelection)
    if (target?.getClientRects().length) target.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  }, [linkedSelection, selectedId])

  const change = useMutation({
    mutationFn: async ({ action, item, text }: InboxChange): Promise<Ticket | undefined> => {
      const editedText = text?.trim()
      if (action === 'convert') return convertInboxToTicket(item.id)
      if (action === 'reject') {
        await rejectResponse(item.id)
        return
      }
      if (editedText && editedText !== item.draft?.answer.trim()) await editResponse(item.id, editedText)
      if (action === 'approve') await approveResponse(item.id)
    },
    onSuccess: (ticket, { action, item, text }) => {
      const updatedDraft = text?.trim()
      queryClient.setQueryData<InboxItem[]>(inboxKey, (current) => current?.map((appeal) => {
        if (appeal.id !== item.id) return appeal
        if (ticket) return { ...appeal, level: 'red', ticket_id: ticket.id, ticket_number: ticket.number }
        if (action === 'reject') return { ...appeal, status: 'rejected' }
        return {
          ...appeal,
          status: action === 'approve' ? 'approved' : appeal.status,
          draft: updatedDraft
            ? { answer: updatedDraft, citations: appeal.draft?.citations ?? [], confidence: appeal.draft?.confidence ?? 0 }
            : appeal.draft,
        }
      }))
      if (ticket) {
        queryClient.setQueryData<Ticket[]>(ticketsKey, (current) =>
          current && !current.some(({ id }) => id === ticket.id) ? [ticket, ...current] : current,
        )
        setTab('tickets')
        clearLinkedSelection()
        setPage(0)
        setSelection(item.id)
      } else if (action === 'approve' || action === 'reject') {
        if (activeTab === 'queue' && selectedId === item.id) {
          const index = visible.findIndex(({ id }) => id === item.id)
          const next = visible[index + 1] ?? visible[index - 1]
          setSelection(next?.id)
          setDetailOpen(false)
          requestAnimationFrame(() => findRow(next?.id)?.focus())
        }
      }
      const titles = { approve: 'inbox.approved', edit: 'inbox.edited', reject: 'inbox.rejected', convert: 'inbox.converted' } as const
      notify({ title: t(titles[action]), description: ticket?.number, variant: 'success' })
    },
    onError: (_, { action }) => {
      const errors = { approve: 'inbox.approveError', edit: 'inbox.editError', reject: 'inbox.rejectError', convert: 'inbox.conversionError' } as const
      notify({ title: t(errors[action]), variant: 'error' })
    },
    onSettled: (_, __, { action }) => {
      void queryClient.invalidateQueries({ queryKey: inboxKey })
      if (action === 'convert') void queryClient.invalidateQueries({ queryKey: ticketsKey })
      if (action !== 'edit') void queryClient.invalidateQueries({ queryKey: analyticsKey })
    },
  })
  const emptyLabel = t(activeTab === 'tickets' ? 'inbox.emptyTicketed' : activeTab === 'queue' ? 'inbox.emptyQueue' : 'inbox.empty')

  return (
    <section className="inbox-page" aria-labelledby="inbox-title">
      <header className="inbox-heading">
        <h1 id="inbox-title">{t('panel.inbox')}</h1>
        <p>{t('inbox.subtitle')}</p>
      </header>
      <div
        className="inbox-split"
        ref={split}
        data-detail-open={!query.isPending && !query.isError && (Boolean(linkedSelection) || (detailOpen && Boolean(selected)))}
      >
        <Tabs className="inbox-list" value={activeTab} onValueChange={(value) => changeView(value === 'queue' || value === 'tickets' ? value : 'all', 0)}>
          <TabsList className="inbox-tabs" aria-label={t('panel.inbox')}>
            {inboxTabs.map((view) => (
              <TabsTrigger className="inbox-tab" key={view} value={view}>
                {t(tabLabels[view])}<span className="inbox-tab-count">{records[view].length}</span>
              </TabsTrigger>
            ))}
          </TabsList>
          <TabsContent className="inbox-list-panel" value={activeTab}>
            {query.isError && !query.data ? (
              <div className="inbox-list-state" role="alert">
                <p>{t('inbox.error')}</p>
                <Button variant="secondary" size="sm" loading={query.isFetching} onClick={() => void query.refetch()}>{t('inbox.retry')}</Button>
              </div>
            ) : query.isPending ? (
              <div className="inbox-list-state" role="status" aria-label={t('common.loading')}>
                <Skeleton className="inbox-skeleton" />
                <Skeleton className="inbox-skeleton" />
                <Skeleton className="inbox-skeleton" />
              </div>
            ) : visible.length > 0 ? (
              <>
                <ul
                  className="inbox-records"
                  ref={list}
                  data-stagger={stagger || undefined}
                  onAnimationEnd={(event) => {
                    if (event.target === event.currentTarget.children[Math.min(5, visible.length - 1)]) setStagger(false)
                  }}
                  onKeyDown={(event) => {
                    const current = visible.findIndex(({ id }) => id === selectedId)
                    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return
                    const next = visible[event.key === 'ArrowDown'
                      ? Math.min(visible.length - 1, current + 1)
                      : Math.max(0, current - 1)]
                    if (next) {
                      event.preventDefault()
                      selectItem(next.id, false)
                    }
                  }}
                >
                  {visible.map((item, index) => (
                    <InboxRow
                      key={item.id}
                      item={item}
                      selected={item.id === selectedId || (!selectedId && index === 0)}
                      today={today}
                      onSelect={() => selectItem(item.id, true)}
                    />
                  ))}
                </ul>
                {lastPage > 0 && (
                  <nav className="inbox-pagination" aria-label={t('inbox.pages')}>
                    <span aria-live="polite">{t('inbox.visibleRange')
                      .replace('{start}', String(currentPage * pageSize + 1))
                      .replace('{end}', String(currentPage * pageSize + visible.length))
                      .replace('{total}', String(filtered.length))}</span>
                    <button type="button" aria-label={t('inbox.previousPage')} disabled={currentPage === 0}
                      onClick={() => changeView(activeTab, currentPage - 1)}><ChevronLeft size={16} strokeWidth={1.5} aria-hidden="true" /></button>
                    <button type="button" aria-label={t('inbox.nextPage')} disabled={currentPage === lastPage}
                      onClick={() => changeView(activeTab, currentPage + 1)}><ChevronRight size={16} strokeWidth={1.5} aria-hidden="true" /></button>
                  </nav>
                )}
              </>
            ) : (
              <div className="inbox-list-state"><p>{emptyLabel}</p></div>
            )}
          </TabsContent>
        </Tabs>
        <div className="inbox-pane">
          {selected ? (
            <InboxDetail
              key={selected.id}
              item={selected}
              pending={change.isPending && change.variables?.item.id === selected.id ? change.variables.action : undefined}
              busy={change.isPending}
              onChange={change.mutate}
              onBack={closeDetail}
            />
          ) : query.isPending ? (
            <div className="inbox-detail-loading" id="inbox-message-detail" role="status" aria-label={t('common.loading')}>
              <Skeleton className="inbox-skeleton" />
              <Skeleton className="inbox-skeleton" />
            </div>
          ) : (
            <>
              {linkedSelection && <button className="inbox-back" type="button" onClick={closeDetail}>{t('inbox.back')}</button>}
              <InboxPlaceholder label={query.isError ? t('inbox.error') : linkedSelection ? t('inbox.notFound') : emptyLabel} />
            </>
          )}
        </div>
      </div>
      {!!visible.length && <p className="inbox-key-hint">{t('inbox.keyboard')}</p>}
    </section>
  )
}
