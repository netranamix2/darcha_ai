import { createContext } from 'react'
import type { Language } from './locales'

export const LanguageContext = createContext<{
  language: Language
  setLanguage: (language: Language) => void
} | null>(null)
