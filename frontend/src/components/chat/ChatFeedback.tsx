import { ThumbsDown, ThumbsUp } from 'lucide-react'
import { useState } from 'react'
import { chatMessages } from '../../i18n/chat'
import { useT } from '../../i18n/useT'
import { Button, IconButton, Input } from '../ui'
import { readChatPreference, saveChatPreference } from './storage'

type Reaction = 'up' | 'down'
type Feedback = { reaction: Reaction | null; detail: string }

function savedFeedback(key: string): Feedback {
  const saved = readChatPreference(key)
  if (!saved || typeof saved !== 'object' || !('reaction' in saved)) return { reaction: null, detail: '' }
  const reaction = saved.reaction === 'up' || saved.reaction === 'down' ? saved.reaction : null
  const detail = 'detail' in saved && typeof saved.detail === 'string' ? saved.detail : ''
  return { reaction, detail }
}

export function ChatFeedback({ messageId }: { messageId: string }) {
  const t = useT(chatMessages)
  const key = 'darcha.chat.feedback.' + messageId
  const [feedback, setFeedback] = useState(() => savedFeedback(key))
  const [detail, setDetail] = useState(feedback.detail)
  const [showDetail, setShowDetail] = useState(false)
  const [confirmed, setConfirmed] = useState(false)

  function record(next: Feedback) {
    setFeedback(next)
    saveChatPreference(key, next)
  }

  function react(reaction: Reaction) {
    const next = feedback.reaction === reaction && (reaction === 'up' || showDetail) ? null : reaction
    setShowDetail(next === 'down')
    setConfirmed(false)
    record({ reaction: next, detail: feedback.detail })
  }

  return (
    <div className="chat-feedback">
      <div className="chat-feedback-summary">
        <p>{t('conversation.aiReply')}</p>
        <div className="chat-feedback-controls">
          <IconButton
            size="sm"
            aria-pressed={feedback.reaction === 'up'}
            aria-label={t('conversation.helpful')}
            onClick={() => react('up')}
          ><ThumbsUp size={14} aria-hidden="true" /></IconButton>
          <IconButton
            size="sm"
            aria-pressed={feedback.reaction === 'down'}
            aria-expanded={showDetail}
            aria-label={t('conversation.unhelpful')}
            onClick={() => react('down')}
          ><ThumbsDown size={14} aria-hidden="true" /></IconButton>
        </div>
      </div>
      {showDetail && (
        <form className="chat-feedback-form" onSubmit={(event) => {
          event.preventDefault()
          if (!detail.trim()) return
          record({ reaction: 'down', detail: detail.trim() })
          setShowDetail(false)
          setConfirmed(true)
        }}>
          <Input
            value={detail}
            maxLength={400}
            aria-label={t('conversation.feedbackPrompt')}
            placeholder={t('conversation.feedbackPrompt')}
            onChange={(event) => setDetail(event.currentTarget.value)}
          />
          <Button size="sm" variant="secondary" type="submit" disabled={!detail.trim()}>{t('conversation.saveFeedback')}</Button>
        </form>
      )}
      {confirmed && <p role="status" className="chat-feedback-confirmation">{t('conversation.savedFeedback')}</p>}
    </div>
  )
}
