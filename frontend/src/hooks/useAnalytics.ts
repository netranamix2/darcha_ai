import { queryOptions, useQuery } from '@tanstack/react-query'
import { getAnalyticsSummary } from '../api/client'
import { analyticsRange } from '../lib/analytics-date'

export const analyticsKey = ['analytics'] as const

function summaryQuery({ from, to }: { from: string; to: string }) {
  return queryOptions({
    queryKey: [...analyticsKey, from, to],
    queryFn: () => getAnalyticsSummary(from, to),
    staleTime: 10_000,
    retry: false,
  })
}

export function useAnalytics(days: number, now: number) {
  const current = useQuery({ ...summaryQuery(analyticsRange(days, now)), refetchInterval: 15_000 })
  const previous = useQuery(summaryQuery(analyticsRange(days, now, days)))
  const lastFourteen = useQuery(summaryQuery(analyticsRange(14, now)))

  return { current, previous, lastFourteen }
}
