import type { AnalyticsAlert, Channel, InboxItem, Sentiment, Ticket, TicketEvent } from '../types'
import { cite, determineReply, topics } from './chat'
import { dayMs } from './dates'
import { currentStaff, departmentFor, similarResolvedTickets, staff, ticketExamples } from './ticket-examples'

const now = Date.now()
const hourMs = dayMs / 24

interface InboxFixture {
  channel: Channel
  text: string
  ageHours: number
  region: string | null
  sentiment?: Sentiment
  status?: InboxItem['status']
}

function seedItem(id: string, fixture: InboxFixture): InboxItem {
  const result = determineReply(fixture.text)
  const topic = Object.values(topics).find(({ label }) => label === result.topic)
  const status = fixture.status ?? (result.level === 'green' ? 'sent' : 'draft')
  const draft = topic && result.level === 'yellow'
    ? {
        answer: topic.overview[result.locale],
        citations: [cite(topic.source, result.locale)],
        confidence: 0.79,
      }
    : null

  return {
    id,
    channel: fixture.channel,
    text: fixture.text,
    created_at: new Date(now - fixture.ageHours * hourMs).toISOString(),
    level: result.level,
    classification: {
      type: result.level === 'red' ? 'Shikoyat' : 'Savol',
      topic: result.topic,
      region: fixture.region,
      sentiment: fixture.sentiment ?? 'neutral',
      flags: result.fraud ? ['fraud'] : [],
      lang: result.locale === 'ru' ? 'ru' : 'uz',
      script: result.locale === 'uz-latn' ? 'latin' : 'cyrillic',
    },
    draft,
    status,
  }
}

const items = {
  contract: seedItem('IN-1001', {
    channel: 'telegram',
    text: 'Kontrakt toʻlovining keyingi qismini qaysi sanagacha oʻtkazishim kerak?',
    ageHours: 3,
    region: 'Toshkent shahri',
  }),
  complaint: seedItem('IN-1002', {
    channel: 'web',
    text: 'Ўқишни кўчириш учун ҳужжатларни топширдим, лекин аризам рад этилди. Шикоятни қандай юбораман?',
    ageHours: 6,
    region: 'Samarqand viloyati',
    sentiment: 'negative',
  }),
  certification: seedItem('IN-1003', {
    channel: 'instagram',
    text: 'Когда можно подать заявление на внеочередную аттестацию? Работаю учителем уже два года.',
    ageHours: 15,
    region: 'Namangan viloyati',
  }),
  uniform: seedItem('IN-1004', {
    channel: 'telegram',
    text: 'Мактаб формаси учун қандай талаблар бор? Болаларга кийимни олдиндан олмоқчимиз.',
    ageHours: 23,
    region: 'Buxoro viloyati',
  }),
  restoration: seedItem('IN-1005', {
    channel: 'web',
    text: 'Sogʻligʻim sabab oʻqishdan chiqqan edim. Oʻqishni qayta tiklash uchun qanday hujjatlar kerak?',
    ageHours: 27,
    region: 'Andijon viloyati',
    status: 'approved',
  }),
  fraud: seedItem('IN-1006', {
    channel: 'telegram',
    text: 'Мне в личных сообщениях обещают поступление без экзаменов и просят перевести деньги. Куда обратиться?',
    ageHours: 39,
    region: 'Fargʻona viloyati',
    sentiment: 'negative',
  }),
  transfer: seedItem('IN-1007', {
    channel: 'web',
    text: 'Urganchdan Nukusga oʻqishni koʻchirish uchun transkript kifoyami yoki boshqa hujjatlar ham kerakmi?',
    ageHours: 48,
    region: 'Xorazm viloyati',
  }),
  anotherContract: seedItem('IN-1008', {
    channel: 'instagram',
    text: 'Большое спасибо за разъяснение. Где посмотреть график платежей по контракту?',
    ageHours: 63,
    region: 'Navoiy viloyati',
    sentiment: 'positive',
  }),
  anotherCertification: seedItem('IN-1009', {
    channel: 'telegram',
    text: 'Педагоглар аттестацияси учун тоифа сертификатини аризага илова қилиш керакми?',
    ageHours: 75,
    region: 'Qashqadaryo viloyati',
    status: 'rejected',
  }),
  uniformComplaint: seedItem('IN-1010', {
    channel: 'web',
    text: 'Ota-onalardan maktab formasi uchun faqat bitta doʻkondan xarid qilishni talab qilishyapti. Shikoyat qoldirmoqchiman.',
    ageHours: 90,
    region: 'Jizzax viloyati',
    sentiment: 'negative',
  }),
  anotherRestoration: seedItem('IN-1011', {
    channel: 'instagram',
    text: 'Хочу восстановиться в вузе после перерыва. Куда подать заявление, если мой факультет переименовали?',
    ageHours: 126,
    region: null,
  }),
  anotherTransfer: seedItem('IN-1012', {
    channel: 'telegram',
    text: 'Oʻqishni koʻchirish ancha tushunarli boʻldi. Arizam holatini qayerda tekshirsam boʻladi?',
    ageHours: 148,
    region: 'Surxondaryo viloyati',
    sentiment: 'positive',
  }),
  oldComplaint: seedItem('IN-1013', {
    channel: 'web',
    text: 'Университет отказал в переводе без объяснения причин. Как получить письменный ответ на жалобу?',
    ageHours: 19 * 24,
    region: 'Toshkent viloyati',
    sentiment: 'negative',
  }),
  oldTransfer: seedItem('IN-1014', {
    channel: 'telegram',
    text: 'Ўқишни кўчириш аризасига транскриптни қандай юклайман?',
    ageHours: 9 * 24,
    region: 'Qoraqalpogʻiston Respublikasi',
  }),
  oldContract: seedItem('IN-1015', {
    channel: 'web',
    text: 'Kontrakt boʻyicha birinchi toʻlov jadvalini qayerdan olaman?',
    ageHours: 11 * 24,
    region: 'Sirdaryo viloyati',
  }),
}

