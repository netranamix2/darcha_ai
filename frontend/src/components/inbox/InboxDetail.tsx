import { ArrowLeft } from 'lucide-react'
import { useRef, useState } from 'react'
import { Link } from 'react-router'
import type { InboxItem } from '../../api/types'
import { formatChatDate } from '../../i18n/chat'
import { inboxMessages } from '../../i18n/inbox'
import { localeCodes } from '../../i18n/locales'
import { useLanguage } from '../../i18n/useLanguage'
import { useT } from '../../i18n/useT'
import { localizeCaseRegion, localizeCaseTopic } from '../../lib/case-labels'
import { CitationFootnotes } from '../CitationFootnotes'
import { Button } from '../ui'
import { inboxChannel, inboxStatus, inboxTone, isDraft, isTicketed } from './inbox-record'

export type InboxAction = 'approve' | 'edit' | 'reject' | 'convert'

export interface InboxChange {
  action: InboxAction
  item: InboxItem
  text?: string
}

const classificationLabels = {
  savol: 'inbox.typeQuestion',
  question: 'inbox.typeQuestion',
  shikoyat: 'inbox.typeComplaint',
  complaint: 'inbox.typeComplaint',
  taklif: 'inbox.typeSuggestion',
  suggestion: 'inbox.typeSuggestion',
  gratitude: 'inbox.typeGratitude',
  insult: 'inbox.typeInsult',
  spam: 'inbox.typeSpam',
} as const

