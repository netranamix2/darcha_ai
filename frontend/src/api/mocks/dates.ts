export const dayMs = 24 * 60 * 60 * 1000
const tashkentOffsetMs = 5 * 60 * 60 * 1000
const calendarDatePattern = /^\d{4}-\d{2}-\d{2}$/

export function dateKey(timestamp: number) {
  return new Date(timestamp + tashkentOffsetMs).toISOString().slice(0, 10)
}

export function dateBoundary(value: string, end = false) {
  const timestamp = Date.parse(value)
  if (!calendarDatePattern.test(value)) return timestamp
  return timestamp - tashkentOffsetMs + (end ? dayMs - 1 : 0)
}