export const inbox = new Map(Object.values(items).map((item) => [item.id, item]))

function seedTicket(
  id: number,
  item: InboxItem,
  details: Pick<Ticket, 'priority' | 'status' | 'summary'> & Partial<Pick<Ticket, 'draft_answer' | 'final_answer' | 'department'>>,
): Ticket {
  const department = details.department ?? departmentFor(item.classification.topic, item.text)
  const member = details.status === 'new' ? undefined : staff.find((person) => person.department === department)
  const createdAt = Date.parse(item.created_at)
  const events: TicketEvent[] = [{ type: 'created', actor: 'ai', created_at: item.created_at }]
  if (member) {
    events.push(
      { type: 'assigned', actor: currentStaff.name, created_at: new Date(createdAt + 15 * 60_000).toISOString(), note: member.name },
      { type: 'viewed', actor: member.name, created_at: new Date(createdAt + 60 * 60_000).toISOString() },
    )
  }
  if (details.status === 'answered') {
    const answeredAt = createdAt + (8 + id % 4 * 3) * hourMs
    events.push(
      { type: 'answered', actor: member?.name ?? currentStaff.name, created_at: new Date(answeredAt).toISOString() },
      { type: 'rated', actor: 'citizen', created_at: new Date(answeredAt + 20_000).toISOString(), note: '4' },
    )
    item.status = 'sent'
  }
  const ticket = {
    id: `T-${id}`,
    number: `DCH-${id}`,
    topic: item.classification.topic,
    region: item.classification.region,
    created_at: item.created_at,
    due_at: new Date(Date.parse(item.created_at) + 15 * dayMs).toISOString(),
    original_text: item.text,
    channel: item.channel,
    draft_answer: null,
    final_answer: null,
    similar_cases: [],
    department,
    assignee_id: member?.id ?? null,
    flags: [...item.classification.flags],
    events,
    ...details,
  } satisfies Ticket
  item.ticket_id = ticket.id
  item.ticket_number = ticket.number
  return ticket
}

