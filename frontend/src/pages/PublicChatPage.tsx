import { useEffect } from 'react'
import { useLocation } from 'react-router'
import PublicChat from '../components/chat/PublicChat'
import { PublicOverview, PublicFaq, PublicFooter } from '../components/public/PublicDetails'
import { PublicSection } from '../components/public/PublicSection'
import { Button, GlassPanel } from '../components/ui'
import { publicHomeMessages } from '../i18n/public-home'
import { useT } from '../i18n/useT'
import './public-home.css'

const trustItems = ['public.trustSources', 'public.trustAvailability', 'public.trustLanguages', 'public.trustReview'] as const
const sectionIds = ['how-it-works', 'channels', 'documents', 'chat']

function telegramUrl() {
  const value: unknown = import.meta.env.VITE_TG_BOT_URL
  if (typeof value !== 'string' || !value.trim()) return null
  try {
    const url = new URL(value.trim())
    return url.protocol === 'https:' && !url.username && !url.password ? url.href : null
  } catch {
    return null
  }
}

const botUrl = telegramUrl()

export default function PublicChatPage() {
  const t = useT(publicHomeMessages)
  const { hash } = useLocation()

  useEffect(() => {
    const target = hash.slice(1)
    if (sectionIds.includes(target)) document.getElementById(target)?.scrollIntoView()
  }, [hash])

  return (
    <div className="public-home">
      <section className="public-hero" aria-labelledby="public-hero-heading">
        <div className="public-hero-intro">
          <h1 id="public-hero-heading" className="public-headline">
            {t('public.heroLead')}{' '}
            <span>{t('public.heroAccent')}</span>
          </h1>
          <p className="public-hero-description">{t('public.heroDescription')}</p>
          <div className="public-hero-actions">
            <Button asChild size="lg"><a href="#chat">{t('public.ask')}</a></Button>
            {botUrl && <Button asChild size="lg" variant="secondary"><a href={botUrl}>{t('public.telegram')}</a></Button>}
          </div>
          <ul className="public-trust">
            {trustItems.map((label) => <li key={label}>{t(label)}</li>)}
          </ul>
        </div>
        <GlassPanel className="public-answer-example" variant="subtle" blur={false}>
          <figure>
            <figcaption>{t('public.sampleLabel')}</figcaption>
            <p className="public-example-question">{t('public.sampleQuestion')}</p>
            <p className="public-example-answer">{t('public.sampleAnswer')} <sup>[1]</sup></p>
            <p className="public-example-source">{t('public.sampleSource')}</p>
          </figure>
        </GlassPanel>
      </section>
      <PublicOverview />
      <PublicSection id="chat" title={t('public.chatTitle')} className="landing-chat">
        <PublicChat />
      </PublicSection>
      <PublicFaq />
      <PublicFooter botUrl={botUrl} />
    </div>
  )
}
