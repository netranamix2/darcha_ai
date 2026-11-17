import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { LanguageContext } from './language-context'
import { isLanguage, localeCodes } from './locales'
import type { Language } from './locales'

const storageKey = 'darcha.language'

function getInitialLanguage(): Language {
  try {
    const stored = localStorage.getItem(storageKey)
    if (isLanguage(stored)) return stored
  } catch {
    // The language remains selectable when browser storage is unavailable.
  }
  return 'uz-latn'
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState<Language>(getInitialLanguage)

  useEffect(() => {
    document.documentElement.lang = localeCodes[language]
    try {
      localStorage.setItem(storageKey, language)
    } catch {
      // The selected language remains active for this page.
    }
  }, [language])

  return (
    <LanguageContext.Provider value={{ language, setLanguage }}>
      {children}
    </LanguageContext.Provider>
  )
}
