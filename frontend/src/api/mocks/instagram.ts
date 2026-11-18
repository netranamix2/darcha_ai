import type { ChatReply, InstagramComment, InstagramFeed, InstagramTrace } from '../types'
import { abusiveWords, determineReply } from './chat'
import type { MockLocale } from './chat'
import { createChatSession, readChatMessages, sendChatMessage } from './index'
import { uuid } from '../../lib/uuid'

const storageKey = 'darcha:instagram-sandbox:v1'
const postId = 'sandbox-post'
const botName = 'darcha.demo'

interface StoredComment extends InstagramComment {
  session_id?: string
}

interface Store {
  comments: StoredComment[]
  traces: InstagramTrace[]
}

const sourceLabel: Record<MockLocale, string> = { 'uz-latn': 'Manba', 'uz-cyrl': 'Манба', ru: 'Источник' }
const pendingText: Record<MockLocale, string> = {
  'uz-latn': 'Savolingiz mutaxassisga yuborildi — javob shu yerda paydo boʻladi.',
  'uz-cyrl': 'Саволингиз мутахассисга юборилди — жавоб шу ерда пайдо бўлади.',
  ru: 'Ваш вопрос передан специалисту — ответ появится здесь.',
}
const personalText: Record<MockLocale, string> = {
  'uz-latn': 'Bu shaxsiy masala — iltimos, maʼlumotlaringizni izohda yozmang. Telegram-botimiz orqali murojaat qiling, mutaxassis javob beradi.',
  'uz-cyrl': 'Бу шахсий масала — илтимос, маълумотларингизни изоҳда ёзманг. Телеграм-ботимиз орқали мурожаат қилинг, мутахассис жавоб беради.',
  ru: 'Это личный вопрос — пожалуйста, не пишите свои данные в комментариях. Напишите в наш Telegram-бот, специалист ответит.',
}
const hotlineText: Record<MockLocale, string> = {
  'uz-latn': 'Ishonch telefoni: 1006',
  'uz-cyrl': 'Ишонч телефони: 1006',
  ru: 'Телефон доверия: 1006',
}

function telegramLink() {
  const value: unknown = import.meta.env.VITE_TG_BOT_URL
  return typeof value === 'string' && value.trim().startsWith('https://') ? value.trim() : ''
}

function withSource(answer: string, reply: Pick<ChatReply, 'citations'>, locale: MockLocale) {
  const source = reply.citations[0]
  return source ? `${answer}\n📄 ${sourceLabel[locale]}: ${source.title}, ${source.ref}` : answer
}

function botReply(reply: ChatReply, locale: MockLocale): { text: string; pending: boolean } {
  if (reply.warning === 'fraud') return { text: `${reply.answer}\n☎️ ${hotlineText[locale]}`, pending: false }
  if (reply.level === 'red') {
    const link = telegramLink()
    return { text: link ? `${personalText[locale]}\n${link}` : personalText[locale], pending: false }
  }
  if (reply.level === 'yellow') return { text: pendingText[locale], pending: true }
  return { text: withSource(reply.answer, reply, locale), pending: false }
}

function minutesAgo(now: number, minutes: number) {
  return new Date(now - minutes * 60_000).toISOString()
}

function seed(): Store {
  const now = Date.now()
  const examples: Array<[string, string, number]> = [
    ['aziza.m', 'Kontrakt pulini boʻlib toʻlash mumkinmi?', 128],
    ['sardor_2007', 'Boshqa OTMga oʻqishni koʻchirish uchun qayerga ariza beriladi?', 47],
    ['dilnoza.ustoz', 'Pedagoglar attestatsiyasi qachon oʻtkaziladi?', 12],
  ]
  const comments = examples.map(([author, text, minutes], index): StoredComment => {
    const info = determineReply(text)
    const answer = info.level === 'green' ? info.answer : info.followUp
    return {
      id: `seed-${index}`,
      author,
      text,
      created_at: minutesAgo(now, minutes),
      is_bot: false,
      replies: [{
        id: `seed-${index}-reply`,
        author: botName,
        text: withSource(answer, info, info.locale),
        created_at: minutesAgo(now, minutes - 1),
        is_bot: true,
        replies: [],
      }],
    }
  })
  return { comments: comments.reverse(), traces: [] }
}

function load(): Store {
  try {
    const raw = localStorage.getItem(storageKey)
    if (raw) {
      const value: unknown = JSON.parse(raw)
      if (typeof value === 'object' && value !== null && Array.isArray((value as Store).comments)) return value as Store
    }
  } catch {
    // Storage can be unavailable or hold an older shape; start from the seed.
  }
  return seed()
}

function save(store: Store) {
  try {
    localStorage.setItem(storageKey, JSON.stringify(store))
  } catch {
    // The sandbox still works in memory when storage is blocked.
  }
}

function strip(comment: StoredComment): InstagramComment {
  return {
    id: comment.id,
    author: comment.author,
    text: comment.text,
    created_at: comment.created_at,
    is_bot: comment.is_bot,
    hidden: comment.hidden,
    pending: comment.pending,
    replies: comment.replies.map(strip),
  }
}

async function refreshPending(store: Store) {
  let changed = false
  for (const comment of store.comments) {
    const reply = comment.replies[0]
    if (!reply?.pending || !comment.session_id) continue
    const messages = await readChatMessages(comment.session_id, true)
    const answered = messages.find((message) => message.role === 'assistant' && message.reply?.level === 'green')
    if (!answered?.reply) continue
    const locale = determineReply(comment.text).locale
    reply.text = withSource(answered.reply.answer, answered.reply, locale)
    reply.pending = false
    reply.created_at = new Date().toISOString()
    const trace = store.traces.find(({ comment_id }) => comment_id === comment.id)
    if (trace) trace.replied_at = reply.created_at
    changed = true
  }
  if (changed) save(store)
}

export async function getInstagramFeed(): Promise<InstagramFeed> {
  const store = load()
  await refreshPending(store)
  return { post_id: postId, comments: store.comments.map(strip), traces: structuredClone(store.traces) }
}

export async function postInstagramComment(author: string, text: string): Promise<InstagramTrace> {
  const receivedAt = new Date().toISOString()
  const { session_id } = await createChatSession()
  const reply = await sendChatMessage(session_id, text, { channel: 'instagram' })
  const info = determineReply(text)
  const id = `ig-${uuid()}`
  const comment: StoredComment = {
    id, author, text, created_at: receivedAt, is_bot: false, replies: [], session_id,
  }
  const trace: InstagramTrace = {
    comment_id: id,
    received_at: receivedAt,
    level: info.refused ? 'hidden' : reply.level,
    lang: info.locale,
    topic: info.refused ? undefined : info.topic,
    documents: reply.citations.length,
    ticket_number: reply.ticket_number,
    replied_at: null,
  }

  if (info.refused) {
    const abusive = abusiveWords.test(text.toLowerCase().replace(/[ʻʼ‘’`´]/g, "'"))
    comment.hidden = abusive
    trace.reason = abusive ? 'abuse' : 'off_topic'
  } else {
    const answer = botReply(reply, info.locale)
    const repliedAt = new Date(Date.now() + 900).toISOString()
    comment.replies.push({
      id: `${id}-reply`, author: botName, text: answer.text, created_at: repliedAt,
      is_bot: true, pending: answer.pending, replies: [],
    })
    if (!answer.pending) trace.replied_at = repliedAt
  }

  const store = load()
  store.comments.unshift(comment)
  store.traces = [trace, ...store.traces].slice(0, 20)
  save(store)
  return trace
}
