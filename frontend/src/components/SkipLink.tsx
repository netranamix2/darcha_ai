import { useT } from '../i18n/useT'

export function SkipLink() {
  const t = useT()
  return <a className="skip-link" href="#main-content">{t('common.skip')}</a>
}
