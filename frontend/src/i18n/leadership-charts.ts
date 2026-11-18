const uzLatn = {
  'lc.daily': 'Kunlik dinamika',
  'lc.dailyHint': 'murojaatlar kunlar boʻyicha',
  'lc.ai': 'AI javob berdi',
  'lc.specialist': 'Mutaxassis',
  'lc.waiting': 'Ochiq',
  'lc.total': 'Jami',
  'lc.who': 'Kim javob berdi',
  'lc.whoHint': '{n} ta murojaatdan',
  'lc.aiNote': 'hujjatga tayangan avtomatik javob',
  'lc.specialistNote': 'tasdiqlangan qoralama yoki murojaat orqali',
  'lc.waitingNote': 'javob hali tayyorlanmoqda',
  'lc.questions': 'Eng koʻp beriladigan savollar',
  'lc.questionsLink': 'Haftalik FAQ →',
  'lc.times': '{n} marta',
  'lc.empty': 'Bu davr uchun maʼlumot yoʻq',
}

type Keys = keyof typeof uzLatn

const uzCyrl: Record<Keys, string> = {
  'lc.daily': 'Кунлик динамика',
  'lc.dailyHint': 'мурожаатлар кунлар бўйича',
  'lc.ai': 'AI жавоб берди',
  'lc.specialist': 'Мутахассис',
  'lc.waiting': 'Очиқ',
  'lc.total': 'Жами',
  'lc.who': 'Ким жавоб берди',
  'lc.whoHint': '{n} та мурожаатдан',
  'lc.aiNote': 'ҳужжатга таянган автоматик жавоб',
  'lc.specialistNote': 'тасдиқланган қоралама ёки мурожаат орқали',
  'lc.waitingNote': 'жавоб ҳали тайёрланмоқда',
  'lc.questions': 'Энг кўп бериладиган саволлар',
  'lc.questionsLink': 'Ҳафталик FAQ →',
  'lc.times': '{n} марта',
  'lc.empty': 'Бу давр учун маълумот йўқ',
}

const ru: Record<Keys, string> = {
  'lc.daily': 'Динамика по дням',
  'lc.dailyHint': 'обращения по дням',
  'lc.ai': 'Ответил AI',
  'lc.specialist': 'Специалист',
  'lc.waiting': 'Открыто',
  'lc.total': 'Всего',
  'lc.who': 'Кто ответил',
  'lc.whoHint': 'из {n} обращений',
  'lc.aiNote': 'автоответ со ссылкой на документ',
  'lc.specialistNote': 'через одобренный черновик или обращение',
  'lc.waitingNote': 'ответ ещё готовится',
  'lc.questions': 'Самые частые вопросы',
  'lc.questionsLink': 'FAQ недели →',
  'lc.times': '{n} раз',
  'lc.empty': 'Нет данных за этот период',
}

export const leadershipChartMessages = { 'uz-latn': uzLatn, 'uz-cyrl': uzCyrl, ru }
