import { Link } from 'react-router'
import { useT } from '../i18n/useT'
import { AnimatedOutlet } from './AnimatedOutlet'
import { Brand } from './Brand'
import { LanguageLinks } from './LanguageSwitcher'
import { SkipLink } from './SkipLink'

export function PublicLayout() {
  const t = useT()

  return (
    <div className="public-shell">
      <SkipLink />
      <header className="public-header">
        <div className="public-header-inner">
          <Brand />
          <div className="public-actions">
            <LanguageLinks />
            <Link className="staff-link" to="/login">{t('header.staff')}</Link>
          </div>
        </div>
      </header>
      <main className="public-main" id="main-content" tabIndex={-1}>
        <AnimatedOutlet />
      </main>
    </div>
  )
}
