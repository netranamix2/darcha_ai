import { Link } from 'react-router'
import { useT } from '../i18n/useT'
import { cn } from '../lib/cn'

const panes = [
  { x: 4.75, y: 4.75 },
  { x: 13.25, y: 4.75 },
  { x: 13.25, y: 13.25 },
  { x: 4.75, y: 13.25 },
] as const

/**
 * Darcha window mark: a square window with 2×2 panes, one pane lit in accent blue.
 * `thinking` lights the panes in sequence — the only looping animation in the product.
 */
export function WindowMark({ size = 22, thinking = false, className }: { size?: number; thinking?: boolean; className?: string }) {
  return (
    <svg
      className={cn('window-mark', className)}
      data-thinking={thinking || undefined}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <rect x="2.75" y="2.75" width="18.5" height="18.5" rx="5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M12 3.5v17M3.5 12h17" stroke="currentColor" strokeWidth="1.5" />
      {panes.map(({ x, y }, index) => (
        <rect key={index} className="window-mark__pane" x={x} y={y} width="6" height="6" rx="1.5" />
      ))}
    </svg>
  )
}

export function Brand({ compact = false }: { compact?: boolean }) {
  const t = useT()
  return (
    <Link className="brand" to="/" aria-label={t('brand.name')}>
      <WindowMark />
      {compact ? null : <span className="brand__word">{t('brand.name')}</span>}
    </Link>
  )
}
