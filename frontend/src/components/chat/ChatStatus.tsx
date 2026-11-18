import type { ChatReply } from '../../api/types'
import { chatMessages, formatChatDate, formatChatDays } from '../../i18n/chat'
import { useLanguage } from '../../i18n/useLanguage'
import { useT } from '../../i18n/useT'

const msInDay = 24 * 60 * 60 * 1000

export function ChatPending() {
  const t = useT(chatMessages)
  return (
    <div className="chat-status chat-status--pending">
      <p className="chat-status-title">{t('conversation.pendingTitle')}</p>
      <p>{t('conversation.pendingDetail')}</p>
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
    <div className="chat-status chat-status--ticket" data-resolved={resolved}>
      <p className="chat-status-title">{t('conversation.ticketTitle')}</p>
      {reply.ticket_number && <p className="chat-ticket-number">№ {reply.ticket_number.replace(/^№\s*/u, '')}</p>}
      {due && <p className="chat-ticket-due">{due}</p>}
      <p>{t(resolved ? 'conversation.ticketAnswered' : 'conversation.ticketWaiting')}</p>
    </div>
  )
}

export function ChatFraud() {
  const t = useT(chatMessages)
  return (
    <div className="chat-status chat-status--fraud">
      <p className="chat-status-title">{t('conversation.fraudTitle')}</p>
      <p>{t('conversation.fraudBody')}</p>
      <a className="chat-hotline" href="tel:1006">{t('conversation.hotline')}</a>
    </div>
  )
}
