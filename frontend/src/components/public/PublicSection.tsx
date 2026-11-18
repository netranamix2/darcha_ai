import { motion, useReducedMotion } from 'motion/react'
import type { ReactNode } from 'react'

export function PublicSection({ id, title, className, children }: {
  id: string
  title: string
  className?: string
  children: ReactNode
}) {
  const reducedMotion = useReducedMotion()
  return (
    <motion.section
      id={id}
      className={['landing-section', className].filter(Boolean).join(' ')}
      aria-labelledby={id + '-title'}
      tabIndex={-1}
      initial={reducedMotion ? false : { opacity: 0, y: 8 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.08 }}
      transition={{ duration: reducedMotion ? 0 : 0.2, ease: 'easeOut' }}
    >
      <h2 id={id + '-title'}>{title}</h2>
      {children}
    </motion.section>
  )
}
