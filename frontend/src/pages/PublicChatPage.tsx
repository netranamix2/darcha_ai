import { ArrowUp, FileText, Landmark } from 'lucide-react'
import { WindowMark } from '../components/Brand'
import { GlassPanel, IconButton, Input } from '../components/ui'
import { useT } from '../i18n/useT'

export default function PublicChatPage() {
  const t = useT()

  return (
    <div className="chat-page">
      <section className="chat-intro" aria-labelledby="chat-heading">
        <p className="chat-eyebrow"><Landmark size={16} aria-hidden="true" />{t('chat.eyebrow')}</p>
        <h1 id="chat-heading">{t('chat.heading')}</h1>
        <p className="chat-description">{t('chat.description')}</p>
      </section>
      <GlassPanel variant="elevated" className="chat-window">
        <section aria-labelledby="chat-name">
          <header className="chat-window-header">
            <WindowMark />
            <div>
              <h2 id="chat-name">{t('chat.name')}</h2>
              <p>{t('chat.preview')}</p>
            </div>
          </header>
          <div className="chat-thread">
            <p className="chat-question">{t('chat.exampleQuestion')}</p>
            <div className="chat-answer">
              <p>{t('chat.exampleAnswer')}</p>
              <span className="chat-source"><FileText aria-hidden="true" size={15} />{t('chat.source')}</span>
            </div>
          </div>
          <div className="chat-composer">
            <div className="chat-composer-row">
              <Input disabled placeholder={t('chat.placeholder')} aria-label={t('chat.placeholder')} />
              <IconButton variant="secondary" disabled aria-label={t('chat.send')}>
                <ArrowUp aria-hidden="true" size={18} />
              </IconButton>
            </div>
            <p>{t('chat.unavailable')}</p>
          </div>
        </section>
      </GlassPanel>
    </div>
  )
}
