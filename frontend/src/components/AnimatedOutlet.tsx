import { motion, useReducedMotion } from 'motion/react'
import { Suspense } from 'react'
import { useLocation, useOutlet } from 'react-router'
import { useT } from '../i18n/useT'

export function AnimatedOutlet() {
  const currentPage = useOutlet()
  const { pathname } = useLocation()
  const reducedMotion = useReducedMotion()
  const t = useT()

  return (
    <Suspense fallback={<p className="route-loading" role="status">{t('common.loading')}</p>}>
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
