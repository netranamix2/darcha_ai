import { useInView } from 'motion/react'
import { lazy, Suspense, useRef } from 'react'
import PublicChat from '../components/chat/PublicChat'
import { useT } from '../i18n/useT'
import './public-home.css'

const PublicDetails = lazy(() => import('../components/public/PublicDetails'))

function DeferredDetails() {
  const slot = useRef<HTMLDivElement>(null)
  const isNear = useInView(slot, { once: true, margin: '0px 0px 240px 0px' })
  const t = useT()

  return (
    <div className="public-details-slot" ref={slot}>
      {isNear && (
        <Suspense fallback={<p className="regulations-state" role="status">{t('common.loading')}</p>}>
          <PublicDetails />
        </Suspense>
      )}
    </div>
  )
}

export default function PublicChatPage() {
  return (
    <div className="public-home">
      <PublicChat />
      <DeferredDetails />
    </div>
  )
}