export function InboxDetail({ item, pending, busy, onChange, onBack }: {
  item: InboxItem
  pending?: InboxAction
  busy: boolean
  onChange: (change: InboxChange) => void
  onBack: () => void
}) {
  const t = useT(inboxMessages)
  const { language } = useLanguage()
  const [editable, setEditable] = useState(false)
  const [draftText, setDraftText] = useState<string | null>(null)
  const editor = useRef<HTMLTextAreaElement>(null)
  const editButton = useRef<HTMLButtonElement>(null)
  const { icon: Icon, label } = inboxChannel[item.channel]
  const { classification, draft } = item
  const topic = localizeCaseTopic(classification.topic, language) || t('inbox.topicUnknown')
  const canEdit = isDraft(item)
  const preview = (canEdit ? draftText : null) ?? draft?.answer ?? ''
  const isLinked = isTicketed(item)
  const validDraft = preview.trim().length > 0
  const sentiment = t(classification.sentiment === 'positive' ? 'inbox.sentiment.positive'
    : classification.sentiment === 'negative' ? 'inbox.sentiment.negative' : 'inbox.sentiment.neutral')
  const region = classification.region ? localizeCaseRegion(classification.region, language) : t('inbox.regionUnknown')
  const normalizedType = classification.type.trim().toLowerCase()
  const typeKey = Object.hasOwn(classificationLabels, normalizedType)
    ? classificationLabels[normalizedType as keyof typeof classificationLabels]
    : undefined
  const type = t(typeKey ?? 'inbox.typeUnknown')
  const confidence = draft && Number.isFinite(draft.confidence) ? Math.min(1, Math.max(0, draft.confidence)) : null
  const time = new Date(item.created_at)
  const date = formatChatDate(time, language)
  const timestamp = date
    ? date + ' · ' + time.toLocaleTimeString(localeCodes[language], { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Tashkent' })
    : '—'
  const ticketLink = item.ticket_id
    ? '/panel/tickets?' + new URLSearchParams({ ticket: item.ticket_id })
    : '/panel/tickets'

  function triggerEdit() {
    if (!editable) {
      setEditable(true)
      requestAnimationFrame(() => editor.current?.focus())
      return
    }
    if (preview.trim() !== draft?.answer?.trim()) onChange({ action: 'edit', item, text: preview })
    setEditable(false)
  }

  return (
    <article className="inbox-detail" id="inbox-message-detail" aria-labelledby="inbox-detail-title">
      <button type="button" className="inbox-back" onClick={onBack}><ArrowLeft aria-hidden="true" size={16} />{t('inbox.back')}</button>
      <header className="inbox-detail-header">
        <div className="inbox-detail-meta">
          <span className="inbox-status" data-tone={inboxTone(item)}><i aria-hidden="true" />{t(inboxStatus(item))}</span>
          {classification.flags.includes('fraud') && <span className="inbox-status" data-tone="red"><i aria-hidden="true" />{t('inbox.fraud')}</span>}
          <span className="inbox-detail-channel"><Icon aria-hidden="true" size={16} strokeWidth={1.5} />{t(label)}</span>
          <time dateTime={item.created_at}>{timestamp}</time>
        </div>
        <h2 className="inbox-detail-title" id="inbox-detail-title" tabIndex={-1}>{topic}</h2>
      </header>
      <section className="inbox-detail-message" aria-labelledby="inbox-message-label">
        <h3 className="inbox-section-label" id="inbox-message-label">{t('inbox.message')}</h3>
        <blockquote>{item.text}</blockquote>
      </section>
      <section className="inbox-analysis" aria-labelledby="inbox-analysis-label">
        <h3 className="inbox-section-label" id="inbox-analysis-label">{t('inbox.analysis')}</h3>
        <p className="inbox-analysis-tokens">
          <span>{t('inbox.analysisType')}: <strong>{type}</strong></span>
          <span>{t('inbox.analysisSentiment')}: <strong>{sentiment}</strong></span>
          <span>{t('inbox.analysisRegion')}: <strong>{region}</strong></span>
        </p>
        {confidence !== null && (
          <div className="inbox-confidence">
            <span>{t('inbox.confidence')}</span>
            <meter value={confidence} aria-label={t('inbox.confidence')} />
            <strong>{Math.round(confidence * 100)}%</strong>
          </div>
        )}
      </section>
      {(draft || canEdit) && (
        <section className="inbox-draft" aria-labelledby="inbox-draft-label">
          <h3 className="inbox-section-label" id="inbox-draft-label">
            {t(canEdit ? 'inbox.draft' : 'inbox.response')}
          </h3>
          {editable ? (
            <textarea
              ref={editor}
              aria-labelledby="inbox-draft-label"
              readOnly={busy}
              value={preview}
              placeholder={t('inbox.draftPlaceholder')}
              rows={Math.max(4, Math.min(9, Math.ceil(preview.length / 62)))}
              onChange={(event) => setDraftText(event.currentTarget.value)}
              onKeyDown={(event) => {
                if (event.key === 'Escape') {
                  setEditable(false)
                  setDraftText(null)
                  editButton.current?.focus()
                }
              }}
            />
          ) : <p className="inbox-draft-preview">{preview || t('inbox.draftPlaceholder')}</p>}
          {draft && <CitationFootnotes citations={draft.citations} />}
        </section>
      )}
      <footer className="inbox-detail-actions">
        {isLinked ? (
          <Link to={ticketLink}>{t('inbox.open')}{item.ticket_number && <span className="inbox-linked-id">{item.ticket_number}</span>}</Link>
        ) : (
          <>
            {canEdit && (
              <>
                <Button size="sm" disabled={busy || !validDraft} loading={pending === 'approve'} onClick={() => onChange({ action: 'approve', item, text: preview })}>
                  {t('inbox.approve')}
                </Button>
                <button ref={editButton} type="button" className="inbox-text-action" disabled={busy || (editable && !validDraft)} onClick={triggerEdit}>
                  {t(editable ? 'inbox.save' : 'inbox.edit')}
                </button>
                <button type="button" className="inbox-text-action" disabled={busy} onClick={() => onChange({ action: 'reject', item })}>
                  {t('inbox.reject')}
                </button>
              </>
            )}
            <button type="button" className="inbox-text-action" disabled={busy} onClick={() => onChange({ action: 'convert', item })}>
              {t('inbox.convert')}
            </button>
          </>
        )}
      </footer>
    </article>
  )
}
