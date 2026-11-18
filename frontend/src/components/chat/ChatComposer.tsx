import { ArrowUp } from 'lucide-react'
import { forwardRef, useState } from 'react'
import { chatMessages } from '../../i18n/chat'
import { useT } from '../../i18n/useT'
import { Select } from '../ui'
import { isRegion, regions, useChatRegion } from './region'

const messageLimit = 1000

type ComposerProps = {
  disabled: boolean
  sessionId: string | null
  onSend: (text: string) => void
}

export const ChatComposer = forwardRef<HTMLTextAreaElement, ComposerProps>(function ChatComposer(
  { disabled, sessionId, onSend }, ref,
) {
  const [draft, setDraft] = useState('')
  const [region, setRegion] = useChatRegion(sessionId)
  const t = useT(chatMessages)
  const ready = Boolean(draft.trim()) && !disabled
  const nearLimit = draft.length > messageLimit * 0.8
  const regionOptions = [
    { value: 'none', label: t('conversation.regionUnset') },
    ...Object.entries(regions).map(([value, label]) => ({ value, label: t(label) })),
  ]

  return (
    <form
      className="composer frost"
      onSubmit={(event) => {
        event.preventDefault()
        if (!ready) return
        onSend(draft.trim())
        setDraft('')
      }}
    >
      <div className="composer__grow" data-mirror={draft + ' '}>
        <textarea
          ref={ref}
          className="composer__input"
          rows={1}
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
      <div className="composer__bar">
        <Select
          appearance="inline"
          side="top"
          aria-label={t('conversation.region')}
          prefix={t('conversation.regionPrefix')}
          value={region ?? 'none'}
          onValueChange={(value) => setRegion(isRegion(value) ? value : null)}
          options={regionOptions}
          className="composer__region"
        />
        <div className="composer__end">
          {nearLimit ? (
            <output className="composer__count mono" aria-live="polite">{draft.length}/{messageLimit}</output>
          ) : (
            <span className="composer__hint">{t('conversation.sendHint')}</span>
          )}
          <button type="submit" className="composer__send" aria-label={t('conversation.send')} disabled={!ready}>
            <ArrowUp aria-hidden="true" size={18} strokeWidth={2.25} />
          </button>
        </div>
      </div>
    </form>
  )
})
