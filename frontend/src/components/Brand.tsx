import { Link } from 'react-router'
import { useT } from '../i18n/useT'

export function WindowMark() {
  return <span className="window-mark" aria-hidden="true"><span /></span>
}

export function Brand({ compact = false }: { compact?: boolean }) {
  const t = useT()
  return (
    <Link className="brand" to="/" aria-label={t('brand.name')}>
      <WindowMark />
      {compact ? null : <span>{t('brand.name')}</span>}
    </Link>
  )
}
