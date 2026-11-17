import { Search } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { useT } from '../i18n/useT'
import { panelSections } from '../lib/panel-sections'
import { Input } from './ui'

export function PanelSearch() {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const t = useT()
  const navigate = useNavigate()
  const searchTerm = query.trim().toLocaleLowerCase()
  const sections = panelSections.filter(({ label }) => t(label).toLocaleLowerCase().includes(searchTerm))

  function closeResults() {
    setQuery('')
    setOpen(false)
  }

  return (
    <form
      className="panel-search"
      role="search"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false)
      }}
      onKeyDown={(event) => {
        if (event.key === 'Escape') setOpen(false)
      }}
      onSubmit={(event) => {
        event.preventDefault()
        const match = sections[0]
        if (!searchTerm || !match) return
        void navigate(`/panel/${match.id}`)
        closeResults()
      }}
    >
      <Input
        containerClassName="panel-search-field"
        startIcon={<Search aria-hidden="true" />}
        aria-label={t('panel.search')}
        placeholder={t('panel.search')}
        type="search"
        value={query}
        onFocus={() => setOpen(true)}
        onChange={(event) => {
          setQuery(event.currentTarget.value)
          setOpen(true)
        }}
      />
      {open && searchTerm && (
        <div className="panel-search-results">
          {sections.length ? (
            <ul>
              {sections.map(({ id, label, icon: SectionIcon }) => (
                <li key={id}>
                  <Link to={`/panel/${id}`} onClick={closeResults}>
                    <SectionIcon size={16} aria-hidden="true" />
                    {t(label)}
                  </Link>
                </li>
              ))}
            </ul>
          ) : <p role="status">{t('panel.searchEmpty')}</p>}
        </div>
      )}
    </form>
  )
}
