import { motion, useReducedMotion } from 'motion/react'
import { Suspense } from 'react'
import { useLocation, useOutlet } from 'react-router'
import { RouteLoading } from './RouteFeedback'

export function AnimatedOutlet({ context }: { context?: unknown }) {
  const currentPage = useOutlet(context)
  const { pathname } = useLocation()
  const reducedMotion = useReducedMotion()

  return (
    <Suspense fallback={<RouteLoading />}>
      <motion.div
        key={pathname}
        initial={reducedMotion ? false : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: reducedMotion ? 0 : 0.25, ease: 'easeOut' }}
      >
        {currentPage}
      </motion.div>
    </Suspense>
  )
}
