import { Check } from 'lucide-react'
import { useEffect, useState } from 'react'
import { chatMessages } from '../../i18n/chat'
import { useT } from '../../i18n/useT'
import { ChatOrb } from './ChatHeader'

const steps = [
  { label: 'conversation.analyzing', time: 0 },
  { label: 'conversation.searching', time: 290 },
  { label: 'conversation.checking', time: 630 },
] as const

export function ChatThinking({ startedAt }: { startedAt: number }) {
  const t = useT(chatMessages)
  const [activeStep, setActiveStep] = useState(0)

  useEffect(() => {
    const timers = steps.slice(1).map(({ time }, index) => {
      const delay = Math.max(0, time - (Date.now() - startedAt))
      return window.setTimeout(() => setActiveStep(index + 1), delay)
    })
    return () => timers.forEach((timer) => window.clearTimeout(timer))
  }, [startedAt])

  return (
    <div className="chat-thinking">
      <ChatOrb />
      <ol aria-label={t(steps[activeStep].label)}>
        {steps.map(({ label }, index) => (
          <li key={label} data-step={index < activeStep ? 'complete' : index === activeStep ? 'active' : 'waiting'}>
            <span className="chat-thinking-marker" aria-hidden="true">{index < activeStep && <Check size={11} />}</span>
            {t(label)}
          </li>
        ))}
      </ol>
    </div>
  )
}
