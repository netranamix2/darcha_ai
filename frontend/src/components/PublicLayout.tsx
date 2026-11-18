import { Instagram, Send } from 'lucide-react'
import { Link, useLocation } from 'react-router'
import { useT } from '../i18n/useT'
import { instagramDemoPath, telegramBotUrl } from '../lib/channels'
import { AnimatedOutlet } from './AnimatedOutlet'
import { Brand } from './Brand'
import { LanguageSwitcher } from './LanguageSwitcher'
import { SkipLink } from './SkipLink'
import './public/public-header.css'

const landingLinks = [
  { id: 'how-it-works', label: 'public.how' },
  { id: 'channels', label: 'public.channels' },
  { id: 'documents', label: 'public.documents' },
  { id: 'chat', label: 'public.ask' },
] as const

export function PublicLayout() {
  const t = useT()
  const onLanding = useLocation().pathname === '/'
  return (
    <div className="public-shell">
      <SkipLink />
      <header className={onLanding ? 'public-header public-header--landing' : 'public-header'}>
        <Brand />
        {onLanding && (
          <nav className="public-anchor-nav" aria-label={t('public.nav')}>
            {landingLinks.map(({ id, label }) => <a href={'#' + id} key={id}>{t(label)}</a>)}
          </nav>
        )}
        <div className="public-actions">
          <div className="public-channel-icons">
            {telegramBotUrl && (
              <a className="public-channel-icon" href={telegramBotUrl} target="_blank" rel="noopener noreferrer"
                aria-label={t('header.telegram')} title={t('header.telegram')}>
                <Send size={17} aria-hidden="true" />
              </a>
            )}
            <Link className="public-channel-icon" to={instagramDemoPath} aria-label={t('header.instagram')} title={t('header.instagram')}>
              <Instagram size={17} aria-hidden="true" />
            </Link>
          </div>
          <LanguageSwitcher />
          <Link className="staff-link" to="/login">{t('header.staff')}</Link>
        </div>
      </header>
      <main className="public-main" id="main-content" tabIndex={-1}>
        <AnimatedOutlet />
      </main>
    </div>
  )
}
