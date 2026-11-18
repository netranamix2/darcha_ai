import type { Language } from './locales'

const latin = {
  'conversation.region': 'Hududingiz (ixtiyoriy)',
  'conversation.regionShort': 'Hudud',
  'conversation.regionNone': 'tanlanmagan',
  'conversation.regionKarakalpakstan': 'Qoraqalpogʻiston Respublikasi',
  'conversation.regionAndijan': 'Andijon viloyati',
  'conversation.regionBukhara': 'Buxoro viloyati',
  'conversation.regionFergana': 'Fargʻona viloyati',
  'conversation.regionJizzakh': 'Jizzax viloyati',
  'conversation.regionNamangan': 'Namangan viloyati',
  'conversation.regionNavoi': 'Navoiy viloyati',
  'conversation.regionKashkadarya': 'Qashqadaryo viloyati',
  'conversation.regionSamarkand': 'Samarqand viloyati',
  'conversation.regionSirdarya': 'Sirdaryo viloyati',
  'conversation.regionSurkhandarya': 'Surxondaryo viloyati',
  'conversation.regionTashkent': 'Toshkent viloyati',
  'conversation.regionTashkentCity': 'Toshkent shahri',
  'conversation.regionKhorezm': 'Xorazm viloyati',
  'conversation.thread': 'Suhbat xabarlari',
  'conversation.suggestions': 'Namunaviy savollar',
  'conversation.suggestTransfer': 'Boshqa OTMga qanday oʻtish mumkin?',
  'conversation.suggestContract': 'Kontrakt toʻlovini boʻlib toʻlasa boʻladimi?',
  'conversation.suggestCertification': 'Pedagoglar attestatsiyasi qachon?',
  'conversation.suggestRestoration': 'Oʻqishni qayta tiklash tartibi',
  'conversation.placeholder': 'Savolingizni yozing…',
  'conversation.send': 'Xabar yuborish',
  'conversation.newMessage': 'Yangi xabar',
  'conversation.restoring': 'Suhbat yuklanmoqda…',
  'conversation.analyzing': 'Savol tahlil qilinmoqda…',
  'conversation.searching': 'Hujjatlar qidirilmoqda…',
  'conversation.checking': 'Javob tekshirilmoqda…',
  'conversation.lexLink': 'lex.uz’da ochish',
  'conversation.sourceLink': 'Manbani ochish',
  'conversation.checked': 'Iqtibos tekshirildi',
  'conversation.helpful': 'Foydali javob',
  'conversation.unhelpful': 'Foydasiz javob',
  'conversation.feedbackPrompt': 'Nima notoʻgʻri?',
  'conversation.saveFeedback': 'Saqlash',
  'conversation.savedFeedback': 'Fikringiz saqlandi.',
  'conversation.pendingTitle': 'Javobni mutaxassis tayyorlamoqda.',
  'conversation.pendingDetail': 'Javob shu yerda paydo boʻladi.',
  'conversation.ticketTitle': 'Murojaatingiz roʻyxatga olindi',
  'conversation.due': 'Javob muddati: {date} ({duration})',
  'conversation.dueNoDuration': 'Javob muddati: {date}',
  'conversation.ticketWaiting': 'Mutaxassis shu suhbatda javob beradi.',
  'conversation.ticketAnswered': 'Mutaxassis javob berdi.',
  'conversation.specialist': 'Mutaxassis javobi',
  'conversation.fraudTitle': 'Diqqat!',
  'conversation.fraudBody': 'Pul evaziga oʻqishga kiritish yoki koʻchirish — firibgarlik. Hech kimga pul oʻtkazmang.',
  'conversation.hotline': 'Ishonch telefoni: 1006',
  'conversation.restoreError': 'Suhbatni yuklab boʻlmadi. Qayta urinib koʻring.',
  'conversation.sendError': 'Xabar yuborilmadi. Qayta urinib koʻring.',
  'conversation.retry': 'Qayta urinish',
} as const

type ChatDictionary = Record<keyof typeof latin, string>

