import { ArrowLeft } from 'lucide-react'
import { Link } from 'react-router'
import { WindowMark } from '../components/Brand'
import { GlassPanel } from '../components/ui'
import { useT } from '../i18n/useT'

export default function NotFoundPage() {
  const t = useT()

  return (
    <div className="login-page">
      <GlassPanel variant="elevated" className="login-card">
        <div className="not-found-marker"><WindowMark /><span aria-hidden="true">404</span></div>
        <h1>{t('missing.heading')}</h1>
        <p>{t('missing.description')}</p>
        <Link to="/" className="staff-link missing-link">
          <ArrowLeft aria-hidden="true" size={16} /> {t('common.home')}
        </Link>
      </GlassPanel>
    </div>
  )
}
