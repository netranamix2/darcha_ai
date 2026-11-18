import type { Citation, Level } from '../types'

export type MockLocale = 'uz-latn' | 'uz-cyrl' | 'ru'

type LocalizedText = Record<MockLocale, string>

interface TopicReference {
  title: LocalizedText
  ref: LocalizedText
  documentId: number
}

interface MockTopic {
  label: string
  pattern: RegExp
  level: Exclude<Level, 'red'>
  source: TopicReference
  overview: LocalizedText
  confusion: string
}

const transferTitle = {
  'uz-latn': 'Oʻqishni koʻchirish va qayta tiklash tartibi',
  'uz-cyrl': 'Ўқишни кўчириш ва қайта тиклаш тартиби',
  ru: 'Порядок перевода и восстановления студентов',
}

export const topics = {
  transfer: {
    label: 'Oʻqishni koʻchirish',
    pattern: /ko'chir|kochirish|кўчир|boshqa (?:otm|oliygoh).*o'tish|бошқа (?:отм|олийгоҳ).*ўтиш|перевод(?:а|е|у|ом)?(?![\p{L}]|\s+(?:денег|денежных))|перевестись|перейти в другой вуз/iu,
    level: 'green',
    source: {
      title: transferTitle,
      ref: {
        'uz-latn': '578-son qaror, 3-ilova, 14–15-bandlar',
        'uz-cyrl': '578-сон қарор, 3-илова, 14–15-бандлар',
        ru: 'Постановление № 578, приложение 3, пункты 14–15',
      },
      documentId: 7726569,
    },
    overview: {
      'uz-latn': 'Davlat oliygohlari oʻrtasida oʻqishni koʻchirish arizasi vazirlikning rasmiy sayti yoki Yagona interaktiv davlat xizmatlari portali orqali roʻyxatdan oʻtkaziladi. Nizomda arizaga qoʻshiladigan hujjatlar, jumladan akademik maʼlumotnoma yoki transkript nusxasi koʻrsatilgan.',
      'uz-cyrl': 'Давлат олийгоҳлари ўртасида ўқишни кўчириш аризаси вазирликнинг расмий сайти ёки Ягона интерактив давлат хизматлари портали орқали рўйхатдан ўтказилади. Низомда аризага қўшиладиган ҳужжатлар, жумладан академик маълумотнома ёки транскрипт нусхаси кўрсатилган.',
      ru: 'Заявление о переводе между государственными вузами регистрируют через официальный сайт министерства или Единый портал интерактивных государственных услуг. Перечень приложений к заявлению, включая академическую справку или копию транскрипта, приведён в положении.',
    },
    confusion: 'Talabalar ariza qayerga topshirilishi va transkript talab qilinishini soʻramoqda.',
  },
  restoration: {
    label: 'Oʻqishni qayta tiklash',
    pattern: /qayta tikla|қайта тикла|восстанов/i,
    level: 'yellow',
    source: {
      title: transferTitle,
      ref: {
        'uz-latn': '578-son qaror, 3-ilova, 5-bob',
        'uz-cyrl': '578-сон қарор, 3-илова, 5-боб',
        ru: 'Постановление № 578, приложение 3, глава 5',
      },
      documentId: 7726569,
    },
    overview: {
      'uz-latn': 'Oʻqishni qayta tiklash uchun arizaga akademik maʼlumotnoma, reyting daftarchasi yoki transkript nusxasi ilova qilinadi. Ariza qabul qilish muddatlari Nizomning 42-bandida keltirilgan.',
      'uz-cyrl': 'Ўқишни қайта тиклаш учун аризага академик маълумотнома, рейтинг дафтарчаси ёки транскрипт нусхаси илова қилинади. Ариза қабул қилиш муддатлари Низомнинг 42-бандида келтирилган.',
      ru: 'К заявлению о восстановлении прилагают академическую справку, зачётную книжку или копию транскрипта. Сроки приёма заявлений приведены в пункте 42 положения.',
    },
    confusion: 'Oʻqishni qayta tiklash va boshqa oliygohga koʻchirib tiklash tartibi chalkashmoqda.',
  },
  contract: {
    label: 'Kontrakt toʻlovi',
    pattern: /kontrakt|контракт|оплат[ауы] (за )?(вуз|обучени)|плат[ае] за обучени/i,
    level: 'green',
    source: {
      title: {
        'uz-latn': 'Toʻlov-kontrakt asosida oʻqitish tartibi',
        'uz-cyrl': 'Тўлов-контракт асосида ўқитиш тартиби',
        ru: 'Положение об обучении на платно-контрактной основе',
      },
      ref: {
        'uz-latn': '2431-son Nizom, 22-band',
        'uz-cyrl': '2431-сон Низом, 22-банд',
        ru: 'Положение № 2431, пункт 22',
      },
      documentId: 2137212,
    },
    overview: {
      'uz-latn': 'Oliy taʼlim uchun kontrakt toʻlovining ulushlari va muddatlari 2431-son Nizomning 22-bandida koʻrsatilgan. Toʻlov jadvalingizni oliygoh bilan tuzgan shartnomangizdan ham tekshiring.',
      'uz-cyrl': 'Олий таълим учун контракт тўловининг улушлари ва муддатлари 2431-сон Низомнинг 22-бандида кўрсатилган. Тўлов жадвалингизни олийгоҳ билан тузган шартномангиздан ҳам текширинг.',
      ru: 'Сроки и доли оплаты за обучение в вузе приведены в пункте 22 положения № 2431. Проверьте также график платежей в договоре с вашим вузом.',
    },
    confusion: 'Talabalar qaysi muddatgacha kontraktning qancha qismini toʻlashni bilmoqchi.',
  },
  certification: {
    label: 'Pedagoglar attestatsiyasi',
    pattern: /attestatsi|аттестаци|malaka toifa|малака тоифа/i,
    level: 'yellow',
    source: {
      title: {
        'uz-latn': 'Pedagog kadrlarni attestatsiyadan oʻtkazish',
        'uz-cyrl': 'Педагог кадрларни аттестациядан ўтказиш',
        ru: 'Аттестация педагогических кадров',
      },
      ref: {
        'uz-latn': '572-son qaror, 1-ilova',
        'uz-cyrl': '572-сон қарор, 1-илова',
        ru: 'Постановление № 572, приложение 1',
      },
      documentId: 5641270,
    },
    overview: {
      'uz-latn': 'Pedagoglar attestatsiyasi boʻyicha ariza va baholash tartibi 572-son qarorning 1-ilovasida bayon qilingan. Oʻz holatingiz boʻyicha attestatsiya turini aniqlashtiring.',
      'uz-cyrl': 'Педагоглар аттестацияси бўйича ариза ва баҳолаш тартиби 572-сон қарорнинг 1-иловасида баён қилинган. Ўз ҳолатингиз бўйича аттестация турини аниқлаштиринг.',
      ru: 'Правила подачи заявления и оценки при аттестации педагогов изложены в приложении 1 к постановлению № 572. Уточните, какая аттестация предусмотрена для вашего случая.',
    },
    confusion: 'Pedagoglar navbatdagi va navbatdan tashqari attestatsiya shartlarini farqlashga qiynalmoqda.',
  },
  uniform: {
    label: 'Maktab formasi',
    pattern: /maktab forma|мактаб форма|школьн\p{L}* форм/iu,
    level: 'green',
    source: {
      title: {
        'uz-latn': 'Yagona maktab formasiga qoʻyilgan talablar',
        'uz-cyrl': 'Ягона мактаб формасига қўйилган талаблар',
        ru: 'Требования к школьной форме',
      },
      ref: {
        'uz-latn': '666-son qaror, 2-ilova, 3-bob',
        'uz-cyrl': '666-сон қарор, 2-илова, 3-боб',
        ru: 'Постановление № 666, приложение 2, глава 3',
      },
      documentId: 3866498,
    },
    overview: {
      'uz-latn': 'Davlat maktablari oʻquvchilari formasi boʻyicha talablar 666-son qarorga ilova qilingan Nizomda keltirilgan. Muayyan maktabdagi kiyinish tartibini maʼmuriyatdan aniqlashtiring.',
      'uz-cyrl': 'Давлат мактаблари ўқувчилари формаси бўйича талаблар 666-сон қарорга илова қилинган Низомда келтирилган. Муайян мактабдаги кийиниш тартибини маъмуриятдан аниқлаштиринг.',
      ru: 'Требования к форме учащихся государственных школ приведены в положении, приложенном к постановлению № 666. Правила одежды в конкретной школе уточните у её администрации.',
    },
    confusion: 'Ota-onalar kiyimga qoʻyilgan umumiy talablarni amaliy misollar bilan bilishni istamoqda.',
  },
} satisfies Record<string, MockTopic>

