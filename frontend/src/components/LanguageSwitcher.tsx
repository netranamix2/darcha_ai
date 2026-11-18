import { ChevronDown, Globe2 } from 'lucide-react'
import { isLanguage, languages, localeCodes } from '../i18n/locales'
import { useLanguage } from '../i18n/useLanguage'
import { useT } from '../i18n/useT'
import { Dropdown, DropdownContent, DropdownRadioGroup, DropdownRadioItem, DropdownTrigger } from './ui'

export function LanguageLinks() {
  const { language, setLanguage } = useLanguage()
  const t = useT()

  return (
    <div className="language-links" role="group" aria-label={t('language.label')}>
      {languages.map((option) => (
        <button key={option} type="button" lang={localeCodes[option]} aria-label={t(`language.${option}`)} aria-pressed={option === language} onClick={() => setLanguage(option)}>
          {t(`language.short.${option}`)}
        </button>
      ))}
    </div>
  )
}

export function LanguageSwitcher({ compact = false }: { compact?: boolean }) {
  const { language, setLanguage } = useLanguage()
  const t = useT()

  return (
    <Dropdown>
      <DropdownTrigger asChild>
        <button
          aria-label={`${t('language.label')} · ${t(`language.${language}`)}`}
          className={`language-switch${compact ? ' language-switch--compact' : ''}`}
          type="button"
        >
          <Globe2 aria-hidden="true" size={17} />
          <span lang={localeCodes[language]}>{t(`language.${language}`)}</span>
          <ChevronDown className="language-chevron" aria-hidden="true" size={13} />
        </button>
      </DropdownTrigger>
      <DropdownContent align="end" aria-label={t('language.label')}>
        <DropdownRadioGroup
          value={language}
          onValueChange={(value) => { if (isLanguage(value)) setLanguage(value) }}
        >
          {languages.map((option) => (
            <DropdownRadioItem key={option} value={option} lang={localeCodes[option]}>
              {t(`language.${option}`)}
            </DropdownRadioItem>
          ))}
        </DropdownRadioGroup>
      </DropdownContent>
    </Dropdown>
  )
}
