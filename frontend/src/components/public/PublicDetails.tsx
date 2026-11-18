import { Phone, QrCode } from 'lucide-react'
import { motion, useReducedMotion } from 'motion/react'
import { publicHomeMessages } from '../../i18n/public-home'
import { useT } from '../../i18n/useT'
import { LanguageSwitcher } from '../LanguageSwitcher'
import { GlassPanel } from '../ui/glass-panel'

const ministryCards = [
  { title: 'public.sourceTitle', body: 'public.sourceBody' },
  { title: 'public.reviewTitle', body: 'public.reviewBody' },
  { title: 'public.channelsTitle', body: 'public.channelsBody' },
] as const

export default function PublicDetails() {
  const reducedMotion = useReducedMotion()
  const t = useT(publicHomeMessages)

  return (
    <>
      <section className="ministry-section" aria-labelledby="ministry-title">
        <h2 id="ministry-title">{t('public.how')}</h2>
        <div className="ministry-cards">
          {ministryCards.map(({ title, body }, index) => (
            <motion.article
              key={title}
              initial={reducedMotion ? false : { opacity: 0, y: 5 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.25 }}
              transition={{ duration: reducedMotion ? 0 : 0.2, delay: reducedMotion ? 0 : index * 0.04, ease: 'easeOut' }}
            >
              <GlassPanel variant="subtle" className="ministry-card">
                <h3>{t(title)}</h3>
                <p>{t(body)}</p>
              </GlassPanel>
            </motion.article>
          ))}
        </div>
      </section>
      <footer className="public-footer">
        <div className="public-qr">
          <span className="public-qr-icon"><QrCode aria-hidden="true" size={25} /></span>
          <div>
            <p>{t('public.telegram')}</p>
            <small>{t('public.qrPending')}</small>
          </div>
        </div>
        <a className="public-hotline" href="tel:1006">
          <Phone aria-hidden="true" size={16} />
          <span>{t('public.hotline')} <strong>1006</strong></span>
        </a>
        <p className="public-disclaimer">{t('public.disclaimer')}</p>
        <LanguageSwitcher />
      </footer>
    </>
  )
}
