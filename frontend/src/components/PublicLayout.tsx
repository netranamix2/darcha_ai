import { ArrowUpRight } from 'lucide-react'
import { Link } from 'react-router'
import { useT } from '../i18n/useT'
import { AnimatedOutlet } from './AnimatedOutlet'
import { Brand } from './Brand'
import { LanguageSwitcher } from './LanguageSwitcher'
import { SkipLink } from './SkipLink'

export function PublicLayout() {
  const t = useT()

  return (
    <div className="public-shell">
      <SkipLink />
      <header className="public-header">
        <Brand />
        <div className="public-actions">
          <LanguageSwitcher />
          <Link className="staff-link" to="/login">
            {t('header.staff')} <ArrowUpRight aria-hidden="true" size={16} />
          </Link>
        </div>
      </header>
      <main className="public-main" id="main-content" tabIndex={-1}>
        <AnimatedOutlet />
      </main>
    </div>
  )
}
