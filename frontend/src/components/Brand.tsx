import { Link } from 'react-router'
import { useT } from '../i18n/useT'

export function WindowMark({ className }: { className?: string }) {
  return (
    <svg className={className ? "window-mark " + className : "window-mark"} viewBox="0 0 24 24" width="32" height="32" fill="none" aria-hidden="true" focusable="false">
      <path fill="var(--color-primary)" d="M12 2.5c4.9 2 8 5 8 8.5v1.5h-8Z" />
      <path stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" d="M4 21.5V11c0-3.5 3.1-6.5 8-8.5 4.9 2 8 5 8 8.5v10.5H4ZM12 2.5v19M4 12.5h16" />
    </svg>
  )
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
