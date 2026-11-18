import { useMutation, useQuery } from '@tanstack/react-query'
import { CalendarPlus, ChevronDown, FileText, Info, Link2, Search, X } from 'lucide-react'
import { Dialog } from 'radix-ui'
import { useId, useRef, useState } from 'react'
import { getKnowledgeBase, updateTicket } from '../../api/client'
import { getTicketExtensionLimit } from '../../api/ticket-deadlines'
import type { Citation, Ticket } from '../../api/types'
import { ticketDrawerMessages } from '../../i18n/ticket-drawer'
import { useLanguage } from '../../i18n/useLanguage'
import { useT } from '../../i18n/useT'
import { formatDayDuration, formatTicketDate, getDeadlineDays, getTicketStatus } from '../../lib/ticket-time'
import {
  Button, Dropdown, DropdownContent, DropdownRadioGroup, DropdownRadioItem,
  DropdownTrigger, IconButton, Input, Skeleton, Textarea,
} from '../ui'

type PickerOption<Value> = { value: Value; label: string }

export function TicketFieldPicker<Value extends string>({
  label, value, selectedLabel, options, onChange, disabled, tone,
}: {
  label: string
  value: Value
  selectedLabel: string
  options: PickerOption<Value>[]
  onChange: (value: Value) => void
  disabled: boolean
  tone?: string
}) {
  return (
    <div className="ticket-drawer-field">
      <span className="ticket-drawer-field-label">{label}</span>
      <Dropdown modal={false}>
        <DropdownTrigger asChild>
          <Button
            variant="secondary"
            size="sm"
            className="ticket-drawer-picker"
            disabled={disabled}
            aria-label={`${label} · ${selectedLabel}`}
          >
            {tone && <i aria-hidden="true" className="ticket-drawer-picker-dot" data-tone={tone} />}
            <span>{selectedLabel}</span>
            <ChevronDown aria-hidden="true" />
          </Button>
        </DropdownTrigger>
        <DropdownContent align="start" className="ticket-drawer-picker-menu">
          <DropdownRadioGroup value={value} onValueChange={(next) => {
            const option = options.find((item) => item.value === next)
            if (option && option.value !== value) onChange(option.value)
          }}>
            {options.map((option) => (
              <DropdownRadioItem key={option.value} value={option.value}>
                {option.label}
              </DropdownRadioItem>
            ))}
          </DropdownRadioGroup>
        </DropdownContent>
      </Dropdown>
    </div>
  )
}

const dayMs = 24 * 60 * 60 * 1000
const tashkentOffset = 5 * 60 * 60 * 1000
const appealLaw = 'https://lex.uz/uz/docs/-3336169'

function tashkentDate(timestamp: number) {
  return new Date(timestamp + tashkentOffset).toISOString().slice(0, 10)
}

