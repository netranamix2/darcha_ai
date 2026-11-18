import { Check, Copy, ThumbsDown, ThumbsUp } from 'lucide-react'
import { useEffect, useState } from 'react'
import { chatMessages } from '../../i18n/chat'
import { useT } from '../../i18n/useT'
import { Button, IconButton, Input, Tooltip } from '../ui'
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

export function ChatFeedback({ messageId, text }: { messageId: string; text: string }) {
  const t = useT(chatMessages)
  const key = 'darcha.chat.feedback.' + messageId
  const [feedback, setFeedback] = useState(() => savedFeedback(key))
  const [detail, setDetail] = useState(feedback.detail)
  const [showDetail, setShowDetail] = useState(false)
  const [confirmed, setConfirmed] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!copied) return
    const timer = window.setTimeout(() => setCopied(false), 1600)
    return () => window.clearTimeout(timer)
  }, [copied])

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

  async function copy() {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
    } catch {
      // Clipboard access can be blocked; the text stays selectable.
    }
  }

  return (
    <div className="feedback">
      <div className="feedback__actions">
        <Tooltip content={t('conversation.helpful')}>
          <IconButton size="sm" aria-pressed={feedback.reaction === 'up'} aria-label={t('conversation.helpful')} onClick={() => react('up')}>
            <ThumbsUp aria-hidden="true" />
          </IconButton>
        </Tooltip>
        <Tooltip content={t('conversation.unhelpful')}>
          <IconButton size="sm" aria-pressed={feedback.reaction === 'down'} aria-expanded={showDetail}
            aria-label={t('conversation.unhelpful')} onClick={() => react('down')}>
            <ThumbsDown aria-hidden="true" />
          </IconButton>
        </Tooltip>
        <Tooltip content={t(copied ? 'conversation.copied' : 'conversation.copy')}>
          <IconButton size="sm" aria-label={t(copied ? 'conversation.copied' : 'conversation.copy')} onClick={() => void copy()}>
            {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
          </IconButton>
        </Tooltip>
      </div>
      {showDetail && (
        <form className="feedback__form" onSubmit={(event) => {
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
      {confirmed && <p role="status" className="feedback__done">{t('conversation.savedFeedback')}</p>}
    </div>
  )
}
