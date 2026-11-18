import { useQuery } from '@tanstack/react-query'
import { getPublicDocuments } from '../../api/client'
import { publicHomeMessages } from '../../i18n/public-home'
import { useLanguage } from '../../i18n/useLanguage'
import { useT } from '../../i18n/useT'
import { Skeleton, StatusDot } from '../ui'

// Official Uzbek documents use dd.mm.yyyy regardless of interface language.
function formatDate(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})/u.exec(value)
  return match ? `${match[3]}.${match[2]}.${match[1]}` : value
}

export function PublicDocuments() {
  const t = useT(publicHomeMessages)
  const { language } = useLanguage()
  const documents = useQuery({
    queryKey: ['public-documents', language],
    queryFn: () => getPublicDocuments(language),
    staleTime: 10 * 60_000,
  })
  const active = documents.data?.filter(({ status }) => status === 'active')

  return (
    <section className="docs" aria-labelledby="docs-title">
      <header className="docs__head">
        <h2 id="docs-title" className="docs__title">{t('docs.title')}</h2>
        <p className="docs__subtitle">{t('docs.subtitle')}</p>
      </header>

      {documents.isError ? (
        <p className="docs__state" role="alert">{t('docs.error')}</p>
      ) : (
        <div className="docs__table" role="table" aria-labelledby="docs-title" aria-busy={documents.isPending}>
          <div className="docs__row docs__row--head" role="row">
            <span role="columnheader">{t('docs.colTitle')}</span>
            <span role="columnheader">{t('docs.colNumber')}</span>
            <span role="columnheader">{t('docs.colDate')}</span>
            <span role="columnheader">{t('docs.colStatus')}</span>
          </div>
          {active ? active.map((document) => (
            <div className="docs__row" role="row" key={document.id}>
              <span role="cell" className="docs__name">
                <a href={document.url} target="_blank" rel="noopener noreferrer" aria-label={`${document.title} — ${t('docs.open')}`}>
                  {document.title}
                </a>
              </span>
              <span role="cell" className="docs__number mono">{document.number}</span>
              <span role="cell" className="docs__date mono">{formatDate(document.adopted_at)}</span>
              <span role="cell"><StatusDot tone="ok">{t('docs.active')}</StatusDot></span>
            </div>
          )) : Array.from({ length: 4 }, (_, index) => (
            <div className="docs__row" role="row" key={index}>
              <span role="cell"><Skeleton className="docs__skeleton" /></span>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
