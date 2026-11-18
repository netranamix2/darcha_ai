import { useQuery } from '@tanstack/react-query'
import { ChevronDown, Globe2, Inbox, Instagram, Phone, Send } from 'lucide-react'
import { getPublicKnowledgeBase } from '../../api/client'
import { publicHomeMessages } from '../../i18n/public-home'
import { useLanguage } from '../../i18n/useLanguage'
import { useT } from '../../i18n/useT'
import { Button, GlassPanel, Skeleton } from '../ui'
import { PublicSection } from './PublicSection'

const evidence = [
  {
    description: 'public.appeals',
    source: 'public.appealsSource',
    url: 'https://parliament.gov.uz/oz/news/deputatlar-murojaatlar-bilan-ishlashni-yanada-yaxshilash-boyicha-takliflar-berdi',
  },
  { description: 'public.deadline', source: 'public.deadlineSource', url: 'https://lex.uz/uz/docs/-3336169' },
] as const
const steps = ['public.stepQuestion', 'public.stepSearch', 'public.stepAnswer'] as const
const levels = [
  { tone: 'green', title: 'public.instantTitle', body: 'public.instantBody' },
  { tone: 'amber', title: 'public.reviewTitle', body: 'public.reviewBody' },
  { tone: 'red', title: 'public.ticketTitle', body: 'public.ticketBody' },
] as const
const channels = [
  { label: 'public.channelTelegram', Icon: Send },
  { label: 'public.channelWeb', Icon: Globe2 },
  { label: 'public.channelInstagram', Icon: Instagram },
] as const
const questions = [
  { question: 'public.faqOfficial', answer: 'public.faqOfficialAnswer' },
  { question: 'public.faqPrivacy', answer: 'public.faqPrivacyAnswer' },
  { question: 'public.faqWrong', answer: 'public.faqWrongAnswer' },
  { question: 'public.faqTime', answer: 'public.faqTimeAnswer' },
  { question: 'public.faqLanguages', answer: 'public.faqLanguagesAnswer' },
] as const

function PublicDocuments() {
  const t = useT(publicHomeMessages)
  const { language } = useLanguage()
  const documents = useQuery({
    queryKey: ['public-knowledge-base', language],
    queryFn: () => getPublicKnowledgeBase(language),
    staleTime: Infinity,
  })
  const dateFormat = new Intl.DateTimeFormat(language, { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' })

  return (
    <PublicSection id="documents" title={t('public.documentsTitle')}>
      {documents.isPending ? (
        <div className="landing-documents-state" role="status" aria-label={t('common.loading')}>
          <Skeleton /><Skeleton /><Skeleton />
        </div>
      ) : documents.isError ? (
        <div className="landing-documents-state" role="alert">
          <p>{t('public.documentsError')}</p>
          <Button size="sm" variant="secondary" onClick={() => void documents.refetch()}>{t('common.retry')}</Button>
        </div>
      ) : documents.data.length ? (
        <ul className="landing-documents">
          {documents.data.map((document) => (
            <li key={document.url}>
              <a href={document.url}>{document.title}</a>
              <span className="landing-documents-number">№ {document.number}</span>
              <time dateTime={document.date}>{dateFormat.format(new Date(document.date))}</time>
              <span className="landing-active-status">{t('public.documentActive')}</span>
            </li>
          ))}
        </ul>
      ) : <p className="landing-documents-state">{t('public.documentsEmpty')}</p>}
    </PublicSection>
  )
}

export function PublicOverview() {
  const t = useT(publicHomeMessages)
  return (
    <>
      <PublicSection id="problem" title={t('public.problem')}>
        <div className="landing-evidence">
          {evidence.map(({ description, source, url }, index) => (
            <div className="landing-stat" key={source}>
              <p className="landing-stat-value">{index === 0 ? '46\u00a0909' : t('public.deadlineValue')}</p>
              <p>{t(description)}</p>
              <a href={url}>{t(source)}</a>
            </div>
          ))}
        </div>
      </PublicSection>
      <PublicSection id="how-it-works" title={t('public.how')}>
        <ol className="landing-steps">
          {steps.map((label, index) => (
            <li key={label}><span aria-hidden="true">{index + 1}</span><h3>{t(label)}</h3></li>
          ))}
        </ol>
      </PublicSection>
      <PublicSection id="levels" title={t('public.levels')}>
        <div className="landing-levels">
          {levels.map(({ tone, title, body }) => (
            <GlassPanel key={tone} variant="subtle" blur={false} className="landing-level" data-tone={tone}>
              <h3>{t(title)}</h3>
              <p>{t(body)}</p>
            </GlassPanel>
          ))}
        </div>
      </PublicSection>
      <PublicSection id="channels" title={t('public.channelsTitle')}>
        <div className="landing-channel-diagram">
          <ul className="landing-channel-inputs">
            {channels.map(({ label, Icon }) => <li key={label}><Icon size={16} aria-hidden="true" />{t(label)}</li>)}
          </ul>
          <span className="landing-channel-join" aria-hidden="true" />
          <GlassPanel variant="subtle" blur={false} className="landing-channel-inbox">
            <Inbox size={24} aria-hidden="true" />
            <h3>{t('public.channelInbox')}</h3>
          </GlassPanel>
        </div>
      </PublicSection>
      <PublicDocuments />
    </>
  )
}

export function PublicFaq() {
  const t = useT(publicHomeMessages)
  return (
    <PublicSection id="faq" title={t('public.faq')}>
      <div className="landing-faq">
        {questions.map(({ question, answer }) => (
          <details key={question} name="darcha-landing-faq">
            <summary>{t(question)} <ChevronDown size={18} aria-hidden="true" /></summary>
            <p>{t(answer)}</p>
          </details>
        ))}
      </div>
    </PublicSection>
  )
}

export function PublicFooter({ botUrl }: { botUrl: string | null }) {
  const t = useT(publicHomeMessages)
  return (
    <footer className="public-footer">
      <div className="public-footer-links">
        <a href="tel:1006"><Phone size={16} aria-hidden="true" /> {t('public.hotline')} <strong>1006</strong></a>
        {botUrl && <a href={botUrl}><Send size={16} aria-hidden="true" /> {t('public.telegram')}</a>}
      </div>
      <p>{t('public.disclaimer')}</p>
    </footer>
  )
}
