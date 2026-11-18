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
    <ul className="suggestions" aria-label={t('conversation.suggestions')}>
      {prompts.map((key) => (
        <li key={key}>
          <button type="button" className="suggestions__item" disabled={disabled} onClick={() => onPrompt(t(key))}>
            {t(key)}
          </button>
        </li>
      ))}
    </ul>
  )
}