const appealSource: TopicReference = {
  title: {
    'uz-latn': 'Jismoniy va yuridik shaxslarning murojaatlari toʻgʻrisida',
    'uz-cyrl': 'Жисмоний ва юридик шахсларнинг мурожаатлари тўғрисида',
    ru: 'Об обращениях физических и юридических лиц',
  },
  ref: {
    'uz-latn': 'OʻRQ-445, 28-modda',
    'uz-cyrl': 'ЎРҚ-445, 28-модда',
    ru: 'Закон № ЗРУ-445, статья 28',
  },
  documentId: 3336169,
}

const replyText = {
  pending: {
    'uz-latn': 'Savolingizni oldik. Mutaxassis holatingizni koʻrib chiqib, javob tayyorlamoqda.',
    'uz-cyrl': 'Саволингизни олдик. Мутахассис ҳолатингизни кўриб чиқиб, жавоб тайёрламоқда.',
    ru: 'Вопрос получен. Специалист изучает вашу ситуацию и готовит ответ.',
  },
  escalated: {
    'uz-latn': 'Murojaatingiz roʻyxatga olindi. Mutaxassis tafsilotlarni tekshiradi va shu chat orqali javob beradi.',
    'uz-cyrl': 'Мурожаатингиз рўйхатга олинди. Мутахассис тафсилотларни текширади ва шу чат орқали жавоб беради.',
    ru: 'Обращение зарегистрировано. Специалист проверит детали и ответит в этом чате.',
  },
  fraud: {
    'uz-latn': 'Oʻqishga kiritishni vaʼda qilib pul soʻrash firibgarlik belgisi boʻlishi mumkin. Pul oʻtkazmang va karta maʼlumotlarini bermang. Xabaringiz tekshiruv uchun mutaxassisga yuborildi.',
    'uz-cyrl': 'Ўқишга киритишни ваъда қилиб пул сўраш фирибгарлик белгиси бўлиши мумкин. Пул ўтказманг ва карта маълумотларини берманг. Хабарингиз текширув учун мутахассисга юборилди.',
    ru: 'Просьба заплатить за обещание поступления может быть признаком мошенничества. Не переводите деньги и не сообщайте данные карты. Сообщение передано специалисту для проверки.',
  },
  clarify: {
    'uz-latn': 'Savolingizga aniq javob berish uchun taʼlim muassasasi nomini va qaysi masala boʻyicha yordam kerakligini yozing. Murojaatlarni koʻrib chiqish tartibi quyidagi hujjatda keltirilgan.',
    'uz-cyrl': 'Саволингизга аниқ жавоб бериш учун таълим муассасаси номини ва қайси масала бўйича ёрдам кераклигини ёзинг. Мурожаатларни кўриб чиқиш тартиби қуйидаги ҳужжатда келтирилган.',
    ru: 'Чтобы ответить точнее, укажите учебное заведение и опишите, в чём нужна помощь. Порядок рассмотрения обращений приведён в документе ниже.',
  },
  specialist: {
    'uz-latn': 'Murojaatingizni koʻrib chiqdim. Vaziyatni aniqlashtirish uchun taʼlim muassasasi nomini va hodisa sanasini shu suhbatda yozishingiz mumkin.',
    'uz-cyrl': 'Мурожаатингизни кўриб чиқдим. Вазиятни аниқлаштириш учун таълим муассасаси номини ва ҳодиса санасини шу суҳбатда ёзишингиз мумкин.',
    ru: 'Я ознакомился с обращением. Для уточнения обстоятельств укажите в этом чате название учебного заведения и дату события.',
  },
} satisfies Record<string, LocalizedText>

