import { caseTopicNames } from '../i18n/case-topics'
import { chatMessages } from '../i18n/chat'
import { languages } from '../i18n/locales'
import type { Language } from '../i18n/locales'

const regionKeys = [
  'conversation.regionAndijan', 'conversation.regionBukhara', 'conversation.regionFergana', 'conversation.regionJizzakh',
  'conversation.regionKarakalpakstan', 'conversation.regionKashkadarya', 'conversation.regionKhorezm', 'conversation.regionNamangan',
  'conversation.regionNavoi', 'conversation.regionSamarkand', 'conversation.regionSirdarya', 'conversation.regionSurkhandarya',
  'conversation.regionTashkent', 'conversation.regionTashkentCity',
] as const

function normalizeLabel(value: string) {
  return value.trim().toLowerCase().replace(/[ʻʼ’‘`]/gu, "'")
}

const topicsByLabel = new Map(
  Object.entries(caseTopicNames).flatMap(([latin, [cyrillic, russian]]) => {
    const translations: Record<Language, string> = { 'uz-latn': latin, 'uz-cyrl': cyrillic, ru: russian }
    return Object.values(translations).map((label) => [normalizeLabel(label), translations] as const)
  }),
)
const regionsByLabel = new Map(
  regionKeys.flatMap((key) => languages.map((language) => [normalizeLabel(chatMessages[language][key]), key] as const)),
)

export function localizeCaseTopic(name: string, language: Language) {
  return topicsByLabel.get(normalizeLabel(name))?.[language] ?? name
}

export function localizeCaseRegion(name: string, language: Language) {
  const key = regionsByLabel.get(normalizeLabel(name))
  return key ? chatMessages[language][key] : name
}
