import type { Channel, InboxItem, Sentiment } from '../types'
import { cite, topics, type MockLocale } from './chat'
import { dateBoundary, dateKey, dayMs } from './dates'

type TopicKey = keyof typeof topics
type SeedMessage = readonly [locale: MockLocale, text: string]

const messages: Record<TopicKey, SeedMessage[]> = {
  transfer: [
    ['uz-latn', 'Oʻqishni boshqa viloyatga koʻchirish uchun transkriptni qayerga yuklayman?'],
    ['uz-cyrl', 'Ўқишни кўчириш учун академик маълумотнома ҳам талаб қилинадими?'],
    ['ru', 'Можно ли подать заявление на перевод без готовой выписки с оценками?'],
    ['uz-latn', 'Oʻqishni koʻchirish uchun ariza holatini portalda qanday tekshiraman?'],
    ['ru', 'Где посмотреть список документов для перевода между вузами?'],
    ['uz-cyrl', 'Бошқа олийгоҳга ўтиш аризасига қайси ҳужжатларни илова қиламан?'],
    ['uz-latn', 'Yoʻnalishlar nomi farq qilsa, oʻqishni koʻchirish arizasida qaysi birini tanlayman?'],
    ['ru', 'Заявление на перевод вернули из-за формата файла. Как загрузить документы повторно?'],
  ],
  contract: [
    ['uz-latn', 'Kontrakt toʻlovini qismlarga boʻlish uchun kimga murojaat qilaman?'],
    ['uz-cyrl', 'Контракт тўловининг навбатдаги қисми учун муддатни қаердан кўраман?'],
    ['ru', 'Где взять актуальный график платежей по контракту на этот семестр?'],
    ['uz-latn', 'Kontrakt toʻlaganim haqidagi kvitansiyani yana yuborishim kerakmi?'],
    ['ru', 'Могу ли я оплатить обучение двумя платежами вместо одного?'],
    ['uz-cyrl', 'Контракт суммаси ўзгарган бўлса, янги шартномани қаердан юклаб оламан?'],
    ['uz-latn', 'Kontrakt pulini boshqa odam men uchun toʻlasa, toʻlov topshiriqnomasiga nima yoziladi?'],
  ],
  uniform: [
    ['uz-latn', 'Maktab formasining rangi va matosi uchun qanday talablar belgilangan?'],
    ['uz-cyrl', 'Мактаб формасини бошқа дўкондан сотиб олса бўладими?'],
    ['ru', 'Где опубликованы требования к школьной форме для первоклассников?'],
    ['uz-latn', 'Kuzgi mavsumda maktab formasiga qanday ustki kiyim kiyish mumkin?'],
    ['uz-cyrl', 'Қишда мактаб формаси ўрнига иссиқ шим кийишга рухсат борми?'],
    ['ru', 'Разрешено ли школьнику носить другой фасон формы по медицинским показаниям?'],
  ],
  restoration: [
    ['uz-latn', 'Bir yillik tanaffusdan keyin oʻqishni qayta tiklash uchun qanday hujjat kerak?'],
    ['uz-cyrl', 'Ўқишни қайта тиклаш аризасини янги факультетга берсам бўладими?'],
    ['ru', 'Можно ли восстановиться, если мою образовательную программу закрыли?'],
    ['uz-latn', 'Qayta tiklash uchun eski baholar varaqasi transkript oʻrniga oʻtadimi?'],
    ['uz-cyrl', 'Талабалар сафидан чиққанимдан кейин қайта тиклаш учун қанча муддатим бор?'],
    ['ru', 'Вернут ли меня на тот же курс, если после отчисления обновили учебный план?'],
  ],
  certification: [
    ['uz-latn', 'Pedagoglar attestatsiyasida navbatdagi va navbatdan tashqari arizalar nimasi bilan farq qiladi?'],
    ['uz-cyrl', 'Педагоглар аттестацияси аризасида малака тоифаси рақамини қаердан оламан?'],
    ['ru', 'Когда подаётся заявление на внеочередную аттестацию и какие документы нужны?'],
    ['uz-latn', 'Attestatsiya natijasi chiqqanidan keyin sertifikat qayerda koʻrinadi?'],
    ['ru', 'Можно ли подать заявление на аттестацию, если в этом году сменил школу?'],
    ['uz-cyrl', 'Аттестацияга ариза берганда диплом нусхасини ҳам юклашим керакми?'],
  ],
}

