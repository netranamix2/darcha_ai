import { Globe2, Instagram, Send } from 'lucide-react'
import type { Channel, InboxItem, Level } from '../../api/types'

export const inboxChannel = {
  web: { icon: Globe2, label: 'inbox.channelWeb' },
  instagram: { icon: Instagram, label: 'inbox.channelInstagram' },
  telegram: { icon: Send, label: 'inbox.channelTelegram' },
} as const satisfies Record<Channel, { icon: typeof Globe2; label: string }>

export function isTicketed(item: InboxItem) {
  return Boolean(item.ticket_id || item.ticket_number)
}

export function isDraft(item: InboxItem) {
  return item.level === 'yellow' && item.status === 'draft' && !isTicketed(item)
}

export function inboxTone(item: InboxItem): Level {
  if (isTicketed(item) || item.level === 'red' || item.status === 'rejected') return 'red'
  return isDraft(item) ? 'yellow' : 'green'
}

export function inboxStatus(item: InboxItem) {
  if (isTicketed(item)) return 'inbox.statusTicket'
  if (item.status === 'rejected') return 'inbox.statusRejected'
  if (isDraft(item)) return 'inbox.statusDraft'
  if (item.level === 'red' && item.status === 'draft') return 'inbox.statusReview'
  return 'inbox.statusSent'
}
