// Public channel links shown on the landing page (hero, channel cards, header, footer).
// VITE_TG_BOT_URL: https link to the public Telegram bot, e.g. https://t.me/<bot username>.
function telegramUrl(): string | null {
  const value: unknown = import.meta.env.VITE_TG_BOT_URL
  if (typeof value !== 'string' || !value.trim()) return null
  try {
    const url = new URL(value.trim())
    return url.protocol === 'https:' && !url.username && !url.password ? url.href : null
  } catch {
    return null
  }
}

export const telegramBotUrl = telegramUrl()
export const instagramDemoPath = '/demo/instagram'

/** Smoothly scroll to the site chat and focus its input. */
export function scrollToChat(reducedMotion: boolean | null): boolean {
  const section = document.getElementById('chat')
  if (!section) return false
  section.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'start' })
  window.history.replaceState(null, '', '#chat')
  section.querySelector<HTMLTextAreaElement>('textarea:not(:disabled)')?.focus({ preventScroll: true })
  return true
}
