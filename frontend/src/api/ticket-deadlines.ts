const tashkentOffsetMs = 5 * 60 * 60 * 1_000

export function getTicketExtensionLimit(dueAt: string): string {
  const deadline = Date.parse(dueAt)
  if (!Number.isFinite(deadline)) return ''

  const localDate = new Date(deadline + tashkentOffsetMs)
  const day = localDate.getUTCDate()
  localDate.setUTCDate(1)
  localDate.setUTCMonth(localDate.getUTCMonth() + 1)
  const end = new Date(localDate)
  end.setUTCMonth(end.getUTCMonth() + 1, 0)
  localDate.setUTCDate(Math.min(day, end.getUTCDate()))
  return new Date(localDate.getTime() - tashkentOffsetMs).toISOString()
}
