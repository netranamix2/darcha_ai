import { useContext } from 'react'
import { LanguageContext } from './language-context'

export function useLanguage() {
  const value = useContext(LanguageContext)
  if (!value) throw new Error('LanguageProvider is required')
  return value
}
