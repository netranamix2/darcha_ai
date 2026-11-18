import { useEffect, type MouseEvent } from 'react'
import { useReducedMotion } from 'motion/react'
import { Instagram, Send } from 'lucide-react'
import { Link, useLocation } from 'react-router'
import PublicChat from '../components/chat/PublicChat'
import { PublicOverview, PublicFaq, PublicFooter } from '../components/public/PublicDetails'
import { PublicSection } from '../components/public/PublicSection'
import { Button, GlassPanel } from '../components/ui'
import { publicHomeMessages } from '../i18n/public-home'
import { instagramDemoPath, scrollToChat, telegramBotUrl } from '../lib/channels'
import { useT } from '../i18n/useT'
import './public-home.css'

const trustItems = ['public.trustSources', 'public.trustAvailability', 'public.trustLanguages', 'public.trustReview'] as const
const sectionIds = ['how-it-works', 'channels', 'documents', 'chat']

const botUrl = telegramBotUrl

export default function PublicChatPage() {
  const t = useT(publicHomeMessages)
  const { hash } = useLocation()
  const reducedMotion = useReducedMotion()

  function goToChat(event: MouseEvent<HTMLAnchorElement>) {
    if (scrollToChat(reducedMotion)) event.preventDefault()
  }

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
            <Button asChild size="lg"><a href="#chat" onClick={goToChat}>{t('public.ask')}</a></Button>
            {botUrl && (
              <Button asChild size="lg" variant="secondary">
                <a href={botUrl} target="_blank" rel="noopener noreferrer"><Send size={18} aria-hidden="true" />{t('public.heroTelegram')}</a>
              </Button>
            )}
            <Button asChild size="lg" variant="secondary">
              <Link to={instagramDemoPath}><Instagram size={18} aria-hidden="true" />{t('public.heroInstagram')}</Link>
            </Button>
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
      <PublicOverview afterHow={(
        <PublicSection id="chat" title={t('public.chatTitle')} className="landing-chat">
          <div className="chat-window">
            <PublicChat />
          </div>
        </PublicSection>
      )} />
      <PublicFaq />
      <PublicFooter botUrl={botUrl} />
    </div>
  )
}
