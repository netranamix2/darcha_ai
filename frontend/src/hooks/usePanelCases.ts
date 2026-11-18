import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { getInbox, getStaff, getTickets, subscribeToCaseChanges } from '../api/client'
import { analyticsKey } from './useAnalytics'

export const ticketsKey = ['tickets'] as const
export const inboxKey = ['inbox'] as const

export function useTicketRecords(live = false) {
  return useQuery({
    queryKey: ticketsKey,
    queryFn: getTickets,
    refetchInterval: live ? 5_000 : false,
    staleTime: 4_000,
    retry: false,
  })
}

export function useInboxRecords() {
  return useQuery({
    queryKey: inboxKey,
    queryFn: () => getInbox(),
    staleTime: 4_000,
    retry: false,
  })
}

export function useStaffRecords() {
  return useQuery({
    queryKey: ['staff'],
    queryFn: getStaff,
    staleTime: 10 * 60_000,
    retry: false,
  })
}

export function usePanelCaseSubscription() {
  const client = useQueryClient()

  useEffect(() => subscribeToCaseChanges((kind) => {
    if (kind === 'report') return
    void client.invalidateQueries({ queryKey: ticketsKey })
    void client.invalidateQueries({ queryKey: inboxKey })
    void client.invalidateQueries({ queryKey: analyticsKey })
  }), [client])
}
