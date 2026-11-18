import { ChevronDown, Globe2 } from 'lucide-react'
import { motion } from 'motion/react'
import { useId } from 'react'
import { isLanguage, languages, localeCodes } from '../i18n/locales'
import { useLanguage } from '../i18n/useLanguage'
import { useT } from '../i18n/useT'
import { Dropdown, DropdownContent, DropdownRadioGroup, DropdownRadioItem, DropdownTrigger } from './ui'

/** Compact segmented control: Oʻz / Ўз / Ру. */
export function LanguageSegmented() {
  const { language, setLanguage } = useLanguage()
  const t = useT()
  const group = useId()

  return (
    <div className="lang-segmented" role="radiogroup" aria-label={t('language.label')}>
      {languages.map((option) => {
        const active = option === language
        return (
          <button
            key={option}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={t(`language.${option}`)}
            lang={localeCodes[option]}
            className="lang-segmented__option"
            onClick={() => setLanguage(option)}
            onKeyDown={(event) => {
              if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return
              event.preventDefault()
              const step = event.key === 'ArrowRight' ? 1 : -1
              const next = languages[(languages.indexOf(language) + step + languages.length) % languages.length]
              setLanguage(next)
              const siblings = event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('button')
              siblings?.[languages.indexOf(next)]?.focus()
            }}
            tabIndex={active ? 0 : -1}
          >
            {active && (
              <motion.span
                className="lang-segmented__thumb"
                layoutId={group + 'thumb'}
                transition={{ type: 'spring', visualDuration: 0.25, bounce: 0.1 }}
              />
            )}
            <span className="lang-segmented__label">{t(`language.short.${option}`)}</span>
          </button>
        )
      })}
    </div>
  )
}

/** Dropdown variant, used by the staff panel. */
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
          <Globe2 aria-hidden="true" size={16} />
          <span lang={localeCodes[language]}>{t(`language.${language}`)}</span>
          <ChevronDown className="language-chevron" aria-hidden="true" size={13} />
        </button>
      </DropdownTrigger>
      <DropdownContent align="end" aria-label={t('language.label')}>
        <DropdownRadioGroup value={language} onValueChange={(value) => { if (isLanguage(value)) setLanguage(value) }}>
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
