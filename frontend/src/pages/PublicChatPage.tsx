import { useInView } from 'motion/react'
import { Fragment, lazy, Suspense, useEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import PublicChat from '../components/chat/PublicChat'
import { ViewportCounter } from '../components/ui'
import { localeCodes } from '../i18n/locales'
import { publicHomeMessages } from '../i18n/public-home'
import { useLanguage } from '../i18n/useLanguage'
import { useT } from '../i18n/useT'
import './public-home.css'

const PublicDetails = lazy(() => import('../components/public/PublicDetails'))
const introStorageKey = 'darcha.home-intro'
let introShownInDocument = false

const trustItems = ['public.trustSources', 'public.trustAvailability', 'public.trustLanguages', 'public.trustReview'] as const

const steps = ['public.stepQuestion', 'public.stepSearch', 'public.stepAnswer'] as const

function shouldShowIntro() {
  if (introShownInDocument) return false
  try {
    return sessionStorage.getItem(introStorageKey) === null
  } catch {
    return true
  }
}

function HeadlineWords({ words, offset = 0 }: { words: string[]; offset?: number }) {
  return words.map((word, index) => (
    <Fragment key={index}>
      {index > 0 && ' '}
      <span className="public-headline-word" style={{ '--word-index': offset + index } as CSSProperties}>
        {word}
      </span>
    </Fragment>
  ))
}

function DeferredDetails() {
  const slot = useRef<HTMLDivElement>(null)
  const isNear = useInView(slot, { once: true, margin: '0px 0px 240px 0px' })

  return (
    <div className="public-details-slot" ref={slot}>
      {isNear && (
        <Suspense fallback={null}>
          <PublicDetails />
        </Suspense>
      )}
    </div>
  )
}

export default function PublicChatPage() {
  const [showIntro] = useState(shouldShowIntro)
  const t = useT(publicHomeMessages)
  const { language } = useLanguage()
  const lead = t('public.heroLead')
  const accent = t('public.heroAccent')
  const leadWords = lead.match(/\S+(?:\s+—)?/gu) ?? [lead]
  const accentWords = accent.split(' ')

  useEffect(() => {
    if (!showIntro) return
    introShownInDocument = true
    try {
      sessionStorage.setItem(introStorageKey, 'shown')
    } catch {
      // The document flag covers in-app navigation when storage is unavailable.
    }
  }, [showIntro])

  return (
    <div className="public-home" data-intro={showIntro ? '' : undefined}>
      <div className="public-hero">
        <section className="public-hero-intro" aria-labelledby="public-hero-heading">
          <h1 id="public-hero-heading" className="public-headline" aria-label={`${lead} ${accent}`}>
            <span aria-hidden="true"><HeadlineWords words={leadWords} /></span>
            <span className="public-headline-accent" aria-hidden="true">
              <HeadlineWords words={accentWords} offset={leadWords.length} />
            </span>
          </h1>
          <p className="public-hero-description">{t('public.heroDescription')}</p>
          <ul className="public-trust">
            {trustItems.map((label) => <li key={label}>{t(label)}</li>)}
          </ul>
          <ol className="public-steps" aria-label={t('public.how')}>
            {steps.map((label) => <li key={label}>{t(label)}</li>)}
          </ol>
          <div className="public-stat">
            <p>
              {t('public.today')}{' '}
              <ViewportCounter value={1284} locale={localeCodes[language]} className="public-stat-value" />
            </p>
            <small>{t('public.todayDemo')}</small>
          </div>
        </section>
        <div className="public-chat-slot">
          <PublicChat />
        </div>
      </div>
      <DeferredDetails />
    </div>
  )
}