function detectLocale(text: string): MockLocale {
  if (!/\p{Script=Cyrillic}/u.test(text)) return 'uz-latn'
  if (/[ўқғҳ]|салом|мактаб|ариза|менга|олий|педагоглар|аттестацияси|қабул|(?:^|\s)пул(?:$|\s)/i.test(text)) return 'uz-cyrl'
  return 'ru'
}

export function cite(source: TopicReference, locale: MockLocale): Citation {
  const prefix = { 'uz-latn': 'uz/', 'uz-cyrl': '', ru: 'ru/' }[locale]
  const latinMarker = locale === 'uz-cyrl' ? '' : '-'
  return { title: source.title[locale], ref: source.ref[locale], url: `https://lex.uz/${prefix}docs/${latinMarker}${source.documentId}` }
}

function isFraud(text: string) {
  if (/firibgar|фирибгар|мошенни|\bpora\b|пора (бер|сўра)|взятк|kontraktsiz (o'qishga )?kirit|контрактсиз (ўқишга )?кирит/i.test(text)) return true

  const words = text.split(/[^\p{L}]+/u).filter(Boolean)
  const hasMoney = words.some((word) => /^(pul|пул)(m?ni|и?ни|ga|га|dan|дан|lar|лар)?$|^деньг|^денег$/i.test(word))
  const admission = /qabul|kirish|kirit|поступ|зачисл|қабул|кириш|кирит/i.test(text)
  const solicitation = /so'radi|so'ray|so'rashyap|сўради|сўраяп|требу|прос[ия]|вымага/i.test(text)
  return hasMoney && (words.length === 1 || solicitation || (admission && !topics.contract.pattern.test(text)))
}

export function determineReply(text: string, forceEscalation = false) {
  const locale = detectLocale(text)
  const normalized = text.toLowerCase().replace(/[ʻʼ‘’`´]/g, "'")
  const topic = Object.values(topics).find(({ pattern }) => pattern.test(normalized))
  const fraud = isFraud(normalized)
  const escalated = forceEscalation || fraud || /shikoyat|şikoyat|шикоят|жалоб|rad etildi|рад этилди|отказал|muddati o'tdi|муддати ўтди|просроч/i.test(normalized)
  const level: Level = escalated ? 'red' : topic?.level ?? 'yellow'
  const source = escalated ? appealSource : topic?.source ?? appealSource
  let answer = replyText.pending[locale]

  if (escalated) answer = (fraud ? replyText.fraud : replyText.escalated)[locale]
  else if (topic?.level === 'green') answer = topic.overview[locale]

  const label = fraud ? 'Qabuldagi firibgarlik' : topic?.label ?? 'Boshqa murojaatlar'
  const followUp = escalated ? replyText.specialist[locale] : topic?.overview[locale] ?? replyText.clarify[locale]
  return { locale, topic: label, level, answer, citations: [cite(source, locale)], fraud, followUp }
}
