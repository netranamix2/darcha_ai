import { useQuery } from '@tanstack/react-query'
import { Navigate, useOutletContext } from 'react-router'
import { getKnowledgeBase } from '../api/client'
import { PanelCitations } from '../components/PanelCitations'
import type { PanelContext } from '../components/PanelLayout'
import { Button, GlassPanel, Skeleton } from '../components/ui'
import { panelSimpleMessages } from '../i18n/panel-simple'
import { useT } from '../i18n/useT'
import { staffLanding } from '../lib/staff-landing'

export default function KnowledgeBasePage() {
  const { role } = useOutletContext<PanelContext>()
  const t = useT(panelSimpleMessages)
  const documents = useQuery({
    queryKey: ['knowledge-base'],
    queryFn: getKnowledgeBase,
    enabled: role === 'manager',
    retry: false,
  })
  if (role !== 'manager') return <Navigate replace to={staffLanding(role)} />

  return (
    <section className="simple-panel-page" aria-labelledby="documents-title">
      <header className="simple-panel-heading">
        <h1 id="documents-title">{t('panel.documents')}</h1>
        <p>{t('simple.docsIntro')}</p>
      </header>
      <GlassPanel variant="subtle" blur={false}>
        {documents.isPending ? (
          <div className="simple-panel-state" role="status" aria-label={t('common.loading')}><Skeleton /></div>
        ) : documents.isError ? (
          <div className="simple-panel-state" role="alert">
            <p>{t('simple.docsError')}</p>
            <Button variant="secondary" onClick={() => void documents.refetch()}>{t('simple.retry')}</Button>
          </div>
        ) : documents.data.length > 0 ? <PanelCitations citations={documents.data} /> : (
          <div className="simple-panel-state"><p>{t('simple.docsEmpty')}</p></div>
        )}
      </GlassPanel>
    </section>
  )
}