const cyrillic = {
  'conversation.region': 'Ҳудудингиз (ихтиёрий)',
  'conversation.regionShort': 'Ҳудуд',
  'conversation.regionNone': 'танланмаган',
  'conversation.regionKarakalpakstan': 'Қорақалпоғистон Республикаси',
  'conversation.regionAndijan': 'Андижон вилояти',
  'conversation.regionBukhara': 'Бухоро вилояти',
  'conversation.regionFergana': 'Фарғона вилояти',
  'conversation.regionJizzakh': 'Жиззах вилояти',
  'conversation.regionNamangan': 'Наманган вилояти',
  'conversation.regionNavoi': 'Навоий вилояти',
  'conversation.regionKashkadarya': 'Қашқадарё вилояти',
  'conversation.regionSamarkand': 'Самарқанд вилояти',
  'conversation.regionSirdarya': 'Сирдарё вилояти',
  'conversation.regionSurkhandarya': 'Сурхондарё вилояти',
  'conversation.regionTashkent': 'Тошкент вилояти',
  'conversation.regionTashkentCity': 'Тошкент шаҳри',
  'conversation.regionKhorezm': 'Хоразм вилояти',
  'conversation.thread': 'Суҳбат хабарлари',
  'conversation.suggestions': 'Намунавий саволлар',
  'conversation.suggestTransfer': 'Бошқа ОТМга қандай ўтиш мумкин?',
  'conversation.suggestContract': 'Контракт тўловини бўлиб тўласа бўладими?',
  'conversation.suggestCertification': 'Педагоглар аттестацияси қачон?',
  'conversation.suggestRestoration': 'Ўқишни қайта тиклаш тартиби',
  'conversation.placeholder': 'Саволингизни ёзинг…',
  'conversation.send': 'Хабар юбориш',
  'conversation.newMessage': 'Янги хабар',
  'conversation.restoring': 'Суҳбат юкланмоқда…',
  'conversation.analyzing': 'Савол таҳлил қилинмоқда…',
  'conversation.searching': 'Ҳужжатлар қидирилмоқда…',
  'conversation.checking': 'Жавоб текширилмоқда…',
  'conversation.lexLink': 'lex.uz’да очиш',
  'conversation.sourceLink': 'Манбани очиш',
  'conversation.checked': 'Иқтибос текширилди',
  'conversation.helpful': 'Фойдали жавоб',
  'conversation.unhelpful': 'Фойдасиз жавоб',
  'conversation.feedbackPrompt': 'Нима нотўғри?',
  'conversation.saveFeedback': 'Сақлаш',
  'conversation.savedFeedback': 'Фикрингиз сақланди.',
  'conversation.pendingTitle': 'Жавобни мутахассис тайёрламоқда.',
  'conversation.pendingDetail': 'Жавоб шу ерда пайдо бўлади.',
  'conversation.ticketTitle': 'Мурожаатингиз рўйхатга олинди',
  'conversation.due': 'Жавоб муддати: {date} ({duration})',
  'conversation.dueNoDuration': 'Жавоб муддати: {date}',
  'conversation.ticketWaiting': 'Мутахассис шу суҳбатда жавоб беради.',
  'conversation.ticketAnswered': 'Мутахассис жавоб берди.',
  'conversation.specialist': 'Мутахассис жавоби',
  'conversation.fraudTitle': 'Диққат!',
  'conversation.fraudBody': 'Пул эвазига ўқишга киритиш ёки кўчириш — фирибгарлик. Ҳеч кимга пул ўтказманг.',
  'conversation.hotline': 'Ишонч телефони: 1006',
  'conversation.restoreError': 'Суҳбатни юклаб бўлмади. Қайта уриниб кўринг.',
  'conversation.sendError': 'Хабар юборилмади. Қайта уриниб кўринг.',
  'conversation.retry': 'Қайта уриниш',
} satisfies ChatDictionary

