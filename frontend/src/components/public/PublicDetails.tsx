import { useQuery } from '@tanstack/react-query'
import { getPublicRegulations } from '../../api/client'
import { publicHomeMessages } from '../../i18n/public-home'
import { useLanguage } from '../../i18n/useLanguage'
import { useT } from '../../i18n/useT'
import { Skeleton } from '../ui'

const ministryBot = 'https://t.me/eduuzuniversalbot'

function documentDate(value: string | undefined) {
  if (!value) return ''
  const [year, month, day] = value.split('-')
  return [day, month, year].filter(Boolean).join('.')
}

export default function PublicDetails() {
  const t = useT(publicHomeMessages)
  const { language } = useLanguage()
  const { data = [], isPending, isError, refetch } = useQuery({
    queryKey: ['public-regulations', language],
    queryFn: () => getPublicRegulations(language),
    staleTime: 15 * 60_000,
  })

  return (
    <>
      <section className="public-regulations" aria-labelledby="regulations-title">
        <h2 id="regulations-title">{t('public.regulations')}</h2>
        {isPending ? (
          <div className="regulations-loading" role="status" aria-label={t('common.loading')}>
            <Skeleton className="regulations-skeleton" />
            <Skeleton className="regulations-skeleton" />
          </div>
        ) : isError ? (
          <div className="regulations-state">
            <p role="alert">{t('common.loadError')}</p>
            <button type="button" className="public-inline-action" onClick={() => { void refetch() }}>{t('common.retry')}</button>
          </div>
        ) : data.length ? (
          <ul className="regulations-list">
            {data.map((document) => (
              <li className="regulations-entry" key={document.url}>
                <a href={document.url} target="_blank" rel="noopener noreferrer">{document.title}</a>
                <p className="regulations-meta">
                  <span>{document.document_number ? `№ ${document.document_number}` : document.ref}</span>
                  {document.document_date && <time dateTime={document.document_date}>{documentDate(document.document_date)}</time>}
                  <span className="regulations-active">{t('public.active')}</span>
                </p>
              </li>
            ))}
          </ul>
        ) : <p className="regulations-state">{t('public.regulationsEmpty')}</p>}
      </section>
      <footer className="public-footer">
        <div className="public-support">
          <a href="tel:1006">{t('public.hotline')} <span>1006</span></a>
          <a href={ministryBot} target="_blank" rel="noopener noreferrer">{t('public.telegram')}</a>
        </div>
        <p>{t('public.disclaimer')}</p>
      </footer>
    </>
  )
}
