import { useEffect, useState } from 'react'
import { chatMessages } from '../../i18n/chat'
import { useT } from '../../i18n/useT'
import { WindowMark } from '../Brand'

const steps = [
  { label: 'conversation.analyzing', time: 0 },
  { label: 'conversation.searching', time: 240 },
  { label: 'conversation.checking', time: 520 },
] as const

export function ChatThinking({ startedAt }: { startedAt: number }) {
  const t = useT(chatMessages)
  const [activeStep, setActiveStep] = useState(0)
  useEffect(() => {
    const timers = steps.slice(1).map(({ time }, index) =>
      window.setTimeout(() => setActiveStep(index + 1), Math.max(0, time - (Date.now() - startedAt))),
    )
    return () => timers.forEach((timer) => window.clearTimeout(timer))
  }, [startedAt])

  return (
    <div className="chat-thinking" role="status">
      <WindowMark thinking />
      <span>{t(steps[activeStep].label)}</span>
    </div>
  )
}