function DeadlineExtension({ ticket, disabled, onUpdated }: {
  ticket: Ticket
  disabled: boolean
  onUpdated: () => void
}) {
  const t = useT(ticketDrawerMessages)
  const [open, setOpen] = useState(false)
  const [date, setDate] = useState('')
  const [reason, setReason] = useState('')
  const [invalid, setInvalid] = useState(false)
  const dateId = useId()
  const reasonId = useId()
  const current = Date.parse(ticket.due_at)
  const limit = Date.parse(getTicketExtensionLimit(ticket.original_due_at ?? ticket.due_at))
  const canExtend = Number.isFinite(current) && Number.isFinite(limit) && current + dayMs <= limit
  const minDate = canExtend ? tashkentDate(current + dayMs) : undefined
  const maxDate = canExtend ? tashkentDate(limit) : undefined
  const update = useMutation({
    mutationFn: (dueAt: string) => updateTicket(ticket.id, { due_at: dueAt, extension_reason: reason.trim() }),
    onSuccess: () => {
      onUpdated()
      setOpen(false)
    },
  })

  function toggle(next: boolean) {
    if (update.isPending) return
    if (next && canExtend) {
      setDate(tashkentDate(Math.min(current + 7 * dayMs, limit)))
      setReason('')
      setInvalid(false)
      update.reset()
    }
    setOpen(next)
  }

  function submit() {
    const localTime = new Date(current + tashkentOffset).toISOString().slice(11, -1)
    const dueAt = new Date(`${date}T${localTime}+05:00`)
    if (!reason.trim() || !Number.isFinite(dueAt.getTime()) || dueAt.getTime() <= current || dueAt.getTime() > limit) {
      setInvalid(true)
      return
    }
    setInvalid(false)
    update.mutate(dueAt.toISOString())
  }

  return (
    <Dialog.Root open={open} onOpenChange={toggle}>
      <Dialog.Trigger asChild>
        <Button
          variant="secondary"
          size="sm"
          disabled={disabled || !canExtend}
          title={!canExtend ? t('drawer.extensionWindow') : undefined}
        >
          <CalendarPlus size={15} aria-hidden="true" /> {t('drawer.extend')}
        </Button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="ticket-drawer-modal-overlay" />
        <Dialog.Content className="ticket-drawer-modal">
          <div className="ticket-drawer-modal-header">
            <Dialog.Title>{t('drawer.extend')}</Dialog.Title>
            <Dialog.Close asChild>
              <IconButton aria-label={t('drawer.close')} size="sm" disabled={update.isPending}><X size={17} /></IconButton>
            </Dialog.Close>
          </div>
          <Dialog.Description className="ticket-drawer-modal-description">{t('drawer.extensionWindow')}</Dialog.Description>
          <form className="ticket-drawer-modal-form" noValidate onSubmit={(event) => {
            event.preventDefault()
            if (!update.isPending) submit()
          }}>
            <label className="ticket-drawer-field" htmlFor={dateId}>
              <span className="ticket-drawer-field-label">{t('drawer.newDeadline')}</span>
              <Input id={dateId} type="date" min={minDate} max={maxDate} value={date}
                onChange={(event) => setDate(event.target.value)} disabled={update.isPending} required />
            </label>
            <label className="ticket-drawer-field" htmlFor={reasonId}>
              <span className="ticket-drawer-field-label">{t('drawer.reason')}</span>
              <Textarea id={reasonId} rows={3} value={reason} onChange={(event) => setReason(event.target.value)}
                disabled={update.isPending} required />
            </label>
            <p className="ticket-drawer-modal-note"><Info size={16} aria-hidden="true" /> {t('drawer.notification')}</p>
            {(invalid || update.isError) && (
              <p className="ticket-drawer-error" role="alert">
                {t(invalid ? 'drawer.invalidExtension' : 'drawer.saveError')}
              </p>
            )}
            <div className="ticket-drawer-modal-actions">
              <Dialog.Close asChild>
                <Button variant="ghost" disabled={update.isPending}>{t('drawer.cancel')}</Button>
              </Dialog.Close>
              <Button type="submit" loading={update.isPending}>{t('drawer.save')}</Button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

export function TicketDeadline({ ticket, now, disabled, onUpdated }: {
  ticket: Ticket
  now: number
  disabled: boolean
  onUpdated: () => void
}) {
  const t = useT(ticketDrawerMessages)
  const { language } = useLanguage()
  const status = getTicketStatus(ticket, now)
  const days = getDeadlineDays(ticket.due_at, now)
  const date = formatTicketDate(ticket.due_at, language)
  const overdue = status === 'overdue'
  const duration = formatDayDuration(Math.abs(days), language)
  const remaining = t(overdue ? 'drawer.late' : 'drawer.remaining').replace('{duration}', duration)
  const exactDays = (Date.parse(ticket.due_at) - now) / dayMs
  const tone = overdue || exactDays < 3 ? 'danger' : exactDays <= 7 ? 'warning' : 'on-time'

  return (
    <section className="ticket-drawer-deadline" aria-label={t('drawer.deadline')} data-tone={tone}>
      <div className="ticket-drawer-deadline-top">
        <div>
          <h3>{t('drawer.deadline')}</h3>
          <div className="ticket-drawer-deadline-line">
            <time dateTime={ticket.due_at}>{date}</time>
            {status !== 'answered' && Number.isFinite(days) && <span>{remaining}</span>}
          </div>
        </div>
        {status !== 'answered' && <DeadlineExtension ticket={ticket} disabled={disabled} onUpdated={onUpdated} />}
      </div>
      <a href={appealLaw} className="ticket-drawer-legal" target="_blank" rel="noopener noreferrer">
        <FileText size={15} aria-hidden="true" />
        <span>{t('drawer.law')}</span>
      </a>
    </section>
  )
}

function citationSearch(value: string) {
  return value.normalize('NFKC').toLocaleLowerCase().replace(/[ʻʼ‘’`´]/g, "'")
}

export function TicketCitationPicker({ disabled, onPick, onReturnToEditor }: {
  disabled: boolean
  onPick: (citation: Citation) => void
  onReturnToEditor: () => void
}) {
  const t = useT(ticketDrawerMessages)
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const searchInput = useRef<HTMLInputElement>(null)
  const picked = useRef(false)
  const source = useQuery({
    queryKey: ['knowledge-base'],
    queryFn: getKnowledgeBase,
    enabled: open,
    staleTime: 60_000,
    retry: false,
  })
  const needle = citationSearch(query.trim())
  const results = (source.data ?? []).filter(({ ref, title }) => citationSearch(`${title} ${ref}`).includes(needle))

  return (
    <Dialog.Root open={open} onOpenChange={(next) => {
      if (next) setQuery('')
      setOpen(next)
    }}>
      <Dialog.Trigger asChild>
        <Button variant="secondary" size="sm" disabled={disabled}>
          <Link2 size={15} aria-hidden="true" /> {t('drawer.cite')}
        </Button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="ticket-drawer-modal-overlay" />
        <Dialog.Content className="ticket-drawer-modal ticket-drawer-citation-modal" onOpenAutoFocus={(event) => {
          event.preventDefault()
          searchInput.current?.focus()
        }} onCloseAutoFocus={(event) => {
          if (!picked.current) return
          event.preventDefault()
          picked.current = false
          onReturnToEditor()
        }}>
          <div className="ticket-drawer-modal-header">
            <Dialog.Title>{t('drawer.sources')}</Dialog.Title>
            <Dialog.Close asChild>
              <IconButton aria-label={t('drawer.close')} size="sm"><X size={17} /></IconButton>
            </Dialog.Close>
          </div>
          <Dialog.Description className="sr-only">{t('drawer.searchSources')}</Dialog.Description>
          <Input
            ref={searchInput}
            type="search"
            startIcon={<Search size={16} />}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t('drawer.searchSources')}
            aria-label={t('drawer.searchSources')}
          />
          {source.isPending && (
            <div className="ticket-drawer-loading ticket-drawer-loading--citations" role="status" aria-label={t('common.loading')}>
              <Skeleton /><Skeleton /><Skeleton />
            </div>
          )}
          {source.isError && (
            <div className="ticket-drawer-citation-error">
              <p className="ticket-drawer-error" role="alert">{t('drawer.sourceError')}</p>
              <Button size="sm" variant="secondary" onClick={() => void source.refetch()}>{t('drawer.retry')}</Button>
            </div>
          )}
          {source.isSuccess && (
            results.length ? (
              <ul className="ticket-drawer-citation-list">
                {results.map((citation) => (
                  <li key={`${citation.url}/${citation.ref}`}>
                    <Dialog.Close asChild>
                      <button type="button" className="ticket-drawer-citation" onClick={() => {
                        picked.current = true
                        onPick(citation)
                      }}>
                        <FileText size={16} aria-hidden="true" />
                        <span><strong>{citation.title}</strong><small>{citation.ref}</small></span>
                        <Link2 size={15} aria-hidden="true" />
                      </button>
                    </Dialog.Close>
                  </li>
                ))}
              </ul>
            ) : <p className="ticket-drawer-muted" role="status">{t('drawer.noSources')}</p>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
