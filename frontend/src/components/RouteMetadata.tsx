import { useEffect } from 'react'
import { useLocation } from 'react-router'
import type { TranslationKey } from '../i18n/messages'
import { useT } from '../i18n/useT'

const labels: Readonly<Record<string, TranslationKey>> = {
  '/': 'meta.chat',
  '/login': 'login.heading',
  '/panel': 'meta.panel',
  '/panel/inbox': 'panel.inbox',
  '/panel/tickets': 'panel.tickets',
  '/panel/analytics': 'panel.analytics',
  '/panel/documents': 'panel.documents',
  '/ui': 'meta.ui',
}

export function RouteMetadata() {
  const t = useT()
  const { pathname } = useLocation()
  const path = pathname.toLowerCase().replace(/\/+$/u, '') || '/'
  const page = path === '/demo/instagram' ? 'Instagram sandbox' : t(labels[path] ?? 'missing.heading')
  const title = `${t('brand.name')} · ${page}`
  const description = t('meta.description')

  useEffect(() => {
    document.title = title
    document.querySelector('meta[name="description"]')?.setAttribute('content', description)
  }, [description, title])

  return null
}
