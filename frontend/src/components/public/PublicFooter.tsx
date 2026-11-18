import { publicHomeMessages } from '../../i18n/public-home'
import { useT } from '../../i18n/useT'
import { Brand } from '../Brand'

// Set VITE_TELEGRAM_BOT_URL once the official bot is published.
const telegramUrl = (import.meta.env.VITE_TELEGRAM_BOT_URL ?? '').trim()

export function PublicFooter() {
  const t = useT(publicHomeMessages)

  return (
    <footer className="footer">
      <div className="footer__top">
        <Brand />
        <ul className="footer__links">
          <li>
            <a href="tel:1006" className="footer__link">
              {t('footer.hotline')} <span className="mono footer__phone">1006</span>
            </a>
          </li>
          <li>
            {telegramUrl ? (
              <a href={telegramUrl} className="footer__link" target="_blank" rel="noopener noreferrer">{t('footer.telegram')}</a>
            ) : (
              <span className="footer__muted">{t('footer.telegram')} · {t('footer.soon')}</span>
            )}
          </li>
        </ul>
      </div>
      <p className="footer__disclaimer">{t('footer.disclaimer')}</p>
    </footer>
  )
}
