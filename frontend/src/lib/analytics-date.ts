import { formatChatDate } from '../i18n/chat'
import type { Language } from '../i18n/locales'

const dayMs = 86_400_000
const tashkentOffset = 5 * 3_600_000
const clock = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Tashkent',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
})

function localDateKey(timestamp: number) {
  return new Date(timestamp + tashkentOffset).toISOString().slice(0, 10)
}

export function analyticsRange(days: number, now: number, offset = 0) {
  const end = now - offset * dayMs
  return { from: localDateKey(end - (days - 1) * dayMs), to: localDateKey(end) }
}

export function analyticsTimestamp(timestamp: string | number, language: Language) {
  const date = new Date(timestamp)
  const day = formatChatDate(date, language)
  return day ? `${day} · ${clock.format(date)}` : '—'
}
