import { Phone, ShieldAlert } from 'lucide-react'
import type { ChatReply } from '../../api/types'
import { chatMessages, formatChatDate, formatChatDays } from '../../i18n/chat'
import { useLanguage } from '../../i18n/useLanguage'
import { useT } from '../../i18n/useT'

const msInDay = 24 * 60 * 60 * 1000
const ticketSteps = ['conversation.received', 'conversation.forwarded', 'conversation.answer'] as const

export function ChatPending() {
  const t = useT(chatMessages)
  return (
    <p className="note" data-tone="warn">
      <span className="ui-dot" aria-hidden="true" />
      {t('conversation.pendingNote')}
    </p>
  )
}

export function ChatTicket({ reply, createdAt, resolved }: { reply: ChatReply; createdAt: string; resolved: boolean }) {
  const t = useT(chatMessages)
  const { language } = useLanguage()
  const deadline = reply.due_at ? new Date(reply.due_at) : null
  const duration = deadline ? Math.ceil((deadline.getTime() - new Date(createdAt).getTime()) / msInDay) : 0
  const date = deadline ? formatChatDate(deadline, language) : null
  const current = resolved ? 3 : 1

  return (
    <div className="ticket">
      <div className="ticket__head">
        <p className="ticket__title">{t('conversation.ticketTitle')}</p>
        {reply.ticket_number && <p className="ticket__number mono">№ {reply.ticket_number.replace(/^№\s*/u, '')}</p>}
      </div>
      {date && (
        <p className="ticket__due">
          {t('conversation.dueLabel')}: <span className="mono">{date}</span>
          {Number.isFinite(duration) && duration > 0 && <span className="ticket__duration"> · {formatChatDays(duration, language)}</span>}
        </p>
      )}
      <ol className="ticket__steps" aria-label={t('conversation.ticketStatus')}>
        {ticketSteps.map((step, index) => {
          const state = index < current ? 'done' : index === current ? 'current' : 'todo'
          return (
            <li key={step} data-state={state} aria-current={state === 'current' ? 'step' : undefined}>
              <span className="ticket__marker" aria-hidden="true" />
              <span>{t(step)}</span>
            </li>
          )
        })}
      </ol>
    </div>
  )
}

export function ChatFraud() {
  const t = useT(chatMessages)
  return (
    <div className="fraud" role="alert">
      <ShieldAlert className="fraud__icon" size={18} aria-hidden="true" />
      <div>
        <p className="fraud__title">{t('conversation.fraudTitle')}</p>
        <p className="fraud__body">{t('conversation.fraudBody')}</p>
        <a className="fraud__hotline" href="tel:1006"><Phone size={14} aria-hidden="true" />{t('conversation.hotline')}</a>
      </div>
    </div>
  )
}
