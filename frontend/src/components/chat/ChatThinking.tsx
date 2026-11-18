import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useState } from 'react'
import { chatMessages } from '../../i18n/chat'
import { useT } from '../../i18n/useT'
import { WindowMark } from '../Brand'

const steps = [
  { label: 'conversation.analyzing', time: 0 },
  { label: 'conversation.searching', time: 700 },
  { label: 'conversation.checking', time: 1500 },
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

  const label = t(steps[activeStep].label)

  return (
    <div className="thinking" role="status" aria-label={label}>
      <WindowMark size={18} thinking className="thinking__mark" />
      <span className="thinking__text" aria-hidden="true">
        <AnimatePresence mode="wait" initial={false}>
          <motion.span
            key={activeStep}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
          >
            {label}
          </motion.span>
        </AnimatePresence>
      </span>
    </div>
  )
}
