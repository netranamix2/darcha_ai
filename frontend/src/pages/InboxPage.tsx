import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowUpRight, Globe2, Inbox, Instagram, Send, Ticket as TicketIcon } from 'lucide-react'
import { useState } from 'react'
import { Link, useOutletContext } from 'react-router'
import { convertInboxToTicket } from '../api/client'
import type { Channel, InboxItem, Ticket } from '../api/types'
import type { PanelNotify } from '../components/PanelLayout'
import { Button, GlassPanel, Skeleton, Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui'
import { inboxKey, ticketsKey, useInboxRecords } from '../hooks/usePanelCases'
import { inboxMessages } from '../i18n/inbox'
import { useLanguage } from '../i18n/useLanguage'
import { useT } from '../i18n/useT'
import { formatTicketDate } from '../lib/ticket-time'
import './inbox-page.css'

const channels = {
  web: { icon: Globe2, label: 'inbox.channelWeb' },
  instagram: { icon: Instagram, label: 'inbox.channelInstagram' },
  telegram: { icon: Send, label: 'inbox.channelTelegram' },
} as const satisfies Record<Channel, { icon: typeof Globe2; label: string }>

const empty: InboxItem[] = []

function AppealedRow({ appeal, pending, disabled, onConvert }: {
  appeal: InboxItem
  pending: boolean
  disabled: boolean
  onConvert: () => void
}) {
  const t = useT(inboxMessages)
  const { language } = useLanguage()
  const { icon: ChannelIcon, label } = channels[appeal.channel]
  const target = appeal.ticket_id
    ? `/panel/tickets?${new URLSearchParams({ ticket: appeal.ticket_id })}`
    : '/panel/tickets'

  return (
    <article className="inbox-record">
      <div className="inbox-record-icon"><ChannelIcon aria-hidden="true" size={20} /></div>
      <div className="inbox-record-body">
        <div className="inbox-record-meta">
          <span>{t(label)}</span>
          <time dateTime={appeal.created_at}>{formatTicketDate(appeal.created_at, language)}</time>
          {appeal.ticket_number && <span className="inbox-ticket-number">{appeal.ticket_number}</span>}
        </div>
        <h2>{appeal.classification.topic}</h2>
        <p>{appeal.text}</p>
      </div>
      {appeal.ticket_id || appeal.ticket_number ? (
        <Button asChild variant="secondary" size="sm">
          <Link to={target}>{t('inbox.open')} <ArrowUpRight aria-hidden="true" size={16} /></Link>
        </Button>
      ) : (
        <Button variant="secondary" size="sm" onClick={onConvert} loading={pending} disabled={disabled}>
          <TicketIcon aria-hidden="true" size={16} /> {t('inbox.convert')}
        </Button>
      )}
    </article>
  )
}

export default function InboxPage() {
  const [tab, setTab] = useState<'all' | 'tickets'>('all')
  const t = useT(inboxMessages)
  const notify = useOutletContext<PanelNotify>()
  const queryClient = useQueryClient()
  const query = useInboxRecords()
  const appeals = query.data ?? empty
  const ticketed = appeals.filter(({ ticket_id, ticket_number }) => ticket_id || ticket_number)
  const visible = tab === 'all' ? appeals : ticketed

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
      setTab('tickets')
      notify({ title: t('inbox.converted'), description: ticket.number, variant: 'success' })
    },
    onError: () => notify({ title: t('inbox.conversionError'), variant: 'error' }),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ticketsKey })
      void queryClient.invalidateQueries({ queryKey: inboxKey })
    },
  })

  return (
    <section className="inbox-page" aria-labelledby="inbox-title">
      <header className="inbox-heading">
        <h1 id="inbox-title">{t('panel.inbox')}</h1>
        <p>{t('inbox.subtitle')}</p>
      </header>
      <Tabs value={tab} onValueChange={(value) => setTab(value === 'tickets' ? 'tickets' : 'all')}>
        <TabsList aria-label={t('panel.inbox')}>
          <TabsTrigger value="all">{t('inbox.all')}<span className="inbox-tab-count">{appeals.length}</span></TabsTrigger>
          <TabsTrigger value="tickets">{t('inbox.ticketed')}<span className="inbox-tab-count">{ticketed.length}</span></TabsTrigger>
        </TabsList>
        <TabsContent value={tab}>
          <GlassPanel className="inbox-list" variant="subtle">
            {query.isError && !query.data ? (
              <div className="inbox-state" role="alert">
                <p>{t('inbox.error')}</p>
                <Button variant="secondary" size="sm" onClick={() => void query.refetch()}>{t('inbox.retry')}</Button>
              </div>
            ) : query.isPending ? (
              <div className="inbox-state" role="status" aria-label={t('common.loading')}>
                <Skeleton className="inbox-skeleton" />
                <Skeleton className="inbox-skeleton" />
              </div>
            ) : visible.length > 0 ? (
              <div className="inbox-records glass-stagger">
                {visible.map((appeal) => (
                  <AppealedRow
                    key={appeal.id}
                    appeal={appeal}
                    pending={conversion.isPending && conversion.variables === appeal.id}
                    disabled={conversion.isPending}
                    onConvert={() => conversion.mutate(appeal.id)}
                  />
                ))}
              </div>
            ) : (
              <div className="inbox-state">
                <Inbox aria-hidden="true" size={23} />
                <p>{t(tab === 'tickets' ? 'inbox.emptyTicketed' : 'inbox.empty')}</p>
              </div>
            )}
          </GlassPanel>
        </TabsContent>
      </Tabs>
    </section>
  )
}
