import { messages } from './messages'
import type { TranslationKey } from './messages'
import type { Language } from './locales'
import { useLanguage } from './useLanguage'

type Dictionary<Key extends string> = Record<Language, Record<Key, string>>

export function useT(): (key: TranslationKey) => string
export function useT<Key extends string>(dictionary: Dictionary<Key>): (key: TranslationKey | Key) => string
export function useT(dictionary?: Dictionary<string>) {
  const { language } = useLanguage()
  const local = dictionary?.[language]
  const shared = messages[language]
  return (key: string) => local?.[key] ?? shared[key as TranslationKey]
}
