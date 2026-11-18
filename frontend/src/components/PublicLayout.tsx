import { Link } from 'react-router'
import { useT } from '../i18n/useT'
import { AnimatedOutlet } from './AnimatedOutlet'
import { Brand } from './Brand'
import { LanguageSegmented } from './LanguageSwitcher'
import { SkipLink } from './SkipLink'
import { Button } from './ui'

export function PublicLayout() {
  const t = useT()

  return (
    <div className="public-shell">
      <SkipLink />
      <header className="public-header frost">
        <div className="public-header__inner">
          <Brand />
          <div className="public-header__actions">
            <LanguageSegmented />
            <Button asChild variant="secondary" size="sm" className="public-header__staff">
              <Link to="/login">{t('header.staff')}</Link>
            </Button>
          </div>
        </div>
      </header>
      <main className="public-main" id="main-content" tabIndex={-1}>
        <AnimatedOutlet />
      </main>
    </div>
  )
}
