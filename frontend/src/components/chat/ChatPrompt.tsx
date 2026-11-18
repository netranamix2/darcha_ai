import type { CSSProperties } from 'react'
import { chatMessages } from '../../i18n/chat'
import { useT } from '../../i18n/useT'

const prompts = [
  'conversation.suggestTransfer',
  'conversation.suggestContract',
  'conversation.suggestCertification',
  'conversation.suggestRestoration',
] as const

export function ChatPrompt({ disabled, onPrompt }: { disabled: boolean; onPrompt: (text: string) => void }) {
  const t = useT(chatMessages)

  return (
    <section className="chat-prompt" aria-labelledby="suggestion-title">
      <h2 id="suggestion-title">{t('conversation.suggestions')}</h2>
      <ol className="chat-prompts" role="list">
        {prompts.map((key, index) => (
          <li key={key} style={{ '--row-delay': `${index * 30}ms` } as CSSProperties}>
            <button type="button" disabled={disabled} onClick={() => onPrompt(t(key))}>
              <span className="chat-question-number" aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>
              <span>{t(key)}</span>
            </button>
          </li>
        ))}
      </ol>
    </section>
  )
}
