import { CalendarDays, Check, Clock3, Phone, ShieldAlert, Ticket } from 'lucide-react'
import type { ChatReply } from '../../api/types'
import { chatMessages, formatChatDate, formatChatDays } from '../../i18n/chat'
import { useLanguage } from '../../i18n/useLanguage'
import { useT } from '../../i18n/useT'

const msInDay = 24 * 60 * 60 * 1000
const ticketSteps = ['conversation.received', 'conversation.forwarded', 'conversation.answer'] as const

export function ChatPending() {
  const t = useT(chatMessages)

  return (
    <div className="chat-status chat-status--pending">
      <span className="chat-status-icon"><Clock3 size={18} aria-hidden="true" /></span>
      <div>
        <p className="chat-status-title">{t('conversation.pendingTitle')}</p>
        <p className="chat-status-detail">{t('conversation.pendingDetail')}</p>
      </div>
      <div className="chat-pending-track" aria-hidden="true"><span /></div>
    </div>
  )
}

export function ChatTicket({ reply, createdAt, resolved }: { reply: ChatReply; createdAt: string; resolved: boolean }) {
  const t = useT(chatMessages)
  const { language } = useLanguage()
  const deadline = reply.due_at ? new Date(reply.due_at) : null
  const duration = deadline ? Math.ceil((deadline.getTime() - new Date(createdAt).getTime()) / msInDay) : 0
  const date = deadline ? formatChatDate(deadline, language) : null
  const due = date && (Number.isFinite(duration) && duration > 0
    ? t('conversation.due').replace('{date}', date).replace('{duration}', formatChatDays(duration, language))
    : t('conversation.dueNoDuration').replace('{date}', date))

  return (
    <div className="chat-status chat-status--ticket">
      <div className="chat-ticket-header">
        <span className="chat-status-icon"><Ticket size={18} aria-hidden="true" /></span>
        <div>
          <p className="chat-status-title">{t('conversation.ticketTitle')}</p>
          {reply.ticket_number && <p className="chat-ticket-number">№{reply.ticket_number.replace(/^№\s*/u, '')}</p>}
        </div>
      </div>
      {due && <p className="chat-ticket-due"><CalendarDays size={15} aria-hidden="true" />{due}</p>}
      <ol className="chat-ticket-steps">
        {ticketSteps.map((step, index) => (
          <li key={step} data-complete={index < 2 || resolved}>
            <span aria-hidden="true">{(index < 2 || resolved) && <Check size={10} />}</span>
            {t(step)}
          </li>
        ))}
      </ol>
    </div>
  )
}

export function ChatFraud() {
  const t = useT(chatMessages)

  return (
    <div className="chat-status chat-status--fraud">
      <span className="chat-status-icon"><ShieldAlert size={19} aria-hidden="true" /></span>
      <div>
        <p className="chat-status-title">{t('conversation.fraudTitle')}</p>
        <p className="chat-status-detail">{t('conversation.fraudBody')}</p>
        <a className="chat-hotline" href="tel:1006"><Phone size={15} aria-hidden="true" />{t('conversation.hotline')}</a>
      </div>
    </div>
  )
}
