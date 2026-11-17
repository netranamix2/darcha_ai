import { GlassPanel } from '../components/ui'
import { useT } from '../i18n/useT'
import { panelSections } from '../lib/panel-sections'
import type { PanelSectionId } from '../lib/panel-sections'

export default function PanelPage({ sectionId }: { sectionId: PanelSectionId }) {
  const t = useT()
  const section = panelSections.find(({ id }) => id === sectionId) ?? panelSections[0]
  const SectionIcon = section.icon

  return (
    <div className="panel-page">
      <header className="panel-page-heading">
        <p>{t('panel.workspace')}</p>
        <h1>{t(section.label)}</h1>
      </header>
      <GlassPanel className="panel-placeholder">
        <span className="panel-placeholder-icon"><SectionIcon size={25} aria-hidden="true" /></span>
        <h2>{t('panel.unavailable')}</h2>
        <p>{t(section.description)}</p>
      </GlassPanel>
    </div>
  )
}