const ticketFixtures = [
  seedTicket(1044, items.complaint, {
    status: 'new',
    priority: 'normal',
    summary: 'Talaba oʻqishni koʻchirish arizasi boʻyicha rad etish sababini soʻramoqda.',
  }),
  seedTicket(1043, items.fraud, {
    status: 'in_progress',
    priority: 'high',
    summary: 'Imtihonsiz oʻqishga qabul qilish evaziga pul oʻtkazishni soʻrashgan.',
    draft_answer: 'Xabarning joʻnatuvchisi va vaqtini saqlab qoʻying. Pul oʻtkazmang. Holatni tekshirish uchun maʼlumotlar mutaxassisga yuborildi.',
  }),
  seedTicket(1042, items.uniformComplaint, {
    status: 'answered',
    priority: 'low',
    summary: 'Ota-ona maktab formasini muayyan doʻkondan sotib olish talabi yuzasidan shikoyat qildi.',
    final_answer: 'Murojaatingiz hududiy taʼlim boʻlimiga koʻrib chiqish uchun yuborildi. Rasmiy javob roʻyxatdan oʻtgan aloqa kanalingizga joʻnatiladi.',
  }),
  seedTicket(1041, items.oldComplaint, {
    status: 'in_progress',
    priority: 'high',
    summary: 'Talaba oʻqishni koʻchirish boʻyicha yozma qarorning nusxasini soʻragan.',
  }),
]

const fixturePlans = [
  ['new', 0.2], ['new', 1], ['new', 1.5], ['new', 3], ['new', 12],
  ['in_progress', 6], ['in_progress', 9], ['in_progress', 13], ['in_progress', 14],
  ['answered', 4], ['answered', 8], ['answered', 10], ['answered', 12], ['answered', 16],
  ['in_progress', 17], ['in_progress', 21],
] as const

for (const [index, [status, daysAgo]] of fixturePlans.entries()) {
  const example = ticketExamples[index]
  const id = 1025 + index
  const item = seedItem(`IN-${id}`, {
    channel: example.channel,
    text: example.text,
    ageHours: daysAgo * 24,
    region: example.region,
    sentiment: 'negative',
  })
  item.level = 'red'
  item.status = status === 'answered' ? 'sent' : 'draft'
  item.classification.type = 'Shikoyat'
  item.classification.topic = example.topic
  item.classification.flags = example.flags ?? []
  inbox.set(item.id, item)
  ticketFixtures.push(seedTicket(id, item, {
    status,
    priority: example.priority,
    summary: example.summary,
    department: example.department,
    draft_answer: example.answer,
    final_answer: status === 'answered' ? example.answer : null,
  }))
}

for (const ticket of ticketFixtures) ticket.similar_cases = similarResolvedTickets(ticket, ticketFixtures)

export const tickets = new Map(ticketFixtures.map((ticket) => [ticket.id, ticket]))
export const responseSeconds = new Map([
  ['IN-1001', 5], ['IN-1004', 6], ['IN-1005', 810], ['IN-1007', 4],
  ['IN-1008', 7], ['IN-1010', 2700], ['IN-1012', 6], ['IN-1014', 4], ['IN-1015', 5],
])
for (const item of inbox.values()) {
  const ticket = item.ticket_id ? tickets.get(item.ticket_id) : undefined
  const answered = ticket?.events?.find(({ type }) => type === 'answered')
  if (answered) responseSeconds.set(item.id, (Date.parse(answered.created_at) - Date.parse(item.created_at)) / 1_000)
}

export const spikeAlert: AnalyticsAlert = {
  id: 'AL-1001',
  kind: 'spike',
  text: 'Oʻqishni koʻchirish boʻyicha savollar soni oshdi.',
  created_at: new Date(now - 48 * hourMs).toISOString(),
}
