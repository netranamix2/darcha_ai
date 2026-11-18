import type { Language } from './locales'

const latin = {
  'public.ministry': 'Taʼlim va ilm-fan vazirligi uchun',
  'public.heading': 'Savolingizga hujjat asosida javob',
  'public.description': 'Taʼlim boʻyicha javoblar rasmiy manbalar bilan.',
  'public.regulations': 'Darcha qaysi hujjatlarga tayanadi',
  'public.regulationsEmpty': 'Hozircha koʻrsatish uchun hujjatlar yoʻq.',
  'public.active': 'amalda',
  'public.telegram': 'Vazirlikning Telegram boti',
  'public.hotline': 'Ishonch telefoni',
  'public.disclaimer': 'Darcha maʼlumot beradi. Rasmiy talqin uchun hujjatning asl matniga murojaat qiling.',
} as const

type PublicDictionary = Record<keyof typeof latin, string>

export const publicHomeMessages = {
  'uz-latn': latin,
  'uz-cyrl': {
    'public.ministry': 'Таълим ва илм-фан вазирлиги учун',
    'public.heading': 'Саволингизга ҳужжат асосида жавоб',
    'public.description': 'Таълим бўйича жавоблар расмий манбалар билан.',
    'public.regulations': 'Дарча қайси ҳужжатларга таянади',
    'public.regulationsEmpty': 'Ҳозирча кўрсатиш учун ҳужжатлар йўқ.',
    'public.active': 'амалда',
    'public.telegram': 'Вазирликнинг Telegram боти',
    'public.hotline': 'Ишонч телефони',
    'public.disclaimer': 'Дарча маълумот беради. Расмий талқин учун ҳужжатнинг асл матнига мурожаат қилинг.',
  },
  ru: {
    'public.ministry': 'Для Министерства образования и науки',
    'public.heading': 'Ответ на ваш вопрос по документам',
    'public.description': 'Ответы об образовании со ссылками на официальные источники.',
    'public.regulations': 'На какие документы опирается Darcha',
    'public.regulationsEmpty': 'Документы пока не опубликованы.',
    'public.active': 'действует',
    'public.telegram': 'Бот министерства в Telegram',
    'public.hotline': 'Телефон доверия',
    'public.disclaimer': 'Ответы Darcha носят справочный характер. За официальной формулировкой обращайтесь к тексту документа.',
  },
} satisfies Record<Language, PublicDictionary>
