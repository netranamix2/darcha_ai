import { ArrowUp } from 'lucide-react'
import { useState } from 'react'
import { chatMessages } from '../../i18n/chat'
import { useT } from '../../i18n/useT'
import { ChatRegion } from './ChatRegion'

const messageLimit = 1000

export function ChatComposer({ disabled, sessionId, onSend }: {
  disabled: boolean
  sessionId: string | null
  onSend: (text: string) => void
}) {
  const [draft, setDraft] = useState('')
  const t = useT(chatMessages)
  const ready = Boolean(draft.trim()) && !disabled

  return (
    <form className="chat-composer" onSubmit={(event) => {
      event.preventDefault()
      if (!ready) return
      onSend(draft.trim())
      setDraft('')
    }}>
      <div className="chat-compose-row">
        <div className="chat-textarea-grow" data-mirror={draft}>
          <textarea
            className="chat-textarea"
            rows={2}
            value={draft}
            maxLength={messageLimit}
            aria-label={t('conversation.placeholder')}
            placeholder={t('conversation.placeholder')}
            onChange={(event) => setDraft(event.currentTarget.value.slice(0, messageLimit))}
            onKeyDown={(event) => {
              if (event.key !== 'Enter' || event.shiftKey || event.nativeEvent.isComposing || event.keyCode === 229) return
              event.preventDefault()
              if (!event.repeat && ready) event.currentTarget.form?.requestSubmit()
            }}
          />
        </div>
        <button type="submit" aria-label={t('conversation.send')} disabled={!ready} className="chat-send">
          <ArrowUp aria-hidden="true" size={21} strokeWidth={1.5} />
        </button>
      </div>
      <div className="chat-compose-meta">
        <ChatRegion sessionId={sessionId} />
        {draft.length > 0 && (
          <output aria-live="off" className="chat-character-count" data-full={draft.length === messageLimit}>
            {draft.length}/{messageLimit}
          </output>
        )}
      </div>
    </form>
  )
}
