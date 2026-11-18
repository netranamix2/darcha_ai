import { Search } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { useT } from '../i18n/useT'
import { panelSections } from '../lib/panel-sections'
import { Input } from './ui'

export function PanelSearch() {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const input = useRef<HTMLInputElement>(null)
  const t = useT()
  const navigate = useNavigate()
  const searchTerm = query.trim().toLocaleLowerCase()
  const sections = panelSections.filter(({ label }) => t(label).toLocaleLowerCase().includes(searchTerm))

  useEffect(() => {
    function focusSearch(event: KeyboardEvent) {
      if ((!event.metaKey && !event.ctrlKey) || event.key.toLowerCase() !== 'k') return
      event.preventDefault()
      input.current?.focus()
      input.current?.select()
    }
    window.addEventListener('keydown', focusSearch)
    return () => window.removeEventListener('keydown', focusSearch)
  }, [])

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
        ref={input}
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
      {!query && <kbd className="panel-search-shortcut" aria-hidden="true">⌘K</kbd>}
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