const russian = {
  'conversation.region': 'Ваш регион (необязательно)',
  'conversation.regionShort': 'Регион',
  'conversation.regionNone': 'не выбран',
  'conversation.regionKarakalpakstan': 'Республика Каракалпакстан',
  'conversation.regionAndijan': 'Андижанская область',
  'conversation.regionBukhara': 'Бухарская область',
  'conversation.regionFergana': 'Ферганская область',
  'conversation.regionJizzakh': 'Джизакская область',
  'conversation.regionNamangan': 'Наманганская область',
  'conversation.regionNavoi': 'Навоийская область',
  'conversation.regionKashkadarya': 'Кашкадарьинская область',
  'conversation.regionSamarkand': 'Самаркандская область',
  'conversation.regionSirdarya': 'Сырдарьинская область',
  'conversation.regionSurkhandarya': 'Сурхандарьинская область',
  'conversation.regionTashkent': 'Ташкентская область',
  'conversation.regionTashkentCity': 'Город Ташкент',
  'conversation.regionKhorezm': 'Хорезмская область',
  'conversation.thread': 'Сообщения чата',
  'conversation.suggestions': 'Примеры вопросов',
  'conversation.suggestTransfer': 'Как перевестись в другой вуз?',
  'conversation.suggestContract': 'Можно ли оплатить контракт частями?',
  'conversation.suggestCertification': 'Когда проходит аттестация педагогов?',
  'conversation.suggestRestoration': 'Как восстановиться на учёбе?',
  'conversation.placeholder': 'Задайте вопрос…',
  'conversation.send': 'Отправить сообщение',
  'conversation.newMessage': 'Новое сообщение',
  'conversation.restoring': 'Загружаем переписку…',
  'conversation.analyzing': 'Анализируем вопрос…',
  'conversation.searching': 'Ищем документы…',
  'conversation.checking': 'Проверяем ответ…',
  'conversation.lexLink': 'Открыть на lex.uz',
  'conversation.sourceLink': 'Открыть источник',
  'conversation.checked': 'Цитата проверена',
  'conversation.helpful': 'Полезный ответ',
  'conversation.unhelpful': 'Неполезный ответ',
  'conversation.feedbackPrompt': 'Что не так?',
  'conversation.saveFeedback': 'Сохранить',
  'conversation.savedFeedback': 'Отзыв сохранён.',
  'conversation.pendingTitle': 'Специалист готовит ответ.',
  'conversation.pendingDetail': 'Ответ появится в этом чате.',
  'conversation.ticketTitle': 'Ваше обращение зарегистрировано',
  'conversation.due': 'Срок ответа: {date} ({duration})',
  'conversation.dueNoDuration': 'Срок ответа: {date}',
  'conversation.ticketWaiting': 'Специалист ответит в этом чате.',
  'conversation.ticketAnswered': 'Специалист ответил.',
  'conversation.specialist': 'Ответ специалиста',
  'conversation.fraudTitle': 'Внимание!',
  'conversation.fraudBody': 'Обещание зачислить или перевести за деньги — мошенничество. Никому не переводите деньги.',
  'conversation.hotline': 'Телефон доверия: 1006',
  'conversation.restoreError': 'Не удалось загрузить переписку. Попробуйте ещё раз.',
  'conversation.sendError': 'Не удалось отправить сообщение. Попробуйте ещё раз.',
  'conversation.retry': 'Повторить попытку',
} satisfies ChatDictionary

export const chatMessages = {
  'uz-latn': latin,
  'uz-cyrl': cyrillic,
  ru: russian,
} satisfies Record<Language, ChatDictionary>

const chatCalendars = {
  'uz-latn': {
    months: ['yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun', 'iyul', 'avgust', 'sentabr', 'oktabr', 'noyabr', 'dekabr'],
    dateSeparator: '-',
    dayUnits: ['kun', 'kun', 'kun'],
  },
  'uz-cyrl': {
    months: ['январь', 'февраль', 'март', 'апрель', 'май', 'июнь', 'июль', 'август', 'сентябрь', 'октябрь', 'ноябрь', 'декабрь'],
    dateSeparator: ' ',
    dayUnits: ['кун', 'кун', 'кун'],
  },
  ru: {
    months: ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'],
    dateSeparator: ' ',
    dayUnits: ['день', 'дня', 'дней'],
  },
} as const

const tashkentDateParts = new Intl.DateTimeFormat('en-US', {
  timeZone: 'Asia/Tashkent',
  calendar: 'gregory',
  numberingSystem: 'latn',
  day: 'numeric',
  month: 'numeric',
})

export function formatChatDate(date: Date, language: Language): string | null {
  if (!Number.isFinite(date.getTime())) return null

  const parts = tashkentDateParts.formatToParts(date)
  const day = parts.find(({ type }) => type === 'day')?.value
  const monthNumber = Number(parts.find(({ type }) => type === 'month')?.value)
  const calendar = chatCalendars[language]
  const month = calendar.months[monthNumber - 1]
  return day && month ? day + calendar.dateSeparator + month : null
}

export function formatChatDays(days: number, language: Language): string {
  const lastDigit = days % 10
  const lastTwoDigits = days % 100
  const teens = lastTwoDigits >= 11 && lastTwoDigits <= 14
  const [one, few, many] = chatCalendars[language].dayUnits
  let unit: string = many

  if (!teens && lastDigit === 1) unit = one
  else if (!teens && lastDigit >= 2 && lastDigit <= 4) unit = few

  return days + ' ' + unit
}
