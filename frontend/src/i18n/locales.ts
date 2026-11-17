export const languages = ['uz-latn', 'uz-cyrl', 'ru'] as const
export type Language = (typeof languages)[number]

export const localeCodes: Record<Language, string> = {
  'uz-latn': 'uz-Latn',
  'uz-cyrl': 'uz-Cyrl',
  ru: 'ru',
}

export function isLanguage(value: string | null): value is Language {
  return languages.some((language) => language === value)
}