const regions = [
  'Toshkent shahri', 'Samarqand viloyati', 'Fargʻona viloyati', null, 'Namangan viloyati', 'Toshkent viloyati',
  'Buxoro viloyati', 'Andijon viloyati', 'Qashqadaryo viloyati', 'Jizzax viloyati', null, 'Xorazm viloyati',
  'Surxondaryo viloyati', 'Qoraqalpogʻiston Respublikasi', 'Sirdaryo viloyati', 'Navoiy viloyati',
] as const
const channels: Channel[] = ['telegram', 'web', 'telegram', 'instagram', 'web', 'telegram', 'web']
const recentCounts = [9, 13, 23, 12, 8, 14, 9, 11, 8, 10, 6, 12, 8, 9]
const recentTopics: TopicKey[] = ['transfer', 'contract', 'transfer', 'uniform', 'transfer', 'contract', 'uniform']
const historicTopics: TopicKey[] = ['contract', 'uniform', 'transfer', 'contract', 'transfer', 'uniform', 'contract']
const reviewTopics: TopicKey[] = ['certification', 'transfer', 'restoration', 'uniform', 'contract']

function sample(seed: number) {
  return ((Math.imul(seed ^ 0x35aab51e, 0x165667b1) ^ Math.imul(seed, 0x27d4eb2d)) >>> 0)
}

export function createAnalyticsFixtures(now: number) {
  const today = dateBoundary(dateKey(now))
  const fixtures: { item: InboxItem; seconds?: number }[] = []
  let nextReviewTopic = 0

  for (let daysAgo = 59; daysAgo >= 0; daysAgo--) {
    const midnight = today - daysAgo * dayMs
    const begin = daysAgo === 0 ? midnight : midnight + 8 * 3_600_000
    const end = daysAgo === 0 ? now : midnight + 21 * 3_600_000
    const count = recentCounts[daysAgo] ?? 3 + sample(daysAgo * 11) % 5
    for (let index = 0; index < count; index++) {
      const seed = sample(daysAgo * 43 + index + 1)
      const instant = Math.floor(begin + (end - begin) * (index + 1) / (count + 1))
      const queue = daysAgo < 7 ? recentTopics : historicTopics
      const held = (index + daysAgo * 5) % 11 >= 9 || (daysAgo < 3 && index === daysAgo)
      const key = held ? reviewTopics[nextReviewTopic++ % reviewTopics.length] : queue[(index + daysAgo) % queue.length]
      const topic = topics[key]
      const alternatives = messages[key]
      const [locale, text] = alternatives[(index + daysAgo * 2) % alternatives.length]
      const sentimentPick = seed % 20
      const sentiment: Sentiment = sentimentPick < (held ? 8 : 4)
        ? 'negative'
        : sentimentPick >= (held ? 18 : 14) ? 'positive' : 'neutral'
      const approved = held && seed % 4 === 0
      const seconds = held
        ? approved ? 190 + sample(seed + 2) % 190 : undefined
        : 5 + sample(seed + 1) % (daysAgo < 7 ? 42 : 58)

      fixtures.push({
        item: {
          id: `IN-AN-${daysAgo}-${index}`,
          channel: channels[Math.floor(seed / 17) % channels.length],
          text,
          created_at: new Date(instant).toISOString(),
          level: held ? 'yellow' : 'green',
          classification: {
            type: 'Savol',
            topic: topic.label,
            region: regions[Math.floor(seed / 37) % regions.length],
            sentiment,
            flags: [],
            lang: locale === 'ru' ? 'ru' : 'uz',
            script: locale === 'uz-latn' ? 'latin' : 'cyrillic',
          },
          draft: held ? { answer: topic.overview[locale], citations: [cite(topic.source, locale)], confidence: 0.76 } : null,
          status: held ? approved ? 'approved' : 'draft' : 'sent',
        },
        seconds,
      })
    }
  }

  return fixtures
}
