import { Link } from 'react-router'
import { useT } from '../i18n/useT'

export function WindowMark({ thinking = false }: { thinking?: boolean }) {
  return (
    <svg className="window-mark" data-thinking={thinking || undefined} viewBox="0 0 32 32" aria-hidden="true" fill="none">
      <path d="M2 2h28v28H2zM16 2v28M2 16h28" stroke="currentColor" strokeWidth="1.15" />
      <g className="window-panes" fill="var(--color-primary)">
        <path d="M5 5h8v8H5z" />
        <path d="M19 5h8v8h-8z" />
        <path d="M19 19h8v8h-8z" />
        <path d="M5 19h8v8H5z" />
      </g>
      <path d="m16 10 1.6 4.4L22 16l-4.4 1.6L16 22l-1.6-4.4L10 16l4.4-1.6Z" fill="var(--color-base)" stroke="currentColor" strokeWidth="1.05" />
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
