import { messages } from './messages'
import type { TranslationKey } from './messages'
import { useLanguage } from './useLanguage'

export function useT() {
  const { language } = useLanguage()
  return (key: TranslationKey) => messages[language][key]
}
