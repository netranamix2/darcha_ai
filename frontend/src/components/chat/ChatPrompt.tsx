import { ArrowRightLeft, ArrowUpRight, CreditCard, GraduationCap, RotateCcw } from 'lucide-react'
import type { CSSProperties } from 'react'
import { chatMessages } from '../../i18n/chat'
import { useT } from '../../i18n/useT'
import { ChatOrb } from './ChatHeader'

const prompts = [
  { key: 'conversation.suggestTransfer', icon: ArrowRightLeft },
  { key: 'conversation.suggestContract', icon: CreditCard },
  { key: 'conversation.suggestCertification', icon: GraduationCap },
  { key: 'conversation.suggestRestoration', icon: RotateCcw },
] as const

export function ChatPrompt({ disabled, onPrompt }: { disabled: boolean; onPrompt: (text: string) => void }) {
  const t = useT(chatMessages)

  return (
    <div className="chat-prompt">
      <ChatOrb large />
      <h3>{t('conversation.greeting')}</h3>
      <ul className="chat-prompts glass-stagger" aria-label={t('conversation.suggestions')}>
        {prompts.map(({ key, icon: TopicIcon }, index) => (
          <li key={key} style={{ '--stagger-index': index } as CSSProperties}>
            <button type="button" className="chat-prompt-chip glass-lift" disabled={disabled} onClick={() => onPrompt(t(key))}>
              <TopicIcon className="chat-chip-icon" aria-hidden="true" size={16} />
              <span>{t(key)}</span>
              <ArrowUpRight className="chat-chip-arrow" aria-hidden="true" size={13} />
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
